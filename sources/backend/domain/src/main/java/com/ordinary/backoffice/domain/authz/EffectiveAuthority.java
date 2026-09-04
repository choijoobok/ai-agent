package com.ordinary.backoffice.domain.authz;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

/**
 * 세션에 담기는 유효 권한 — security-design.md §4 권한 캐싱.
 *
 * <p><b>담는 것은 계산 결과뿐이다.</b> 역할 목록·개인 예외·유효기간은 계산 <b>입력</b>이며
 * 담지 않는다 — 담으면 매 요청 재계산해야 한다.
 *
 * <p><b>{@code calcDate} 가 함께 있는 것이 핵심이다.</b> ② 필터에 날짜가 들어가므로
 * <b>아무도 아무것도 바꾸지 않아도 캐시가 낡는다</b> — 어제 만료된 부여가 캐시에 살아 있다.
 * 데이터 변경만 무효화 신호로 두면 이 경로가 새어 나간다.
 *
 * <p>TTL 을 쓰지 않는 이유는 판정 단위가 <b>날짜</b>(양끝 포함)라 값이 바뀔 수 있는 순간이
 * <b>업무 시간대의 자정 한 번</b>뿐이기 때문이다. TTL 은 "언제 반영되나" 를 흐리고 날짜가
 * 안 바뀌는 동안에도 재계산을 만든다.
 *
 * @param grants (메뉴, 액션) 쌍의 집합. <b>게이트(④)를 이미 통과한 것</b>이다
 * @param calcDate 계산 시점의 <b>업무 시간대</b> 날짜
 */
public record EffectiveAuthority(Set<MenuAction> grants, LocalDate calcDate)
        implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 토큰({@code MENU_CD:ACTION})에 나타날 수 없는 문자다 — 없으면 다른 집합이 같은 문자열로 접힌다. */
    private static final String SEPARATOR = "|";

    /** 판정 한 줄. 인가 인터셉터가 매 요청 부르는 유일한 메서드다. */
    public boolean allows(String menuCd, ActionType action) {
        return grants.contains(new MenuAction(menuCd, action));
    }

    /** 공집합이면 로그인이 차단된다 — security-design.md §4. */
    public boolean isEmpty() {
        return grants.isEmpty();
    }

    /**
     * 이 집합의 <b>내용 해시</b> — 50 §8.1 의 {@code X-Authz-Version}.
     *
     * <p><b>시점이 아니라 내용이다.</b> 시점으로 만들면 노드마다 적재 시각이 달라 같은 권한에
     * 다른 버전이 나오고, 요청이 노드를 옮겨 다닐 때마다 헛 재조회가 걸린다. 내용 해시는
     * 어느 노드에서 계산해도 같다.
     *
     * <p><b>단조 증가 카운터가 아닌 것도 결정이다.</b> 권한을 뺐다가 되돌리면 감지되지 않는데,
     * <b>결과가 같으므로 다시 받을 이유도 없다</b>.
     *
     * <p><b>담아 두지 않고 매번 계산한다.</b> 50 §8.1 은 재계산 때 한 번 계산해 세션에 함께
     * 담는 것으로 적었으나, 세션 스토어가 JDBC·Redis 면 <b>세션 속성이 매 요청 역직렬화되므로</b>
     * 담아 두어도 그 순간 다시 만들어진다 — 필드를 하나 늘려 얻는 것이 없다. 비용은 토큰 수십
     * 개에 대한 SHA-256 한 번이다.
     */
    public String version() {
        return sha256Hex(String.join(SEPARATOR, permissionTokens()));
    }

    /**
     * 이 캐시를 다시 계산해야 하는가.
     *
     * <p>날짜만 본다. {@code authzDirty} 플래그는 세션 속성이라 여기서 볼 수 없고,
     * 인터셉터가 <b>둘을 함께</b> 본다.
     */
    public boolean isStale(LocalDate businessToday) {
        return !calcDate.equals(businessToday);
    }

    /** 프론트가 받는 것은 평탄화된 문자열이다 — 역할명으로 분기하지 않게 하려는 것이다(security-design.md §4). */
    public List<String> permissionTokens() {
        return grants.stream().map(MenuAction::toToken).sorted().toList();
    }

    /**
     * 접근 가능한 메뉴 코드. <b>액션 무관하게 하나라도 있으면</b> 목록에 든다.
     *
     * <p>트리는 이 집합에서 조상을 역산해 만든다(AUTHZ-04) —
     * {@link com.ordinary.backoffice.domain.authz.service.MenuTreeService} 가 이 목록을 입력으로
     * 받는다. <b>역산이 여기 없는 것이 결정이다</b>: 조상은 권한 판정에 참여하지 않으므로
     * (security-design.md §4 경로 결합 기각) 판정 결과를 담는 이 값이 트리 구조를 알 이유가 없다.
     */
    public List<String> menuCodes() {
        return grants.stream()
                .map(MenuAction::menuCd)
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    /**
     * <b>앞 16자만 쓴다.</b> 이 값이 지키는 것은 비밀이 아니라 <i>"달라졌는가"</i> 이며,
     * 64비트 충돌은 같은 사용자의 연속된 두 권한 집합 사이에서 실질적으로 일어나지 않는다.
     * 응답 헤더에 매번 실리므로 짧을수록 좋다.
     */
    private static String sha256Hex(String source) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(source.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 8);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 은 모든 JVM 이 제공해야 하는 알고리즘이다 — 없으면 환경이 깨진 것이다.
            throw new IllegalStateException(e);
        }
    }
}
