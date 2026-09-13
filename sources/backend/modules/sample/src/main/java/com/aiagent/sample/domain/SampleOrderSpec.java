// @feat FEAT-503
package com.aiagent.sample.domain;

import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.sample.domain.entity.QSmplOrder;
import com.aiagent.sample.domain.entity.QSmplOrderTag;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.JPAExpressions;
import java.util.ArrayList;
import java.util.List;

/**
 * 샘플 주문의 화이트리스트 — playbook/INDEX.md · backend/api.md.
 *
 * <p><b>정적 상수다.</b> {@code NoticeSpec} 이 빈이 된 것은 <i>지금</i> 이 필요한 파생
 * 조건 때문이었고(screen/admin/system/notice/requirements.md), 여기에는 그런 조건이 없다 — 필요 없는데 빈으로 만들면
 * 스펙 하나를 읽으려고 스프링을 띄우게 된다.
 *
 * <h2>화면 둘이 <b>한 화이트리스트</b>를 나눠 쓴다</h2>
 *
 * <p>③은 넷을 쓰고(playbook/INDEX.md) ①은 열둘을 쓴다(playbook/INDEX.md). 목록을 둘로 가르지 않는 것은
 * 화이트리스트가 <i>"이 필드가 존재하는가"</i> 만 보는 자리이기 때문이다(backend/api.md) — 같은
 * 테이블에 목록이 둘이면 컬럼을 하나 늘릴 때 <b>한쪽만 고쳐 놓고 왜 안 걸리는지</b> 를
 * 찾게 된다. 어느 조건을 <b>낼지</b> 는 화면이 정한다.
 *
 * <p><b>기간이 필수가 아니다</b> — screen/admin/system/log/access/requirements.md 의 <i>기간 필수 + 상한</i> 은 대용량 이력의
 * 규칙이고, 이 표는 그렇지 않다. ②({@code SMPL_SINGLE_CURSOR})가 그 규칙 쪽이다.
 *
 * <h2>정렬 키가 커서 인덱스와 같다</h2>
 *
 * <p>{@code ORD_DTM DESC, ORD_ID DESC} 는 {@code IX_SMPL_ORDER_DTM} 그대로다(playbook/INDEX.md).
 * 이 화면은 오프셋 페이징이지만 <b>같은 정렬을 커서형 샘플({@code SMPL_SINGLE_CURSOR})이
 * 그대로 쓴다</b> — 정렬이 갈리면 두 화면이 같은 데이터를 다른 순서로 보여 준다.
 */
public final class SampleOrderSpec {

    static final QSmplOrder O = QSmplOrder.smplOrder;

    /**
     * 오프셋형 — ①과 ③이 쓴다.
     *
     * <p>기본 정렬이 <b>둘</b>이다. tie-breaker 를 명시하지 않으면 정렬 키가 같은 행들의
     * 순서가 장마다 흔들려, 오프셋 페이징에서 같은 행이 두 장에 나오거나 아예 빠진다.
     */
    public static final QuerySpec SPEC = columns()
            .defaultSort("ordDtm", SortDir.desc)
            .defaultSort("ordId", SortDir.desc)
            .pk(O.ordId)
            .build();

    /**
     * 커서형 — ②가 쓴다(playbook/INDEX.md).
     *
     * <p><b>같은 화이트리스트에 기본 정렬만 갈린다.</b> 커서는 정렬 키가 <b>하나</b>여야
     * 하며(backend/api.md), 둘이면 서버가 400 이다 — 기준점이 성립하려면 정렬 키가 고정이어야
     * 하기 때문이다.
     *
     * <p><b>tie-breaker 가 없어진 것이 아니다.</b> 커서 모드에서는 PK 가 정렬 키를 따라
     * 붙으며({@code QueryDslBuilder.order}), 그렇게 해야 {@code WHERE} 의 튜플 비교와
     * {@code ORDER BY} 가 어긋나지 않는다.
     *
     * <p><b>스펙을 통째로 복제하지 않는다.</b> 컬럼 목록이 두 벌이 되면 하나를 늘릴 때
     * <b>한쪽만 고쳐 놓고 왜 안 걸리는지</b> 를 찾게 된다 — 갈리는 것은 정렬뿐이므로
     * 갈리는 것만 갈린다.
     */
    public static final QuerySpec CURSOR_SPEC = columns()
            .defaultSort("ordDtm", SortDir.desc)
            .pk(O.ordId)
            .build();

    /** 화이트리스트 한 벌 — 위 둘이 나눠 쓴다. */
    private static QuerySpec.Builder columns() {
        return QuerySpec.of("smplOrder")
            .from(O)
            .col("ordNo", O.ordNo).sortable()
            .col("ordNm", O.ordNm).sortable()
            .col("custNm", O.custNm).sortable()
            .col("ordStatCd", O.ordStatCd).sortable()
            .col("ordDt", O.ordDt).sortable()
            .col("ordQty", O.ordQty).sortable()
            .col("ordAmt", O.ordAmt).sortable()
            .col("urgentYn", O.urgentYn).sortable()
            .col("useYn", O.useYn).sortable()
            .col("ordDtm", O.ordDtm).sortable()
            // ── ①이 더한 여덟 — playbook/INDEX.md ───────────────────────────────────
            // 팝업 참조가 보내는 것은 고른 행의 아이디다. 이름으로 걸면 동명이인이 섞인다.
            .col("custId", O.custId)
            .col("chnlCd", O.chnlCd)
            /*
              납기월은 VARCHAR(6) 이고(playbook/INDEX.md) 범위를 받는다. 문자열에 부등호를 여는 것은
              타입이 아니라 이 선언이며(FieldSpec.ordered), 202608 의 사전순이 곧 시간순인
              컬럼만 여기 온다 — 그 사실을 아는 자리가 스펙이다.
            */
            .col("dlvrYm", O.dlvrYm).ordered().nullable()
            // 화면은 초로 받아 밀리초로 보낸다(57 의 scale) — 서버가 보는 것은 언제나 ms 다.
            .col("procMs", O.procMs).nullable()
            .col("unitAmt", O.unitAmt).sortable()
            .col("dcRt", O.dcRt).sortable()
            // isNull·isNotNull 만 온다. 값 칸이 사라지는 조건이다(playbook/INDEX.md).
            .col("errMsg", O.errMsg).nullable()
            /*
              태그 — 자식 테이블의 EXISTS 다(playbook/INDEX.md). 파생인 것은 화면이 보내는 값 하나가
              이 테이블의 조각 하나가 아니라 <b>다른 테이블에 대한 물음</b>이기 때문이다
              (backend/api.md). 문자열이었으면 LIKE '%…%' 라 개발 이 개발자 에 걸렸다.
            */
            .derived("tagNm", SampleOrderSpec::taggedWith)
            // tie-breaker 다 — 정렬 키가 같은 행들의 순서가 장마다 흔들리면
            // 오프셋 페이징에서 같은 행이 두 장에 나오거나 아예 빠진다(backend/api.md).
            .col("ordId", O.ordId);
    }

    private static final QSmplOrderTag T = QSmplOrderTag.smplOrderTag;

    /**
     * <i>이 태그가 붙은 주문</i> — {@code EXISTS} 한 줄이다.
     *
     * <p><b>{@code in} 과 {@code eq} 만 받는다.</b> 태그는 열거값이고(backend/api.md 의 파생 사례 넷이
     * 전부 그렇다) 순서를 물을 대상이 아니다. 받지 않는 연산자에 {@link IllegalArgumentException}
     * 을 던지면 {@code FieldSpec} 이 400 으로 감싼다 — 조용히 무시하면 <b>거르지 않은 전량</b>이
     * 걸러진 것처럼 나온다.
     */
    private static BooleanExpression taggedWith(Op op, Object rawValue) {
        List<String> names = new ArrayList<>();
        if (op == Op.eq) {
            names.add(String.valueOf(rawValue));
        } else if (op == Op.in && rawValue instanceof Iterable<?> values) {
            for (Object value : values) {
                if (value != null) {
                    names.add(String.valueOf(value));
                }
            }
        } else {
            throw new IllegalArgumentException("태그는 eq 와 in 만 받는다 — " + op);
        }
        if (names.isEmpty()) {
            throw new IllegalArgumentException("태그 목록이 비었다");
        }
        return JPAExpressions.selectOne()
                .from(T)
                .where(T.ordId.eq(O.ordId).and(T.tagNm.in(names)))
                .exists();
    }

    private SampleOrderSpec() {}
}
