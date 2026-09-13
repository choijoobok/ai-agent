// @feat FEAT-508
package com.aiagent.domain.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.domain.batch.entity.SysBatchHistory;
import com.aiagent.domain.batch.entity.SysScheduleBatch;
import com.aiagent.domain.batch.repository.SysBatchHistoryRepository;
import com.aiagent.domain.batch.run.BatchHeartbeat;
import com.aiagent.domain.batch.run.BatchHistoryWriter;
import com.aiagent.domain.batch.run.BatchRunner;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.lock.LockStore;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.stubbing.Answer;

class BatchRunnerTest {

    private static final String BATCH_ID = "SETTLE_DAILY";
    private static final Instant STARTED_AT = Instant.parse("2026-09-12T00:00:00Z");

    private SysBatchHistoryRepository histories;
    private BatchHistoryWriter writer;
    private LockStore locks;
    private BatchHeartbeat heartbeat;
    private BatchHeartbeat.Beat beat;
    private ConfigLookup configs;
    private BatchRunner runner;

    @BeforeEach
    void setUp() {
        histories = mock(SysBatchHistoryRepository.class);
        writer = mock(BatchHistoryWriter.class);
        locks = mock(LockStore.class);
        heartbeat = mock(BatchHeartbeat.class);
        beat = mock(BatchHeartbeat.Beat.class);
        configs = mock(ConfigLookup.class);

        when(writer.now()).thenReturn(STARTED_AT);
        when(writer.start(BATCH_ID, BatchExecType.MANUAL)).thenReturn(42L);
        when(writer.start(BATCH_ID, BatchExecType.SCHEDULE)).thenReturn(43L);
        when(heartbeat.start(anyString(), anyString(), anyInt())).thenReturn(beat);
        when(locks.tryAcquire(anyString(), anyString(), any(), any())).thenReturn(true);
        when(histories.findByBatchIdAndRsltCd(BATCH_ID, BatchResultCode.RUNNING)).thenReturn(List.of());
        org.mockito.Mockito.doAnswer((Answer<Void>) invocation -> {
            ((Runnable) invocation.getArgument(0)).run();
            return null;
        }).when(configs).inNewSnapshot(any(Runnable.class));

        BatchJob job = context -> BatchJobResult.of("정산 완료", "처리 대상 1건");
        runner = runnerFor(job);
    }

    private BatchRunner runnerFor(BatchJob job) {
        return runnerFor(job, (Executor) Runnable::run);
    }

    private BatchRunner runnerFor(BatchJob job, Executor executor) {
        return new BatchRunner(
                histories,
                writer,
                new BatchJobRegistry(Map.of("settleDailyJob", job)),
                locks,
                heartbeat,
                configs,
                executor);
    }

    private static SysScheduleBatch batch() {
        return SysScheduleBatch.created(
                BATCH_ID, "야간 정산", "설명", "settleDailyJob", "0 0 2 * * *", "Asia/Seoul", null, 300, 0, true, 0);
    }

    @Test
    @DisplayName("TC-5081 즉시 실행은 RUNNING을 먼저 남기고 성공 결과와 종료 처리를 확정한다")
    void manualRunStartsAndFinishesSuccessfully() {
        BatchRunner.RunOutcome outcome = runner.runNow(batch());

        assertThat(outcome.started()).isTrue();
        verify(writer).start(BATCH_ID, BatchExecType.MANUAL);
        verify(writer).finish(42L, BatchResultCode.SUCCESS, "정산 완료", "처리 대상 1건", null);
        verify(beat).close();
        verify(locks).release(BatchRunner.LOCK_TYPE, BATCH_ID);
    }

    @Test
    @DisplayName("UC-508 같은 배치가 RUNNING이면 즉시 실행을 새로 시작하지 않고 현재 실행을 돌려준다")
    void manualRunRejectsAlreadyRunningBatch() {
        SysBatchHistory running = SysBatchHistory.started(
                BATCH_ID, BatchExecType.MANUAL, "app-02", STARTED_AT);
        when(histories.findByBatchIdAndRsltCd(BATCH_ID, BatchResultCode.RUNNING)).thenReturn(List.of(running));

        BatchRunner.RunOutcome outcome = runner.runNow(batch());

        assertThat(outcome).isEqualTo(new BatchRunner.RunOutcome(false, "app-02", STARTED_AT));
        verify(writer, never()).start(anyString(), any());
        verify(locks, never()).tryAcquire(anyString(), anyString(), any(), any());
        verify(writer, never()).finish(anyLong(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("TC-5083 중단을 읽고 끝난 실행만 CANCELED로 확정한다")
    void manualRunFinishesCanceledOnlyWhenJobReportsCancellation() {
        runner = runnerFor(context -> BatchJobResult.canceled("300건 처리 후 중단"));

        runner.runNow(batch());

        verify(writer).finish(42L, BatchResultCode.CANCELED, "300건 처리 후 중단", null, null);
    }

    @Test
    @DisplayName("TC-5081 큐가 거부하면 RUNNING을 FAIL로 끝내고 heartbeat와 락을 함께 정리한다")
    void queueRejectionFinishesTheStartedHistoryAndReleasesTheLock() {
        RuntimeException queueFull = new IllegalStateException("실행 풀이 가득 찼다");
        runner = runnerFor(context -> BatchJobResult.of("사용되지 않음", null), runnable -> {
            throw queueFull;
        });

        assertThatThrownBy(() -> runner.runNow(batch())).isSameAs(queueFull);

        verify(beat).close();
        verify(writer)
                .finish(
                        eq(42L),
                        eq(BatchResultCode.FAIL),
                        eq("실행 큐에 넣지 못했다"),
                        eq(null),
                        contains("IllegalStateException: 실행 풀이 가득 찼다"));
        verify(locks).release(BatchRunner.LOCK_TYPE, BATCH_ID);
    }

    @Test
    @DisplayName("UC-508 수동 실행은 쿨다운 락만 지우고 다시 선점해 시작한다")
    void manualRunReacquiresOnlyTheCooldownLock() {
        when(locks.tryAcquire(anyString(), anyString(), any(), any())).thenReturn(false, true);
        when(histories.findByBatchIdAndRsltCd(BATCH_ID, BatchResultCode.RUNNING))
                .thenReturn(List.of(), List.of());

        assertThat(runner.runNow(batch()).started()).isTrue();

        verify(locks).forceRelease(BatchRunner.LOCK_TYPE, BATCH_ID);
        verify(writer).start(BATCH_ID, BatchExecType.MANUAL);
    }

    @Test
    @DisplayName("UC-508 경쟁 실행이 보이면 수동 실행은 락을 강제 해제하지 않는다")
    void manualRunDoesNotReleaseALockWhenAnotherNodeStartedFirst() {
        SysBatchHistory raced = SysBatchHistory.started(
                BATCH_ID, BatchExecType.SCHEDULE, "app-03", STARTED_AT);
        when(locks.tryAcquire(anyString(), anyString(), any(), any())).thenReturn(false);
        when(histories.findByBatchIdAndRsltCd(BATCH_ID, BatchResultCode.RUNNING))
                .thenReturn(List.of(), List.of(raced));

        assertThat(runner.runNow(batch()))
                .isEqualTo(new BatchRunner.RunOutcome(false, "app-03", STARTED_AT));

        verify(locks, never()).forceRelease(BatchRunner.LOCK_TYPE, BATCH_ID);
        verify(writer, never()).start(anyString(), any());
    }

    @Test
    @DisplayName("TC-5083 스케줄 쿨다운은 락 충돌이 아니라 SKIP_COOLDOWN으로 기록한다")
    void scheduledRunRecordsCooldownBeforeTryingTheLock() {
        SysScheduleBatch cooldownBatch = batch(60);
        when(histories.findLastAttemptStart(BATCH_ID)).thenReturn(Optional.of(STARTED_AT.minusSeconds(1)));

        runner.runScheduled(cooldownBatch);

        verify(writer)
                .skip(
                        eq(BATCH_ID),
                        eq(BatchExecType.SCHEDULE),
                        eq(BatchResultCode.SKIP_COOLDOWN),
                        contains("쿨다운(60초)"));
        verify(locks, never()).tryAcquire(anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("TC-5083 쿨다운이 아니고 다른 노드가 선점했으면 SKIP_LOCK으로 기록한다")
    void scheduledRunRecordsLockContentionSeparatelyFromCooldown() {
        when(locks.tryAcquire(anyString(), anyString(), any(), any())).thenReturn(false);

        runner.runScheduled(batch());

        verify(writer)
                .skip(
                        eq(BATCH_ID),
                        eq(BatchExecType.SCHEDULE),
                        eq(BatchResultCode.SKIP_LOCK),
                        contains("다른 노드"));
        verify(writer, never()).start(anyString(), any());
    }

    @Test
    @DisplayName("TC-5081 스케줄 실행도 시작 이력부터 남기고 성공과 락 해제로 끝낸다")
    void scheduledRunStartsAndFinishesSuccessfully() {
        runner.runScheduled(batch());

        verify(writer).start(BATCH_ID, BatchExecType.SCHEDULE);
        verify(writer).finish(43L, BatchResultCode.SUCCESS, "정산 완료", "처리 대상 1건", null);
        verify(locks).release(BatchRunner.LOCK_TYPE, BATCH_ID);
    }

    @Test
    @DisplayName("TC-5083 등록 뒤 구현이 사라지면 SUCCESS 대신 FAIL로 남긴다")
    void missingRegisteredJobFinishesAsFail() {
        SysScheduleBatch missingJob = SysScheduleBatch.created(
                BATCH_ID, "야간 정산", "설명", "removedJob", "0 0 2 * * *", "Asia/Seoul", null, 300, 0, true, 0);

        runner.runNow(missingJob);

        verify(writer)
                .finish(
                        eq(42L),
                        eq(BatchResultCode.FAIL),
                        contains("등록된 BatchJob 구현이 없다"),
                        eq(null),
                        eq(null));
    }

    @Test
    @DisplayName("TC-5083 실행 예외는 FAIL 이력과 오류 전문을 남기고 락을 해제한다")
    void jobExceptionFinishesAsFailAndReleasesTheLock() {
        runner = runnerFor(context -> {
            throw new IllegalStateException("정산 원장 연결 실패");
        });

        runner.runNow(batch());

        verify(writer)
                .finish(
                        eq(42L),
                        eq(BatchResultCode.FAIL),
                        eq("IllegalStateException: 정산 원장 연결 실패"),
                        eq(null),
                        contains("IllegalStateException: 정산 원장 연결 실패"));
        verify(beat).close();
        verify(locks).release(BatchRunner.LOCK_TYPE, BATCH_ID);
    }

    private static SysScheduleBatch batch(int lockMinIntervalSec) {
        return SysScheduleBatch.created(
                BATCH_ID,
                "야간 정산",
                "설명",
                "settleDailyJob",
                "0 0 2 * * *",
                "Asia/Seoul",
                null,
                300,
                lockMinIntervalSec,
                true,
                0);
    }
}
