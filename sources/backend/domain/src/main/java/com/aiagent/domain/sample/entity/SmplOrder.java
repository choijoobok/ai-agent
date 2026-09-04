package com.aiagent.domain.sample.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.core.domain.YnConverter;
import com.aiagent.domain.sample.OrderStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.TableGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

/**
 * 샘플 주문 — 48 §3. <b>어휘의 실물이다.</b>
 *
 * <p>컬럼이 많은 이유가 업무가 아니라 <b>grid-column-contract.md §5 의 어휘</b>다. 타입 아홉 · 에디터 열 ·
 * 렌더러 여섯이 하나씩 실물을 가져야 하고, 컬럼은 그 자리를 채우려고 존재한다.
 *
 * <h2>논리 삭제가 없다 — 그것이 이 테이블의 역할이다</h2>
 *
 * <p>grid-standard.md §3.5 가 <i>"물리 삭제하는 테이블에만 삭제 컬럼이 나온다"</i> 고 했는데
 * {@code SYS_} 는 대부분 논리 삭제거나 삭제가 없어 <b>삭제 컬럼의 실물이 빈약하다</b>.
 * 샘플이 물리 삭제여야 삭제 컬럼 · 되돌리기 · <b>마스터 삭제 게이트</b>가 전부 실물을
 * 갖는다(48 §3.4).
 *
 * <h2>{@code USE_YN} 과 {@code LOCK_YN} 은 다른 축이다</h2>
 *
 * <p>{@code ORD_STAT_CD} 는 <i>일이 어디까지 갔나</i> 이고 {@link #lockYn} 은
 * <i>운영이 잠갔나</i> 다(48 §3.2). 한 컬럼으로 합치면 <b>완료된 주문의 잠금을 풀
 * 방법</b>이 없어진다.
 */
@Entity
@Table(name = "SMPL_ORDER")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SmplOrder extends BaseAuditEntity {

    /**
     * {@code TABLE} 전략이다 — MySQL 이 {@code SEQUENCE} 를 조용히 건너뛴 자리
     * (ADR-0015). 논리 시퀀스명은 테이블명과 같다(db-portability.md §4.1).
     */
    @Id
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "smpl_order_seq")
    @TableGenerator(
            name = "smpl_order_seq",
            table = "SYS_SEQUENCE",
            pkColumnName = "SEQ_NAME",
            valueColumnName = "NEXT_VAL",
            pkColumnValue = "SMPL_ORDER",
            initialValue = 1,
            allocationSize = 50)
    @Column(name = "ORD_ID")
    private Long ordId;

    @Column(name = "ORD_NO", length = 30, nullable = false)
    private String ordNo;

    @Nationalized
    @Column(name = "ORD_NM", length = 200, nullable = false)
    private String ordNm;

    @Column(name = "CUST_ID", length = 30, nullable = false)
    private String custId;

    @Nationalized
    @Column(name = "CUST_NM", length = 200, nullable = false)
    private String custNm;

    @Column(name = "CUST_GRD_CD", length = 20)
    private String custGrdCd;

    @Column(name = "ORD_STAT_CD", length = 20, nullable = false)
    private String ordStatCd;

    @Column(name = "CHNL_CD", length = 20, nullable = false)
    private String chnlCd;

    @Column(name = "PRIORITY_CD", length = 20, nullable = false)
    private String priorityCd;

    @Column(name = "ORD_DT", nullable = false)
    private LocalDate ordDt;

    /** {@code precision:'month'} 는 {@code VARCHAR(6)} 이다 — 48 §4.2. */
    @Column(name = "DLVR_YM", length = 6)
    private String dlvrYm;

    @Column(name = "ORD_DTM", nullable = false)
    private Instant ordDtm;

    @Column(name = "ORD_QTY", nullable = false)
    private int ordQty;

    @Column(name = "UNIT_AMT", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitAmt;

    /** {@code afterEdit} 이 계산한다 — 화면이 보내지만 <b>서버가 다시 센다</b>(아래). */
    @Column(name = "ORD_AMT", nullable = false, precision = 17, scale = 2)
    private BigDecimal ordAmt;

    @Column(name = "VAT_AMT", nullable = false, precision = 17, scale = 2)
    private BigDecimal vatAmt;

    @Column(name = "DC_RT", nullable = false, precision = 5, scale = 2)
    private BigDecimal dcRt;

    @Column(name = "PROC_MS")
    private Long procMs;

    @Convert(converter = YnConverter.class)
    @Column(name = "URGENT_YN", length = 1, nullable = false)
    private Boolean urgentYn;

    @Convert(converter = YnConverter.class)
    @Column(name = "USE_YN", length = 1, nullable = false)
    private Boolean useYn;

    /*
      nclob 셋은 @Lob 이 아니다 — MySQL 에서 tinytext(255B) 가 된다(db-portability.md §3.1).
      @Nationalized + LONG32NVARCHAR 고정이 이 저장소의 규약이다.
    */
    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "MEMO")
    private String memo;

    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "RMK")
    private String rmk;

    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "ERR_MSG")
    private String errMsg;

    @Convert(converter = YnConverter.class)
    @Column(name = "LOCK_YN", length = 1, nullable = false)
    private Boolean lockYn;

    @Column(name = "SRC_SYS_CD", length = 20)
    private String srcSysCd;

    /**
     * 새 주문 — <b>파생 셋은 인자가 아니다</b>.
     *
     * <p>{@code ORD_AMT}·{@code VAT_AMT} 는 {@link #recalculate()} 가 만든다. 화면도
     * {@code afterEdit} 으로 같은 계산을 하지만(grid-edit-validation.md §2.3) 그것은 <b>보여주기 위한
     * 것</b>이고, 요청 본문은 조작할 수 있으므로 서버가 다시 센다(원칙 P1).
     */
    public static SmplOrder create(
            String ordNo,
            String ordNm,
            String custId,
            String custNm,
            String ordStatCd,
            String chnlCd,
            String priorityCd,
            LocalDate ordDt,
            Instant ordDtm) {
        SmplOrder order = new SmplOrder();
        order.ordNo = ordNo;
        order.ordNm = ordNm;
        order.custId = custId;
        order.custNm = custNm;
        order.ordStatCd = ordStatCd;
        order.chnlCd = chnlCd;
        order.priorityCd = priorityCd;
        order.ordDt = ordDt;
        order.ordDtm = ordDtm;
        order.ordQty = 0;
        order.unitAmt = BigDecimal.ZERO;
        order.dcRt = BigDecimal.ZERO;
        order.urgentYn = Boolean.FALSE;
        order.useYn = Boolean.TRUE;
        order.lockYn = Boolean.FALSE;
        order.recalculate();
        return order;
    }

    public void modify(
            String ordNm,
            String custId,
            String custNm,
            String ordStatCd,
            LocalDate ordDt,
            int ordQty,
            BigDecimal unitAmt,
            BigDecimal dcRt,
            boolean urgentYn,
            boolean useYn) {
        this.ordNm = ordNm;
        this.custId = custId;
        this.custNm = custNm;
        this.ordStatCd = ordStatCd;
        this.ordDt = ordDt;
        this.ordQty = ordQty;
        this.unitAmt = unitAmt;
        this.dcRt = dcRt;
        this.urgentYn = urgentYn;
        this.useYn = useYn;
        recalculate();
    }

    /**
     * ①이 고치는 것까지 — 68 §3.2. <b>{@link #modify} 가 손대지 않는 여섯을 더한다.</b>
     *
     * <p>둘로 나눠 둔 것은 화면이 그리지 않는 컬럼을 <b>보낼 경로가 없어야</b> 하기
     * 때문이다(원칙 P1). ③은 아홉을 그리므로 아홉만 고칠 수 있고, 여기서 {@code modify} 를
     * 넓히면 ③의 저장이 <b>화면에 없는 칸을 null 로 덮는다</b>.
     *
     * <p><b>{@code CUST_GRD_CD} 가 인자인 것은 팝업이 채우기 때문이다</b>(grid-column-contract.md §6.3) — 고객을
     * 고르면 이름과 등급이 함께 온다. 사용자가 타이핑하는 칸이 아니다.
     */
    public void modifyFull(
            String ordNm,
            String custId,
            String custNm,
            String custGrdCd,
            String ordStatCd,
            String chnlCd,
            String priorityCd,
            LocalDate ordDt,
            String dlvrYm,
            int ordQty,
            BigDecimal unitAmt,
            BigDecimal dcRt,
            boolean urgentYn,
            boolean useYn,
            String memo,
            String rmk) {
        this.custGrdCd = custGrdCd;
        this.chnlCd = chnlCd;
        this.priorityCd = priorityCd;
        this.dlvrYm = dlvrYm;
        this.memo = memo;
        this.rmk = rmk;
        modify(ordNm, custId, custNm, ordStatCd, ordDt, ordQty, unitAmt, dcRt, urgentYn, useYn);
    }

    /** 확정 — {@code RCV} 만 {@code CFM} 으로 간다(48 §3.2 의 전이표). */
    public void confirm() {
        this.ordStatCd = OrderStatus.CFM.name();
    }

    public boolean confirmable() {
        return OrderStatus.RCV.name().equals(ordStatCd) && !Boolean.TRUE.equals(lockYn);
    }

    /**
     * 일괄 재계산이 쓴다 — 68 §3.4.
     *
     * <p><b>세율이 인자다.</b> {@link #recalculate()} 의 상수는 <i>평소</i> 의 값이고, 이 작업은
     * <b>기준을 사람이 준다</b>({@code params} 모달 · 68 §9.13). 둘이 같은 상수를 보면
     * 모달의 세율 칸이 아무 일도 하지 않는 칸이 된다.
     *
     * <p><b>{@code PROC_MS} 를 여기서 적는다.</b> {@code renderer:'duration'} 이 읽는 값이
     * 어디서 오는지가 이 컬럼의 뜻이며(48 §3), 아무도 쓰지 않으면 <b>영원히 비어 있는 칸</b>을
     * 화면이 그리게 된다.
     */
    public void applyRecalculation(BigDecimal vatRate, long procMs) {
        this.ordAmt = unitAmt.multiply(BigDecimal.valueOf(ordQty))
                .setScale(2, java.math.RoundingMode.HALF_UP);
        this.vatAmt = ordAmt.multiply(vatRate).setScale(2, java.math.RoundingMode.HALF_UP);
        this.procMs = procMs;
    }

    /** 출고 지시 — {@code CFM} 만 {@code SHP} 로 간다(48 §3.2 의 전이표). */
    public void ship() {
        this.ordStatCd = OrderStatus.SHP.name();
    }

    public boolean shippable() {
        return OrderStatus.CFM.name().equals(ordStatCd) && !Boolean.TRUE.equals(lockYn);
    }

    /**
     * <b>금액을 아직 고칠 수 있는가</b> — 품목 재계산의 게이트다(68 §5.4).
     *
     * <p>화면의 {@code amountEditable} 과 <b>같은 사실</b>이다: 확정부터는 금액이 잠긴다
     * (48 §3.2). 실행이 이것을 보지 않으면 <b>화면이 닫아 둔 문을 실행이 열어 준다</b> —
     * 확정된 주문의 품목 금액이 다시 계산되고, 그 변화는 합계를 보는 자리에서만 드러난다.
     *
     * <p><b>{@link #confirmable()} 과 지금 값이 같지만 질문이 다르다.</b> 저것은 <i>다음
     * 상태로 갈 수 있는가</i> 이고 이것은 <i>금액이 열려 있는가</i> 이며, 전이표가 바뀌는
     * 날(48 §3.2 는 열려 있다) 한쪽만 따라 움직인다 — 합쳐 두면 그때 <b>어느 뜻으로 쓰인
     * 자리인지</b> 를 호출자마다 다시 읽어야 한다.
     */
    public boolean amountOpen() {
        return OrderStatus.RCV.name().equals(ordStatCd) && !Boolean.TRUE.equals(lockYn);
    }

    /**
     * 금액 둘을 <b>한 곳에서</b> 센다 — grid-edit-validation.md §2.3.
     *
     * <p>부가세율이 상수인 것은 샘플이기 때문이다. 실제 프로젝트에서는 이 자리가 설정이나
     * 코드 테이블이 되며, <b>여기가 그 자리라는 것</b>이 어휘로서의 값어치다.
     */
    private void recalculate() {
        this.ordAmt = unitAmt.multiply(BigDecimal.valueOf(ordQty)).setScale(2, java.math.RoundingMode.HALF_UP);
        this.vatAmt = ordAmt.multiply(VAT_RATE).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private static final BigDecimal VAT_RATE = new BigDecimal("0.10");
}
