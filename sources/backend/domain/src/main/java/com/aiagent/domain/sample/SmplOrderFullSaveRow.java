package com.aiagent.domain.sample;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * ①의 저장 한 행 — playbook/INDEX.md.
 *
 * <p><b>{@link SmplOrderSaveRow} 와 왜 갈리나</b> — 받는 컬럼이 곧 <b>고칠 수 있는 컬럼</b>
 * 이기 때문이다. 하나로 합치고 화면마다 일부만 채워 보내면, 안 보낸 칸이 서버에서
 * {@code null} 과 구별되지 않아 <b>③의 저장이 ①만 그리는 칸을 지운다</b>. 화면이 그리지
 * 않는 것에는 <b>보낼 경로가 없어야</b> 한다(원칙 P1).
 *
 * <p><b>파생과 잠금은 여기에도 없다</b>({@code ordAmt} · {@code vatAmt} · {@code procMs} ·
 * {@code lockYn} · {@code srcSysCd} · {@code errMsg}). 앞의 셋은 서버가 만들고 뒤의 셋은
 * 운영·시스템의 것이며, 화면에서 읽기 전용인 것과 <b>요청이 조작될 수 있는 것</b>은 다른
 * 문제다.
 *
 * <p><b>{@code custGrdCd} 는 받는다</b> — 팝업이 채우는 칸이라(frontend/grid.md) 사용자가 타이핑하지
 * 않지만 <b>고른 고객과 함께 온다</b>. 서버가 고객 마스터를 다시 읽어 채우는 편이 더
 * 옳지만, 샘플에 고객 테이블은 없다(playbook/INDEX.md — 담는 것은 두 테이블이다).
 */
public record SmplOrderFullSaveRow(
        @NotNull RowState rowState,
        String ordId,
        @Size(max = 30) String ordNo,
        @Size(max = 200) String ordNm,
        @Size(max = 30) String custId,
        @Size(max = 200) String custNm,
        @Size(max = 20) String custGrdCd,
        @Size(max = 20) String ordStatCd,
        @Size(max = 20) String chnlCd,
        @Size(max = 20) String priorityCd,
        LocalDate ordDt,
        /** {@code precision:'month'} 의 전송 형태 — {@code 202608} 이다(playbook/INDEX.md). */
        @Pattern(regexp = "\\d{6}") String dlvrYm,
        @Min(0) Integer ordQty,
        BigDecimal unitAmt,
        BigDecimal dcRt,
        Boolean urgentYn,
        Boolean useYn,
        /**
         * {@code list} 컬럼 — <b>배열을 그대로 받는다</b>(frontend/grid.md).
         *
         * <p>행으로 펴는 것은 서버다: 화면은 자식 테이블이 있다는 사실을 모른다.
         * {@code null} 은 <i>손대지 않았다</i> 가 아니라 <b>비었다</b> 로 읽는다 — 화면이
         * 언제나 전량을 보내므로 그 둘을 가를 근거가 요청에 없다.
         */
        List<SmplOrderTagRow> tagList,
        String memo,
        String rmk) {

    public boolean urgentYnOrFalse() {
        return Boolean.TRUE.equals(urgentYn);
    }

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

    public List<SmplOrderTagRow> tagListOrEmpty() {
        return tagList == null ? List.of() : tagList;
    }
}
