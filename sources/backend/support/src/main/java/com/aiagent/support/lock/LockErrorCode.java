package com.aiagent.support.lock;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 락이 내는 실패 — backend/persistence.md 의 {@link LockConflict#EXCEPTION} 하나뿐이다.
 *
 * <p><b>{@code CONFLICT} 는 사용자가 고칠 수 있는 실패다.</b> 잠깐 뒤에 다시 누르면 된다 —
 * 그래서 400 대이고, 500 으로 올리면 <b>정상적인 경합이 에러 로그를 채운다</b>.
 *
 * <p><b>저장소 장애는 여기 없다.</b> backend/persistence.md 이 <i>fail-closed</i> 로 정했으므로 판정할 수
 * 없으면 실행하지 않는데, 그 실패는 락의 실패가 아니라 <b>DB 의 실패</b>이며 이미 500 으로
 * 나간다 — 여기에 코드를 만들면 <i>"락 때문에 실패했다"</i> 로 읽혀 진단이 어긋난다.
 */
public enum LockErrorCode implements ErrorCode {

    CONFLICT(MsgKey.ERR_LOCK_CONFLICT, "다른 작업이 처리 중입니다. 잠시 후 다시 시도해 주세요");

    private final String code;
    private final String defaultMessage;

    LockErrorCode(String code, String defaultMessage) {
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
