package com.aiagent.domain.config.admin;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * {@code CONFIG_MGMT} 저장의 거부 — 63 §4.
 *
 * <p><b>셋 다 화면이 미리 막을 수 없거나, 막았어도 서버가 다시 보는 것이다</b>(grid-edit-validation.md §3.4).
 * 특히 {@link #INVALID_VALUE} 는 <b>화면이 복제해서는 안 되는</b> 판정이다 — 제약의 단일
 * 원본은 바인딩 객체이고(43 §6.2) 화면이 옮겨 적으면 원본이 둘이 된다.
 */
public enum ConfigErrorCode implements ErrorCode {

    /** {@code yml} 이 정한 키 목록에 없다 — 아우터 조인의 <b>왼쪽에 없는 키</b>다. */
    KEY_UNKNOWN(MsgKey.ERR_CONFIG_KEY_UNKNOWN, "코드가 정하지 않은 설정 키입니다"),

    /** 되돌릴 행이 없다 — 다른 사람이 먼저 되돌렸다. */
    NOT_OVERRIDDEN(MsgKey.ERR_CONFIG_NOT_OVERRIDDEN, "이미 기본값으로 되돌아간 설정입니다"),

    /** 재바인딩이 거부했다 — 타입·{@code @Min}·상호 제약이 여기 모인다(ADR-0026 §3). */
    INVALID_VALUE(MsgKey.ERR_CONFIG_INVALID_VALUE, "설정값이 규칙에 맞지 않습니다");

    private final String code;
    private final String defaultMessage;

    ConfigErrorCode(String code, String defaultMessage) {
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
