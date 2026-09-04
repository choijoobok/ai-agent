package com.aiagent.domain.notification.inbox;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * <i>내 알림</i> 이 거부하는 것 — main-shell.md §7 · 60 §8.
 *
 * <p><b>하나뿐이다.</b> 이 탭은 읽기와 읽음 표시밖에 하지 않으므로 거부할 것이
 * <i>대상이 내 것인가</i> 하나로 수렴한다.
 *
 * <p><b>{@code FORBIDDEN} 이 아니라 {@code INVALID_REQUEST} 다.</b> 남의 알림 번호를
 * 넣었을 때 403 으로 답하면 <b>그 번호가 실재한다</b>는 것을 알려 준다 — 알림은 사람마다
 * 행이 다르므로(47 §7) 남의 것과 없는 것은 <b>같은 답</b>이어야 한다.
 */
public enum NotiInboxErrorCode implements ErrorCode {
    NOT_FOUND(MsgKey.ERR_NOTI_INBOX_NOT_FOUND, "없는 알림입니다");

    private final String code;
    private final String defaultMessage;

    NotiInboxErrorCode(String code, String defaultMessage) {
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
