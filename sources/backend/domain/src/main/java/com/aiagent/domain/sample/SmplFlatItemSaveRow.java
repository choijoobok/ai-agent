package com.aiagent.domain.sample;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * &#9317;의 저장 한 행 &mdash; 68 &sect;8. <b>부모를 업무 키로 나른다.</b>
 *
 * <p>{@link SmplOrderItemSaveRow} 와 갈리는 것이 <b>대상을 가리키는 방법</b> 하나다.
 * 저쪽은 요청이 {@code ordId} 를 하나 싣고 행은 {@code itemSeq} 로 자기를 가리키는데,
 * 여기서는 둘 다 쓸 수 없다:
 *
 * <table><caption></caption>
 *   <tr><td><b>{@code ordId} 가 요청에 없다</b></td>
 *       <td>한 파일에 <b>여러 주문의 품목</b>이 섞인다. 그것이 평면 엑셀 한 장이라는
 * 전제(frontend/grid-advanced.md)이며, 요청 하나에 주문 하나를 강요하면 사용자가 파일을 주문
 *           수만큼 쪼개야 한다</td></tr>
 *   <tr><td><b>{@code itemSeq} 가 파일에 없다</b></td>
 *       <td>서버가 정하는 값이라 양식에 넣지 않았다(68 &sect;8.2) &mdash; 넣으면 사람이
 *           채우려 든다</td></tr>
 * </table>
 *
 * <p>그래서 {@code (ordNo, itemCd)} 가 행을 가리킨다. 48 &sect;4.3 이 그 쌍을 엑셀 대조의
 * 키로 정했고 900 의 {@code UK_SMPL_ITEM_CD} 가 유일성을 보증한다 &mdash; 보증이 없으면
 * <i>수정</i> 이 <b>어느 행을 고치는지 말할 수 없는</b> 요청이 된다.
 *
 * <p><b>{@code amt} 가 없다</b> &mdash; {@code afterEdit} 이 계산하는 파생이고 서버가 다시
 * 센다({@link SmplOrderItemSaveRow} 와 같은 규칙).
 */
public record SmplFlatItemSaveRow(
        @NotNull RowState rowState,
        @Size(max = 30) String ordNo,
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

    /** 이 행이 가리키는 자리 &mdash; 오류 문구가 사람에게 <b>어느 줄</b>인지 말한다. */
    public String where() {
        return ordNo + " / " + itemCd;
    }
}
