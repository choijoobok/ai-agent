package com.aiagent.domain.batch.history;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 실행 이력 화면이 거부하는 것 — 65 §4.5 · §4.10. <b>둘뿐이다.</b>
 *
 * <p>조회 전용 화면이라 저장이 없고({@code api.save} 를 선언하지 않는다 — 65 §4.8) 그래서
 * 거부할 것도 <b>{@code X} 하나에 딸린 것</b>과 <b>파기</b>뿐이다.
 *
 * <p><b>{@link #PURGED} 는 고장이 아니다.</b> 목록을 본 뒤 파기 배치가 지나간 것이며
 * (32 §3 — 보존 1년), {@code ErrorLogErrorCode.PURGED} 와 같은 자리다. 목록을 다시
 * 그리지 않는 것이 규약이다 — 사용자가 보던 화면이 발밑에서 바뀌는 것이 더 나쁘다.
 */
public enum BatchHistoryErrorCode implements ErrorCode {

    /** {@code [보기]} 를 눌렀는데 그 사이 파기됐다 — 65 §4.10. */
    PURGED(MsgKey.ERR_BATCH_HIST_PURGED, "이미 파기된 이력입니다"),

    /**
     * 중단 대상이 아니다 — {@code RUNNING} 이 아니다(65 §4.5).
     *
     * <p><b>조용히 건너뛰지 않는다.</b> 화면이 고른 사이 배치가 끝났을 수 있고, 그때
     * 건너뛰면 운영자는 <i>중단이 먹었다</i> 고 믿는다 — 실패가 시끄러운 쪽이다(원칙 P1).
     */
    NOT_CANCELABLE(MsgKey.ERR_BATCH_HIST_NOT_CANCELABLE, "실행 중인 이력이 아닙니다");

    private final String code;
    private final String defaultMessage;

    BatchHistoryErrorCode(String code, String defaultMessage) {
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
