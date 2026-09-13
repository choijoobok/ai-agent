// @feat FEAT-503
package com.aiagent.sample.domain;

/**
 * 주문 상태 넷과 전이 — playbook/INDEX.md.
 *
 * <p><b>공통코드에도 있다</b>({@code SMPL_ORD_STAT}). 값이 두 곳에 있는 것이 의도이며
 * sys/code.md 가 그 갈림을 정했다 — <b>값에 따라 소스의 판단이 갈리면 소스가 값을 가져야
 * 한다</b>. 여기서 갈리는 것은 셋이다: 다음 상태가 무엇인가, 어느 칸이 편집되는가,
 * 출고 지시 대상인가.
 *
 * <p>공통코드 쪽은 <b>이름과 순서</b>를 갖는다 — 화면에 보이는 글자는 운영이 정한다.
 */
public enum OrderStatus {

    /** 접수 — <b>전부 열린다</b>. */
    RCV,

    /** 확정 — 수량·단가가 <b>잠긴다</b>. 확정된 금액이다. */
    CFM,

    /** 출고 — 배송 관련만 열린다. */
    SHP,

    /** 완료 — <b>전부 잠긴다</b>. */
    DON;

    /** 다음 상태 — 마지막은 없다. */
    public OrderStatus next() {
        return switch (this) {
            case RCV -> CFM;
            case CFM -> SHP;
            case SHP -> DON;
            case DON -> null;
        };
    }

    /**
     * 모르는 값은 <b>거절한다</b>.
     *
     * <p>조용히 {@code RCV} 로 떨어뜨리면 화면 밖 경로가 보낸 오타가 <b>접수 상태의
     * 주문</b>이 되어 저장되고, 그 행은 정상으로 보인다.
     */
    public static OrderStatus of(String code) {
        for (OrderStatus status : values()) {
            if (status.name().equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("not an order status: " + code);
    }
}
