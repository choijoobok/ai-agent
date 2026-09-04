package com.aiagent.domain.sample;

import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.sample.entity.QSmplOrderItem;
import com.querydsl.core.types.dsl.StringExpression;

/**
 * 샘플 주문 품목의 화이트리스트 &mdash; 68 &sect;8.3. <b>&#9317;만 쓴다.</b>
 *
 * <p>&#9314;&#9315;&#9316;의 품목 그리드는 화이트리스트가 <b>필요 없다</b> &mdash; 대상이
 * 조회조건이 아니라 파라미터(고른 주문 하나)라 거를 것이 없고, 그래서
 * {@code getItemList} 는 리포지터리를 그대로 부른다. &#9317;에서 처음으로 <b>주문을
 * 가로질러</b> 품목을 묻는다.
 *
 * <h2>tie-breaker 가 <b>업무 키 둘을 이은 것</b>이다</h2>
 *
 * <p>이 테이블의 PK 는 {@code (ORD_ID, ITEM_SEQ)} 복합인데 {@link QuerySpec#pk()} 는 하나만
 * 받는다. 한쪽만 골라도 되는 자리가 아니다 &mdash; {@code ITEM_SEQ} 는 <b>주문 안에서만</b>
 * 유일하므로 주문을 가로지르는 이 조회에서는 값이 겹치고, 사용자가 수량으로 정렬하면
 * <i>정렬 키가 같은 행들</i>의 순서가 장마다 흔들려 <b>오프셋 페이징에서 같은 행이 두 장에
 * 나오거나 아예 빠진다</b>. 그것이 {@code pk()} 가 존재하는 이유다.
 *
 * <p>그래서 {@code (ORD_NO, ITEM_CD)} 를 잇는다. 이 쌍은 48 &sect;4.3 이 <b>엑셀 대조의
 * 키</b>로 정한 것이며, 900 의 {@code UK_SMPL_ITEM_CD} 가 그 유일성을 실제로 보증한다 &mdash;
 * 보증이 없으면 <i>키라고 부르는데 키가 아닌 것</i>을 tie-breaker 로 쓰는 셈이다.
 *
 * <p><b>구분자를 낀다.</b> 잇기만 하면 {@code (SO-1, 001)} 과 {@code (SO-10, 01)} 이 같은
 * 글자가 되어 <b>서로 다른 두 행의 순서가 다시 흔들린다</b>. 유닛 구분자를 쓰는 것은
 * 프론트의 {@code matchRows.keyOf} 와 같은 이유이며 &mdash; 업무 키에 들어가지 않는
 * 글자다 &mdash; 같은 판단이 양쪽에 있는 것이 우연이 아니라 <b>같은 키를 다루기</b>
 * 때문이다.
 */
public final class SampleItemSpec {

    static final QSmplOrderItem I = QSmplOrderItem.smplOrderItem;

    /**
     * 유닛 구분자({@code U+001F}) &mdash; 업무 키에 들어가지 않는 글자다.
     *
     * <p><b>소스에 그 글자를 직접 적지 않는다.</b> 제어 문자는 편집기와 diff 에서 보이지
     * 않거나 다른 글자처럼 보이고, 그러면 지우거나 공백으로 바꿔도 아무도 모른다
     * (프론트의 {@code matchRows} 가 같은 이유로 같은 선택을 했다).
     */
    private static final String SEPARATOR = String.valueOf((char) 31);

    /** {@code ORD_NO}␟{@code ITEM_CD} &mdash; 이 표에서 행 하나를 가리키는 이름이다. */
    private static final StringExpression BUSINESS_KEY = I.ordNo.concat(SEPARATOR).concat(I.itemCd);

    /**
     * &#9317;의 업무 데이터 탭 &mdash; 68 &sect;8.3 의 넷을 낸다.
     *
     * <p><b>기본 정렬이 주문번호다.</b> 평면 목록이지만 사람은 <i>주문별로</i> 읽으므로,
     * 같은 주문의 품목이 흩어져 있으면 스크롤로 모아야 한다 &mdash; 엑셀로 내려도 같다.
     */
    public static final QuerySpec SPEC = QuerySpec.of("smplOrderItem")
            .from(I)
            // 부모를 업무 키로 나르는 컬럼이다(playbook/INDEX.md) — 엑셀 양식에 대리키를 넣을 수 없다.
            .col("ordNo", I.ordNo).sortable()
            .col("itemCd", I.itemCd).sortable()
            .col("itemNm", I.itemNm).sortable()
            .col("uomCd", I.uomCd).sortable()
            .col("qty", I.qty).sortable()
            .col("unitAmt", I.unitAmt).sortable()
            .col("amt", I.amt).sortable()
            // 납기일은 비어 있을 수 있다 — isNull 이 값 칸 없는 조건으로 온다(backend/api.md).
            .col("dlvrDt", I.dlvrDt).sortable().nullable()
            .col("itemStatCd", I.itemStatCd).sortable()
            .col("useYn", I.useYn).sortable()
            .col("rmk", I.rmk).nullable()
            .defaultSort("ordNo", SortDir.asc)
            .pk(BUSINESS_KEY)
            .build();

    private SampleItemSpec() {}
}
