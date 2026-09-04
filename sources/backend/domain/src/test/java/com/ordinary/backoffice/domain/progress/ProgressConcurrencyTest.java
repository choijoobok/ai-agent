package com.ordinary.backoffice.domain.progress;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 여러 스레드가 함께 세도 <b>건수가 맞는가</b> — 2026-09-03.
 *
 * <p>{@link Progress} 는 오래 <i>"스레드 하나가 쓴다"</i> 를 전제로 아무 보호가 없었다.
 * 지금 쓰는 두 실행이 단일 루프라 드러나지 않았을 뿐이고, <b>구조가 그것을 막고 있지는
 * 않았다</b> — 그래서 이 파일이 그 자리를 지킨다.
 *
 * <p><b>이 고장은 조용하다.</b> {@code curCnt++} 가 겹쳐 유실되어도 예외가 없고 작업도
 * 정상으로 끝난다. 남는 것은 <i>100% 에 못 닿는 막대</i> 하나뿐이며, 몇 건이 사라졌는지는
 * 아무 데도 적히지 않는다.
 */
class ProgressConcurrencyTest {

    private static final int THREADS = 8;
    private static final int STEPS_PER_THREAD = 10_000;
    private static final long TOTAL = (long) THREADS * STEPS_PER_THREAD;

    /** 저장소에 기록된 건수들 — 순서대로 담는다(되돌아가는지도 함께 본다). */
    private final List<Long> writes = new CopyOnWriteArrayList<>();

    private final AtomicBoolean completed = new AtomicBoolean();

    private final JobProgressStore store = new JobProgressStore() {
        @Override
        public void start(String jobId, String userId, Long totCnt) {}

        @Override
        public void progress(String jobId, long curCnt, String stepMsg, String subTitle) {
            writes.add(curCnt);
        }

        @Override
        public void reset(String jobId, String subTitle, Long totCnt) {
            writes.add(0L);
        }

        @Override
        public void complete(String jobId) {
            completed.set(true);
        }

        @Override
        public void fail(String jobId, String errMsg) {}

        @Override
        public Optional<JobProgressView> find(String jobId, String userId) {
            return Optional.empty();
        }
    };

    /*
      <b>{@code subTitle} 로 마지막 값을 뽑는다.</b> 걸음은 조절에 걸려 마지막 몇 건이
      기록되지 않을 수 있고, 그것은 정상이다 — 여기서 재려는 것은 <i>손잡이가 센 값</i>
      이므로 조절을 지나가는 쓰기 하나가 필요하다. 소제목은 건수를 <b>그대로</b> 밀어
      넣으므로(걸음을 더하지 않는다) 그 값이 곧 총 걸음 수다.
    */
    @Test
    @DisplayName("여덟 스레드가 8만 걸음을 밟아도 건수가 하나도 유실되지 않는다")
    void countsEveryStepUnderContention() throws Exception {
        Progress progress = new Progress(store, Clock.systemUTC(), "j1", TOTAL);
        runInParallel(() -> {
            for (int index = 0; index < STEPS_PER_THREAD; index++) {
                progress.step();
            }
        });

        progress.subTitle("끝");

        assertThat(writes.get(writes.size() - 1)).isEqualTo(TOTAL);
    }

    /*
      <b>막대는 뒤로 가지 않는다.</b> 저장소가 {@code CUR_CNT} 를 덮어쓰므로, 늦게 도착한
      쓰기가 더 작은 값을 실으면 화면의 막대가 되돌아간다 — 사용자는 그것을 <i>다시
      시작했다</i> 로 읽는다.
    */
    @Test
    @DisplayName("기록된 건수가 되돌아가지 않는다 — 늦은 쓰기가 앞선 값을 덮지 않는다")
    void writesNeverGoBackwards() throws Exception {
        Progress progress = new Progress(store, Clock.systemUTC(), "j1", TOTAL);
        runInParallel(() -> {
            for (int index = 0; index < STEPS_PER_THREAD; index++) {
                // 문구를 섞는다 — 그 걸음은 조절을 건너뛰고 <b>기다려서</b> 쓴다.
                progress.step(index % 500 == 0 ? "처리 중" : null);
            }
        });

        assertThat(writes).isSorted();
    }

    /*
      <b>종료 뒤에는 쓰지 않는다.</b> 없으면 종료 직전에 밟힌 걸음이 뒤늦게 도착해
      {@code MOD_DTM} 을 되돌리고, 만료 청소가 그 행을 <i>방금 끝난 작업</i>으로 읽는다.
    */
    @Test
    @DisplayName("종료를 적은 뒤의 걸음은 기록되지 않는다")
    void ignoresStepsAfterCompletion() {
        Progress progress = new Progress(store, Clock.systemUTC(), "j1", 10L);
        progress.step("첫 걸음");
        int before = writes.size();

        progress.complete();
        progress.step("늦은 걸음");
        progress.subTitle("늦은 소제목");

        assertThat(completed).isTrue();
        assertThat(writes).hasSize(before);
    }

    private void runInParallel(Runnable work) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch ready = new CountDownLatch(THREADS);
        CountDownLatch go = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(THREADS);
        try {
            for (int index = 0; index < THREADS; index++) {
                pool.execute(() -> {
                    ready.countDown();
                    try {
                        // 다 같이 출발한다 — 먼저 시작한 스레드가 혼자 끝내면 겹침이 없다.
                        go.await();
                        work.run();
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                    } finally {
                        done.countDown();
                    }
                });
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            go.countDown();
            assertThat(done.await(60, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }
    }
}
