// @feat FEAT-508
package com.aiagent.domain.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
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
    private ConfigLookup configs;
    private BatchRunner runner;

    @BeforeEach
    void setUp() {
        histories = mock(SysBatchHistoryRepository.class);
        writer = mock(BatchHistoryWriter.class);
        locks = mock(LockStore.class);
        heartbeat = mock(BatchHeartbeat.class);
        BatchHeartbeat.Beat beat = mock(BatchHeartbeat.Beat.class);
        configs = mock(ConfigLookup.class);

        when(writer.now()).thenReturn(STARTED_AT);
        when(writer.start(BATCH_ID, BatchExecType.MANUAL)).thenReturn(42L);
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
        return new BatchRunner(
                histories,
                writer,
                new BatchJobRegistry(Map.of("settleDailyJob", job)),
                locks,
                heartbeat,
                configs,
                (Executor) Runnable::run);
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
}
