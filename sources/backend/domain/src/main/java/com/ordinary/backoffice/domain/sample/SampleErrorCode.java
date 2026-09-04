package com.ordinary.backoffice.domain.sample;

import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.core.error.ErrorType;
import com.ordinary.backoffice.core.message.MsgKey;

/**
 * 샘플 저장이 거부하는 것 — 68 §5.
 *
 * <p><b>{@link #HAS_ITEMS} 가 이 화면 고유의 것</b>이다. grid-standard.md §6.2 의 <b>마스터 삭제
 * 게이트</b>이며, 화면이 체크박스를 열지 않는 것과 <b>같은 사실을 서버가 다시</b> 말한다 —
 * 화면 밖 경로가 실재하고(직접 호출) FK 의 {@code RESTRICT} 는 <i>제약 위반</i> 이라는
 * 읽을 수 없는 문구로만 답한다(48 §5.1).
 */
public enum SampleErrorCode implements ErrorCode {

    REQUIRED(MsgKey.ERR_SAMPLE_REQUIRED, "주문번호·주문명·고객은 필수입니다"),
    NOT_FOUND(MsgKey.ERR_SAMPLE_NOT_FOUND, "없는 주문입니다"),
    DUPLICATED(MsgKey.ERR_SAMPLE_DUPLICATED, "이미 있는 주문번호입니다"),
    LOCKED(MsgKey.ERR_SAMPLE_LOCKED, "잠긴 주문은 고칠 수 없습니다"),
    HAS_ITEMS(MsgKey.ERR_SAMPLE_HAS_ITEMS, "품목이 있는 주문은 지울 수 없습니다"),
    NOT_SHIPPABLE(MsgKey.ERR_SAMPLE_NOT_SHIPPABLE, "확정 상태의 주문만 출고 지시할 수 있습니다"),
    NOT_CONFIRMABLE(MsgKey.ERR_SAMPLE_NOT_CONFIRMABLE, "접수 상태의 주문만 확정할 수 있습니다"),
    NOT_RECALCULABLE(
            MsgKey.ERR_SAMPLE_NOT_RECALCULABLE,
            "확정 전(접수) 주문의 품목만 다시 계산할 수 있습니다"),
    RANGE_REQUIRED(MsgKey.ERR_SAMPLE_RANGE_REQUIRED, "주문일시는 필수입니다"),
    RANGE_TOO_WIDE(MsgKey.ERR_SAMPLE_RANGE_TOO_WIDE, "조회 기간은 31일을 넘을 수 없습니다"),
    RMK_REQUIRED(MsgKey.ERR_SAMPLE_RMK_REQUIRED, "할인율이 있으면 비고가 필요합니다"),
    TAG_REQUIRED(MsgKey.ERR_SAMPLE_TAG_REQUIRED, "태그명과 정렬순서는 필수입니다"),
    TAG_SORT_DUPLICATED(MsgKey.ERR_SAMPLE_TAG_SORT_DUPLICATED, "태그의 정렬순서가 겹칩니다"),
    TAG_TOO_MANY(MsgKey.ERR_SAMPLE_TAG_TOO_MANY, "태그는 최대 20개입니다"),
    NO_SUCH_ORDER(MsgKey.ERR_SAMPLE_NO_SUCH_ORDER, "없는 주문번호입니다"),
    ITEM_DUPLICATED(MsgKey.ERR_SAMPLE_ITEM_DUPLICATED, "같은 주문에 같은 품목코드가 두 번 있습니다");

    private final String code;
    private final String defaultMessage;

    SampleErrorCode(String code, String defaultMessage) {
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
