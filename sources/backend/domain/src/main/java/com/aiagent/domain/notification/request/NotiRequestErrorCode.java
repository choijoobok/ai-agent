package com.aiagent.domain.notification.request;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 요청 처리가 거부하는 것 — 66 §5.3 · §5.7.
 *
 * <p>앞의 셋은 <b>저장 검증이 아니다</b>. 그 화면은 셀을 고치지 않으므로(66 §5.2)
 * 필수·형식 오류가 성립하지 않고, 거부되는 것은 전부 <b>판정의 전제</b>다 — 대상이
 * 있는가, 처리할 수 있는 상태인가, 반려의 답을 적었는가.
 *
 * <p><b>뒤의 둘은 반대편이다</b> — 요청을 <i>내는</i> 쪽(알림 모달 · 60 §8)이 만난다.
 * 한 열거형에 둔 것은 그 둘이 같은 테이블의 같은 규칙이기 때문이다: 여기서 갈라 두면
 * <i>요청이란 무엇인가</i> 가 두 곳에 적힌다.
 */
public enum NotiRequestErrorCode implements ErrorCode {

    NOT_FOUND(MsgKey.ERR_NOTI_REQ_NOT_FOUND, "없는 요청입니다"),
    NOT_RECEIVED(MsgKey.ERR_NOTI_REQ_NOT_RECEIVED, "이미 처리된 요청이 선택에 있습니다"),
    MEMO_REQUIRED(MsgKey.ERR_NOTI_REQ_MEMO_REQUIRED, "반려 사유는 필수입니다"),

    /** 요청을 <b>내는</b> 쪽 — 아래 둘은 관리자가 아니라 사용자가 만난다(60 §8). */
    CONTENT_REQUIRED(MsgKey.ERR_NOTI_REQ_CONTENT_REQUIRED, "요청 내용은 필수입니다"),
    DUPLICATE(MsgKey.ERR_NOTI_REQ_DUPLICATE, "같은 유형의 접수된 요청이 이미 있습니다");

    private final String code;
    private final String defaultMessage;

    NotiRequestErrorCode(String code, String defaultMessage) {
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
