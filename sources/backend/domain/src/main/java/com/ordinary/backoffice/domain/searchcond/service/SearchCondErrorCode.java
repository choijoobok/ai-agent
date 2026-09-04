package com.ordinary.backoffice.domain.searchcond.service;

import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.core.error.ErrorType;
import com.ordinary.backoffice.core.message.MsgKey;

/** 저장된 조회조건이 거부되는 자리 — search-form-contract.md §5. */
public enum SearchCondErrorCode implements ErrorCode {

    /**
     * 화면당 상한을 넘겼다 — search-form-contract.md §5.4.
     *
     * <p><b>사용자가 고칠 수 있는 실패다.</b> 하나 지우면 저장된다 — 그래서 조용히 가장
     * 오래된 것을 밀어내지 않는다: 밀려난 것이 <b>매일 쓰는 조건</b>일 수 있다.
     */
    LIMIT_EXCEEDED(MsgKey.ERR_SEARCH_COND_LIMIT, "저장할 수 있는 조회조건 수를 넘었습니다");

    private final String code;
    private final String defaultMessage;

    SearchCondErrorCode(String code, String defaultMessage) {
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
