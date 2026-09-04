package com.aiagent.api.auth;

import com.aiagent.api.auth.check.LoginCandidate;
import com.aiagent.api.auth.check.LoginPostCheck;
import com.aiagent.api.authz.AuthzSession;
import com.aiagent.api.authz.AuthzVersionHeader;
import com.aiagent.api.auth.request.LoginRequest;
import com.aiagent.api.auth.response.LoginResponse;
import com.aiagent.api.auth.response.LoginUserResponse;
import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.ErrorCode;
import com.aiagent.domain.auth.LoginResultCode;
import com.aiagent.domain.authz.EffectiveAuthority;
import com.aiagent.domain.authz.service.EffectiveAuthorityService;
import com.aiagent.domain.authz.service.MenuTreeService;
import com.aiagent.domain.message.service.CacheVersionService;
import com.aiagent.domain.auth.service.LoginHistoryService;
import com.aiagent.domain.auth.service.LoginHistoryService.LoginContext;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.service.UserAccountService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.AuthPasswordProps;
import com.aiagent.support.config.props.SearchRangeProps;
import com.aiagent.support.config.props.UiDateFormatProps;
import com.aiagent.support.config.props.UiExcelProps;
import com.aiagent.support.time.BusinessCalendar;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Map;
import org.springframework.security.authentication.AccountExpiredException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.session.SessionAuthenticationException;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;

/**
 * 로그인 · 로그아웃 조립 — backend/security.md 의 흐름 그대로다.
 *
 * <p><b>체인 #2~#5 를 직접 구현하지 않는다.</b> {@code AccountStatusUserDetailsChecker} 가
 * 4개 플래그로 자동 검사하며, 여기서는 <b>어떤 예외가 어떤 이력 코드인가</b>만 옮긴다
 * (backend/security.md). 직접 검사하면 플래그와 검사가 두 곳에 생겨 언젠가 어긋난다.
 *
 * <p><b>#5 만 예외다.</b> 비밀번호 만료는 차단이 아니라 <b>유도</b>이므로
 * {@link CredentialsExpiredException} 을 잡아 제한 세션으로 전환한다. 그 예외가 던져졌다는
 * 것은 <b>비밀번호는 맞았다</b>는 뜻이다 — 자격 검사는 사전 검사와 비밀번호 검사 뒤에 온다.
 */
@Service
public class LoginService {

    /** 예외 → 이력 코드. 표를 코드로 옮긴 것이며 분기문으로 흩지 않는다. */
    private static final Map<Class<? extends RuntimeException>, LoginResultCode> EXCEPTION_TO_RESULT =
            Map.of(
                    UsernameNotFoundException.class, LoginResultCode.FAIL_NO_USER,
                    BadCredentialsException.class, LoginResultCode.FAIL_PWD,
                    DisabledException.class, LoginResultCode.FAIL_DISABLED,
                    AccountExpiredException.class, LoginResultCode.FAIL_EXPIRED,
                    LockedException.class, LoginResultCode.FAIL_LOCKED);

    /** 이력 코드 → 화면에 나갈 코드·문구. {@code FAIL_NO_USER}·{@code FAIL_PWD} 가 같은 칸이다. */
    private static final Map<LoginResultCode, AuthErrorCode> RESULT_TO_ERROR = Map.of(
            LoginResultCode.FAIL_NO_USER, AuthErrorCode.LOGIN_FAILED,
            LoginResultCode.FAIL_PWD, AuthErrorCode.LOGIN_FAILED,
            LoginResultCode.FAIL_DISABLED, AuthErrorCode.DISABLED,
            LoginResultCode.FAIL_EXPIRED, AuthErrorCode.EXPIRED,
            LoginResultCode.FAIL_LOCKED, AuthErrorCode.LOCKED,
            LoginResultCode.FAIL_DORMANT, AuthErrorCode.DORMANT,
            LoginResultCode.FAIL_IP, AuthErrorCode.IP_DENIED,
            LoginResultCode.FAIL_NO_AUTHORITY, AuthErrorCode.NO_AUTHORITY,
            LoginResultCode.FAIL_TEMP_EXPIRED, AuthErrorCode.TEMP_EXPIRED,
            LoginResultCode.FAIL_CONCURRENT, AuthErrorCode.CONCURRENT_LOGIN);

    private final AuthenticationManager authenticationManager;
    private final UserAccountService userAccountService;
    private final EffectiveAuthorityService effectiveAuthorityService;
    private final MenuTreeService menuTreeService;
    private final CacheVersionService cacheVersionService;
    private final LoginHistoryService loginHistoryService;
    private final List<LoginPostCheck> postChecks;
    private final SessionAuthenticationStrategy sessionStrategy;
    private final SecurityContextRepository securityContextRepository;
    private final ConfigLookup configs;
    private final BusinessCalendar calendar;

    public LoginService(
            AuthenticationManager authenticationManager,
            UserAccountService userAccountService,
            EffectiveAuthorityService effectiveAuthorityService,
            MenuTreeService menuTreeService,
            CacheVersionService cacheVersionService,
            LoginHistoryService loginHistoryService,
            List<LoginPostCheck> postChecks,
            SessionAuthenticationStrategy sessionStrategy,
            SecurityContextRepository securityContextRepository,
            ConfigLookup configs,
            BusinessCalendar calendar) {
        this.authenticationManager = authenticationManager;
        this.userAccountService = userAccountService;
        this.effectiveAuthorityService = effectiveAuthorityService;
        this.menuTreeService = menuTreeService;
        this.cacheVersionService = cacheVersionService;
        this.loginHistoryService = loginHistoryService;
        this.postChecks = postChecks;
        this.sessionStrategy = sessionStrategy;
        this.securityContextRepository = securityContextRepository;
        this.configs = configs;
        this.calendar = calendar;
    }

    public LoginResponse login(
            LoginRequest form, HttpServletRequest request, HttpServletResponse response) {

        LoginContext context = LoginContexts.of(request);
        Authentication authentication;
        boolean mustChangePassword = false;

        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(
                            form.loginId(), form.password()));
        } catch (CredentialsExpiredException e) {
            // 체인 #5. 비밀번호는 맞았으므로 제한 세션으로 들여보낸다(backend/security.md).
            mustChangePassword = true;
            authentication = restrictedAuthentication(form.loginId());
        } catch (BadCredentialsException e) {
            userAccountService.recordLoginFailure(form.loginId());
            throw fail(form.loginId(), LoginResultCode.FAIL_PWD, context);
        } catch (RuntimeException e) {
            LoginResultCode result = EXCEPTION_TO_RESULT.get(e.getClass());
            if (result == null) {
                throw e;
            }
            throw fail(form.loginId(), result, context);
        }

        SysUser user = userAccountService
                .find(form.loginId())
                .orElseThrow(() -> fail(form.loginId(), LoginResultCode.FAIL_NO_USER, context));

        // 임시 비밀번호 방치 — 발급받고 temp-valid-hours 를 넘긴 계정은 들여보내지 않는다(backend/security.md).
        if (user.isTemporaryPasswordExpired(
                calendar.now(), configs.get(AuthPasswordProps.class).tempValidHours())) {
            throw fail(form.loginId(), LoginResultCode.FAIL_TEMP_EXPIRED, context);
        }

        // AUTH-14 후처리 체인 — 플래그로 커버되지 않는 검사들(sys/user-role.md).
        //
        // 유효 권한은 후보 객체가 지연 계산한다. 체인의 마지막 검사(공집합)가 부르거나,
        // 그것이 꺼져 있으면 아래 세션 적재가 부른다 — 어느 쪽이든 계산은 한 번이다.
        LoginCandidate candidate =
                new LoginCandidate(user, () -> effectiveAuthorityService.calculate(form.loginId()));

        for (LoginPostCheck check : postChecks) {
            LoginResultCode blocked = check.check(candidate).orElse(null);
            if (blocked != null) {
                throw fail(form.loginId(), blocked, context);
            }
        }

        EffectiveAuthority authority = candidate.authority();

        // 세션 수립이 성공 기록보다 앞이다 — 동시 접속 제어가 여기서 거부할 수 있으므로
        // (prevent-login: true) 순서가 뒤바뀌면 실패한 로그인이 실패 횟수를 초기화한다.
        try {
            establishSession(authentication, mustChangePassword, authority, request, response);
        } catch (SessionAuthenticationException e) {
            throw fail(form.loginId(), LoginResultCode.FAIL_CONCURRENT, context);
        }

        userAccountService.recordLoginSuccess(form.loginId());
        loginHistoryService.record(form.loginId(), LoginResultCode.SUCCESS, context);

        // 세션은 방금 establishSession 이 만들었다 — 여기서 없으면 그것이 실패한 것이다.
        HttpSession session = request.getSession(false);

        return LoginResponse.of(
                new LoginUserResponse(user.getUserId(), user.getUserNm(), user.getLocaleCd()),
                mustChangePassword,
                authority,
                menuTreeService.build(authority),
                cacheVersionService.all(),
                session == null ? 0 : session.getMaxInactiveInterval(),
                configs.get(UiExcelProps.class).maxRows(),
                configs.get(UiExcelProps.class).maxUploadRows(),
                configs.get(SearchRangeProps.class).defaultDays(),
                configs.get(SearchRangeProps.class).maxDays(),
                dateFormat());
    }

    /**
     * 날짜 표시 형식 셋 — sys/code.md · frontend/grid.md.
     *
     * <p>{@code AuthController#dateFormat} 과 같은 세 줄이다. 부품으로 빼지 않는 근거는
     * 그쪽에 적어 두었다.
     */
    private LoginResponse.DateFormatResponse dateFormat() {
        UiDateFormatProps format = configs.get(UiDateFormatProps.class);
        return new LoginResponse.DateFormatResponse(
                format.month(), format.day(), format.second());
    }

    public void logout(HttpServletRequest request, LoginResultCode reason) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String userId = authentication == null ? null : authentication.getName();

        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();

        if (userId != null) {
            loginHistoryService.record(userId, reason, LoginContexts.of(request));
        }
    }

    // ── 내부 ────────────────────────────────────────────────────────────

    /**
     * 세션 고정 공격 방어. <b>SecurityContext 를 저장하기 전에</b> 세션 ID 를 바꾼다 —
     * 순서가 뒤바뀌면 인증된 컨텍스트가 공격자가 아는 옛 ID 에 붙는다.
     *
     * <p><b>동시 접속 제어(backend/security.md)가 이 한 줄 안에 있다.</b> 주입된 전략은 합성물이며
     * ({@code SecurityConfig}) 세션 ID 교체 앞에 {@code ConcurrentSessionControl} 이 붙어 있다 —
     * 그래서 {@code prevent-login: true} 에서 이 호출이 던지고, 아래의 세션 조작은 일어나지
     * 않는다. <b>전략을 직접 나열하지 않는 것이 요점</b>이다: 설정으로 켜고 끄는 것이
     * 조립(설정)의 일이지 이 흐름의 분기가 아니다.
     */
    private void establishSession(
            Authentication authentication,
            boolean mustChangePassword,
            EffectiveAuthority authority,
            HttpServletRequest request,
            HttpServletResponse response) {

        sessionStrategy.onAuthentication(authentication, request, response);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);

        HttpSession session = request.getSession();
        session.setAttribute(SessionKeys.PASSWORD_CHANGE_REQUIRED, mustChangePassword);

        // 유효 권한을 세션에 담는다 — 이후 매 요청의 판정이 이 값 하나를 본다(backend/security.md).
        // 세션 ID 를 바꾼 뒤에 담아야 한다: 순서가 뒤바뀌면 옛 세션에 담기고 새 세션은 빈다.
        AuthzSession.write(session, authority);

        // 로그인 응답은 /api/public 이라 인가 인터셉터를 지나지 않는다 — 여기서 붙이지 않으면
        // 프론트가 비교 기준값 없이 셸을 그린다.
        AuthzVersionHeader.stamp(response, authority);
    }

    private Authentication restrictedAuthentication(String userId) {
        return UsernamePasswordAuthenticationToken.authenticated(userId, null, List.of());
    }

    private BusinessException fail(String userId, LoginResultCode result, LoginContext context) {
        loginHistoryService.record(userId, result, context);
        ErrorCode code = RESULT_TO_ERROR.getOrDefault(result, AuthErrorCode.LOGIN_FAILED);
        return new BusinessException(code, code.defaultMessage());
    }

}
