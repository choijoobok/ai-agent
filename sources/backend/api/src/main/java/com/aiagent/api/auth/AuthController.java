package com.aiagent.api.auth;

import com.aiagent.api.auth.request.LoginRequest;
import com.aiagent.api.auth.request.PasswordChangeRequest;
import com.aiagent.api.auth.request.ResetCodeRequest;
import com.aiagent.api.auth.request.ResetPasswordRequest;
import com.aiagent.api.auth.request.ResetVerifyRequest;
import com.aiagent.api.auth.response.HeartbeatResponse;
import com.aiagent.api.auth.response.LoginResponse;
import com.aiagent.api.auth.response.LoginUserResponse;
import com.aiagent.api.auth.response.PasswordPolicyResponse;
import com.aiagent.api.authz.AuthzSession;
import com.aiagent.api.trace.TraceId;
import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.core.response.ApiResponse;
import com.aiagent.domain.auth.LoginResultCode;
import com.aiagent.domain.authz.EffectiveAuthority;
import com.aiagent.domain.authz.service.MenuTreeService;
import com.aiagent.domain.message.service.CacheVersionService;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.service.PasswordChangeService;
import com.aiagent.domain.user.service.PasswordResetService;
import com.aiagent.domain.user.service.UserAccountService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.mail.Mailer;
import com.aiagent.support.config.props.SearchRangeProps;
import com.aiagent.support.config.props.UiDateFormatProps;
import com.aiagent.support.config.props.UiExcelProps;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증 API — security-design.md §3.
 *
 * <p><b>계층 마디가 접근 정책을 정한다</b>(api-conventions.md §2.1). {@code public} 은 인증 전이므로
 * {@code permitAll} 이자 CSRF 예외이고, {@code common} 은 로그인한 사람이면 누구나 쓴다 —
 * 메뉴×액션 인가를 받지 않는다. 그래서 이 컨트롤러는 {@code SYS_API} 시드 대상이 아니다
 * (60 §3.4).
 *
 * <p>경로 표기는 <b>camelCase 단수</b>이며 <b>소스의 메서드명이 그대로 경로</b>다(api-conventions.md §2.2).
 */
@RestController
public class AuthController {

    private final LoginService loginService;
    private final UserAccountService userAccountService;
    private final MenuTreeService menuTreeService;
    private final CacheVersionService cacheVersionService;
    private final PasswordChangeService passwordChangeService;
    private final PasswordResetService passwordResetService;
    private final PasswordPolicies passwordPolicies;
    private final Mailer mailer;
    private final ConfigLookup configs;

    public AuthController(
            LoginService loginService,
            UserAccountService userAccountService,
            MenuTreeService menuTreeService,
            CacheVersionService cacheVersionService,
            PasswordChangeService passwordChangeService,
            PasswordResetService passwordResetService,
            PasswordPolicies passwordPolicies,
            Mailer mailer,
            ConfigLookup configs) {
        this.loginService = loginService;
        this.userAccountService = userAccountService;
        this.menuTreeService = menuTreeService;
        this.cacheVersionService = cacheVersionService;
        this.passwordChangeService = passwordChangeService;
        this.passwordResetService = passwordResetService;
        this.passwordPolicies = passwordPolicies;
        this.mailer = mailer;
        this.configs = configs;
    }

    @PostMapping("/api/public/auth/login")
    public ApiResponse<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        return ApiResponse.success(
                loginService.login(request, servletRequest, servletResponse), TraceId.current());
    }

    /**
     * 비밀번호 규칙 목록 — {@code documents/screen/_standalone/login/requirements.md} §7-1.
     *
     * <p><b>{@code public} 인데 {@code GET} 인 것이 규약이다</b> — {@code common}·{@code public}
     * 의 조회는 GET 이고 나머지는 POST 다(api-conventions.md §2.1). 인가 판정을 받지 않으므로 접두
     * ({@code get*})가 액션을 정하지는 않지만 <b>같은 접두를 쓴다</b>: 규칙이 둘이 되면
     * 어느 쪽인지 매번 확인해야 한다.
     *
     * <p><b>공개해도 되는 값이다.</b> 정책은 로그인 화면에 이미 그려질 것이고, 감추면
     * 사용자가 규칙을 모른 채 세 번 거절당한 뒤 관리자에게 전화한다({@code PasswordRule} 의
     * 그 문장과 같은 판단). {@code tempValidHours}·{@code adminResetEnabled} 는 운영의 값이라
     * 여기 없다.
     *
     * <p>강제 변경과 프로필의 변경 탭도 <b>같은 응답</b>을 쓴다 — 규칙 목록의 출처가 서버
     * 하나여야 세 화면이 갈리지 않는다.
     */
    @GetMapping("/api/public/auth/getPasswordPolicy")
    public ApiResponse<PasswordPolicyResponse> getPasswordPolicy() {
        return ApiResponse.success(passwordPolicies.current(), TraceId.current());
    }

    /**
     * 재설정 ① — 인증번호를 보낸다. AUTH-07 · 요건서 §6-3.
     *
     * <p><b>계정이 없어도, 메일 주소가 없어도, 쿨다운 중이어도 같은 응답이다.</b> 이 메서드에
     * 분기가 하나도 없는 것이 그 규칙의 모양이며, 갈리는 순간 <b>로그인 화면을 지나지 않고도
     * 계정 목록을 만들 수 있다</b>.
     *
     * <p><b>발송이 트랜잭션 밖이다.</b> 토큰 발급은 {@code issue} 안에서 이미 커밋됐고, SMTP
     * 왕복을 그 안에 두면 메일 서버가 멎는 동안 DB 커넥션이 붙잡힌다 — 인증 없이 누구나
     * 부를 수 있는 경로라 그것이 곧 고갈 경로가 된다.
     *
     * <p><b>발송 실패도 같은 응답이다.</b> {@code Mailer} 가 결과를 돌려주지만 그것으로 할 수
     * 있는 일이 없다 — 실패는 서버 로그에 남고 토큰은 발급된 채 만료를 기다린다(§6-3).
     */
    @PostMapping("/api/public/auth/sendResetCode")
    public ApiResponse<Void> sendResetCode(@Valid @RequestBody ResetCodeRequest request) {
        passwordResetService
                .issue(request.loginId())
                .ifPresent(mail -> mailer.send(mail.to(), mail.subject(), mail.body()));
        return ApiResponse.success(null, TraceId.current());
    }

    /**
     * 재설정 ② — 인증번호를 확인한다. 요건서 §6-3.
     *
     * <p><b>서버에 <i>확인됨</i> 상태를 남기지 않는다.</b> ③이 같은 코드를 다시 싣고 서버가
     * 다시 대조하므로, 그 상태의 수명과 무효화를 정할 필요가 없다 — 정하면 그것은 토큰을
     * 하나 더 만드는 일이다.
     */
    @PostMapping("/api/public/auth/verifyResetCode")
    public ApiResponse<Void> verifyResetCode(@Valid @RequestBody ResetVerifyRequest request) {
        passwordResetService.verify(request.loginId(), request.resetCode());
        return ApiResponse.success(null, TraceId.current());
    }

    /**
     * 재설정 ③ — 새 비밀번호를 저장하고 <b>여기서</b> 잠금을 푼다. 요건서 §6-3.
     *
     * <p><b>이름이 {@code savePasswordReset} 이 아니다.</b> 그 이름은 이미
     * {@code /api/service/user/savePasswordReset}(관리자 임시 비밀번호 발급)의 것이며, 둘은
     * 다른 일이라 겹치면 로그에서 구분되지 않는다 — 셋을 {@code reset} 으로 묶어 <b>한
     * 묶음임이 경로만 봐도 보이게</b> 했다(요건서 §7).
     *
     * <p><b>세션을 만들지 않는다.</b> 비밀번호를 바꾼 사용자는 로그인 화면으로 돌아가 새
     * 값으로 들어온다 — 여기서 인증까지 해 주면 <i>인증번호를 아는 것</i> 이 곧 로그인이 되어
     * 접근 제어 체인(사용 여부·기간·IP·권한)을 통째로 건너뛴다.
     */
    @PostMapping("/api/public/auth/saveResetPassword")
    public ApiResponse<Void> saveResetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.complete(
                request.loginId(), request.resetCode(), request.newPwd());
        return ApiResponse.success(null, TraceId.current());
    }

    /**
     * 새로고침 시 세션 복원 — {@code authStore} 에 {@code persist} 를 붙이지 않기로 한
     * 결정의 대가가 이 왕복이다(frontend-stack.md §8.1).
     */
    @GetMapping("/api/common/auth/getMe")
    public ApiResponse<LoginResponse> me(Principal principal, HttpServletRequest request) {
        if (principal == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        SysUser user = userAccountService
                .find(principal.getName())
                // 세션은 살아 있는데 계정이 사라졌다 — 관리자가 지운 경우다. 세션을 믿지 않는다.
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHENTICATED));

        EffectiveAuthority authority = currentAuthority(request);
        return ApiResponse.success(
                LoginResponse.of(
                        new LoginUserResponse(user.getUserId(), user.getUserNm(), user.getLocaleCd()),
                        passwordChangeRequired(request),
                        authority,
                        menuTreeService.build(authority),
                        cacheVersionService.all(),
                        sessionBudget(request),
                        configs.get(UiExcelProps.class).maxRows(),
                        configs.get(UiExcelProps.class).maxUploadRows(),
                        configs.get(SearchRangeProps.class).defaultDays(),
                        configs.get(SearchRangeProps.class).maxDays(),
                        dateFormat()),
                TraceId.current());
    }

    /**
     * 날짜 표시 형식 셋 — 43 §6.4 · grid-column-contract.md §4.5.
     *
     * <p><b>{@link LoginService} 에 같은 메서드가 있다.</b> 부품으로 빼지 않는 것은 두 곳이
     * 모두 <i>설정 하나를 응답의 한 칸에 담는</i> 세 줄이고, 그것을 옮기면 <b>설정 조회의
     * 자리가 응답 조립에서 멀어진다</b> — 두 응답이 다른 값을 담게 되는 날 어느 쪽이
     * 틀렸는지 찾을 곳이 늘어난다.
     */
    private LoginResponse.DateFormatResponse dateFormat() {
        UiDateFormatProps format = configs.get(UiDateFormatProps.class);
        return new LoginResponse.DateFormatResponse(
                format.month(), format.day(), format.second());
    }

    /**
     * 만료까지의 예산 — 50 §7. 세션이 없으면 0 이며 <b>셸이 타이머를 걸지 않는다.</b>
     *
     * <p>0 을 예고 시점으로 해석해 즉시 모달을 띄우면, 세션을 못 찾은 것이 <i>"곧 만료된다"</i>
     * 로 보인다 — 그 둘은 다른 사실이다.
     */
    private static int sessionBudget(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? 0 : session.getMaxInactiveInterval();
    }

    /**
     * 만료 예고 모달의 "연장" — 60 §5.
     *
     * <p>세션 갱신 자체는 이 요청이 도달한 것으로 이미 끝났다({@code lastAccessedTime}).
     * 응답이 나르는 것은 <b>다음 만료까지 남은 초</b>이며, 프론트가 그것으로 다음 예고
     * 시점을 다시 잡는다 — 타임아웃 값을 프론트에 박아 두면 서버 설정과 어긋난다.
     */
    @PostMapping("/api/common/auth/heartbeat")
    public ApiResponse<HeartbeatResponse> heartbeat(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return ApiResponse.success(
                new HeartbeatResponse(session.getMaxInactiveInterval()), TraceId.current());
    }

    /**
     * 본인 비밀번호 변경 — AUTH-05 · main-shell.md §8 의 <b>비밀번호 변경</b> 탭.
     *
     * <p><b>{@code user} 가 아니라 {@code auth} 아래인 것이 요건이다.</b> 제한 세션에서
     * 열려 있어야 하는 유일한 업무 경로이며({@code AuthorizationInterceptor} 의
     * {@code RESTRICTED_SESSION_ALLOWED}), 그 화이트리스트는 경로 문자열로 비교한다 —
     * 옮기면 <b>비밀번호가 만료된 사용자가 아무것도 못 하는 막다른 세션</b>에 갇힌다.
     *
     * <p><b>성공하면 제한 표시를 내린다.</b> 바꾸고 나서도 플래그가 남으면 방금 요건을
     * 충족한 사람이 계속 403 을 받는다 — 체인 #5 는 <b>차단이 아니라 유도</b>이고, 유도의
     * 끝에는 문이 열려야 한다.
     *
     * <p><b>세션을 새로 만들지 않는다.</b> 비밀번호 변경 뒤 세션 고정 공격을 걱정할 자리가
     * 아니다 — 세션 ID 를 바꾸는 것은 <b>인증 경계를 넘을 때</b>(로그인)이고, 여기는 이미
     * 인증된 사람이 자기 값을 고치는 것이라 새 세션은 열려 있던 탭만 잃게 한다.
     */
    @PostMapping("/api/common/auth/changePassword")
    public ApiResponse<Void> changePassword(
            @Valid @RequestBody PasswordChangeRequest request,
            Principal principal,
            HttpServletRequest servletRequest) {

        if (principal == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        passwordChangeService.changePassword(
                principal.getName(), request.currentPwd(), request.newPwd());

        HttpSession session = servletRequest.getSession(false);
        if (session != null) {
            session.removeAttribute(SessionKeys.PASSWORD_CHANGE_REQUIRED);
        }
        return ApiResponse.success(null, TraceId.current());
    }

    @PostMapping("/api/common/auth/logout")
    public ApiResponse<Void> logout(HttpServletRequest request) {
        // traceId 를 먼저 읽는다 — 세션 무효화 뒤에도 응답 봉투는 채워져야 한다.
        String traceId = TraceId.current();
        loginService.logout(request, LoginResultCode.LOGOUT);
        return ApiResponse.success(null, traceId);
    }

    /**
     * 인가 인터셉터가 세션에 넣어 둔 유효 권한을 그대로 나른다 — <b>여기서 다시 계산하지
     * 않는다</b>(security-design.md §4 판정은 한 곳에서).
     *
     * <p>낡았으면 이미 인터셉터가 갱신했다. 그래서 F5 마다 도는 이 왕복은 <b>쿼리 0</b> 이며,
     * 자정을 넘긴 첫 새로고침에서만 재계산이 붙는다.
     */
    private static EffectiveAuthority currentAuthority(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        EffectiveAuthority authority = session == null ? null : AuthzSession.read(session);
        if (authority == null) {
            throw new BusinessException(CommonErrorCode.UNAUTHENTICATED);
        }
        return authority;
    }

    private static boolean passwordChangeRequired(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session != null
                && Boolean.TRUE.equals(session.getAttribute(SessionKeys.PASSWORD_CHANGE_REQUIRED));
    }
}
