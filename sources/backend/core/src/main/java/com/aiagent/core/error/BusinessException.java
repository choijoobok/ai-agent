package com.aiagent.core.error;

import java.io.Serial;
import java.util.List;

/**
 * 업무 규칙 위반. {@link ErrorCode} 하나와 필드 오류 목록을 나른다.
 *
 * <p>{@code getMessage()} 가 <b>완성된 문구</b>여야 한다 — 그대로 {@code SYS_LO_EXCEPTION}
 * 과 애플리케이션 로그에 남고, 코드만 남으면 매번 뜻을 되찾아야 하기 때문이다(architecture.md §6-1.2).
 *
 * <p><b>이 문구는 로그의 것이고 응답의 것이 아니다</b>(2026-08-29). 응답에 나가는 문구는
 * {@link ErrorCode#code()} 를 키로 {@code SYS_MESSAGE} 에서 <b>사용자 언어</b>로 읽는다
 * ({@code ErrorMessages}). 가르는 이유는 <b>로그가 사용자 언어면 같은 사건이 사람마다 다른
 * 문자열로 쌓이기</b> 때문이다 — 그러면 문구로 묶어 세는 것이 불가능해진다.
 *
 * <p>그래서 여기 담기는 것은 {@code defaultMessage()} 이며 <b>서버 언어</b>다. 예외를 만드는
 * 자리는 도메인이고 거기에는 요청의 언어가 없다 — 있어도 담으면 안 된다.
 */
public class BusinessException extends RuntimeException {

    @Serial private static final long serialVersionUID = 1L;

    private final transient ErrorCode errorCode;
    private final transient List<FieldError> fieldErrors;

    public BusinessException(ErrorCode errorCode) {
        this(errorCode, errorCode.defaultMessage(), List.of());
    }

    public BusinessException(ErrorCode errorCode, String message) {
        this(errorCode, message, List.of());
    }

    public BusinessException(ErrorCode errorCode, String message, List<FieldError> fieldErrors) {
        super(message);
        this.errorCode = errorCode;
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    public ErrorCode errorCode() {
        return errorCode;
    }

    public List<FieldError> fieldErrors() {
        return fieldErrors;
    }

    /**
     * 400 응답의 {@code fields} 한 칸(api-conventions.md §2.3).
     *
     * <p><b>배열인 것이 규약이다</b> — 관계가 틀린 검증은 같은 문구가 두 필드에 실린다
     * (65 §3.4).
     */
    public record FieldError(String field, String message) {}
}
