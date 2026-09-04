package com.aiagent.domain.authz.userauth;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 개인 예외 저장이 거부하는 것 — screen/user/requirements.md · sys/menu.md 의 원칙 P1.
 *
 * <p>{@code RoleErrorCode} 의 뒤 셋(메뉴 · 액션 · {@code READ})과 <b>같은 규칙</b>을
 * 지키지만 <b>키를 공유하지 않는다</b>({@link MsgKey} 의 해당 블록) — 규칙이 하나인 것과
 * 문구가 하나인 것은 다르다.
 *
 * <p>여기만 있는 것이 넷이다: <b>기간 필수 · 기간 순서 · 사유 필수 · 행 존재</b>. 앞의 셋은
 * {@code SYS_USER_MENU_AUTH} 가 역할 부여와 <b>모양이 다른</b> 데서 오고(sys/menu.md — 기간과 사유가
 * {@code NOT NULL} 이다), 넷째는 이 화면에만 <b>수정과 삭제가 있기</b> 때문이다.
 */
public enum UserAuthErrorCode implements ErrorCode {

    NOT_FOUND(MsgKey.ERR_USER_AUTH_NOT_FOUND, "없는 계정입니다"),
    MENU_NOT_AUTHORIZABLE(MsgKey.ERR_USER_AUTH_MENU, "권한을 줄 수 없는 메뉴입니다"),
    ACTION_UNDEFINED(MsgKey.ERR_USER_AUTH_ACTION, "그 메뉴에 정의되지 않은 액션입니다"),
    READ_REQUIRED(MsgKey.ERR_USER_AUTH_READ, "조회 권한 없이 다른 액션만 줄 수 없습니다"),
    PERIOD_REQUIRED(MsgKey.ERR_USER_AUTH_PERIOD_REQUIRED, "부여 기간은 필수입니다"),
    PERIOD_REVERSED(MsgKey.ERR_USER_AUTH_PERIOD, "부여 기간의 시작이 종료보다 늦습니다"),
    REASON_REQUIRED(MsgKey.ERR_USER_AUTH_REASON_REQUIRED, "부여 사유는 필수입니다"),
    DUPLICATE(MsgKey.ERR_USER_AUTH_DUPLICATE, "이미 있는 부여입니다"),
    MISSING(MsgKey.ERR_USER_AUTH_MISSING, "고치려는 부여가 없습니다");

    private final String code;
    private final String defaultMessage;

    UserAuthErrorCode(String code, String defaultMessage) {
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
