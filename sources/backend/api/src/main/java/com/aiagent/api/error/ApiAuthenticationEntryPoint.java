package com.aiagent.api.error;

import com.aiagent.core.error.CommonErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

/**
 * 인증되지 않은 접근 — <b>401 JSON</b> 이다(backend/packages.md · backend/api.md).
 *
 * <p>기본 동작인 로그인 페이지 리다이렉트(302)를 쓰지 않는 이유는 SPA 이기 때문이다.
 * axios 는 리다이렉트를 따라가 <b>로그인 HTML 을 데이터로</b> 받고, 화면은 파싱 오류를 낸다.
 *
 * <p>프론트는 이 401 에 <b>재인증 모달</b>로 답한다 — 곧바로 로그아웃하지 않는다(frontend/packages.md ·
 * backend/session.md). 그래서 401 은 에러 로그에 남기지 않는다: 세션 만료는 정상 흐름이고 하트비트마다
 * 쌓이면 에러 로그가 만료 로그가 된다(sys/logs.md).
 *
 * <p><b>{@code SESSION_TIMEOUT} 이력은 아직 남기지 않는다.</b> sys/logs.md 은 기록 시점을
 * "첫 401" 로 정했지만, 그 시점에는 세션이 이미 사라져 <b>{@code USER_ID} 를 알 수 없다</b> —
 * 그리고 만료된 쿠키 값으로 중복을 막는 장치도 함께 필요하다. 이력 슬라이스가 푼다.
 */
@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ApiErrorWriter writer;

    public ApiAuthenticationEntryPoint(ApiErrorWriter writer) {
        this.writer = writer;
    }

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException)
            throws IOException {
        writer.write(response, CommonErrorCode.UNAUTHENTICATED);
    }
}
