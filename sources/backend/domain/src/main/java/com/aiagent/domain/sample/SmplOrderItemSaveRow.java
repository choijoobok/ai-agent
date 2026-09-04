package com.aiagent.domain.sample;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 디테일 저장의 한 행 — 68 §5.
 *
 * <p><b>{@code amt} 가 없다</b> — {@code afterEdit} 이 계산하는 파생이고 서버가 다시
 * 센다(마스터와 같은 규칙).
 *
 * <p><b>{@code ordId} 도 없다.</b> 대상 주문은 <b>행이 아니라 요청</b>이 나른다
 * ({@code SmplOrderItemSaveRequest.ordId}) — 행마다 받으면 <b>한 요청에 여러 주문의 품목</b>이
 * 섞일 수 있고, 그러면 <i>이 주문을 저장한다</i> 는 화면의 뜻과 요청이 갈린다.
 *
 * <p>{@code itemSeq} 는 신규 행에서 {@code null} 이다 — 주문 안의 다음 번호를 서버가 정한다.
 */
public record SmplOrderItemSaveRow(
        @NotNull RowState rowState,
        Integer itemSeq,
        @Size(max = 30) String itemCd,
        @Size(max = 200) String itemNm,
        @Size(max = 20) String uomCd,
        BigDecimal qty,
        BigDecimal unitAmt,
        LocalDate dlvrDt,
        @Size(max = 20) String itemStatCd,
        Boolean useYn,
        @Size(max = 500) String rmk) {

    public BigDecimal qtyOrZero() {
        return qty == null ? BigDecimal.ZERO : qty;
    }

    public BigDecimal unitAmtOrZero() {
        return unitAmt == null ? BigDecimal.ZERO : unitAmt;
    }

    public boolean useYnOrTrue() {
        return !Boolean.FALSE.equals(useYn);
    }
}
