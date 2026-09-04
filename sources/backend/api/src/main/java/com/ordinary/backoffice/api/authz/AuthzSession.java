package com.ordinary.backoffice.api.authz;

import com.ordinary.backoffice.domain.authz.EffectiveAuthority;
import jakarta.servlet.http.HttpSession;

/**
 * 유효 권한이 사는 자리 — security-design.md §4 권한 캐싱.
 *
 * <p><b>공유 캐시(Redis)가 아니라 세션인 이유</b> — 세션은 어차피 매 요청 조회되므로 추가
 * 왕복이 없고, 세션 스토어가 공유라 다중 노드에서 노드마다 다른 값을 가질 수 없다. 그리고
 * 그 사용자의 세션만 건드리면 되므로 <b>폴링 지연 없이 즉시</b> 반영된다(ADR-0017).
 *
 * <p><b>재계산 신호가 둘이고 둘을 함께 봐야 한다.</b>
 *
 * <pre>
 * authzDirty == true  또는  authzCalcDate != 업무시간대_오늘  → 재계산
 * </pre>
 *
 * <p>플래그만 두면 <b>날짜 경과가 샌다</b> — {@code VALID_TO_DT} 가 어제까지인 부여는 아무도
 * 값을 바꾸지 않았으므로 플래그가 서지 않는다. 날짜만 두면 관리자의 즉시 회수가 자정까지
 * 반영되지 않는다.
 */
public final class AuthzSession {

    /** {@link EffectiveAuthority} 는 직렬화 가능해야 한다 — JDBC·Redis 스토어를 지나간다. */
    static final String AUTHORITY = "BACKOFFICE_AUTHZ";

    static final String DIRTY = "BACKOFFICE_AUTHZ_DIRTY";

    private AuthzSession() {}

    /**
     * 세션에 담긴 유효 권한. <b>인가 인터셉터가 이미 최신으로 만들어 둔 값</b>이다 —
     * {@code /api/**} 는 전부 인터셉터를 지나므로 컨트롤러가 다시 계산할 이유가 없다.
     *
     * <p>{@code null} 이면 인터셉터가 돌지 않았다는 뜻이며 그것은 배선 결함이다.
     * 부르는 쪽은 <b>계산으로 메우지 말고 실패시켜야</b> 한다 — 조용히 메우면 판정 자리가
     * 둘이 되고, security-design.md §4 가 인터셉터 한 곳으로 모아 둔 것이 흩어진다.
     */
    public static EffectiveAuthority read(HttpSession session) {
        Object value = session.getAttribute(AUTHORITY);
        return value instanceof EffectiveAuthority authority ? authority : null;
    }

    /**
     * 계산 결과를 담고 <b>dirty 플래그를 함께 지운다</b> — 둘이 갈리면 재계산 직후에도
     * 플래그가 서 있어 매 요청 다시 계산한다.
     *
     * <p>부르는 곳이 둘이다 — 로그인 시 최초 적재({@code LoginService})와 낡았을 때의
     * 갱신({@code AuthorizationInterceptor}).
     */
    public static void write(HttpSession session, EffectiveAuthority authority) {
        session.setAttribute(AUTHORITY, authority);
        session.removeAttribute(DIRTY);
    }

    static boolean isDirty(HttpSession session) {
        return Boolean.TRUE.equals(session.getAttribute(DIRTY));
    }

    /**
     * 다음 요청에서 다시 계산하게 한다.
     *
     * <p><b>권한 집합을 미리 계산해 넣지 않는다.</b> 역할 하나를 바꾸면 보유자가 100명일 수
     * 있고, 플래그를 세우는 편이 훨씬 가벼우며 로그인하지 않은 사용자는 계산조차 하지 않는다.
     *
     * <p><b>지금 이 메서드를 부르는 곳은 이 사용자의 세션 하나뿐이다.</b> security-design.md §4 는 역할 권한이
     * 바뀌면 {@code SYS_USER_ROLE} 역방향 조회로 <b>보유자 전원</b>의 세션을 찾아 같은 플래그를
     * 세우라고 한다 — 그 세션 검색은 {@code FindByIndexNameSessionRepository} 를 쓰며
     * ({@code §4-1} 의 {@code SpringSessionBackedSessionRegistry} 와 같은 부품),
     * <b>부를 화면(AUTHZ-02·03)이 아직 없다.</b> 역할 관리 슬라이스가 그것을 잇는다.
     * {@link com.ordinary.backoffice.domain.authz.repository.SysUserRoleRepository#findUserIdsByRoleId}
     * 가 그때 쓰일 대상 조회다.
     */
    public static void markDirty(HttpSession session) {
        session.setAttribute(DIRTY, Boolean.TRUE);
    }
}
