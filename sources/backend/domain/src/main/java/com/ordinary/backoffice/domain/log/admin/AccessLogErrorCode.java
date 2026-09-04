package com.ordinary.backoffice.domain.log.admin;

import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.core.error.ErrorType;
import com.ordinary.backoffice.core.message.MsgKey;

/**
 * {@code ACCESS_LOG} 조회의 거부 — 64 §2.2 · §3.7.
 *
 * <p><b>셋 다 부하의 문제이거나 시간의 문제다.</b> 이 화면에는 쓰기가 없으므로(64 §2.1)
 * 저장 거부라는 것이 애초에 없다 — 여기 있는 것은 전부 <i>"그렇게 물으면 안 된다"</i> 이다.
 */
public enum AccessLogErrorCode implements ErrorCode {

    /**
     * 기간이 없다 — 64 §2.2.
     *
     * <p>조건 없이 열면 첫 조회가 <b>90일 전량</b>을 향한다. 폼도 막지만 서버가 다시 보는
     * 것은, 막는 이유가 <i>사용자 편의</i> 가 아니라 <b>부하</b>이기 때문이다.
     *
     * <p><b>추적 ID 를 넣으면 이 검사를 건너뛴다</b> — {@code TRACE_ID} 에 인덱스가 있어
     * 기간 없이도 인덱스를 탄다. <b>조건 하나가 다른 조건의 필수 여부를 바꾸는 첫 사례</b>다.
     */
    RANGE_REQUIRED(MsgKey.ERR_ACCESS_LOG_RANGE_REQUIRED, "조회 기간은 필수입니다"),

    /**
     * 기간이 상한을 넘었다 — 64 §2.2 · §3.7.
     *
     * <p><b>조용히 자르지 않는다.</b> 잘라 주면 사용자는 <i>"31일치를 봤다"</i> 고 믿은 채
     * 더 넓은 기간의 결론을 낸다.
     */
    RANGE_TOO_WIDE(MsgKey.ERR_ACCESS_LOG_RANGE_TOO_WIDE, "조회 기간이 허용 범위를 넘었습니다"),

    /**
     * {@code [보기]} 를 눌렀는데 그 행이 없다 — 64 §3.7.
     *
     * <p>목록을 조회한 뒤 파기 배치가 지나간 것이다(32 §4). <b>목록을 다시 읽지 않는다</b> —
     * 모달만 안내하고 화면은 그대로 둔다: 보던 목록이 눈앞에서 갈리는 것이 더 나쁘다.
     */
    PURGED(MsgKey.ERR_ACCESS_LOG_PURGED, "이미 파기된 이력입니다");

    private final String code;
    private final String defaultMessage;

    AccessLogErrorCode(String code, String defaultMessage) {
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
