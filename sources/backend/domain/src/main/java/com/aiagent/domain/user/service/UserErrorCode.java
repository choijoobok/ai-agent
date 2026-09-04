package com.aiagent.domain.user.service;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/** 사용자 자신의 설정 변경이 거부되는 자리 — frontend/tabs.md. */
public enum UserErrorCode implements ErrorCode {

    LOCALE_UNSUPPORTED(MsgKey.ERR_USER_LOCALE_UNSUPPORTED, "지원하지 않는 언어입니다"),

    /** 현재 비밀번호 확인 실패 — AUTH-05. 로그인 실패 횟수는 올리지 않는다(backend/security.md). */
    PWD_MISMATCH(MsgKey.ERR_USER_PWD_MISMATCH, "현재 비밀번호가 일치하지 않습니다"),

    /** 정책 미달 — 길이·문자 종류. 문구가 정책 값을 나른다. */
    PWD_WEAK(MsgKey.ERR_USER_PWD_WEAK, "비밀번호가 정책을 충족하지 않습니다"),

    /** 최근 N건 안에 있던 값 — sys/user-role.md. */
    PWD_REUSED(MsgKey.ERR_USER_PWD_REUSED, "최근에 사용한 비밀번호는 다시 쓸 수 없습니다"),

    /** 지금 쓰는 것과 같다 — 이력에는 아직 없으므로 별도 판정이다. */
    PWD_UNCHANGED(MsgKey.ERR_USER_PWD_UNCHANGED, "현재 비밀번호와 다른 값이어야 합니다");

    private final String code;
    private final String defaultMessage;

    UserErrorCode(String code, String defaultMessage) {
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
