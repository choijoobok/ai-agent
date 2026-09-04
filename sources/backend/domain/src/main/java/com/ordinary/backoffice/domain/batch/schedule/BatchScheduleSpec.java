package com.ordinary.backoffice.domain.batch.schedule;

import com.ordinary.backoffice.core.search.QuerySpec;
import com.ordinary.backoffice.core.search.SortDir;
import com.ordinary.backoffice.domain.batch.entity.QSysScheduleBatch;

/**
 * {@code BATCH_SCHEDULE} 의 화이트리스트 — 65 §3 · api-conventions.md §4.1.
 *
 * <h2>조회조건이 없다시피 하다</h2>
 *
 * <p>등록이 <b>수십 건</b>이고 페이지 사이즈가 50 이라(65 §2.5) 한 화면에 다 들어온다 —
 * 거르는 것보다 <b>눈으로 훑는 것</b>이 빠른 규모다. 그래서 목록 조회는 대개 조건 없이
 * 오며, 여기 열어 둔 넷은 등록이 수백 건이 됐을 때를 위한 것이다(65 §6 의 실측 미결).
 *
 * <h2>{@code PARAM_JSON} 이 없다</h2>
 *
 * <p>46 §5.2 가 감수한 대가 셋 중 첫째다 — <i>"파라미터로 검색할 수 없다. 벤더 중립으로는
 * {@code LIKE} 뿐이다"</i>. 열어 두면 {@code LIKE '%warehouseId%'} 가 되고, 그것은
 * <b>인덱스를 못 타면서 되는 것처럼 보이는</b> 조건이다.
 *
 * <h2>정렬이 {@code SORT_NO} 하나다</h2>
 *
 * <p>65 §3.3 — 사람이 정한 순서가 <b>이 화면의 의미</b>다(마감 → 집계 → 발송). 다른
 * 컬럼으로 정렬하면 그 묶음이 흩어지고, 흩어진 목록에서 <i>이 배치 다음에 무엇이 도나</i>
 * 를 읽을 수 없다. tie-breaker 는 PK 이며 db-portability.md §4.5 가 그것을 요구한다.
 */
public final class BatchScheduleSpec {

    static final QSysScheduleBatch B = QSysScheduleBatch.sysScheduleBatch;

    public static final QuerySpec SPEC = QuerySpec.of("batchSchedule")
            .from(B)
            .col("batchId", B.batchId)
            .col("batchNm", B.batchNm)
            .col("beanId", B.beanId)
            .col("useYn", B.useYn)
            // 유일한 정렬이며 기본이다 — 사람이 정한 순서가 이 화면의 의미다(65 §3.3).
            .col("sortNo", B.sortNo).sortable()
            .defaultSort("sortNo", SortDir.asc)
            .pk(B.batchId)
            .build();

    private BatchScheduleSpec() {}
}
