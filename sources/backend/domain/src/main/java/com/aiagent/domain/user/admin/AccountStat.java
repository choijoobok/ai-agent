package com.aiagent.domain.user.admin;

/**
 * 계정 상태 — screen/user/requirements.md. <b>파생값이며 컬럼이 아니다.</b>
 *
 * <p>sys/user-role.md 가 계정을 못 쓰게 하는 것을 넷으로 갈랐다({@code USE_YN} · 기간 만료 ·
 * {@code LOCK_YN} · {@code DORMANT_YN}). <b>목록에 넷을 나란히 두면 운영자가 매 행에서 넷을
 * 읽어 조합해야 한다</b> — 그래서 <b>접근 제어 체인 순서로 먼저 걸린 것 하나</b>만 낸다.
 *
 * <p>로그인 이력이 결과 코드를 하나만 남기는 것과 <b>같은 규칙</b>이며(sys/logs.md), 아래 순서가
 * 그대로 {@link com.aiagent.domain.auth.LoginResultCode} 의 실패 코드에 대응한다.
 *
 * <h2>공통코드가 아니다</h2>
 *
 * <p>서버가 계산하는 값이고 다섯에서 늘 일이 없다. 표시 문자열은 메시지 키({@code user.stat.*})
 * 이며 컬럼 타입도 {@code code} 가 아니라 {@code text} 다(screen/user/requirements.md · frontend/packages.md) — {@code code}
 * 는 공통코드 값을 위한 것이다.
 *
 * <h2>넷이 동시에 걸릴 수 있다</h2>
 *
 * <p>잠금을 풀어도 여전히 미사용일 수 있다. 이 열거가 하나로 접는 것은 <b>표시일 뿐</b>이며
 * sys/user-role.md 규칙 3(서로 덮지 않는다)을 바꾸지 않는다 — 원본 넷은 각각 컬럼으로 남아 있고
 * 기본 숨김이다(screen/user/requirements.md).
 */
public enum AccountStat {

    /** 넷 다 통과 — {@code SUCCESS}. */
    NORMAL,

    /** {@code USE_YN='N'} — {@code FAIL_DISABLED}. <b>관리자가 건다.</b> */
    DISABLED,

    /** 오늘이 사용 기간 밖 — {@code FAIL_EXPIRED}. 예정된 날짜가 도달한 것이다. */
    EXPIRED,

    /**
     * {@code LOCK_YN='Y'} — {@code FAIL_LOCKED}.
     *
     * <p><b>시간 경과 자동 해제를 보지 않는다.</b> 그것은 {@code SysUser.isLocked} 가 로그인
     * 시점에 하는 판정이고(backend/security.md), 목록이 그것까지 계산하면 <b>조회 조건의 SQL 과 표시가
     * 갈린다</b> — 조건은 컬럼으로 걸 수밖에 없기 때문이다. screen/user/requirements.md 의 표가 이 칸을
     * {@code LOCK_YN='Y'} 로 적은 것이 그 선택이며, 확실히 정리하는 수단은 ①의 잠금 해제다.
     */
    LOCKED,

    /** {@code DORMANT_YN='Y'} — {@code FAIL_DORMANT}. 배치가 건다(sys/user-role.md). */
    DORMANT
}
