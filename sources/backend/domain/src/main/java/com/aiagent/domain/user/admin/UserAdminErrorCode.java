package com.aiagent.domain.user.admin;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 사용자 관리가 거부하는 것 — 61 §3.2 · §3.6 · §3.7.1.
 *
 * <p><b>{@code UserErrorCode} 와 축이 다르다.</b> 저기는 <b>본인이</b> 자기 계정에 하는 일의
 * 실패(비밀번호 변경 · 언어)이고 여기는 <b>관리자가 남의 계정에</b> 하는 일이다. 같은 열거에
 * 담으면 <i>내 프로필</i> 화면이 관리자용 문구를 상속하게 된다.
 *
 * <p><b>전부 서버가 마지막으로 막는 것이다.</b> 화면도 같은 것을 막지만(삭제 컬럼이 아예 없고
 * 자기 행의 셀이 잠긴다) 그것은 <b>UX 이지 방어가 아니다</b>(security-design.md §4) — 요청 본문은 조작할 수
 * 있고, 화면 없이 부르는 경로가 늘 있다.
 */
public enum UserAdminErrorCode implements ErrorCode {

    DUPLICATE_ID(MsgKey.ERR_USER_ADMIN_DUPLICATE, "이미 있는 로그인 ID 입니다"),
    NOT_FOUND(MsgKey.ERR_USER_ADMIN_NOT_FOUND, "없는 계정입니다"),
    NAME_REQUIRED(MsgKey.ERR_USER_ADMIN_NAME_REQUIRED, "이름은 필수입니다"),
    EMAIL_REQUIRED(MsgKey.ERR_USER_ADMIN_EMAIL_REQUIRED, "이메일은 필수입니다"),
    PERIOD_REVERSED(MsgKey.ERR_USER_ADMIN_PERIOD, "사용 기간의 시작이 종료보다 늦습니다"),

    /** {@code SYS_USER} 는 물리 삭제를 하지 않는다 — 41 §4.5 · USER-02. */
    DELETE_NOT_SUPPORTED(MsgKey.ERR_USER_ADMIN_NO_DELETE, "계정은 삭제할 수 없습니다"),

    /** 61 §3.7.1 — 그 자리에서 화면 밖으로 밀려난다. */
    SELF_DISABLE(MsgKey.ERR_USER_ADMIN_SELF_DISABLE, "자기 계정은 사용 중지할 수 없습니다"),

    RESET_DISABLED(MsgKey.ERR_USER_ADMIN_RESET_DISABLED, "임시 비밀번호 발급이 꺼져 있습니다");

    private final String code;
    private final String defaultMessage;

    UserAdminErrorCode(String code, String defaultMessage) {
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
