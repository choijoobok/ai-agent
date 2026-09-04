package com.aiagent.domain.sample;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 마스터 저장의 한 행 — playbook/INDEX.md.
 *
 * <p><b>파생 셋이 없다</b>({@code ordAmt} · {@code vatAmt} · {@code itemCnt}). 화면은
 * {@code afterEdit} 으로 앞의 둘을 계산해 보여 주지만(frontend/grid.md) 그것은 <i>보여주기</i> 이고,
 * 받을 경로를 두면 <b>화면이 금액을 스스로 정하는</b> 셈이 된다 — 읽기 전용은 화면에서만
 * 읽기 전용이고 요청 본문은 조작할 수 있다(원칙 P1).
 *
 * <p><b>{@code lockYn} 도 없다.</b> 그것은 운영이 정하는 것이고 이 화면은 그리지도 않는다
 * (playbook/INDEX.md — {@code hidden}). 받으면 <b>잠긴 주문이 스스로 잠금을 푸는</b> 요청이 성립한다.
 *
 * <p>{@code ordId} 는 신규 행에서 {@code null} 이고(채번) 수정·삭제에서는 <b>대상을
 * 가리키는 값</b>이다. 문자열인 것은 {@code bigint} 어휘의 규약이다(frontend/packages.md).
 */
public record SmplOrderSaveRow(
        @NotNull RowState rowState,
        String ordId,
        @Size(max = 30) String ordNo,
        @Size(max = 200) String ordNm,
        @Size(max = 30) String custId,
        @Size(max = 200) String custNm,
        @Size(max = 20) String ordStatCd,
        LocalDate ordDt,
        @Min(0) Integer ordQty,
        BigDecimal unitAmt,
        BigDecimal dcRt,
        Boolean urgentYn,
        Boolean useYn) {

    /** {@code null} 이면 급하지 않다 — 켜는 것이 명시여야 한다. */
    public boolean urgentYnOrFalse() {
        return Boolean.TRUE.equals(urgentYn);
    }

    /** {@code null} 이면 쓴다 — 만들자마자 꺼져 있으면 왜 안 보이는지 찾게 된다. */
    public boolean useYnOrTrue() {
        return !Boolean.FALSE.equals(useYn);
    }

    public int ordQtyOrZero() {
        return ordQty == null ? 0 : ordQty;
    }

    public BigDecimal unitAmtOrZero() {
        return unitAmt == null ? BigDecimal.ZERO : unitAmt;
    }

    public BigDecimal dcRtOrZero() {
        return dcRt == null ? BigDecimal.ZERO : dcRt;
    }
}
