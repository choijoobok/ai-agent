package com.aiagent.core.search;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 조회 프로토콜 위반 — backend/api.md.
 *
 * <p><b>전부 400 이다.</b> 사용자가 넣은 값의 문제가 아니라 <b>화면이 만든 요청</b>이 규약과
 * 어긋난 것이며, 개발 중에 드러나야 하는 종류다. 다만 500 으로 올리지 않는다 — 요청 본문이
 * 신뢰할 수 없는 입력이라는 사실은 변하지 않으므로, 조작된 요청 하나가 에러 로그를 채우게
 * 두지 않는다.
 *
 * <p><b>예외는 {@link #TOO_MANY_ROWS} 하나다.</b> 요청은 정상이고 데이터가 많은 것이므로
 * 사용자가 조건을 좁혀 고칠 수 있다.
 */
public enum SearchErrorCode implements ErrorCode {

    UNKNOWN_FIELD(MsgKey.ERR_QUERY_UNKNOWN_FIELD, "조회할 수 없는 항목입니다"),
    OP_TYPE_MISMATCH(MsgKey.ERR_QUERY_OP_TYPE, "이 항목에 쓸 수 없는 조건입니다"),
    INVALID_VALUE(MsgKey.ERR_QUERY_VALUE, "조회 조건의 값이 올바르지 않습니다"),
    NOT_SORTABLE(MsgKey.ERR_QUERY_NOT_SORTABLE, "정렬할 수 없는 항목입니다"),
    TOO_MANY_ROWS(MsgKey.ERR_QUERY_TOO_MANY_ROWS, "결과가 너무 많습니다. 조건을 좁혀 주세요"),
    INVALID_CURSOR(MsgKey.ERR_QUERY_INVALID_CURSOR, "페이지를 다시 조회해 주세요"),
    CURSOR_SORT_ARITY(MsgKey.ERR_QUERY_CURSOR_SORT_ARITY, "이 목록은 한 컬럼으로만 정렬할 수 있습니다");

    private final String code;
    private final String defaultMessage;

    SearchErrorCode(String code, String defaultMessage) {
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
