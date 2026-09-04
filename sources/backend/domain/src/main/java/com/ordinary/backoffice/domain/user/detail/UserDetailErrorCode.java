package com.ordinary.backoffice.domain.user.detail;

import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.core.error.ErrorType;
import com.ordinary.backoffice.core.message.MsgKey;

/**
 * 디테일 탭의 저장이 거부하는 것 — 61 §3.8.
 *
 * <p><b>편집이 있는 탭은 둘뿐</b>이라(보유 역할 · 접속 IP) 여기 있는 것도 그 둘의 것이다.
 * 개인 예외 · 유효 권한 · 활성 세션은 조회 전용이며, 강제 로그아웃의 <i>자기 자신</i> 거부는
 * 세션이 도메인 밖이라 {@code api} 가 갖는다(architecture.md §1).
 *
 * <p><b>{@code UserAdminErrorCode} 와 접두를 나눈다.</b> 저기는 {@code SYS_USER} 한 테이블의
 * 일이고 여기는 <b>그 계정에 매달린 것들</b>의 일이다 — 같은 화면이지만 고치는 테이블이
 * 다르고, 문구를 고치는 사람이 <i>어느 탭의 말인가</i> 를 키에서 읽을 수 있어야 한다.
 */
public enum UserDetailErrorCode implements ErrorCode {

    /** 없는 계정에 무언가를 매달려 했다 — FK 가 막기 전에 우리가 먼저 말한다. */
    USER_NOT_FOUND(MsgKey.ERR_USER_DETAIL_USER, "없는 계정입니다"),

    /** 없는 역할을 줬다. 화면이 낡았거나(그 사이 역할이 사라졌다) 화면 밖 경로다. */
    ROLE_NOT_FOUND(MsgKey.ERR_USER_DETAIL_ROLE, "없는 역할입니다"),

    /**
     * 이미 가진 역할을 또 줬다 — PK 가 {@code (USER_ID, ROLE_ID)} 다(42 §3.2).
     *
     * <p>재부여는 <b>같은 행의 기간을 갱신</b>하는 것이지 새 행이 아니다. 만료된 부여가
     * 목록에 남아 있는 상태에서 <i>다시 주려고</i> 행을 추가하면 정확히 이 오류가 나며,
     * 그때 할 일은 <b>그 행의 종료일을 미는 것</b>이다.
     */
    ROLE_DUPLICATE(MsgKey.ERR_USER_DETAIL_ROLE_DUPLICATE, "이미 가진 역할입니다"),

    /** 고치거나 지우려는 부여가 없다 — 다른 사람이 먼저 정리했다. */
    ROLE_MISSING(MsgKey.ERR_USER_DETAIL_ROLE_MISSING, "고치려는 역할 부여가 없습니다"),

    /** 부여 기간의 시작이 종료보다 늦다 — 그 부여는 어느 날도 유효하지 않다(40 §4.3). */
    PERIOD_REVERSED(MsgKey.ERR_USER_DETAIL_PERIOD, "부여 기간의 시작이 종료보다 늦습니다"),

    /**
     * IP 도 CIDR 도 아니다 — 41 §7 이 DDL 에 두지 않은 검사를 여기서 한다.
     *
     * <p>벤더 중립 DDL 에 정규식 {@code CHECK} 를 둘 수 없고(db-portability.md §4), 둘 수 있어도 IPv6
     * 축약까지 정규식으로 맞추는 것은 <b>저장 시 파싱보다 약하다</b>.
     */
    IP_MALFORMED(MsgKey.ERR_USER_DETAIL_IP, "IP 주소 또는 CIDR 형식이 아닙니다"),

    /** 같은 대역을 두 번 넣었다 — PK 가 {@code (USER_ID, IP_CIDR)} 다(41 §7). */
    IP_DUPLICATE(MsgKey.ERR_USER_DETAIL_IP_DUPLICATE, "이미 등록된 대역입니다"),

    /** 고치거나 지우려는 대역이 없다. */
    IP_MISSING(MsgKey.ERR_USER_DETAIL_IP_MISSING, "고치려는 허용 대역이 없습니다");

    private final String code;
    private final String defaultMessage;

    UserDetailErrorCode(String code, String defaultMessage) {
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
