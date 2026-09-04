package com.ordinary.backoffice.core.error;

import com.ordinary.backoffice.core.message.MsgKey;

/** 도메인에 매이지 않는 에러 코드. 도메인별 코드는 각 모듈이 자기 enum 을 만든다. */
public enum CommonErrorCode implements ErrorCode {

    VALIDATION(MsgKey.ERR_VALIDATION, ErrorType.INVALID_REQUEST, "입력값을 확인하세요"),
    UNAUTHENTICATED(MsgKey.ERR_UNAUTHENTICATED, ErrorType.UNAUTHENTICATED, "로그인이 필요합니다"),
    FORBIDDEN(MsgKey.ERR_FORBIDDEN, ErrorType.FORBIDDEN, "권한이 없습니다"),
    NOT_FOUND(MsgKey.ERR_NOT_FOUND, ErrorType.INVALID_REQUEST, "요청한 자원을 찾을 수 없습니다"),
    METHOD_NOT_ALLOWED(
            MsgKey.ERR_METHOD_NOT_ALLOWED, ErrorType.INVALID_REQUEST, "허용되지 않은 요청 방식입니다"),
    MALFORMED_BODY(MsgKey.ERR_MALFORMED_BODY, ErrorType.INVALID_REQUEST, "요청 본문을 해석할 수 없습니다"),
    INTERNAL(MsgKey.ERR_INTERNAL, ErrorType.INTERNAL_ERROR, "처리 중 오류가 발생했습니다");

    private final String code;
    private final ErrorType type;
    private final String defaultMessage;

    CommonErrorCode(String code, ErrorType type, String defaultMessage) {
        this.code = code;
        this.type = type;
        this.defaultMessage = defaultMessage;
    }

    @Override
    public String code() {
        return code;
    }

    @Override
    public ErrorType type() {
        return type;
    }

    @Override
    public String defaultMessage() {
        return defaultMessage;
    }
}
