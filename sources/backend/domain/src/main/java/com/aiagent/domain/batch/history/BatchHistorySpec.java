package com.aiagent.domain.batch.history;

import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.batch.BatchResultCode;
import com.aiagent.domain.batch.entity.QSysBatchHistory;
import com.aiagent.domain.batch.entity.QSysScheduleBatch;
import com.querydsl.core.types.dsl.BooleanExpression;
import java.util.List;

/**
 * {@code BATCH_HISTORY} 의 화이트리스트 — screen/batch/history/requirements.md · backend/api.md.
 *
 * <h2>정렬이 셋 열려 있다 — 이력 화면 중 유일하다</h2>
 *
 * <p>screen/admin/system/log/access/requirements.md 이 이력의 정렬을 <b>고정</b>으로 두었고(커서형 이동의 전제) screen/batch/history/requirements.md 이
 * 그것을 <b>상속하지 않는다</b>고 항목별로 따져 결정했다. 근거는 하나다 —
 * sys/batch.md 이 {@code ELAPSED_MS} 를 <b>저장하기로</b> 한 이유가 <i>"오래 걸린 배치 정렬이
 * 인덱스를 못 탄다"</i> 였고, <b>정렬을 끄면 그 컬럼을 저장할 이유가 사라진다</b>.
 *
 * <p><i>"어떤 배치가 오래 걸리나"</i> 는 이 화면의 핵심 질문이고 <b>조회조건으로 거를 수
 * 있는 질문이 아니다</b> — screen/admin/system/log/access/requirements.md 이 <i>"정렬이 아니라 거르기가 맞는 도구"</i> 라고 한
 * 것의 <b>반대 사례</b>다. 그래서 총 건수도 함께 센다(둘은 한 결정이다 — frontend/grid.md).
 *
 * <h2>{@code RSLT_DTL_MSG} 와 {@code ERR_MSG} 가 여기 없다</h2>
 *
 * <p>조건으로도 정렬로도 쓸 수 없다 — 값이 목록에 없고(screen/batch/history/requirements.md), Oracle 이 {@code CLOB}
 * 을 {@code ORDER BY} 에 쓰지 못한다(backend/api.md). <b>여기 없는 것이 그 집행</b>이며
 * {@code ErrorLogSpec} 의 {@code rootCauseStack} 과 같다.
 *
 * <p><b>{@code RSLT_MSG} 도 없다.</b> 이쪽은 이유가 다르다 — {@code VARCHAR(1000)} 이라
 * 실을 수 있지만 <b>배치가 지은 문장</b>이라 형식이 배치마다 다르다. 조건으로 열면
 * <i>"3건 제외"</i> 를 찾는 {@code LIKE} 가 되고, 그 물음에 답하는 것은 {@code RSLT_CD}
 * 다 — sys/batch.md 이 <b>판정을 코드에 둔</b> 이유가 이것이다.
 */
public final class BatchHistorySpec {

    static final QSysBatchHistory H = QSysBatchHistory.sysBatchHistory;

    static final QSysScheduleBatch B = QSysScheduleBatch.sysScheduleBatch;

    /** 화면의 <b>결과 묶음</b> 콤보와 같은 문자열이다(screen/batch/history/requirements.md). */
    static final String FAILED_ONLY = "FAILED";

    static final String SKIPPED_ONLY = "SKIPPED";

    public static final QuerySpec SPEC = QuerySpec.of("batchHistory")
            /*
              FK 가 없으므로(sys/batch.md) 등록이 지워진 이력이 남는다 — leftJoin 이라야 그 행이
              사라지지 않는다. 조인을 안 하면 배치명을 못 얻고, inner 로 하면 고아가
              **목록에서 통째로 없어진다**. screen/batch/history/requirements.md 이 "이력은 남아야 한다" 고 한 것을
              집행하는 자리가 이 한 글자다.
            */
            .from(H)
            .leftJoin(B).on(B.batchId.eq(H.batchId))
            // 기본 정렬이자 조회조건의 기간 — 필수가 아니지만 기본값은 있다(screen/batch/schedule/requirements.md).
            .col("startDtm", H.startDtm).sortable()
            .col("batchId", H.batchId).sortable()
            .col("execTypeCd", H.execTypeCd)
            .col("rsltCd", H.rsltCd)
            // 이 화면의 성능 진단 동선 — 정렬과 조건이 짝이다(screen/batch/history/requirements.md).
            .col("elapsedMs", H.elapsedMs).sortable().nullable()
            .col("nodeId", H.nodeId)
            .col("histId", H.histId)
            .derived("rsltGroup", BatchHistorySpec::rsltGroup)
            .defaultSort("startDtm", SortDir.desc)
            .defaultSort("histId", SortDir.desc)
            .pk(H.histId)
            .build();

    /**
     * <b>실패만</b> · <b>건너뜀만</b> — screen/batch/history/requirements.md 의 <i>결과 묶음</i>. 파생 조건의 <b>네 번째
     * 사례</b>다({@code AccessLogSpec.outcome} · {@code LoginLogSpec.rsltGroup} ·
     * {@code ErrorLogSpec.statusGroup} 다음).
     *
     * <p><b>코드 여섯을 하나씩 고르는 것보다 <i>실패만</i> 이 훨씬 잦다.</b> 그리고
     * <i>실패</i> 가 {@code FAIL} 하나가 아닌 것이 이 조건이 필요한 진짜 이유다 —
     * {@code CANCELED} 도 <i>끝까지 못 간 실행</i>이라 같이 봐야 하는데, 그것을 사용자가
     * 매번 둘 고르게 하면 <b>한쪽을 빠뜨린다</b>.
     *
     * <p><b>{@code 건너뜀만} 은 둘 다 낸다.</b> {@code SKIP_LOCK} 이 정상이고
     * {@code SKIP_COOLDOWN} 이 결함이지만(screen/batch/history/requirements.md), <i>건너뛴 것을 보자</i> 는 질문에
     * 정상만 빼면 <b>비율을 볼 수 없다</b> — 셋 중 둘이 락이면 락이 제대로 도는 것이고
     * (screen/batch/history/requirements.md) 그 비교는 함께 볼 때만 성립한다.
     *
     * <p><b>모르는 값을 조용히 전체로 흘리지 않는다</b> — {@code ErrorLogSpec} 과 같은
     * 규칙이다. 흘려보내면 <b>거르지 않은 목록을 거른 것으로 읽는다</b>.
     */
    private static BooleanExpression rsltGroup(Op op, Object value) {
        if (op != Op.eq) {
            throw new IllegalArgumentException("결과 묶음은 = 만 받는다 — " + op);
        }
        String group = String.valueOf(value);
        if (FAILED_ONLY.equalsIgnoreCase(group)) {
            return H.rsltCd.in(List.of(BatchResultCode.FAIL, BatchResultCode.CANCELED));
        }
        if (SKIPPED_ONLY.equalsIgnoreCase(group)) {
            return H.rsltCd.in(
                    List.of(BatchResultCode.SKIP_LOCK, BatchResultCode.SKIP_COOLDOWN));
        }
        throw new IllegalArgumentException(
                "결과 묶음은 " + FAILED_ONLY + " · " + SKIPPED_ONLY + " 뿐이다 — " + group);
    }

    private BatchHistorySpec() {}
}
