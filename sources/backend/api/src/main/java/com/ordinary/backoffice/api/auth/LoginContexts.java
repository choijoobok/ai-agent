package com.ordinary.backoffice.api.auth;

import com.ordinary.backoffice.api.trace.ClientIp;
import com.ordinary.backoffice.api.trace.TraceId;
import com.ordinary.backoffice.domain.auth.service.LoginHistoryService.LoginContext;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 요청에서 로그인 이력의 부수 정보를 뽑는 한 자리.
 *
 * <p>부르는 곳이 둘이며 <b>둘의 손에 든 것이 다르다</b> — {@link LoginService} 는 요청을
 * 인자로 갖고 있고, {@link EvictionRecordingStrategy} 는 프레임워크 콜백 안이라 갖고 있지
 * 않다. 값이 갈리면 같은 로그인 한 번이 두 가지 IP 로 기록되므로 추출 규칙을 하나로 둔다.
 *
 * <p>IP 자체의 규칙은 {@link com.ordinary.backoffice.api.trace.ClientIp} 가 갖는다 — 사용 이력
 * 인터셉터도 같은 것을 묻기 시작하면서 부르는 곳이 셋이 됐다(architecture.md §6.3).
 */
public final class LoginContexts {

    private LoginContexts() {}

    public static LoginContext of(HttpServletRequest request) {
        return new LoginContext(ClientIp.of(request), request.getHeader("User-Agent"), TraceId.current());
    }

    /**
     * 지금 처리 중인 요청에서 뽑는다.
     *
     * <p>요청 밖(배치·스케줄러)에서 부르면 값이 비지만 <b>실패시키지 않는다</b> — 이력 한 줄의
     * 부수 정보 때문에 본 동작(세션 만료)을 막을 이유가 없다.
     */
    public static LoginContext current() {
        if (RequestContextHolder.getRequestAttributes()
                instanceof ServletRequestAttributes attributes) {
            return of(attributes.getRequest());
        }
        return new LoginContext(null, null, TraceId.current());
    }
}
