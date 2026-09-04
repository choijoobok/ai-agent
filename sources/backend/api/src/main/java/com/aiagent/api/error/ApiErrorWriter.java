package com.aiagent.api.error;

import com.aiagent.api.trace.TraceId;
import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.response.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * 필터 체인 안에서 봉투를 직접 쓴다.
 *
 * <p>{@code @RestControllerAdvice} 는 <b>컨트롤러에 도달한 요청만</b> 다룬다. Security 가
 * 앞에서 끊은 401·403 은 거기까지 오지 않으므로, 그대로 두면 <b>같은 API 가 어떤 실패는
 * 봉투로 어떤 실패는 서블릿 기본 HTML 로</b> 응답한다 — 프론트의 첫 분기가 {@code success}
 * 하나여야 하는데 그것이 깨진다(backend/api.md).
 *
 * <p><b>패키지가 {@code tools.jackson} 이다.</b> Spring Boot 4.1 은 Jackson 3 을 쓴다 —
 * {@code com.fasterxml.jackson.databind} 는 클래스패스에 없다. 애너테이션만
 * {@code com.fasterxml.jackson.annotation} 에 그대로 남아 있어 둘이 섞여 보인다.
 */
@Component
public class ApiErrorWriter {

    private final ObjectMapper objectMapper;
    private final ErrorMessages errorMessages;

    public ApiErrorWriter(ObjectMapper objectMapper, ErrorMessages errorMessages) {
        this.objectMapper = objectMapper;
        this.errorMessages = errorMessages;
    }

    public void write(HttpServletResponse response, ErrorCode errorCode) throws IOException {
        response.setStatus(errorCode.type().status());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(
                response.getWriter(),
                ApiResponse.failure(errorCode.code(), errorMessages.of(errorCode), TraceId.current()));
    }
}
