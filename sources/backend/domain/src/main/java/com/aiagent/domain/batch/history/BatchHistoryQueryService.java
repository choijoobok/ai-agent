package com.aiagent.domain.batch.history;

import static com.aiagent.domain.batch.history.BatchHistorySpec.B;
import static com.aiagent.domain.batch.history.BatchHistorySpec.H;
import static com.aiagent.domain.batch.history.BatchHistorySpec.SPEC;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.batch.BatchExecType;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.core.types.dsl.CaseBuilder;
import com.querydsl.core.types.dsl.NumberExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code BATCH_HISTORY} 의 조회 — screen/admin/system/batch/history/requirements.md. <b>쓰기가 없다.</b>
 *
 * <p>쓰는 쪽은 {@code BatchHistoryWriter}(러너)와 {@code BatchCancelService}(중단 요청)이며
 * <b>둘 다 화면의 조회와 다른 축</b>이다. {@code ErrorLogQueryService} 가
 * {@code ExceptionLogRecorder} 와 갈린 것과 같은 모양이다.
 *
 * <h2>{@code PageMode.offset} 이다 — 이력 셋 중 유일하다</h2>
 *
 * <p>사용 이력·로그인 이력·에러 로그는 셋 다 커서형이고 총 건수를 세지 않는다(screen/admin/system/log/access/requirements.md).
 * 여기는 <b>번호 있는 페이징</b>이며 <b>센다</b> — screen/admin/system/batch/history/requirements.md 이 항목별로 따져 그렇게 정했다.
 * 정렬을 열려면 번호 페이징이 있어야 하고, 정렬을 여는 이유는
 * {@code ELAPSED_MS} 를 저장한 결정 그 자체다(sys/batch.md).
 *
 * <h2>{@code nclob} 둘을 {@code SELECT} 하지 않는다</h2>
 *
 * <p>목록은 <b>있는가</b> 만 센다({@link #HAS_DETAIL}) — screen/admin/system/batch/history/requirements.md. 100행마다 대상 목록
 * 수백 줄을 실어 나르면 그리드가 아니라 파일 전송이 된다.
 *
 * <h2>유령 판정이 서버에 있다</h2>
 *
 * <p>screen/admin/system/batch/history/requirements.md — {@code RUNNING} 인데 {@code LOCK_EXPIRY_SEC} 를 넘겼으면 죽은 것이다.
 * <b>임계값이 조인해 온 값</b>이라 화면이 스스로 판정할 수 없고, 판정을 내려보내지 않으면
 * 화면은 {@code LOCK_EXPIRY_SEC} 를 컬럼으로 받아야 한다 — 이력에 없는 값을 이력 행에
 * 실어 보내는 셈이다.
 */
@Service
@Transactional(readOnly = true)
public class BatchHistoryQueryService {

    /** 하단 pane 의 기본 건수 — screen/admin/system/batch/history/requirements.md. 전량은 이 화면이 답한다. */
    public static final int RECENT_LIMIT = 10;

    /**
     * <b>값이 아니라 유무다</b>(screen/admin/system/batch/history/requirements.md). {@code [보기]} 가 생기는가를 이 한 칸이 정한다.
     *
     * <p>둘을 따로 내려보내지 않는 것은 <b>셀이 하나</b>이기 때문이다 — 어느 탭이 열리는지는
     * 모달을 열 때 {@code getDetail} 이 말한다. 목록에 둘 다 실으면 셀 하나를 위해 칸이
     * 둘이고, 그 둘은 목록에서 아무 데도 쓰이지 않는다.
     */
    private static final NumberExpression<Integer> HAS_DETAIL = new CaseBuilder()
            .when(H.rsltDtlMsg.isNotNull().or(H.errMsg.isNotNull()))
            .then(1)
            .otherwise(0);

    private static final Expression<?>[] LIST = {
        H.histId,
        H.startDtm,
        H.batchId,
        B.batchNm,
        H.execTypeCd,
        H.rsltCd,
        H.elapsedMs,
        H.rsltMsg,
        HAS_DETAIL,
        H.endDtm,
        H.nodeId,
        H.cancelReqDtm
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;

    public BatchHistoryQueryService(JPAQueryFactory query, QueryDslBuilder builder) {
        this.query = query;
        this.builder = builder;
    }

    /**
     * 목록 — 번호 페이징이고 <b>총 건수를 센다</b>(screen/admin/system/batch/history/requirements.md).
     *
     * <p><b>기간이 필수가 아니다</b>(screen/admin/system/log/access/requirements.md 를 상속하지 않는다). 등록 수십 건 × 하루 수십
     * 회라 90일에 수천만 행이 되는 그 근거가 여기서는 성립하지 않는다 — 기본값은 두되
     * 비우고 조회할 수 있으며, 1년치가 수십만 행이라 <b>느려지지만 막지는 않는다</b>.
     */
    public PageResponse<BatchHistoryRow> getList(SearchRequest<Void> request) {
        Built built = builder.build(request, SPEC, PageMode.offset);

        List<Tuple> found = built.apply(query.select(Projections.tuple(LIST))).fetch();
        Long total = built.count(query).fetchOne();

        return built.respond(rowsOf(found), total == null ? 0L : total);
    }

    /**
     * 스케줄 관리의 하단 pane — <b>이 배치의 최근 N건</b>(screen/admin/system/batch/history/requirements.md).
     *
     * <p><b>화면이 10건만 묻는다.</b> 전량을 묻는 질문에는 마스터가 아니라 <i>이 화면</i>이
     * 답하며(screen/menu/requirements.md 과 같은 방향), 그래서 pane 에서 행을 더블 클릭하면
     * {@code BATCH_HISTORY} 가 그 배치로 열린다.
     *
     * <p><b>{@code QuerySpec} 은 목록과 같은 것을 쓴다.</b> 기본 정렬이
     * {@code START_DTM DESC, HIST_ID DESC} 라 <b>pane 의 첫 행과 마스터의 <i>최근 결과</i>
     * 가 같은 행</b>이 된다 — screen/admin/system/batch/history/requirements.md 가 요구한 그 일치는 정렬을 공유해야 성립한다.
     *
     * <p>배치를 <b>조건이 아니라 파라미터로</b> 받는 것은 {@code getAffectedUsers} 와 같다
     * (backend/api.md) — 조건 목록에 담으면 사용자가 지울 수 있고, 지우면 이 pane 이 <b>전 배치의
     * 최근 실행</b>을 낸다.
     */
    public PageResponse<BatchHistoryRow> getRecent(SearchRequest<BatchIdParams> request) {
        String batchId = request.params().batchId();
        Built built = builder.build(request, SPEC, PageMode.offset);

        List<Tuple> found = built.apply(query.select(Projections.tuple(LIST)))
                .where(H.batchId.eq(batchId))
                .fetch();
        Long total = built.count(query).where(H.batchId.eq(batchId)).fetchOne();

        return built.respond(rowsOf(found), total == null ? 0L : total);
    }

    /**
     * 탭 둘을 <b>한 번에</b> — screen/admin/system/batch/schedule/requirements.md. <b>동적 봉투를 태우지 않는다</b>(backend/api.md).
     *
     * <p>PK 하나로 한 행을 집는 고정형이다. 조건 목록으로 열면 <b>{@code nclob} 조회가 임의
     * 조건의 조회</b>가 되고, 그 순간 그것을 목록에서 뺀 이유가 무너진다.
     */
    public BatchHistoryDetail getDetail(long histId) {
        Tuple found = query.select(H.histId, H.rsltDtlMsg, H.errMsg)
                .from(H)
                .where(H.histId.eq(histId))
                .fetchFirst();

        if (found == null) {
            // 목록을 본 뒤 파기 배치가 지나갔다(retention.md) — 목록은 그대로 둔다(screen/admin/system/batch/schedule/requirements.md).
            throw new BusinessException(
                    BatchHistoryErrorCode.PURGED, "배치 실행 이력 행이 없다 — " + histId);
        }
        return new BatchHistoryDetail(
                found.get(H.histId), found.get(H.rsltDtlMsg), found.get(H.errMsg));
    }

    // ── 안 ──────────────────────────────────────────────────────────

    private List<BatchHistoryRow> rowsOf(List<Tuple> found) {
        List<BatchHistoryRow> rows = new ArrayList<>(found.size());
        for (Tuple row : found) {
            rows.add(new BatchHistoryRow(
                    row.get(H.histId),
                    row.get(H.startDtm),
                    row.get(H.batchId),
                    row.get(B.batchNm),
                    row.get(H.execTypeCd),
                    row.get(H.rsltCd),
                    row.get(H.elapsedMs),
                    row.get(H.rsltMsg),
                    Integer.valueOf(1).equals(row.get(HAS_DETAIL)),
                    row.get(H.endDtm),
                    row.get(H.nodeId),
                    row.get(H.cancelReqDtm)));
        }
        return rows;
    }

    /**
     * 죽었는가 — screen/admin/system/batch/schedule/requirements.md.
     *
     * <p><b>임계값을 새로 만들지 않는다.</b> {@code LOCK_EXPIRY_SEC} 가 이미 그 값이며
     * (sys/batch.md <i>만료 안전망</i>) 조인해서 쓴다.
     *
     * <p><b>삭제된 배치면 판정하지 않는다</b>(screen/admin/system/batch/history/requirements.md) — 잴 자가 없다. 여기서 임의의
     * 기본값을 두면 <i>등록을 지우자 옛 이력이 갑자기 유령이 되는</i> 일이 생긴다.
     *
     * <p><b>화면이 정리하지는 않는다.</b> 유령 행을 {@code FAIL} 로 바꾸는 것은 락 만료
     * 안전망의 일이며, 화면에 버튼을 두면 정리 주체가 둘이 된다.
     */
    public static List<BatchExecType> execTypes() {
        return List.of(BatchExecType.values());
    }
}
