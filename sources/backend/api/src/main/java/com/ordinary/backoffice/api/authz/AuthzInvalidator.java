package com.ordinary.backoffice.api.authz;

import jakarta.servlet.http.HttpSession;
import java.util.Collection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Component;

/**
 * <b>남의 세션</b>에 재계산 표시를 세운다 — security-design.md §4 권한 캐싱.
 *
 * <p>{@link AuthzSession#markDirty} 는 <i>이 요청의 세션</i> 하나를 다룬다. 그것으로는 모자란
 * 자리가 역할 화면이다: <b>역할 권한을 고치거나 역할을 끄면 보유자 전원의 유효 권한이
 * 바뀌는데</b>(62 §2.5 · §3.6) 그 사람들은 지금 다른 세션에 들어와 있다. security-design.md §4 가
 * {@code SYS_USER_ROLE} 역방향 조회로 <b>보유자 전원</b>의 세션을 찾아 같은 플래그를 세우라고
 * 한 것이 이 컴포넌트이며, {@code AuthzSession} 이 <i>"부를 화면(AUTHZ-02·03)이 아직
 * 없다 — 역할 관리 슬라이스가 그것을 잇는다"</i> 고 적어 둔 자리를 닫는다.
 *
 * <h2>권한 집합을 미리 계산해 넣지 않는다</h2>
 *
 * 플래그만 세운다. 보유자가 100명이어도 <b>다음 요청에서 각자 계산</b>하며, 로그인하지 않은
 * 사용자는 계산조차 하지 않는다 — 그 판단은 {@code AuthzSession} 이 이미 적어 두었다.
 *
 * <h2>{@code SessionRegistry} 가 아니라 세션 저장소를 직접 쓴다</h2>
 *
 * {@code SpringSessionBackedSessionRegistry} 는 <b>세션을 나열</b>할 뿐 그 속성을 고칠 수단을
 * 주지 않는다(만료시키는 것은 된다 — 그것은 강제 로그아웃이고 여기서 하려는 일이 아니다).
 * 필요한 것은 {@code principal → 세션들} 인덱스이므로 그 인덱스를 가진
 * {@link FindByIndexNameSessionRepository} 를 그대로 쓴다 — security-design.md §4-1 이 동시 접속 제어를
 * 위해 이미 요구한 <b>같은 부품</b>이다.
 *
 * <h2>이 요청의 세션은 <b>저장소로 건드리지 않는다</b></h2>
 *
 * <p>{@link AuthzSession#markDirty} 가 이미 그 일을 하고, 그 쓰기는 <b>요청이 끝날 때</b>
 * 세션 저장소로 나간다. 여기서 같은 세션을 저장소로 한 번 더 쓰면 <b>같은 속성을 두 번
 * 넣는다</b> — Spring Session JDBC 는 새 속성을 {@code INSERT} 하므로
 * {@code (SESSION_PRIMARY_ID, ATTRIBUTE_NAME)} 이 겹쳐 <b>중복 키로 터진다</b>.
 *
 * <p><b>딱 한 번만 터지는 것이 이 결함의 얼굴이었다</b>(2026-08-30 실물 — 첫 저장이 500,
 * 같은 조작을 다시 하면 200). 플래그가 <b>처음 서는 그 요청</b>에서만 둘 다 {@code INSERT}
 * 이고, 그 뒤로는 둘 다 {@code UPDATE} 라 조용히 지나간다 — 재현되지 않는다고 없는 것이
 * 아니었다.
 *
 * <p>업무 트랜잭션은 이미 커밋된 뒤라 데이터는 멀쩡했고, <b>화면만 500 을 봤다</b>. 그것이
 * 더 나쁘다: 저장은 됐는데 실패로 보이므로 사용자가 같은 저장을 다시 누른다.
 *
 * <h2>인덱스가 없으면 <b>현재 세션만</b> 표시하고 경고한다</h2>
 *
 * 스토어가 아예 없으면(서블릿 컨테이너 세션) 다른 세션에 닿을 방법이 없다. {@code SecurityConfig}
 * 가 <i>스토어는 있는데 인덱스가 없는</i> 배포를 기동 실패로 막아 두었으므로 여기 남는 경우는
 * <b>{@code none} 하나</b>이며, 그것은 <b>선택된 동작</b>이다(단일 노드 · 개발).
 *
 * <p>그래도 <b>자기 세션은 반드시 표시한다.</b> 관리자가 자기 역할의 권한을 고치는 일이
 * 흔하고, 그때 자기 화면의 버튼이 옛 권한으로 남아 있으면 <i>고쳤는데 안 바뀐다</i> 로 읽힌다.
 */
@Component
public class AuthzInvalidator {

    private static final Logger log = LoggerFactory.getLogger(AuthzInvalidator.class);

    private final ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> indexed;

    public AuthzInvalidator(
            ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> indexed) {
        this.indexed = indexed;
    }

    /**
     * @param userIds 유효 권한이 바뀐 사람들. <b>비어 있으면 아무 일도 하지 않는다</b> — 이름만
     *     고친 저장에서 전원을 재계산시킬 이유가 없다
     * @param current 이 요청의 세션. 인덱스가 없는 배포에서 <b>유일하게 닿을 수 있는 세션</b>
     *     이며, 인덱스가 있어도 지금 사람이 대상이면 어차피 함께 표시된다
     * @param currentUserId 이 요청을 보낸 사람. {@code userIds} 에 들어 있을 때만 자기 세션을
     *     건드린다 — 남의 권한을 고쳤을 뿐인데 자기 것을 다시 계산할 이유가 없다
     */
    public void markDirty(Collection<String> userIds, HttpSession current, String currentUserId) {
        if (userIds.isEmpty()) {
            return;
        }
        if (userIds.contains(currentUserId)) {
            AuthzSession.markDirty(current);
        }
        FindByIndexNameSessionRepository<? extends Session> repository = indexed.getIfAvailable();
        if (repository == null) {
            // 컨테이너 세션이다 — 다른 노드는커녕 같은 노드의 다른 세션에도 닿지 못한다.
            log.warn(
                    "세션 인덱스가 없어 보유자 {}명의 권한 재계산을 예약하지 못했다 — 각자 다음"
                            + " 로그인에서 반영된다(security-design.md §4-1 · ADR-0002)",
                    userIds.size());
            return;
        }
        userIds.forEach(userId -> mark(repository, userId, current.getId()));
    }

    /**
     * 와일드카드를 <b>타입 변수로 잡는다</b>. {@code ? extends Session} 인 채로는
     * {@code save(S)} 를 부를 수 없다 — 읽어 온 세션이 그 저장소의 것이라는 사실을 컴파일러가
     * 다시 확인해 주는 자리이며, 캐스트로 뭉개는 것보다 낫다.
     */
    private static <S extends Session> void mark(
            FindByIndexNameSessionRepository<S> repository, String userId, String currentId) {
        repository.findByPrincipalName(userId).forEach((sessionId, session) -> {
            // 이 요청의 세션은 위에서 이미 표시했고, 그 쓰기는 요청이 끝날 때 나간다.
            if (sessionId.equals(currentId)) {
                return;
            }
            session.setAttribute(AuthzSession.DIRTY, Boolean.TRUE);
            repository.save(session);
        });
    }
}
