package com.ordinary.backoffice.domain.sample.entity;

import com.ordinary.backoffice.core.domain.BaseAuditEntity;
import com.ordinary.backoffice.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Nationalized;

/**
 * 샘플 주문 품목 — 48 §4. <b>인라인 편집과 계산 컬럼의 자리다.</b>
 *
 * <h2>{@code ORD_NO} 를 복제한다 — 정규화를 깨는 유일한 자리</h2>
 *
 * <p>FK 는 {@code ORD_ID}(대리키)인데 업무 키를 한 벌 더 둔다(48 §4.3). <b>엑셀 업로드
 * 때문이다</b>: 사람이 채우는 엑셀에 대리키가 들어갈 수 없으므로(발번 전이거나 알 방법이
 * 없다) 업로드 탭은 {@code (ORD_NO, ITEM_CD)} 로 기존 행과 대조하고, 저장 시 서버가
 * {@code ORD_NO} 를 {@code ORD_ID} 로 푼다.
 *
 * <p><b>복제한 값은 갱신되어야 한다.</b> {@code ORD_NO} 가 바뀌지 않는 컬럼이라 실제로는
 * 문제가 없지만, <b>그 불변식이 이 컬럼의 전제</b>다.
 */
@Entity
@Table(name = "SMPL_ORDER_ITEM")
@IdClass(SmplOrderItemId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SmplOrderItem extends BaseAuditEntity {

    @Id
    @Column(name = "ORD_ID")
    private Long ordId;

    @Id
    @Column(name = "ITEM_SEQ")
    private Integer itemSeq;

    @Column(name = "ORD_NO", length = 30, nullable = false)
    private String ordNo;

    @Column(name = "ITEM_CD", length = 30, nullable = false)
    private String itemCd;

    @Nationalized
    @Column(name = "ITEM_NM", length = 200, nullable = false)
    private String itemNm;

    @Column(name = "UOM_CD", length = 20, nullable = false)
    private String uomCd;

    @Column(name = "QTY", nullable = false, precision = 13, scale = 3)
    private BigDecimal qty;

    @Column(name = "UNIT_AMT", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitAmt;

    /** {@code afterEdit} 계산 = {@link #qty} × {@link #unitAmt}. <b>서버가 다시 센다.</b> */
    @Column(name = "AMT", nullable = false, precision = 17, scale = 2)
    private BigDecimal amt;

    @Column(name = "DLVR_DT")
    private LocalDate dlvrDt;

    @Column(name = "ITEM_STAT_CD", length = 20, nullable = false)
    private String itemStatCd;

    @Convert(converter = YnConverter.class)
    @Column(name = "USE_YN", length = 1, nullable = false)
    private Boolean useYn;

    @Nationalized
    @Column(name = "RMK", length = 500)
    private String rmk;

    public static SmplOrderItem create(
            Long ordId,
            int itemSeq,
            String ordNo,
            String itemCd,
            String itemNm,
            String uomCd,
            BigDecimal qty,
            BigDecimal unitAmt,
            LocalDate dlvrDt,
            String itemStatCd,
            boolean useYn,
            String rmk) {
        SmplOrderItem item = new SmplOrderItem();
        item.ordId = ordId;
        item.itemSeq = itemSeq;
        item.ordNo = ordNo;
        item.itemCd = itemCd;
        item.itemNm = itemNm;
        item.uomCd = uomCd;
        item.qty = qty;
        item.unitAmt = unitAmt;
        item.dlvrDt = dlvrDt;
        item.itemStatCd = itemStatCd;
        item.useYn = useYn;
        item.rmk = rmk;
        item.recalculate();
        return item;
    }

    public void modify(
            String itemCd,
            String itemNm,
            String uomCd,
            BigDecimal qty,
            BigDecimal unitAmt,
            LocalDate dlvrDt,
            String itemStatCd,
            boolean useYn,
            String rmk) {
        this.itemCd = itemCd;
        this.itemNm = itemNm;
        this.uomCd = uomCd;
        this.qty = qty;
        this.unitAmt = unitAmt;
        this.dlvrDt = dlvrDt;
        this.itemStatCd = itemStatCd;
        this.useYn = useYn;
        this.rmk = rmk;
        recalculate();
    }

    /**
     * {@code AMT} 를 <b>다시 센다</b> — {@code QTY} × {@code UNIT_AMT}.
     *
     * <p><b>공개인 것은 재계산 액션이 부르기 때문이다</b>({@code SampleItemService.recalcItems}).
     * 외부에서 들어온 품목의 금액은 어긋날 수 있고(엑셀 업로드 · 연계), 그 어긋남은
     * <b>합계를 보는 자리에서만</b> 드러난다 — 이 메서드가 그것을 갚는 자리다.
     *
     * <p><b>멱등이다.</b> 두 번 불러도 같은 값이며, 그래서 이 액션은 실패한 뒤 다시 돌려도
     * 된다 — 진행률이 중간에 끊긴 작업에서 그 성질이 곧 <i>다시 눌러도 되는가</i> 다.
     */
    public void recalculate() {
        this.amt = qty.multiply(unitAmt).setScale(2, RoundingMode.HALF_UP);
    }
}
