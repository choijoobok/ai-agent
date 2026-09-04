package com.aiagent.core.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.aiagent.core.error.BusinessException;
import java.util.List;

/**
 * 성공도 실패도 이 봉투로 감싼다 — backend/api.md.
 *
 * <pre>
 * { "success": true,  "data": { … },                          "traceId": "…" }
 * { "success": false, "code": "err.…", "message": "…",        "traceId": "…" }
 * { "success": false, "code": "err.validation", "fields": [ … ], "traceId": "…" }
 * </pre>
 *
 * <p><b>{@code traceId} 는 성공에도 담는다.</b> 5xx 토스트만 쓰는 것이 아니라 <i>"저장은
 * 됐다는데 값이 이상하다"</i> 는 문의가 <b>성공한 요청</b>을 사용 이력에서 찾아야 하고,
 * 그 열쇠가 이 값이다(backend/api.md · screen/log/access/requirements.md). 값은 {@code X-Request-Id} 와 같다.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
        boolean success,
        T data,
        String code,
        String message,
        List<BusinessException.FieldError> fields,
        String traceId) {

    public static <T> ApiResponse<T> success(T data, String traceId) {
        return new ApiResponse<>(true, data, null, null, null, traceId);
    }

    public static ApiResponse<Void> failure(String code, String message, String traceId) {
        return new ApiResponse<>(false, null, code, message, null, traceId);
    }

    public static ApiResponse<Void> failure(
            String code, String message, List<BusinessException.FieldError> fields, String traceId) {
        return new ApiResponse<>(false, null, code, message, fields.isEmpty() ? null : fields, traceId);
    }
}
