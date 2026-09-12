package com.aiagent.api.auth;

import com.aiagent.domain.auth.LoginResultCode;
import com.aiagent.domain.auth.service.LoginHistoryService;
import com.aiagent.domain.auth.service.LoginHistoryService.LoginContext;
import java.util.List;
import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.web.authentication.session.ConcurrentSessionControlAuthenticationStrategy;

/**
 * 밀려나는 세션을 <b>이력에 남기고</b> 만료시킨다 — backend/security.md · sys/logs.md.
 *
 * <p><b>기록 시점이 밀어내는 순간인 것이 결정이다.</b> 밀려난 사용자가 401 을 받는 시점에
 * 기록하려면 그 사람이 <b>다시 요청을 보내야</b> 하는데, 자리를 뜬 뒤 밀려났다면 그 요청은
 * 영영 오지 않는다 — <i>"갑자기 로그아웃됐다"</i> 는 문의에 답할 근거가 그때 사라진다.
 *
 * <p><b>남는 IP·UA 는 밀어낸 쪽의 것이다.</b> 밀려난 세션의 접속 정보는 이 자리에서 알 수
 * 없다(그 요청이 아니다). 어긋나 보이지만 <b>답해야 하는 질문에 더 맞는 값</b>이다 —
 * screen/admin/system/log/access/requirements.md 가 이 코드에 기대하는 것은 <i>"누가 내 세션을 가져갔는가"</i> 이며, 그것이 곧
 * 새 로그인의 IP 다.
 */
public class EvictionRecordingStrategy extends ConcurrentSessionControlAuthenticationStrategy {

    private final LoginHistoryService loginHistoryService;

    public EvictionRecordingStrategy(
            SessionRegistry sessionRegistry, LoginHistoryService loginHistoryService) {
        super(sessionRegistry);
        this.loginHistoryService = loginHistoryService;
    }

    /**
     * {@code preventLogin=true} 면 상위 구현이 예외를 던지고 <b>아무도 밀려나지 않는다</b> —
     * 그래서 기록은 상위 호출 <b>뒤</b>가 아니라 실제 만료가 일어나는 경로에서만 일어나야 한다.
     * 상위가 던지면 아래 줄에 도달하지 않는다.
     */
    @Override
    protected void allowableSessionsExceeded(
            List<SessionInformation> sessions, int allowableSessions, SessionRegistry registry) {

        super.allowableSessionsExceeded(sessions, allowableSessions, registry);

        LoginContext context = LoginContexts.current();
        sessions.stream()
                .filter(SessionInformation::isExpired)
                .forEach(session -> loginHistoryService.record(
                        principalName(session), LoginResultCode.SESSION_EVICTED, context));
    }

    /**
     * {@code SessionInformation.getPrincipal()} 은 {@code UserDetails} 이거나 사용자명
     * 문자열이다 — 세션 스토어가 무엇을 담았느냐에 달렸으므로 양쪽을 받는다.
     */
    private static String principalName(SessionInformation session) {
        Object principal = session.getPrincipal();
        return principal instanceof org.springframework.security.core.userdetails.UserDetails details
                ? details.getUsername()
                : String.valueOf(principal);
    }
}
