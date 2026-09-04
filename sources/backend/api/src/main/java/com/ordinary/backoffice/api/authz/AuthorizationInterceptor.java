package com.ordinary.backoffice.api.authz;

import com.ordinary.backoffice.api.auth.SessionKeys;
import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.error.CommonErrorCode;
import com.ordinary.backoffice.domain.authz.ApiAuthorityFact;
import com.ordinary.backoffice.domain.authz.EffectiveAuthority;
import com.ordinary.backoffice.domain.authz.service.ApiAuthorityRegistry;
import com.ordinary.backoffice.domain.authz.service.EffectiveAuthorityService;
import com.ordinary.backoffice.domain.user.entity.SysUser;
import com.ordinary.backoffice.domain.user.service.UserAccountService;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.AuthLoginProps;
import com.ordinary.backoffice.support.time.BusinessCalendar;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 인가 판정 — security-design.md §4. <b>여기가 유일한 판정 자리다.</b>
 *
 * <pre>
 * 요청 → /api/public 익명 통과 · /api/common 인증만 확인
 *     → /api/service 는 경로 완전 일치로 SYS_API 조회 → ACTION_CD 1개
 *     → 같은 경로의 SYS_MENU_API 조회 → MENU_CD N개
 *     → (메뉴, 액션) 조합 중 하나라도 유효 권한에 있는가 → 없으면 403
 *     → SYS_API 미등록도 403 · 메뉴 매핑 0건도 403 · 세 프리픽스 밖 /api/** 도 403
 * </pre>
 *
 * <p><b>{@code @PreAuthorize} 를 병행하지 않는다.</b> 같은 사실을 두 곳이 각자 판정하면
 * 어긋났을 때 실효 규칙이 둘의 AND 가 되어 <i>"권한 화면엔 체크돼 있는데 403"</i> 이 생기고
 * 원인은 다른 곳에 있다 — DENY·경로 결합을 기각한 것과 같은 이유다.
 *
 * <p><b>요청당 추가 쿼리 0 이 기본이다.</b> 참조하는 것은 기동 시 적재된
 * {@link ApiAuthorityRegistry} 와 세션의 유효 권한뿐이다. 쿼리가 도는 것은 <b>캐시가 낡았을
 * 때</b>(플래그 또는 날짜 경과) 한 번이며 그것도 그 사용자에 대해서만이다.
 *
 * <p><b>등록 순서가 규약이다</b> — 사용 이력 인터셉터가 이것보다 <b>앞</b>이어야 한다(architecture.md §6.1).
 * {@code preHandle} 이 거부해도 이미 {@code true} 를 반환한 인터셉터의
 * {@code afterCompletion} 은 호출되므로, 앞에 두어야 403 이 사용 이력에 남는다.
 * 그 인터셉터는 이력 슬라이스가 만든다.
 */
@Component
public class AuthorizationInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AuthorizationInterceptor.class);

    /**
     * 제한 세션에서도 열려 있는 경로 — 체인 #5 는 <b>차단이 아니라 유도</b>이기 때문이다.
     *
     * <p><b>비워 두지 않는다.</b> 비우면 비밀번호가 만료된 사용자가 로그인한 뒤 아무것도 할
     * 수 없고 로그아웃조차 못 한다 — 막다른 세션이 된다.
     *
     * <p>비밀번호 변경 화면(60 §4)은 아직 없다. 경로를 미리 적어 두는 이유는 그 슬라이스가
     * <b>컨트롤러만 추가하면 되게</b> 하려는 것이며, 없는 경로가 여기 있어도 무해하다 —
     * 핸들러가 없으면 404 다.
     */
    private static final Set<String> RESTRICTED_SESSION_ALLOWED = Set.of(
            "/api/common/auth/getMe",
            "/api/common/auth/logout",
            "/api/common/auth/heartbeat",
            "/api/common/auth/changePassword");

    private final ApiAuthorityRegistry registry;
    private final EffectiveAuthorityService authorities;
    private final UserAccountService userAccounts;
    private final ConfigLookup configs;
    private final BusinessCalendar calendar;

    public AuthorizationInterceptor(
            ApiAuthorityRegistry registry,
            EffectiveAuthorityService authorities,
            UserAccountService userAccounts,
            ConfigLookup configs,
            BusinessCalendar calendar) {
        this.registry = registry;
        this.authorities = authorities;
        this.userAccounts = userAccounts;
        this.configs = configs;
        this.calendar = calendar;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler) {

        String path = pathOf(request);
        ApiLayer layer = ApiLayer.of(path);

        // 정적 리소스·SPA 라우트. 보호 대상은 화면(코드)이 아니라 데이터다(security-design.md §4).
        if (layer == null || layer == ApiLayer.PUBLIC) {
            return true;
        }

        // 여기 도달했다는 것은 Security 가 이미 인증을 확인했다는 뜻이다. 그래도 세션을
        // 다시 확인하는 것은 필터 체인 설정이 바뀌었을 때 조용히 열리지 않게 하려는 것이다.
        HttpSession session = request.getSession(false);
        String userId = currentUserId();
        if (session == null || userId == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }

        // 체인 #5 — 제한 세션. 인가 판정보다 앞이다: 비밀번호를 바꾸기 전에는 권한이
        // 있든 없든 막힌다.
        if (isRestrictedSession(session) && !RESTRICTED_SESSION_ALLOWED.contains(path)) {
            throw new BusinessException(AuthzErrorCode.PASSWORD_CHANGE_REQUIRED);
        }

        // 유효 권한은 공통 API 에도 필요하다 — 낡았으면 여기서 계정 상태 재검사(#2~#4)가
        // 함께 돌기 때문이다. 공통 API 만 부르는 세션이 그 검사를 영원히 건너뛰면 안 된다.
        EffectiveAuthority authority = currentAuthority(session, userId);

        // 프론트의 메뉴 트리가 낡았는지 판정할 유일한 근거 — 50 §8.1. 판정 결과가 무엇이든
        // (403 도) 붙는다: 권한이 줄어서 거부된 것이면 그 사실을 알려야 할 이유가 더 크다.
        AuthzVersionHeader.stamp(response, authority);

        if (layer == ApiLayer.COMMON) {
            return true;
        }
        if (layer == ApiLayer.UNCLASSIFIED) {
            log.warn("세 프리픽스 밖의 API 요청 {} — 컨트롤러 경로를 고친다", path);
            throw new BusinessException(AuthzErrorCode.UNCLASSIFIED);
        }

        // 업무 API. 매칭은 패턴이 아니라 경로 완전 일치 — 해시 한 번이다.
        ApiAuthorityFact fact = registry
                .find(path)
                .orElseThrow(() -> {
                    log.warn("SYS_API 미등록 {} — API 마스터 시드를 확인한다", path);
                    return new BusinessException(AuthzErrorCode.NOT_REGISTERED);
                });

        if (!fact.isMapped()) {
            log.warn("SYS_MENU_API 매핑 0건 {} — 아무도 권한을 가질 수 없다", path);
            throw new BusinessException(AuthzErrorCode.NOT_MAPPED);
        }
        if (!fact.isAllowedBy(authority)) {
            // 이것만 설정 결함이 아니라 정상 동작이다. 그래서 warn 이 아니다.
            log.debug("권한 없음 user={} {} action={}", userId, path, fact.action());
            throw new BusinessException(AuthzErrorCode.NO_AUTHORITY);
        }
        return true;
    }

    // ── 캐시 ────────────────────────────────────────────────────────────

    /**
     * 세션의 유효 권한을 쓰되 <b>낡았으면 다시 계산한다</b> — security-design.md §4.
     *
     * <p>신호가 둘이고 <b>함께</b> 본다. {@code authzDirty} 는 데이터가 바뀐 것이고,
     * {@code authzCalcDate} 불일치는 <b>아무도 아무것도 바꾸지 않았는데 부여가 만료된 것</b>
     * 이다. 후자가 없으면 어제 만료된 권한이 세션이 끝날 때까지 살아 있다.
     *
     * <p>각 사용자가 <b>자정 이후 첫 요청에서 스스로</b> 재계산하므로, 자정에 활성 세션을
     * 찾아 순회하는 작업이 필요 없다(ADR-0017).
     */
    private EffectiveAuthority currentAuthority(HttpSession session, String userId) {
        EffectiveAuthority cached = AuthzSession.read(session);
        if (cached != null
                && !AuthzSession.isDirty(session)
                && !cached.isStale(calendar.today())) {
            return cached;
        }

        recheckAccountState(session, userId);

        EffectiveAuthority recalculated = authorities.calculate(userId);
        AuthzSession.write(session, recalculated);
        return recalculated;
    }

    /**
     * 접근 제어 체인 #2~#4 의 <b>세션 중 재검사</b> — security-design.md §4 의 체인 표.
     *
     * <p><b>재계산과 같은 순간에 도는 것이 설계다.</b> 매 요청 계정을 조회하면 요청당 쿼리 0
     * 이라는 전제가 깨지고, 아예 하지 않으면 <b>비활성화된 계정이 세션 만료까지 계속
     * 일한다</b>. 재계산 트리거는 셋 다 이 검사가 필요한 순간과 정확히 겹친다.
     *
     * <table>
     *   <tr><th>트리거</th><th>무엇을 잡나</th><th>지금 동작하나</th></tr>
     *   <tr><td>날짜 경과</td><td>계정 사용 기간 만료(#3) · 부여 만료</td><td><b>동작한다</b></td></tr>
     *   <tr><td>{@code authzDirty}</td><td>관리자의 {@code USE_YN} 해제 · 강제 잠금(#2·#4)</td>
     *       <td>플래그를 세우는 화면이 아직 없다 — {@link AuthzSession#markDirty}</td></tr>
     * </table>
     *
     * <p>그래서 <b>남는 창이 하나 있다</b>: 관리자가 계정을 비활성화해도 그 사용자의 세션은
     * 자정까지 살아 있다. 사용자 관리 슬라이스가 {@code markDirty} 를 부르면 닫힌다.
     * 강제 로그아웃(AUTH-10)은 세션 자체를 지우므로 이 경로와 무관하다.
     *
     * <p>실패하면 <b>세션을 무효화하고 401</b> 이다. 403 이 아닌 이유 — 권한의 문제가 아니라
     * 그 사람이 더는 로그인 상태일 수 없다는 뜻이며, 프론트는 401 에 재인증 모달을 띄운다.
     */
    private void recheckAccountState(HttpSession session, String userId) {
        SysUser user = userAccounts.find(userId).orElse(null);
        int lockReleaseMinutes = configs.get(AuthLoginProps.class).lockReleaseMinutes();

        boolean usable = user != null
                && Boolean.TRUE.equals(user.getUseYn())
                && user.isWithinValidPeriod(calendar.today())
                && !user.isLocked(calendar.now(), lockReleaseMinutes);

        if (!usable) {
            log.info("세션 중 계정 상태 재검사 실패 user={} — 세션을 끊는다", userId);
            session.invalidate();
            SecurityContextHolder.clearContext();
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
    }

    // ── 내부 ────────────────────────────────────────────────────────────

    /** 컨텍스트 경로를 뺀 순수 경로. {@code SYS_API.API_URL} 과 같은 모양이어야 한다. */
    private static String pathOf(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        return contextPath.isEmpty() ? uri : uri.substring(contextPath.length());
    }

    private static String currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        return authentication.getName();
    }

    private static boolean isRestrictedSession(HttpSession session) {
        return Boolean.TRUE.equals(session.getAttribute(SessionKeys.PASSWORD_CHANGE_REQUIRED));
    }
}
