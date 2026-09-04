package com.aiagent.domain.auth;

/**
 * {@code SYS_LO_LOGIN.LOGIN_RSLT_CD} — sys/logs.md.
 *
 * <p>접근 제어 체인(backend/security.md)의 실패 지점과 1:1 이다. <b>여러 조건이 동시에 걸려도 코드는
 * 하나</b>이며 체인 순서상 <b>먼저 걸린 것</b>을 남긴다 — {@code USE_YN} → 기간 → 잠금 →
 * 휴면 → IP → 권한.
 *
 * <p><b>이력과 화면 문구는 대칭이 아니다.</b> {@link #FAIL_NO_USER} 와 {@link #FAIL_PWD} 는
 * 여기에 구분해 남기고 화면에는 같은 문구를 준다 — 갈리면 계정 열거가 된다(sys/logs.md).
 */
public enum LoginResultCode {
    SUCCESS,

    FAIL_NO_USER,
    FAIL_PWD,

    /** 체인 #2 — {@code USE_YN='N'}. */
    FAIL_DISABLED,
    /** 체인 #3 — 사용 <b>기간</b> 만료. 세션 만료가 아니다. */
    FAIL_EXPIRED,
    /** 체인 #4 — 잠금. */
    FAIL_LOCKED,
    /** 휴면. 본인 재인증(비밀번호 재설정)이 곧 해제 경로다 — sys/user-role.md. */
    FAIL_DORMANT,
    /** AUTH-08 — 허용 IP 아님. */
    FAIL_IP,
    /** 유효 권한이 공집합 — 빈 셸로 들여보내지 않는다(backend/security.md). */
    FAIL_NO_AUTHORITY,
    /** 관리자 발급 임시 비밀번호가 {@code temp-valid-hours} 경과. */
    FAIL_TEMP_EXPIRED,
    /**
     * {@code prevent-login: true} 에서 기존 세션이 살아 있어 <b>신규 로그인이 거부</b>됨 —
     * backend/security.md · sys/logs.md(2026-08-29 추가).
     *
     * <p>{@link #SESSION_EVICTED} 와 <b>정반대의 사건</b>이다 — 그쪽은 기존 세션이 밀려난 것,
     * 이쪽은 기존 세션이 이겨 새 로그인이 막힌 것이다. 설정 하나로 갈리므로 코드가 없으면
     * <i>"비밀번호가 맞는데 왜 안 되나"</i> 가 이력에 남지 않는다.
     */
    FAIL_CONCURRENT,

    LOGOUT,
    /** 세션 만료. <b>기록 시점은 첫 401</b> 이다 — sys/logs.md. */
    SESSION_TIMEOUT,
    /** 관리자 강제 로그아웃(AUTH-10). */
    FORCED_LOGOUT,
    /** 동시 접속 제어로 밀려남 — backend/security.md. 없으면 "갑자기 로그아웃됨" 에 답할 수 없다. */
    SESSION_EVICTED;

    /** 비밀번호 만료(체인 #5)는 실패가 아니다 — 로그인은 성공하고 제한 세션이 된다(sys/logs.md). */
    public boolean isSuccess() {
        return this == SUCCESS;
    }
}
