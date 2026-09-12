package com.aiagent.domain.auth.loginlog;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * {@code LOGIN_LOG} 조회의 거부 — screen/admin/system/log/login/requirements.md.
 *
 * <p><b>둘뿐이고 둘 다 기간이다.</b> 이 화면에는 쓰기가 없고(screen/admin/system/log/login/requirements.md) 두 번째 호출도 없어
 * (§4.7 — {@code nclob} 컬럼이 없다) 거부할 것이 기간 말고 없다.
 *
 * <p><b>{@code AccessLogErrorCode} 의 같은 둘과 키를 공유하지 않는다.</b> 규칙은
 * {@link com.aiagent.core.search.RangeGuard} 하나가 갖지만 <b>문구는 화면의
 * 것</b>이다 — 상한이 31일과 92일로 다르고 보존이 90일과 1년으로 다르므로, 같은 문장을
 * 쓰면 <i>어느 쪽 숫자를 말하는지</i> 를 사용자가 알 수 없다.
 */
public enum LoginLogErrorCode implements ErrorCode {

    /**
     * 기간이 없다 — screen/admin/system/log/access/requirements.md.
     *
     * <p>보존이 <b>1년</b>이라 조건 없이 열면 첫 조회가 그 전량을 향한다. 사용 이력보다
     * 행이 가볍지만(전문이 없다) <b>가장 오래 사는 테이블</b>이다.
     *
     * <p><b>추적 ID 를 넣으면 이 검사를 건너뛴다</b> — {@code TRACE_ID} 에 인덱스가 있어
     * 기간 없이도 인덱스를 탄다(sys/logs.md).
     */
    RANGE_REQUIRED(MsgKey.ERR_LOGIN_LOG_RANGE_REQUIRED, "조회 기간은 필수입니다"),

    /**
     * 기간이 상한(92일)을 넘었다 — screen/admin/system/log/login/requirements.md.
     *
     * <p><b>보존보다 창이 짧은 유일한 화면이다.</b> 1년치를 봐야 하면 엑셀을 네 번 내린다 —
     * 조용히 잘라 주면 사용자는 <i>"1년치를 봤다"</i> 고 믿은 채 결론을 낸다.
     */
    RANGE_TOO_WIDE(MsgKey.ERR_LOGIN_LOG_RANGE_TOO_WIDE, "조회 기간이 허용 범위를 넘었습니다");

    private final String code;
    private final String defaultMessage;

    LoginLogErrorCode(String code, String defaultMessage) {
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
