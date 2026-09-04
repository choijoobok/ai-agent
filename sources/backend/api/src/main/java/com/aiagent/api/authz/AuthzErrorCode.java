package com.aiagent.api.authz;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 인가 거부 코드 — security-design.md §4.
 *
 * <p><b>넷 다 403 이지만 코드를 가르는 것이 요점이다.</b> 운영자가 받는 것은 셋 다 403 하나이며,
 * 구분하지 않으면 <i>"권한을 줬는데 403"</i> 문의에서 어디를 봐야 할지 알 수 없다.
 *
 * <table>
 *   <tr><th>코드</th><th>상태</th><th>고치는 곳</th></tr>
 *   <tr><td>{@code err.api-not-registered}</td><td>{@code SYS_API} 에 행이 없다</td><td>API 마스터 시드</td></tr>
 *   <tr><td>{@code err.api-not-mapped}</td><td>행은 있으나 매핑 0건</td><td>매핑 시드</td></tr>
 *   <tr><td>{@code err.no-authority}</td><td>API 는 정상이고 사람에게 권한이 없다</td><td>역할 권한 · 개인 예외</td></tr>
 *   <tr><td>{@code err.unclassified-api}</td><td>세 프리픽스 밖의 {@code /api/**}</td><td>컨트롤러 경로</td></tr>
 * </table>
 *
 * <p><b>기록처는 {@code SYS_LO_EXCEPTION.ERR_CD} 다</b>(architecture.md §6.3) — 그 테이블은 이력
 * 슬라이스가 만든다. 지금은 응답 봉투와 애플리케이션 로그에만 남는다.
 *
 * <p>사용자에게 나가는 문구는 <b>넷이 같다.</b> 어느 쪽이든 사용자가 할 수 있는 일은 같고,
 * 원인을 응답으로 흘리면 등록되지 않은 API 의 존재를 알려주는 셈이 된다. 진단은 코드로 한다.
 */
public enum AuthzErrorCode implements ErrorCode {

    NOT_REGISTERED(MsgKey.ERR_API_NOT_REGISTERED),
    NOT_MAPPED(MsgKey.ERR_API_NOT_MAPPED),
    NO_AUTHORITY(MsgKey.ERR_NO_AUTHORITY),

    /** 미분류가 경로 차원에서 fail-closed 다 — 오배치를 조용히 열지 않는다. */
    UNCLASSIFIED(MsgKey.ERR_UNCLASSIFIED_API),

    /**
     * 제한 세션 — 체인 #5. 비밀번호를 바꾸기 전에는 변경 API 외 전부 막힌다.
     *
     * <p>이것만 문구가 다르다. <b>사용자가 할 수 있는 일이 있기 때문</b>이다 — 나머지 넷은
     * 관리자에게 문의하는 것 말고 길이 없지만, 이것은 비밀번호를 바꾸면 풀린다.
     */
    PASSWORD_CHANGE_REQUIRED(
            MsgKey.ERR_PASSWORD_CHANGE_REQUIRED, "비밀번호를 변경해야 계속할 수 있습니다.");

    private static final String FORBIDDEN_MESSAGE = "권한이 없습니다.";

    private final String code;
    private final String defaultMessage;

    AuthzErrorCode(String code) {
        this(code, FORBIDDEN_MESSAGE);
    }

    AuthzErrorCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }

    @Override
    public String code() {
        return code;
    }

    @Override
    public ErrorType type() {
        return ErrorType.FORBIDDEN;
    }

    @Override
    public String defaultMessage() {
        return defaultMessage;
    }
}
