package com.ordinary.backoffice.domain.batch.schedule;

import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.core.error.ErrorType;
import com.ordinary.backoffice.core.message.MsgKey;

/**
 * 배치 등록의 저장·실행이 거부하는 것 — 65 §3.4 · §3.7 · §3.8.
 *
 * <p><b>화면이 앞서 막는 것이 둘뿐이다</b>({@link #NOT_DELETABLE} 의 <i>켜져 있음</i> 과
 * {@link #PARAM_JSON_INVALID}). 나머지는 <b>서버만 아는 사실</b>에 걸린다 — 크론의 최소
 * 간격은 파서가 있어야 알고(65 §3.4), 등록된 빈 목록은 스프링 컨텍스트가 안다.
 * {@code RoleErrorCode} 에서 화면이 미리 막던 것이 <i>건수 컬럼</i> 이었던 것과
 * 대비되는 자리다.
 *
 * <p><b>{@link #ALREADY_RUNNING} 만 저장이 아니다.</b> 즉시 실행의 거부이며, 그래서
 * 이 열거형에 <i>실행</i>이 하나 섞여 있다 — 화면 하나가 {@code S} 와 {@code X} 를 함께
 * 갖기 때문이다(52 §4.2 의 액션 열이 {@code R S X}).
 */
public enum BatchScheduleErrorCode implements ErrorCode {

    DUPLICATE_ID(MsgKey.ERR_BATCH_DUPLICATE, "이미 있는 배치 ID 입니다"),
    NOT_FOUND(MsgKey.ERR_BATCH_NOT_FOUND, "없는 배치입니다"),
    NAME_REQUIRED(MsgKey.ERR_BATCH_NAME_REQUIRED, "배치명은 필수입니다"),
    DESC_REQUIRED(MsgKey.ERR_BATCH_DESC_REQUIRED, "설명은 필수입니다"),
    BEAN_UNKNOWN(MsgKey.ERR_BATCH_BEAN_UNKNOWN, "등록된 배치 구현이 아닙니다"),
    CRON_INVALID(MsgKey.ERR_BATCH_CRON_INVALID, "크론 표현식이 올바르지 않습니다"),
    COOLDOWN_TOO_LONG(MsgKey.ERR_BATCH_COOLDOWN_TOO_LONG, "쿨다운이 크론 주기보다 깁니다"),
    PARAM_JSON_INVALID(MsgKey.ERR_BATCH_PARAM_JSON, "파라미터가 올바른 JSON 이 아닙니다"),
    NOT_DELETABLE(MsgKey.ERR_BATCH_NOT_DELETABLE, "켜져 있거나 실행 중이어서 삭제할 수 없습니다"),
    ALREADY_RUNNING(MsgKey.ERR_BATCH_ALREADY_RUNNING, "이미 실행 중입니다");

    private final String code;
    private final String defaultMessage;

    BatchScheduleErrorCode(String code, String defaultMessage) {
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
