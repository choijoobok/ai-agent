package com.aiagent.domain.notification.notice;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 공지 저장이 거부하는 것 — screen/admin/system/notice/requirements.md.
 *
 * <p><b>{@link #POPUP_RANGE} 가 이 화면 고유의 것</b>이다. 나머지 넷은 어느 마스터 화면에나
 * 있는 필수·기간 검증이지만, 이것은 <b>표시 측 계약</b>을 지키는 검증이다 — 팝업이
 * 게시보다 넓으면 <i>"공지 N건 더 있음"</i> 링크가 빈 목록으로 간다(screen/admin/system/notice/requirements.md C안).
 *
 * <p>화면도 넷을 앞서 막는다. 여기가 마지막 방어인 것이 backend/security.md 의 규칙이며,
 * <b>화면 밖 경로가 실재</b>하기 때문이다(시드 · 직접 호출).
 */
public enum NoticeErrorCode implements ErrorCode {

    REQUIRED(MsgKey.ERR_NOTICE_REQUIRED, "제목·본문·게시 시작은 필수입니다"),
    NOT_FOUND(MsgKey.ERR_NOTICE_NOT_FOUND, "없는 공지입니다"),
    PERIOD_INVALID(MsgKey.ERR_NOTICE_PERIOD, "게시 종료가 시작보다 앞입니다"),
    POPUP_RANGE(MsgKey.ERR_NOTICE_POPUP_RANGE, "팝업 기간이 게시 기간을 벗어납니다"),
    POPUP_PERIOD_REQUIRED(MsgKey.ERR_NOTICE_POPUP_PERIOD, "팝업을 켜면 팝업 기간은 필수입니다");

    private final String code;
    private final String defaultMessage;

    NoticeErrorCode(String code, String defaultMessage) {
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
