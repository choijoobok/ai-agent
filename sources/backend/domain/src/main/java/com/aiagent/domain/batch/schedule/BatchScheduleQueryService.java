package com.aiagent.domain.batch.schedule;

import static com.aiagent.domain.batch.schedule.BatchScheduleSpec.B;
import static com.aiagent.domain.batch.schedule.BatchScheduleSpec.SPEC;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.batch.BatchJobRegistry;
import com.aiagent.domain.batch.BatchResultCode;
import com.aiagent.domain.batch.entity.QSysBatchHistory;
import com.aiagent.domain.batch.entity.SysScheduleBatch;
import com.aiagent.domain.batch.repository.SysBatchHistoryRepository;
import com.aiagent.domain.batch.repository.SysScheduleBatchRepository;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.aiagent.support.time.Timezones;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.JPAExpressions;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code BATCH_SCHEDULE} 의 조회 — screen/batch/schedule/requirements.md.
 *
 * <h2>파생 셋이 세 곳에서 온다</h2>
 *
 * <table><caption></caption>
 * <tr><td><b>다음 실행</b></td><td>크론 파서 — 프론트에 없다(screen/batch/schedule/requirements.md)</td></tr>
 *   <tr><td><b>최근 결과</b></td><td>{@code SYS_BATCH_HISTORY} 의 가장 최근 행</td></tr>
 *   <tr><td><b>실행 중</b></td><td>같은 테이블의 {@code RUNNING} 행 — 삭제 게이트가 본다</td></tr>
 * </table>
 *
 * <p><b>API 를 늘리지 않는다</b>(screen/batch/schedule/requirements.md) — 셋 다 목록 조회가 계산해 내려주며, 저장 후
 * 재조회(frontend/grid.md)에서 새 값이 온다. 크론을 고치고 <i>다음 실행</i> 이 월요일로 바뀌는 것을
 * 보는 것이 이 화면에서 크론을 눈으로 확인하는 유일한 방법이다.
 *
 * <h2>이력을 행마다 묻지 않는다</h2>
 *
 * <p>페이지의 {@code BATCH_ID} 전부를 모아 <b>두 번</b> 묻는다 — 최근 결과 한 번, 실행 중
 * 한 번. 행마다 부르면 50행에 100번이고, 그 N+1 은 <b>이 화면에서만</b> 티가 안 난다
 * (등록이 수십 건이라). 등록이 수백 건이 되는 날 조용히 느려진다.
 */
@Service
@Transactional(readOnly = true)
public class BatchScheduleQueryService {

    private static final QSysBatchHistory H = QSysBatchHistory.sysBatchHistory;

    /** 상관 서브쿼리의 짝 — 같은 테이블을 두 번 참조하므로 별칭이 달라야 한다. */
    private static final QSysBatchHistory LATEST = new QSysBatchHistory("latest");

    private static final Expression<?>[] LIST = {
        B.sortNo,
        B.batchId,
        B.batchNm,
        B.batchDesc,
        B.beanId,
        B.cron,
        B.timezone,
        B.paramJson,
        B.lockExpirySec,
        B.lockMinIntervalSec,
        B.useYn,
        B.regId,
        B.regDtm,
        B.modId,
        B.modDtm
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final SysScheduleBatchRepository batches;
    private final SysBatchHistoryRepository histories;
    private final BatchJobRegistry registry;
    private final Clock clock;

    public BatchScheduleQueryService(
            JPAQueryFactory query,
            QueryDslBuilder builder,
            SysScheduleBatchRepository batches,
            SysBatchHistoryRepository histories,
            BatchJobRegistry registry,
            Clock clock) {
        this.query = query;
        this.builder = builder;
        this.batches = batches;
        this.histories = histories;
        this.registry = registry;
        this.clock = clock;
    }

    /** 마스터 목록 — 기본 정렬이 {@code SORT_NO} 이고 페이지 사이즈가 50 이다(screen/batch/schedule/requirements.md). */
    public PageResponse<BatchScheduleRow> getList(SearchRequest<Void> request) {
        Built built = builder.build(request, SPEC, PageMode.offset);

        List<Tuple> found = built.apply(query.select(Projections.tuple(LIST))).fetch();
        Long total = built.count(query).fetchOne();

        List<String> batchIds = found.stream().map(row -> row.get(B.batchId)).toList();
        Map<String, BatchResultCode> lastResults = lastResultsOf(batchIds);
        Set<String> running = new HashSet<>(histories.findRunningBatchIds(batchIds));
        Instant now = clock.instant();

        List<BatchScheduleRow> rows = new ArrayList<>(found.size());
        for (Tuple row : found) {
            String batchId = row.get(B.batchId);
            rows.add(new BatchScheduleRow(
                    row.get(B.sortNo),
                    batchId,
                    row.get(B.batchNm),
                    row.get(B.batchDesc),
                    row.get(B.beanId),
                    row.get(B.cron),
                    row.get(B.timezone),
                    nextExecutionOf(row, now),
                    row.get(B.paramJson),
                    row.get(B.lockExpirySec),
                    row.get(B.lockMinIntervalSec),
                    row.get(B.useYn),
                    lastResults.get(batchId),
                    running.contains(batchId),
                    row.get(B.regId),
                    row.get(B.regDtm),
                    row.get(B.modId),
                    row.get(B.modDtm)));
        }
        return built.respond(rows, total == null ? 0L : total);
    }

    /**
     * {@code BEAN_ID} 셀렉트의 후보 — <b>스프링 컨텍스트가 원본</b>이다(screen/batch/schedule/requirements.md).
     *
     * <p>시드가 아니다. 시드로 두면 배포마다 구현과 목록이 어긋날 수 있고, 어긋나면
     * 화면이 <i>고를 수 있는데 실행되지 않는</i> 빈을 보여준다.
     *
     * <p><b>비어 있는 것이 정상이다</b> — 템플릿에는 {@code BatchJob} 구현이 하나도 없다.
     */
    public List<String> getBeanIds() {
        return registry.beanIds();
    }

    /** 즉시 실행이 대상을 집는 자리 — 없으면 화면이 낡았거나 화면 밖 경로다. */
    public SysScheduleBatch require(String batchId) {
        return batches.findById(batchId)
                .orElseThrow(() -> new BusinessException(
                        BatchScheduleErrorCode.NOT_FOUND, "없는 배치다 — " + batchId));
    }

    // ── 파생 ────────────────────────────────────────────────────────

    /**
     * <b>꺼 둔 배치는 비운다</b> — screen/batch/schedule/requirements.md.
     *
     * <p>{@code USE_YN='N'} 이면 스케줄러가 등록조차 하지 않으므로 시각을 그리면
     * <i>돌 것처럼</i> 보인다. 크론이 남아 있는 것과 그 크론이 걸려 있는 것은 다른 사실이며,
     * 실행 이력에서 <b>행이 없으면 꺼져 있는 것</b>이라는 판정(screen/batch/schedule/requirements.md)과 짝을 이룬다.
     *
     * <p>크론이 깨져 있어도 비운다 — 저장이 막지만 시드나 직접 UPDATE 는 그 검증을 지나지
     * 않는다. 그때 이 칸이 비는 것이 <b>고장의 신호</b>다.
     */
    private static Instant nextExecutionOf(Tuple row, Instant now) {
        if (!Boolean.TRUE.equals(row.get(B.useYn))) {
            return null;
        }
        /*
          **시간대가 깨져 있어도 비운다** — 크론과 같은 규칙이다. 저장이 막지만 시드나 직접
          UPDATE 는 그 검증을 지나지 않고, 그때 이 칸이 비는 것이 고장의 신호다.
        */
        String zone = row.get(B.timezone);
        if (!Timezones.isKnown(zone)) {
            return null;
        }
        return CronRules.nextExecution(row.get(B.cron), now, ZoneId.of(zone)).orElse(null);
    }

    /**
     * 배치마다 <b>가장 최근 실행의 결과</b> — 하단 pane 첫 행과 같은 값이다(screen/batch/schedule/requirements.md).
     *
     * <p>상관 서브쿼리로 {@code MAX(START_DTM)} 을 맞춘다. {@code LIMIT 1} 서브쿼리를 쓰지
     * 않는 것은 JPQL 이 그것을 이식성 있게 표현하지 못하기 때문이며, 여기 인덱스가
     * {@code (BATCH_ID, START_DTM)} 이라 최댓값 찾기가 그대로 인덱스를 탄다.
     *
     * <p><b>동률이면 먼저 온 것을 쓴다.</b> 같은 밀리초에 두 행이 시작하는 경우이며
     * (같은 노드에서는 사실상 없다) 결과가 갈리는 일도 드물다 — 갈리더라도 그때 화면이
     * 답해야 하는 것은 <i>지금 어떤 상태인가</i> 이고 그것은 {@code running} 이 따로 낸다.
     */
    private Map<String, BatchResultCode> lastResultsOf(List<String> batchIds) {
        if (batchIds.isEmpty()) {
            return Map.of();
        }
        Map<String, BatchResultCode> results = new HashMap<>();
        for (List<String> chunk : com.aiagent.core.search.InChunks.split(batchIds)) {
            List<Tuple> found = query.select(H.batchId, H.rsltCd)
                    .from(H)
                    .where(H.batchId.in(chunk)
                            .and(H.startDtm.eq(JPAExpressions.select(LATEST.startDtm.max())
                                    .from(LATEST)
                                    .where(LATEST.batchId.eq(H.batchId)))))
                    .fetch();
            for (Tuple row : found) {
                results.putIfAbsent(row.get(H.batchId), row.get(H.rsltCd));
            }
        }
        return results;
    }
}
