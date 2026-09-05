package com.aiagent.domain.log.errorlog;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * {@code ERROR_LOG} 조회의 거부 — screen/log/error/requirements.md.
 *
 * <p>{@code AccessLogErrorCode} 와 셋이 같다. 다른 것은 <b>기간의 상한을 덮지 않는다</b>는
 * 것뿐이며(행이 가볍다 — screen/log/error/requirements.md) 그 사실은 코드가 아니라 서비스에 있다.
 *
 * <p><b>이 코드들이 자기 테이블에 남는다.</b> 400 으로 나가는 순간 {@code SYS_LO_EXCEPTION}
 * 에 한 행이 되므로, 기간을 비우고 조회하면 <b>다음 조회에서 자기 오류가 맨 위에</b> 보인다 —
 * 사용 이력의 자기 참조(screen/log/error/requirements.md)와 같은 종류이고 고장이 아니다.
 */
public enum ErrorLogErrorCode implements ErrorCode {

    /**
     * 기간이 없다 — screen/log/access/requirements.md.
     *
     * <p><b>추적 ID 를 넣으면 이 검사를 건너뛴다.</b> 이 화면에서 그것은 예외가 아니라
     * <b>주된 동선</b>이다 — 셋 중 유일하게 사람이 먼저 찾아오는 화면이고(screen/log/error/requirements.md), 들고 오는
     * 것이 5xx 토스트의 {@code traceId} 다(frontend/packages.md).
     */
    RANGE_REQUIRED(MsgKey.ERR_ERROR_LOG_RANGE_REQUIRED, "조회 기간은 필수입니다"),

    /**
     * 기간이 상한을 넘었다 — screen/log/error/requirements.md.
     *
     * <p><b>조용히 자르지 않는다.</b> 잘라 주면 사용자는 <i>"92일치를 봤다"</i> 고 믿은 채
     * 더 넓은 기간의 결론을 낸다 — 보존이 180일이라 <b>여기서는 못 본 절반이 실제로 있다</b>.
     */
    RANGE_TOO_WIDE(MsgKey.ERR_ERROR_LOG_RANGE_TOO_WIDE, "조회 기간이 허용 범위를 넘었습니다"),

    /**
     * {@code [보기]} 를 눌렀는데 그 행이 없다 — screen/log/error/requirements.md.
     *
     * <p>목록을 조회한 뒤 파기 배치가 지나간 것이다(retention.md). <b>목록을 다시 읽지 않는다</b> —
     * 모달만 안내하고 화면은 그대로 둔다.
     *
     * <p><b>전문이 없는 것과 다르다.</b> 그쪽은 사용 이력의 90일이 지난 것이고 오류 행은
     * 멀쩡히 있다 — 그래서 그것은 오류가 아니라 <b>탭 하나의 안내 문구</b>다(screen/log/error/requirements.md).
     */
    PURGED(MsgKey.ERR_ERROR_LOG_PURGED, "이미 파기된 이력입니다");

    private final String code;
    private final String defaultMessage;

    ErrorLogErrorCode(String code, String defaultMessage) {
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
