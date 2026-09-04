package com.ordinary.backoffice.api.user;

import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.core.error.ErrorType;
import com.ordinary.backoffice.core.message.MsgKey;

/**
 * 활성 세션 탭이 거부하는 것 — AUTH-10 · 61 §3.8.2.
 *
 * <p><b>{@code api} 에 있는 것이 요점이다.</b> 다른 탭의 거부는
 * {@code UserDetailErrorCode}(도메인)에 있지만, 이 둘은 <b>세션이 도메인 밖</b>이라
 * 여기여야 한다(architecture.md §1) — {@code AuthzErrorCode} 가 같은 이유로 {@code api} 에 있다.
 */
public enum UserSessionErrorCode implements ErrorCode {

    /**
     * 자기 세션을 끊으려 했다 — 61 §3.7.1. <b>그 자리에서 화면 밖으로 밀려난다.</b>
     *
     * <p>사용 여부 {@code 'N'} 전환과 <b>같은 이유로 막고 다른 자리에서 막는다</b>: 저것은
     * 셀 편집이라 컬럼이 막고, 이것은 실행이라 <b>버튼이 비활성</b>이며 서버가 다시 본다.
     *
     * <p><b>자기 계정의 다른 세션도 함께 막힌다.</b> 동시 접속 상한의 기본값이 1 이라
     * (security-design.md §4-1) 정상 배포에서 <i>다른 세션</i> 이 존재하지 않고, 61 §3.7.1 이 대상을
     * <b>계정</b>으로 적었기 때문이다 — 상한을 2 이상으로 두는 배포에서 이 판정을 세션
     * 단위로 좁힐 여지가 있으며, 그때는 IP 를 함께 보게 되므로(61 §3.8.2 의 뒤집을 트리거)
     * 한 번에 다시 본다.
     */
    SELF(MsgKey.ERR_USER_SESSION_SELF, "자기 세션은 종료할 수 없습니다"),

    /**
     * 세션 인덱스가 없다 — {@code store-type: none} 이다(ADR-0002).
     *
     * <p>빈 목록으로 답하지 않는 이유는 {@link MsgKey#ERR_USER_SESSION_INDEX} 에 적혀 있다:
     * <b>모르는 것을 아는 것처럼</b> 말하게 된다.
     */
    INDEX_MISSING(MsgKey.ERR_USER_SESSION_INDEX, "이 배포에서는 활성 세션을 볼 수 없습니다");

    private final String code;
    private final String defaultMessage;

    UserSessionErrorCode(String code, String defaultMessage) {
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
