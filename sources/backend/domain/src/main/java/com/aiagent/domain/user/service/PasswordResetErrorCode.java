package com.aiagent.domain.user.service;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 분실 비밀번호 재설정이 거부되는 자리 — AUTH-07 · {@code documents/screen/_standalone/login/requirements.md} §6-5.
 *
 * <p><b>{@code AuthErrorCode}(api) 와 갈라 둔 것이 요건이다.</b>
 * 저쪽은 전부 401 인데({@code UNAUTHENTICATED}) 이쪽은 <b>인증을 시도한 것이 아니다</b> —
 * 401 로 내보내면 프론트의 세션 신호가 그것을 <i>세션이 끊겼다</i> 로 읽고 재인증 모달을
 * 띄우려 든다(frontend-stack.md §9). 로그인 화면에서는 세션이 없어 지금은 조용하지만, 그 침묵은
 * <b>우연이지 설계가 아니다</b>.
 *
 * <p><b>발송 실패의 코드가 없다.</b> 계정이 없어도 메일이 안 나가도 응답이 같아야 하므로
 * (계정 열거 방지 — 요건서 §6-3) 실패를 알릴 자리가 존재하지 않는다.
 */
public enum PasswordResetErrorCode implements ErrorCode {

    /** 인증번호 불일치. <b>남은 시도 횟수를 알려주지 않는다</b> — 로그인 실패와 같은 규칙이다. */
    CODE_INVALID(MsgKey.ERR_RESET_CODE_INVALID, "인증번호가 올바르지 않습니다."),

    /**
     * 만료 · 이미 사용 · 시도 한도 초과 · <b>발급받은 적이 없음</b> — 넷이 한 코드다.
     *
     * <p>사용자가 할 일이 넷 다 같고(①로 돌아가 다시 받는다), 갈라 두면 <i>"이 아이디에
     * 유효한 토큰이 있었다"</i> 를 알려주는 응답이 생긴다.
     */
    CODE_EXPIRED(
            MsgKey.ERR_RESET_CODE_EXPIRED,
            "인증번호가 만료됐습니다. 처음부터 다시 요청하세요.");

    private final String code;
    private final String defaultMessage;

    PasswordResetErrorCode(String code, String defaultMessage) {
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
