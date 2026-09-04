package com.ordinary.backoffice.api.auth;

import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.core.error.ErrorType;
import com.ordinary.backoffice.core.message.MsgKey;

/**
 * 로그인 실패 코드 — 60 §3.6 의 화면 분기와 1:1.
 *
 * <p><b>{@code FAIL_NO_USER} 와 {@code FAIL_PWD} 가 같은 코드·같은 문구로 나가는 것이 이
 * 화면의 핵심 제약이다</b>(60 §3.6). 갈리면 계정 열거가 된다. 이력에는 구분해 남으므로
 * (45 §5.2) 진단은 잃지 않는다.
 *
 * <p><b>문구를 여기 두는 것은 임시다.</b> 단일 원본은 {@code SYS_MESSAGE} 이며 서버가
 * 번역을 완성해 담는다(architecture.md §6-1.2) — 메시지 슬라이스가 이 자리를 조회로 바꾼다.
 */
public enum AuthErrorCode implements ErrorCode {

    /** 존재하지 않는 ID <b>와</b> 비밀번호 불일치. 남은 횟수도 알려주지 않는다(50 §4.1). */
    LOGIN_FAILED(
            MsgKey.ERR_LOGIN_FAILED,
            "아이디 또는 비밀번호가 올바르지 않습니다."),

    DISABLED(
            MsgKey.ERR_LOGIN_DISABLED,
            "사용할 수 없는 계정입니다. 관리자에게 문의하세요."),

    EXPIRED(
            MsgKey.ERR_LOGIN_EXPIRED,
            "사용 기간이 만료된 계정입니다. 관리자에게 문의하세요."),

    LOCKED(
            MsgKey.ERR_LOGIN_LOCKED,
            "계정이 잠겼습니다. 비밀번호 재설정으로 해제하거나 관리자에게 문의하세요."),

    /** 재설정 흐름이 곧 본인 재인증이며 마치면 휴면이 풀린다(41 §4.2). */
    DORMANT(
            MsgKey.ERR_LOGIN_DORMANT,
            "장기 미접속으로 휴면 상태입니다. 비밀번호 재설정으로 본인 확인을 마치면 해제됩니다."),

    IP_DENIED(
            MsgKey.ERR_LOGIN_IP_DENIED,
            "허용되지 않은 위치에서의 접속입니다."),

    /** 빈 셸로 들여보내지 않는다(security-design.md §4). */
    NO_AUTHORITY(
            MsgKey.ERR_LOGIN_NO_AUTHORITY,
            "부여된 권한이 없어 로그인할 수 없습니다. 관리자에게 문의하세요."),

    TEMP_EXPIRED(
            MsgKey.ERR_LOGIN_TEMP_EXPIRED,
            "임시 비밀번호가 만료됐습니다. 재발급을 요청하세요."),

    /**
     * {@code prevent-login: true} 에서 기존 세션이 살아 있어 신규 로그인을 거부한 것 — security-design.md §4-1.
     *
     * <p><b>계정 열거가 아니다.</b> 이 응답이 나갔다는 것은 <b>비밀번호가 맞았다</b>는 뜻이지만,
     * 그 사실을 알려면 <b>자기 계정으로 이미 로그인한 세션이 어딘가 있어야</b> 한다 — 남의
     * 계정에 대해서는 얻을 수 없는 정보다. 여기서 문구를 합치면 사용자가 원인을 알 수 없다.
     */
    CONCURRENT_LOGIN(
            MsgKey.ERR_LOGIN_CONCURRENT,
            "이미 다른 곳에서 로그인되어 있습니다. 그 접속을 끝낸 뒤 다시 시도하세요."),

    /**
     * 밀려난 쪽이 다음 요청에서 받는 401 — security-design.md §4-1 · 45 §5.1.
     *
     * <p>보통의 세션 만료와 코드를 가르는 이유는 <b>사용자가 할 일이 다르기 때문</b>이다.
     * 유휴 만료는 다시 로그인하면 그만이지만, 이것은 <i>"내 계정으로 누가 들어왔다"</i> 일 수
     * 있다 — 문구가 같으면 그 신호가 사라진다.
     */
    SESSION_EVICTED(
            MsgKey.ERR_SESSION_EVICTED,
            "다른 곳에서 로그인하여 이 접속이 종료됐습니다.");

    private final String code;
    private final String defaultMessage;

    AuthErrorCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }

    @Override
    public String code() {
        return code;
    }

    /** 로그인 실패는 전부 401 이다 — 인증되지 않은 것이지 인가가 거부한 것이 아니다. */
    @Override
    public ErrorType type() {
        return ErrorType.UNAUTHENTICATED;
    }

    @Override
    public String defaultMessage() {
        return defaultMessage;
    }
}
