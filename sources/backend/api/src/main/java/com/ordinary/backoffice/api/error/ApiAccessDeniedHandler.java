package com.ordinary.backoffice.api.error;

import com.ordinary.backoffice.core.error.CommonErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/**
 * 인가 거부 — <b>403 JSON</b>. CSRF 토큰 불일치도 여기로 온다.
 *
 * <p>업무 인가(메뉴×액션)의 403 은 이 핸들러가 아니라 인가 인터셉터가 낸다 — 판정은 한
 * 곳에서 한다(security-design.md §4).
 */
@Component
public class ApiAccessDeniedHandler implements AccessDeniedHandler {

    private final ApiErrorWriter writer;

    public ApiAccessDeniedHandler(ApiErrorWriter writer) {
        this.writer = writer;
    }

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException)
            throws IOException {
        writer.write(response, CommonErrorCode.FORBIDDEN);
    }
}
