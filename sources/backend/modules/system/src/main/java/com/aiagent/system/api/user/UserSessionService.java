// @feat FEAT-501
package com.aiagent.system.api.user;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.auth.service.LoginHistoryService;
import com.aiagent.domain.auth.service.LoginHistoryService.LoginOrigin;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;

/**
 * 활성 세션 조회와 강제 로그아웃 — AUTH-10 · screen/admin/system/user/requirements.md.
 *
 * <h2>화면이 스토어를 모른다</h2>
 *
 * <p>세션 스토어는 JDBC / Redis 선택형이지만(backend/session.md) 이 서비스는 그것을 묻지 않는다.
 * {@link FindByIndexNameSessionRepository#findByPrincipalName} 이 둘을 <b>같은
 * 인터페이스</b>로 덮으며, 넘기는 것은 사용자 ID 하나다.
 *
 * <p><b>폴백을 두지 않는다</b>(2026-08-30 확정). 갈리는 것은 구현이 아니라 <b>설정 한
 * 줄</b>이었고 — Redis 구현 둘 중 인덱스를 가진 것은 {@code RedisIndexedSessionRepository}
 * 하나인데 {@code repository-type} 의 기본값이 인덱스 없는 쪽이다 — 인덱스가 없으면 탭이
 * 비는 것으로 끝나지 않고 <b>동시 접속 제어가 무력해진다</b>. 그래서 {@code SecurityConfig}
 * 가 그 배포를 <b>기동 실패</b>로 막는다(backend/security.md).
 *
 * <p>여기 남는 것은 {@code store-type: none} 하나이며 그것은 <b>선택된 동작</b>이다(단일
 * 노드 · 개발). 그때는 <b>빈 목록이 아니라 오류</b>를 낸다 — 빈 목록은 <i>"아무 데도 안
 * 들어와 있다"</i> 로 읽히고, 이 탭이 하는 일이 <i>끊을까 말까</i> 이므로 그 거짓말의
 * 대가가 크다.
 *
 * <h2>{@code AuthzInvalidator} 와 같은 부품을 다르게 쓴다</h2>
 *
 * <p>저기는 세션의 <b>속성을 고쳐</b> 다음 요청에서 권한을 다시 계산하게 하고, 여기는
 * 세션을 <b>지운다</b>. 그래서 저기가 <i>"만료시키는 것은 강제 로그아웃이고 여기서 하려는
 * 일이 아니다"</i> 라고 적어 둔 그 일이 이것이다.
 */
@Service
public class UserSessionService {

    /**
     * 짝지을 로그인을 <b>몇 건까지 읽나</b> — screen/admin/system/user/requirements.md.
     *
     * <p>활성 세션 하나마다 로그인 하나가 대응하므로 필요한 것은 <i>세션 수만큼</i> 이다.
     * 그보다 넉넉히 읽는 것은 <b>결과 코드가 인덱스에 없어</b>({@code IX_SYS_LO_LOGIN_03})
     * 성공만 골라내는 일이 읽은 뒤에 일어나기 때문이며, 실패가 몰린 계정에서 성공 한 건을
     * 놓치지 않을 만큼이다.
     *
     * <p><b>세션 수만큼 질의하지 않는다.</b> 한 사람의 활성 세션은 많아야 몇 개이고 후보
     * 목록도 작으므로, <b>한 번 읽어 메모리에서 짝짓는</b> 편이 세션마다 <i>가장 가까운
     * 로그인</i> 을 SQL 로 찾는 것보다 싸다 — 그 질의는 벤더마다 모양이 갈리는 상관
     * 서브쿼리다(backend/persistence.md).
     */
    private static final int LOGIN_SCAN = 50;

    /**
     * 세션 생성과 이력 기록 사이의 <b>허용 간격</b>.
     *
     * <p>정상은 몇 ms 다(같은 요청 안이다). 1분을 두는 것은 로그인 후처리 체인이 메일·알림
     * 같은 일을 함께 하는 배포를 위한 여유이며, <b>넓히지 않는다</b> — 넓히면 <i>조금 전
     * 다른 브라우저에서 한 로그인</i> 이 이 세션의 값으로 붙는다.
     */
    private static final Duration MATCH_WINDOW = Duration.ofMinutes(1);

    private final ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> indexed;
    /**
     * 이력을 <b>도메인 서비스로</b> 읽는다 — 저장소를 직접 부르지 않는다(backend/packages.md).
     *
     * <p>{@code api} 모듈에는 spring-data-jpa 가 없다. 그것이 <b>경계의 집행</b>이며(빌드가
     * 막는다 — 원칙 P1) 여기서 필요한 것은 <i>성공 로그인 몇 건</i> 이라는 값이다.
     */
    private final LoginHistoryService history;

    public UserSessionService(
            ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> indexed,
            LoginHistoryService history) {
        this.indexed = indexed;
        this.history = history;
    }

    /**
     * 이 사람의 활성 세션 — <b>최근 접근이 늦은 것부터</b>.
     *
     * <p>정렬 기준이 <i>끊을까 말까</i> 를 가르는 값이다(screen/admin/system/user/requirements.md). 생성 시각 순으로 두면
     * <b>오래 켜 둔 채 쓰지 않는 세션</b>이 목록 뒤로 밀리는데, 그것이 정확히 찾는 것이다.
     *
     * @param currentSessionId 이 요청의 세션. 목록에서 <b>표시만</b> 하며 빼지 않는다 —
     *     빼면 <i>내가 지금 여기 있다</i> 는 사실이 화면에서 사라진다
     */
    public List<UserSessionRow> list(String userId, String currentSessionId) {
        Map<String, ? extends Session> sessions = repository().findByPrincipalName(userId);
        // 세션이 없으면 이력을 읽지 않는다 — 짝지을 것이 없는데 왕복을 하나 쓰게 된다.
        List<LoginOrigin> logins = sessions.isEmpty()
                ? List.of()
                : history.findRecentSuccess(userId, LOGIN_SCAN);

        return sessions.values().stream()
                .map(session -> {
                    LoginOrigin origin = originOf(logins, session.getCreationTime());
                    return new UserSessionRow(
                            session.getId(),
                            session.getId().equals(currentSessionId),
                            session.getCreationTime(),
                            session.getLastAccessedTime(),
                            session.getLastAccessedTime().plus(session.getMaxInactiveInterval()),
                            origin == null ? null : origin.clientIp(),
                            origin == null ? null : origin.userAgent());
                })
                .sorted(Comparator.comparing(UserSessionRow::lastAccessedDtm).reversed())
                .toList();
    }

    /**
     * 이 세션을 만든 로그인 — <b>생성 시각에 가장 가까운 것</b>이다.
     *
     * <p><b>이전/이후로 자르지 않는다.</b> 순서가 <i>인증 → 세션 생성 → 이력 기록</i> 이라
     * 이력의 시각이 세션 생성보다 <b>몇 ms 뒤</b>인 것이 정상인데, 그 앞뒤는 배포와 부하에
     * 따라 뒤집힐 수 있다 — <i>이전 것 중 가장 늦은 것</i> 으로 잡으면 그때 <b>직전 로그인의
     * 값</b>이 붙는다. 거리로 재면 어느 쪽이든 같은 답이다.
     *
     * <p><b>창을 벗어나면 짝이 없다</b>({@link #MATCH_WINDOW}). 이력이 파기됐거나(retention.md)
     * 로그인 없이 만들어진 세션이며, 그때는 <b>빈 칸이 정직하다</b> — 가장 가까운 것을
     * 무조건 붙이면 <i>어제 로그인의 IP</i> 가 오늘 세션의 값으로 보인다.
     */
    private static LoginOrigin originOf(List<LoginOrigin> logins, Instant createdAt) {
        LoginOrigin best = null;
        Duration bestGap = null;
        for (LoginOrigin login : logins) {
            Duration gap = Duration.between(login.at(), createdAt).abs();
            if (gap.compareTo(MATCH_WINDOW) > 0) {
                continue;
            }
            if (bestGap == null || gap.compareTo(bestGap) < 0) {
                best = login;
                bestGap = gap;
            }
        }
        return best;
    }

    /**
     * 강제 종료 — <b>그 사람의 세션만</b> 끊는다.
     *
     * <p>세션 ID 만으로도 지울 수는 있지만 그러면 <b>ID 를 알아낸 요청이 무엇이든 끊는다</b>.
     * 목록에 뜬 것만 끊게 하려면 <i>이 세션이 그 사람의 것인가</i> 를 서버가 다시 봐야 하고,
     * 그 확인이 여기 있다(sys/menu.md 원칙 P1) — 인덱스 조회의 결과가 그 판정의 근거다.
     *
     * <p><b>없는 세션은 조용히 넘어간다.</b> 이미 끊겼거나 만료된 것이며, 그것은 실패가
     * 아니라 <i>이미 이뤄진 상태</i>다 — 잠금 해제가 잠기지 않은 계정을 오류로 보지 않는
     * 것과 같다(screen/admin/system/user/requirements.md).
     *
     * <p><b>{@code SYS_USER} 는 바뀌지 않는다</b>(screen/admin/system/user/requirements.md). 끊긴 사람은 <b>다시 로그인할
     * 수 있다</b> — 막으려면 {@code USE_YN='N'} 이고 그것은 다른 축이다(sys/user-role.md).
     *
     * @return 실제로 끊은 수. 화면이 <i>N건을 종료했습니다</i> 로 낸다 — 고른 수와 다를 수
     *     있고, 다른 것이 <b>사실</b>이다
     */
    public int kill(String userId, List<String> sessionIds) {
        return killWith(repository(), userId, sessionIds);
    }

    /**
     * 와일드카드를 <b>타입 변수로 잡는다</b> — {@code ? extends Session} 인 채로는
     * {@code deleteById} 를 부를 수 있지만 {@code findByPrincipalName} 의 결과와 같은
     * 저장소라는 것을 컴파일러가 확인해 주지 않는다. {@code AuthzInvalidator#mark} 와 같은
     * 장치이며, 캐스트로 뭉개는 것보다 낫다.
     */
    private static <S extends Session> int killWith(
            FindByIndexNameSessionRepository<S> repository, String userId, List<String> sessionIds) {

        Map<String, S> mine = repository.findByPrincipalName(userId);
        int killed = 0;
        for (String sessionId : sessionIds) {
            if (mine.containsKey(sessionId)) {
                repository.deleteById(sessionId);
                killed++;
            }
        }
        return killed;
    }

    private FindByIndexNameSessionRepository<? extends Session> repository() {
        FindByIndexNameSessionRepository<? extends Session> found = indexed.getIfAvailable();
        if (found == null) {
            throw new BusinessException(
                    UserSessionErrorCode.INDEX_MISSING,
                    "세션 인덱스가 없다 — store-type: none 이다(backend/session.md)");
        }
        return found;
    }
}
