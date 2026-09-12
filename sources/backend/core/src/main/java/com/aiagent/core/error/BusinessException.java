package com.aiagent.core.error;

import java.io.Serial;
import java.util.List;

/**
 * 업무 규칙 위반. {@link ErrorCode} 하나와 필드 오류 목록을 나른다.
 *
 * <p>{@code getMessage()} 가 <b>완성된 문구</b>여야 한다 — 그대로 {@code SYS_LO_EXCEPTION}
 * 과 애플리케이션 로그에 남고, 코드만 남으면 매번 뜻을 되찾아야 하기 때문이다(backend/packages.md).
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
    private final transient List<RowError> rowErrors;

    public BusinessException(ErrorCode errorCode) {
        this(errorCode, errorCode.defaultMessage(), List.of());
    }

    public BusinessException(ErrorCode errorCode, String message) {
        this(errorCode, message, List.of());
    }

    public BusinessException(ErrorCode errorCode, String message, List<FieldError> fieldErrors) {
        this(errorCode, message, fieldErrors, List.of());
    }

    private BusinessException(
            ErrorCode errorCode,
            String message,
            List<FieldError> fieldErrors,
            List<RowError> rowErrors) {
        super(message);
        this.errorCode = errorCode;
        this.fieldErrors = List.copyOf(fieldErrors);
        this.rowErrors = List.copyOf(rowErrors);
    }

    /**
     * 여러 행이 한꺼번에 거부된 경우 — 그리드 저장의 것이다(backend/api.md).
     *
     * <p><b>루프 안에서 던지지 않고 모아서 한 번 던진다.</b> 하나씩 던지면 사용자가 저장을
     * N 번 눌러 오류를 하나씩 발견하게 되고, 그것은 <i>고칠 것이 몇 개인지</i> 를 끝까지
     * 알려 주지 않는 화면이다.
     */
    public static BusinessException rows(ErrorCode errorCode, String message, List<RowError> rowErrors) {
        return new BusinessException(errorCode, message, List.of(), rowErrors);
    }

    public ErrorCode errorCode() {
        return errorCode;
    }

    public List<FieldError> fieldErrors() {
        return fieldErrors;
    }

    public List<RowError> rowErrors() {
        return rowErrors;
    }

    /**
     * 400 응답의 {@code fields} 한 칸(backend/api.md).
     *
     * <p><b>배열인 것이 규약이다</b> — 관계가 틀린 검증은 같은 문구가 두 필드에 실린다
     * (screen/admin/system/batch/schedule/requirements.md).
     *
     * <p>{@code value} 는 <b>서버가 보고 거부한 값</b>이다. 화면이 행을 되찾은 경우에는
     * 화면의 값을 쓰므로 없어도 되지만, 되찾지 못한 오류에서는 <i>무슨 값이 문제인가</i>
     * 를 말할 수 있는 유일한 통로다. 비밀번호처럼 <b>되돌려 보내면 안 되는 값은 담지
     * 않는다</b> — 응답과 에러 로그에 그대로 남는다.
     */
    public record FieldError(String field, String message, String value) {

        public FieldError(String field, String message) {
            this(field, message, null);
        }
    }

    /**
     * 400 응답의 {@code rows} 한 칸 — <b>요청 배열의 몇 번째 행이 왜 거부됐나</b>.
     *
     * <p><b>행을 값으로 가리키지 않고 순번으로 가리킨다.</b> 중복은 <i>같은 값인 행이 둘
     * 이상</i> 이라는 뜻이므로, 값으로 찾게 하면 화면이 어느 쪽을 칠할지 고르지 못한다.
     * 순번은 화면이 보낸 배열의 것이며 서버는 그 순서를 바꾸지 않는다(backend/api.md).
     *
     * <p>{@code fields} 가 배열인 것이 복합 키를 나르는 방법이다 — 키가 두 컬럼이면 두
     * 칸이 함께 붉어져야 <i>이 조합이 중복</i> 이 표현된다.
     */
    public record RowError(int index, List<FieldError> fields) {

        public RowError {
            fields = List.copyOf(fields);
        }

        public static RowError of(int index, String field, String message, String value) {
            return new RowError(index, List.of(new FieldError(field, message, value)));
        }
    }
}
