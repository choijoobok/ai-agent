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
 * { "success": false, "code": "err.…", "rows": [ { "index": 3, "fields": [ … ] } ], "traceId": "…" }
 * </pre>
 *
 * <p><b>{@code fields} 와 {@code rows} 는 다른 축이다.</b> 앞은 <i>요청 하나의 어느 필드</i>
 * 이고 뒤는 <i>요청 안의 어느 행</i> 이다 — 그리드 저장은 행이 여럿이라 필드만으로는
 * 어느 줄인지 말할 수 없다(backend/api.md).
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
        List<BusinessException.RowError> rows,
        String traceId) {

    public static <T> ApiResponse<T> success(T data, String traceId) {
        return new ApiResponse<>(true, data, null, null, null, null, traceId);
    }

    public static ApiResponse<Void> failure(String code, String message, String traceId) {
        return new ApiResponse<>(false, null, code, message, null, null, traceId);
    }

    public static ApiResponse<Void> failure(
            String code, String message, List<BusinessException.FieldError> fields, String traceId) {
        return failure(code, message, fields, List.of(), traceId);
    }

    public static ApiResponse<Void> failure(
            String code,
            String message,
            List<BusinessException.FieldError> fields,
            List<BusinessException.RowError> rows,
            String traceId) {
        return new ApiResponse<>(
                false,
                null,
                code,
                message,
                fields.isEmpty() ? null : fields,
                rows.isEmpty() ? null : rows,
                traceId);
    }
}
