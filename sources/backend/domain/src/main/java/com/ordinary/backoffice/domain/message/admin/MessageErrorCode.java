package com.ordinary.backoffice.domain.message.admin;

import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.core.error.ErrorType;
import com.ordinary.backoffice.core.message.MsgKey;

/**
 * {@code MESSAGE_MGMT} 저장의 거부 — 63 §3.2.
 *
 * <p><b>셋 다 화면이 미리 막을 수 없는 것이다.</b> 현재 페이지 밖의 키와 다른 사람의 삭제는
 * 화면이 모르고, 지원 언어는 서버가 갖는다(grid-edit-validation.md §3.4 — <i>"프론트 검증은 UX 이고 최종 판정은
 * 서버다"</i>).
 */
public enum MessageErrorCode implements ErrorCode {

    KEY_DUPLICATE(MsgKey.ERR_MESSAGE_KEY_DUPLICATE, "이미 있는 메시지 키입니다"),
    LANG_UNKNOWN(MsgKey.ERR_MESSAGE_LANG_UNKNOWN, "지원하지 않는 언어입니다"),
    KEY_MISSING(MsgKey.ERR_MESSAGE_KEY_MISSING, "이미 삭제된 메시지 키입니다");

    private final String code;
    private final String defaultMessage;

    MessageErrorCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }

    @Override
    public String code() {
        return code;
    }

    @Override
    public ErrorType type() {
        return ErrorType.INVALID_REQUEST;
    }

    @Override
    public String defaultMessage() {
        return defaultMessage;
    }
}
