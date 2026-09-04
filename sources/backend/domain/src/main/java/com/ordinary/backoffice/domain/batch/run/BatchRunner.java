package com.ordinary.backoffice.domain.batch.run;

import com.ordinary.backoffice.domain.batch.BatchExecType;
import com.ordinary.backoffice.domain.batch.BatchJob;
import com.ordinary.backoffice.domain.batch.BatchJobContext;
import com.ordinary.backoffice.domain.batch.BatchJobRegistry;
import com.ordinary.backoffice.domain.batch.BatchJobResult;
import com.ordinary.backoffice.domain.batch.BatchResultCode;
import com.ordinary.backoffice.domain.batch.entity.SysBatchHistory;
import com.ordinary.backoffice.domain.batch.entity.SysScheduleBatch;
import com.ordinary.backoffice.domain.batch.repository.SysBatchHistoryRepository;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.lock.LockStore;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * 배치 한 번을 <b>실제로 돌리는 곳</b> — BATCH-02 · BATCH-09 · 31 §7.
 *
 * <p>두 입구가 있고 <b>쿨다운에서만 갈린다</b>.
 *
 * <table><caption></caption>
 *   <tr><th></th><th>{@link #runNow}</th><th>{@link #runScheduled}</th></tr>
 *   <tr><td>부르는 쪽</td><td>화면의 <b>즉시 실행</b>(65 §3.7)</td><td>크론</td></tr>
 *   <tr><td>{@code EXEC_TYPE_CD}</td><td>{@code MANUAL}</td><td>{@code SCHEDULE}</td></tr>
 *   <tr><td>쿨다운</td><td><b>우회한다</b>(31 §7)</td>
 *       <td>지킨다 — 막히면 {@code SKIP_COOLDOWN}</td></tr>
 *   <tr><td>락에 막히면</td><td><b>거절</b> — 사람이 보고 있다</td>
 *       <td>{@code SKIP_LOCK} 행 하나 — 다중화에서 <b>정상</b>이다</td></tr>
 * </table>
 *
 * <p><b>거절과 {@code SKIP} 이 다른 것이 요점이다.</b> 사람이 누른 실행은 <i>안 됐다</i> 를
 * <b>그 자리에서 말해야</b> 하고(65 §3.7 의 문구가 노드와 시각을 요구한다), 크론이 깨운
 * 실행은 아무도 보고 있지 않으므로 <b>이력에 적는 것이 유일한 말하기</b>다.
 *
 * <h2>던지고 끝낸다 — 진행률을 쓰지 않는다</h2>
 *
 * <p>65 §2.4. {@code ProgressHelper} 는 <i>요청 스레드가 시작하는 작업</i>을 전제하는데
 * 배치는 <b>락을 잡은 노드에서</b> 돌고 그것이 다른 노드일 수 있다. 진행 상황을 보여줄
 * 자리는 이미 있다 — 실행 이력의 {@code RUNNING} 행이다.
 *
 * <p>그래서 {@link #runNow} 는 <b>시작만 확인하고 돌아온다.</b> 화면은 하단 pane 을
 * 재조회하고 거기 {@code RUNNING} 행이 보인다(65 §3.9).
 *
 * <h2>락 해제가 {@code finally} 에 있다</h2>
 *
 * <p>없으면 프로세스가 살아 있는 채로 락이 남아 <b>만료까지 그 배치가 다시 못 돈다</b>.
 * 만료 안전망은 <i>프로세스가 죽었을 때</i>의 것이지 예외가 났을 때의 것이 아니다(31 §5).
 */
@Component
public class BatchRunner {

    /** 락 네임스페이스 — 키는 {@code BATCH_ID} 이고 그것이 PK 인 이유다(31 §7 · 46 §5). */
    public static final String LOCK_TYPE = "BATCH";

    private static final Logger log = LoggerFactory.getLogger(BatchRunner.class);

    /**
     * {@code ERR_MSG} 는 {@code nclob} 이라 길이 제약이 사실상 없지만 <b>무한은 아니다</b>.
     *
     * <p>architecture.md §6.2 가 요청 전문에 1MB 를 둔 것과 같은 이유이며, 46 §10 이 상세 결과의 절단
     * 상한을 미결로 남긴 것과 <b>같은 축</b>이다 — 스택은 보통 수 KB 라 이 값에 닿지
     * 않는다. 닿는 경우는 재귀 예외뿐이고 그때 필요한 것은 앞쪽 프레임이다.
     */
    private static final int STACK_MAX = 1_000_000;

    private final SysBatchHistoryRepository histories;
    private final BatchHistoryWriter writer;
    private final BatchJobRegistry registry;
    private final LockStore locks;
    private final BatchHeartbeat heartbeat;
    private final ConfigLookup configs;
    private final Executor executor;

    public BatchRunner(
            SysBatchHistoryRepository histories,
            BatchHistoryWriter writer,
            BatchJobRegistry registry,
            LockStore locks,
            BatchHeartbeat heartbeat,
            ConfigLookup configs,
            @Qualifier(BatchExecutorConfig.EXECUTOR) Executor executor) {
        this.histories = histories;
        this.writer = writer;
        this.registry = registry;
        this.locks = locks;
        this.heartbeat = heartbeat;
        this.configs = configs;
        this.executor = executor;
    }

    /**
     * 즉시 실행 — <b>거절되면 이유가 돌아온다</b>(65 §3.7).
     *
     * <p>거절 사유는 <b>하나뿐</b>이다: 이미 실행 중. 쿨다운은 우회하고({@link
     * LockStore#forceRelease}) {@code USE_YN='N'} 은 막지 않는다 — <i>꺼 둔 배치를 한 번
     * 돌려 보는 것이 정상 동선</i>이기 때문이다.
     *
     * <p><b>노드와 시각을 문구에 넣는 것이 요점이다.</b> <i>"실행 중입니다"</i> 만 내면
     * 운영자는 얼마나 기다려야 하는지 모른다 — 31 §8 이 {@code NODE_ID} 를 남긴 것과
     * 같은 이유다. 그래서 락이 아니라 <b>이력 행</b>을 보고 판정한다(락은 <i>잡혔다</i>
     * 만 말한다).
     */
    public RunOutcome runNow(SysScheduleBatch batch) {
        Optional<SysBatchHistory> running = runningOf(batch.getBatchId());
        if (running.isPresent()) {
            return RunOutcome.ofAlreadyRunning(running.get());
        }

        if (!acquire(batch)) {
            /*
              락에 막혔다. 이력에 RUNNING 이 있으면 방금 다른 노드가 시작한 것이고 —
              그때는 노드와 시각이 있는 문구를 낸다.

              없으면 쿨다운만 남은 락이다(31 §5 — 작업이 끝나도 그 시각까지 행이 남는다).
              수동은 그것을 우회하므로 지우고 다시 잡는다. **먼저 RUNNING 을 확인한 뒤에만**
              지우는 것이 forceRelease 의 계약이다 — 저장소는 도는 락과 쿨다운 락을 가리지
              못한다.
            */
            Optional<SysBatchHistory> raced = runningOf(batch.getBatchId());
            if (raced.isPresent()) {
                return RunOutcome.ofAlreadyRunning(raced.get());
            }
            locks.forceRelease(LOCK_TYPE, batch.getBatchId());
            if (!acquire(batch)) {
                return RunOutcome.ofAlreadyRunning(null);
            }
        }

        submit(batch, BatchExecType.MANUAL);
        return RunOutcome.ofStarted();
    }

    /**
     * 크론이 깨웠다 — <b>건너뛰면 행이 남는다</b>(46 §6.1).
     *
     * <p>기록하지 않으면 <i>"어제 배치가 안 돌았다"</i> 를 조사할 때 아무 흔적도 없고,
     * 크론이 안 맞은 것인지 다른 노드가 가져간 것인지 쿨다운에 막힌 것인지 구분할 수 없다.
     *
     * <p><b>{@code SKIP_LOCK} 과 {@code SKIP_COOLDOWN} 을 가르는 것이 여기서 일어난다.</b>
     * 락 저장소는 둘을 가르지 않으므로({@code tryAcquire} 가 {@code false} 하나로 돌려준다)
     * <b>쿨다운을 먼저 본다</b> — 순서가 판정이다. 뒤바꾸면 쿨다운에 막힌 것이 전부
     * {@code SKIP_LOCK} 으로 적히고, 그러면 <b>결함이 정상으로 기록</b>된다(65 §4.3).
     */
    public void runScheduled(SysScheduleBatch batch) {
        Instant cooldownUntil = cooldownUntil(batch);
        if (cooldownUntil != null) {
            writer.skip(
                    batch.getBatchId(),
                    BatchExecType.SCHEDULE,
                    BatchResultCode.SKIP_COOLDOWN,
                    "쿨다운("
                            + batch.getLockMinIntervalSec()
                            + "초)에 막혔다 — "
                            + cooldownUntil
                            + " 이후에 다시 시도한다");
            return;
        }
        if (!acquire(batch)) {
            writer.skip(
                    batch.getBatchId(),
                    BatchExecType.SCHEDULE,
                    BatchResultCode.SKIP_LOCK,
                    "다른 노드가 실행 중이다 — 다중화에서는 정상이다");
            return;
        }
        submit(batch, BatchExecType.SCHEDULE);
    }

    // ── 안 ──────────────────────────────────────────────────────────

    /**
     * <b>{@code RUNNING} 행을 먼저 쓰고</b> 실행을 큐에 넣는다.
     *
     * <p>순서가 뒤바뀌면 큐에서 기다리는 동안 화면에 아무것도 안 보이고, 사용자는
     * <i>버튼이 안 먹었다</i> 로 읽어 다시 누른다 — 65 §4.5 가 중단 버튼에서 걱정한 것과
     * 같은 종류다.
     */
    private void submit(SysScheduleBatch batch, BatchExecType execType) {
        Long histId = writer.start(batch.getBatchId(), execType);
        /*
          <b>큐에 넣기 전에 시작한다.</b> 실행 풀이 밀려 있으면 작업이 큐에서 몇 분을
          기다리는데, 그동안에도 락은 이 노드의 것이다. execute() 안에서 시작하면 그
          대기 시간이 통째로 밀리지 않는 구간이 되고, 만료가 지나면 유령 청소가
          **아직 시작도 안 한 실행**을 유실로 판정한다.
        */
        BatchHeartbeat.Beat beat =
                heartbeat.start(LOCK_TYPE, batch.getBatchId(), batch.getLockExpirySec());
        try {
            executor.execute(() -> execute(batch, histId, beat));
        } catch (RuntimeException e) {
            // 큐가 가득 찼다 — 시작 행만 남기고 죽으면 그 행이 영영 유령이 된다.
            beat.close();
            writer.finish(histId, BatchResultCode.FAIL, "실행 큐에 넣지 못했다", null, stackOf(e));
            locks.release(LOCK_TYPE, batch.getBatchId());
            throw e;
        }
    }

    /**
     * 실행 스레드가 하는 일 전부 — <b>트랜잭션 밖</b>이다.
     *
     * <p>배치가 자기 트랜잭션을 연다(대개 청크마다). 여기서 하나로 감싸면 오래 걸리는
     * 배치가 <b>커넥션 하나를 몇 분씩 잡고</b> 있게 되고, 그것은 중단이 협조적이어야 하는
     * 이유와 같은 종류의 문제를 만든다.
     */
    private void execute(SysScheduleBatch batch, Long histId, BatchHeartbeat.Beat beat) {
        try {
            /*
              <b>ADR-0026 §2 가 비워 둔 경계 셋 중 하나가 여기다.</b> 그 ADR 은 경계를
              <i>요청</i> 이 아니라 <b>작업</b> 으로 정의했고 스케줄러를 그 한 종류로
              들면서 "생기는 슬라이스가 한 줄을 넣는다" 고 적었다 — 이 슬라이스다.

              열지 않으면 배치가 `configs.get(...)` 에서 IllegalStateException 으로
              죽는다. 그리고 여기서 여는 것이 옳은 이유는 따로 있다: **한 실행 동안
              값이 고정돼야** 한다. 청크 백 번을 도는 중에 화면에서 보존 기간이 바뀌면
              앞 청크와 뒤 청크가 서로 다른 기준으로 지운다.
            */
            configs.inNewSnapshot(() -> runJob(batch, histId));
        } finally {
            beat.close();
            locks.release(LOCK_TYPE, batch.getBatchId());
        }
    }

    /** 실행 그 자체 — 이력을 적는 것까지가 한 덩어리다. */
    private void runJob(SysScheduleBatch batch, Long histId) {
        try {
            Optional<BatchJob> job = registry.find(batch.getBeanId());
            if (job.isEmpty()) {
                /*
                  저장이 막았으므로 여기 오는 경우는 <i>등록 뒤에 구현이 사라진 배포</i>
                  뿐이다. 실제로 일어난다 — 리팩터링으로 빈 이름이 바뀐다. 조용히
                  건너뛰면 "안 도는데 이유가 없는" 상태가 되므로 FAIL 로 남긴다.
                */
                writer.finish(
                        histId,
                        BatchResultCode.FAIL,
                        "등록된 BatchJob 구현이 없다 — " + batch.getBeanId(),
                        null,
                        null);
                return;
            }

            BatchJobResult result = BatchJobResult.orEmpty(job.get()
                    .run(new BatchJobContext(
                            batch.getBatchId(),
                            batch.getParamJson(),
                            histId,
                            () -> writer.isCancelRequested(histId))));

            writer.finish(
                    histId,
                    result.canceled() ? BatchResultCode.CANCELED : BatchResultCode.SUCCESS,
                    result.summary(),
                    result.detail(),
                    null);

        } catch (Exception e) {
            /*
              Throwable 이 아니라 Exception 이다 — OOM·StackOverflow 는 이 스레드가 이력을
              적을 수 있다는 보장이 없고, 적으려다 두 번째 오류가 나면 첫 번째가 로그에서도
              사라진다. 그런 죽음은 유령 행으로 드러난다(65 §4.4).
            */
            log.error("배치 실행이 실패했다 — batchId={} histId={}", batch.getBatchId(), histId, e);
            writer.finish(histId, BatchResultCode.FAIL, oneLineOf(e), null, stackOf(e));
        }
    }

    /**
     * 선점 — <b>쿨다운을 락에 실어 준다</b>(31 §5).
     *
     * <p>{@code releasableAt} 이 미래면 작업이 끝나도 그 시각까지 행이 남고, 그 사이의
     * {@code tryAcquire} 가 실패한다. 그것이 정확히 <i>같은 키의 최소 재실행 간격</i>이다.
     */
    private boolean acquire(SysScheduleBatch batch) {
        Instant now = writer.now();
        Instant expiresAt = now.plus(Duration.ofSeconds(batch.getLockExpirySec()));
        Instant releasableAt = batch.getLockMinIntervalSec() > 0
                ? now.plus(Duration.ofSeconds(batch.getLockMinIntervalSec()))
                : null;
        return locks.tryAcquire(LOCK_TYPE, batch.getBatchId(), expiresAt, releasableAt);
    }

    /**
     * 쿨다운이 남았으면 그 종료 시각 — 아니면 {@code null}.
     *
     * <p><b>락이 아니라 이력을 본다.</b> 락 저장소는 실패 이유를 가르지 않으므로
     * ({@code tryAcquire} 가 {@code false} 하나다) 여기서 미리 갈라야
     * {@code SKIP_COOLDOWN} 과 {@code SKIP_LOCK} 이 서로 다른 코드로 남는다 — 하나는
     * 결함이고 하나는 정상이라 <b>같은 코드에 두면 화면이 색을 줄 수 없다</b>(65 §4.3).
     *
     * <p>기준은 <b>마지막으로 실제로 돈 실행의 시작 시각</b>이다. 종료 시각으로 재면 오래
     * 걸린 배치가 자기 소요만큼 쿨다운을 더 갖게 되고, 31 §5 가 정의한 것은 <i>재실행
     * 간격</i>이다.
     *
     * <p><b>건너뜀 행은 기준이 아니다</b>(2026-08-31 에 뒤집었다). 넣으면 건너뜀이 자기
     * 다음 판정의 기준이 되어 쿨다운이 주기마다 앞으로 밀리고, 그 배치는 <b>다시는 돌지
     * 않는다</b> — 근거는 {@code SysBatchHistoryRepository#findLastAttemptStart} 에 있다.
     */
    private Instant cooldownUntil(SysScheduleBatch batch) {
        if (batch.getLockMinIntervalSec() <= 0) {
            return null;
        }
        Duration interval = Duration.ofSeconds(batch.getLockMinIntervalSec());
        Instant threshold = writer.now().minus(interval);
        return histories
                .findLastAttemptStart(batch.getBatchId())
                .filter(startedAt -> startedAt.isAfter(threshold))
                .map(startedAt -> startedAt.plus(interval))
                .orElse(null);
    }

    private Optional<SysBatchHistory> runningOf(String batchId) {
        List<SysBatchHistory> running =
                histories.findByBatchIdAndRsltCd(batchId, BatchResultCode.RUNNING);
        return running.isEmpty() ? Optional.empty() : Optional.of(running.get(0));
    }

    /** {@code RSLT_MSG} 에 실을 한 줄 — 목록 컬럼이라 스택을 넣지 않는다(46 §6.3). */
    private static String oneLineOf(Exception e) {
        String message = e.getMessage();
        return message == null || message.isBlank()
                ? e.getClass().getSimpleName()
                : e.getClass().getSimpleName() + ": " + message;
    }

    private static String stackOf(Exception e) {
        StringWriter out = new StringWriter();
        e.printStackTrace(new PrintWriter(out));
        String stack = out.toString();
        return stack.length() <= STACK_MAX ? stack : stack.substring(0, STACK_MAX);
    }

    /**
     * 즉시 실행의 결과 — <b>시작했는가, 아니면 왜 안 했는가</b>.
     *
     * <p>예외로 표현하지 않는 것은 65 §3.7 의 응답이 <b>건별</b>이기 때문이다. 여러 건을
     * 골라 누르면 어떤 것은 시작하고 어떤 것은 실행 중이며, 예외를 던지면 <b>첫 실패에서
     * 나머지가 멈춘다</b>.
     *
     * @param started 시작했는가
     * @param runningNodeId 이미 도는 노드 — {@code null} 이면 알 수 없다(락만 잡혀 있었다)
     * @param runningStartedAt 그 실행의 시작 시각
     */
    public record RunOutcome(boolean started, String runningNodeId, Instant runningStartedAt) {

        /**
         * <b>이름이 {@code started()} 가 아닌 것은 컴파일러가 정한다.</b> 레코드 컴포넌트와
         * 같은 이름의 메서드는 접근자 자리라 {@code static} 일 수 없다 — 팩토리가 비켜난다.
         */
        static RunOutcome ofStarted() {
            return new RunOutcome(true, null, null);
        }

        static RunOutcome ofAlreadyRunning(SysBatchHistory running) {
            return running == null
                    ? new RunOutcome(false, null, null)
                    : new RunOutcome(false, running.getNodeId(), running.getStartDtm());
        }
    }
}
