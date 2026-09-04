package com.aiagent.domain.batch.run;

import com.aiagent.domain.batch.entity.SysScheduleBatch;
import com.aiagent.domain.batch.repository.SysScheduleBatchRepository;
import com.aiagent.domain.batch.schedule.BatchScheduleChanged;
import com.aiagent.domain.batch.schedule.CronRules;
import jakarta.annotation.PreDestroy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ScheduledFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 크론을 <b>거는</b> 곳 — BATCH-01. 등록 표가 곧 스케줄이다.
 *
 * <p>{@code @Scheduled} 를 쓰지 않는다. 그 애너테이션은 <b>크론이 소스에 있을 때</b>의
 * 것이고, 여기서는 크론이 {@code SYS_SCHEDULE_BATCH.CRON} 이다 — 46 §5.2 의 <i>창고
 * 10개</i> 가 성립하려면 <b>데이터로 등록이 늘어야</b> 하며, 애너테이션이면 창고 하나마다
 * 소스를 고쳐 배포하게 된다(그것이 정확히 그 절이 피하려던 상황이다).
 *
 * <h2>다시 읽는 시점이 둘이다</h2>
 *
 * <table><caption></caption>
 *   <tr><td>기동 직후</td><td>{@code ApplicationReadyEvent} — DB 가 뜨고 나서다</td></tr>
 *   <tr><td>저장 커밋 뒤</td><td>{@link BatchScheduleChanged} — 롤백된 저장으로 걸지 않는다</td></tr>
 * </table>
 *
 * <p><b>전건을 다시 건다.</b> 부분 갱신은 <i>어느 것을 지우고 어느 것을 다시 거는가</i> 를
 * 저장 쪽이 알아야 한다는 뜻이 되고, 삭제·활성화·크론 변경이 전부 다른 갱신이 된다 —
 * 하나를 빠뜨리면 <b>바뀐 크론이 다음 재기동까지 반영되지 않는다</b>. 등록이 수십 건이라
 * 전건 재등록이 싸다.
 *
 * <h2>{@code USE_YN='N'} 은 <b>등록조차 하지 않는다</b></h2>
 *
 * <p>65 §3.6 — 크론이 남아 있어도 돌지 않으며 <b>{@code SKIP} 이력도 남지 않는다</b>.
 * 걸어 두고 실행할 때 끄면 <i>건너뛰었다</i> 가 되는데, <i>"안 돈다"</i> 와
 * <i>"건너뛰었다"</i> 는 다른 사건이고 실행 이력이 그 둘을 갈라야 한다(65 §4.3).
 *
 * <h2>모든 노드가 건다 — 락이 하나만 실행시킨다</h2>
 *
 * <p>31 §7. 노드마다 크론이 깨어나고 <b>먼저 잡은 하나만</b> 돈다. 나머지는
 * {@code SKIP_LOCK} 을 남기며 그것이 <b>다중화에서는 정상</b>이다 — 노드 3대에서 한 주기에
 * {@code SUCCESS} 1 + {@code SKIP_LOCK} 2 가 나오면 락이 제대로 동작한 것이고, 그 셋이
 * 안 보이면 오히려 이상하다(65 §4.6).
 *
 * <h2>기동 시 전건 재검증 — 저장이 막는 것을 여기서 <b>다시</b> 본다</h2>
 *
 * <p>31 §7 이 요구한 그것이다. 저장 화면이 검증하지만 <b>시드와 직접 UPDATE 는 그 검증을
 * 지나지 않으며</b>, 이 템플릿은 파기 배치를 시드로 넣는다(32 §4) — 지나지 않는 경로가
 * 실제로 있다.
 *
 * <p><b>둘을 보고 결과가 다르다.</b>
 *
 * <table><caption></caption>
 *   <tr><th>어긋남</th><th>결과</th><th>왜 그렇게 하나</th></tr>
 *   <tr><td>크론을 못 읽는다</td><td><b>걸지 않는다</b></td>
 *       <td>{@code CronTrigger} 가 생성자에서 던진다 — 걸려고 하면 <b>그 뒤의 등록이
 *           하나도 안 걸린다</b></td></tr>
 *   <tr><td>쿨다운 ≥ 크론 최소 간격</td><td><b>걸되 경고한다</b></td>
 *       <td>돌기는 돈다 — 쿨다운 간격으로 벌어질 뿐이다. 안 걸면 <b>성능 저하를 정지로
 *           바꾸는</b> 셈이고, 그것은 고치는 것이 아니라 키우는 것이다</td></tr>
 * </table>
 *
 * <p>둘째는 65 §3.4 가 저장에서 막는 바로 그 관계이며, 막힌 그것이 <b>왜 사고인가</b> 는
 * {@code SysBatchHistoryRepository#findLastAttemptStart} 에 적혀 있다 — 그 톱니바퀴가
 * 지금은 풀렸지만, 풀렸다고 해서 <b>매 주기 건너뜀이 쌓이는 등록</b>이 정상이 되지는
 * 않는다. 로그가 그것을 이름으로 부르는 유일한 자리다.
 */
@Component
public class BatchScheduler {

    private static final Logger log = LoggerFactory.getLogger(BatchScheduler.class);

    private final SysScheduleBatchRepository batches;
    private final BatchRunner runner;
    private final ThreadPoolTaskScheduler scheduler;

    /** 지금 걸려 있는 것 — 다시 걸 때 이 맵의 것을 전부 끊는다. */
    private final Map<String, ScheduledFuture<?>> scheduled = new HashMap<>();

    public BatchScheduler(SysScheduleBatchRepository batches, BatchRunner runner) {
        this.batches = batches;
        this.runner = runner;
        this.scheduler = new ThreadPoolTaskScheduler();
        /*
          깨우기만 하는 스레드다 — 실제 실행은 BatchExecutorConfig 의 풀에서 돈다.
          하나로 합치면 오래 걸리는 배치가 다음 배치의 깨우기를 막고, 그 지연은
          "크론이 안 맞았다" 로 보인다(실제로는 앞의 배치가 안 끝난 것이다).
        */
        this.scheduler.setPoolSize(1);
        this.scheduler.setThreadNamePrefix("batch-cron-");
        this.scheduler.setWaitForTasksToCompleteOnShutdown(false);
        this.scheduler.initialize();
    }

    /**
     * 기동 직후 — <b>{@code @PostConstruct} 가 아니다</b>.
     *
     * <p>그때는 Liquibase 도 커넥션 풀도 아직이라 이 조회가 실패한다.
     * {@code ApplicationReadyEvent} 가 <i>애플리케이션이 요청을 받을 준비가 됐다</i> 는
     * 뜻이고, 배치가 돌 수 있는 시점도 정확히 그때다.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        reload();
    }

    /**
     * 저장이 <b>커밋된 뒤</b> — 65 §3.4 의 저장 후 재조회와 같은 순서 규약이다.
     *
     * <p>{@code AFTER_COMMIT} 이 아니면 롤백된 저장으로 크론을 걸게 되고, 그러면
     * <b>DB 에 없는 등록이 돌아</b> 이력에 행을 남긴다 — 그 행의 {@code BATCH_ID} 로는
     * 등록을 찾을 수 없어 화면이 {@code (삭제된 배치)} 로 그린다. 고아가 <b>고장에서</b>
     * 생기는 유일한 경로가 되므로 막는다.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChanged(BatchScheduleChanged event) {
        reload();
    }

    /** 전건 재등록 — <b>동기화한다</b>. 기동과 저장이 겹치면 두 번 걸릴 수 있다. */
    @Transactional(readOnly = true)
    public synchronized void reload() {
        cancelAll();

        List<SysScheduleBatch> all = batches.findAll();
        List<String> rejected = new ArrayList<>();
        List<String> cooldownTooLong = new ArrayList<>();
        for (SysScheduleBatch batch : all) {
            if (!Boolean.TRUE.equals(batch.getUseYn())) {
                continue;
            }
            if (!CronRules.isValid(batch.getCron())) {
                // 기동 시 전건 재검증(31 §7) — 화면에서는 '다음 실행' 이 비어 드러난다.
                rejected.add(batch.getBatchId() + "(" + batch.getCron() + ")");
                continue;
            }
            if (CronRules.cooldownSwallowsCycles(
                    batch.getCron(), batch.getLockMinIntervalSec())) {
                cooldownTooLong.add(batch.getBatchId()
                        + "(크론 " + batch.getCron().trim()
                        + " · 쿨다운 " + batch.getLockMinIntervalSec() + "초)");
            }
            scheduled.put(
                    batch.getBatchId(),
                    scheduler.schedule(
                            () -> runner.runScheduled(batch),
                            new CronTrigger(batch.getCron().trim())));
        }
        log.info("배치 크론을 걸었다 — 등록 {}건 중 {}건", all.size(), scheduled.size());
        if (!rejected.isEmpty()) {
            log.warn("크론을 읽지 못해 걸지 않은 등록 — {}", rejected);
        }
        if (!cooldownTooLong.isEmpty()) {
            log.warn(
                    "쿨다운이 크론 주기 이상이라 주기마다 건너뛰는 등록 — {}."
                            + " 저장 화면은 이 조합을 거부한다(65 §3.4) — 시드나 직접 UPDATE 로 들어온 값이다",
                    cooldownTooLong);
        }
    }

    /**
     * <b>{@code false} 로 끊는다</b> — 도는 배치를 인터럽트하지 않는다.
     *
     * <p>중단은 협조적이어야 한다(46 §6.2). 여기서 인터럽트하면 배치가 체크포인트를 지나기
     * 전에 죽고, {@code RUNNING} 행이 그대로 남아 <b>유령</b>이 된다 — 크론 한 줄 고쳤을
     * 뿐인데 도는 배치가 죽는 것은 아무도 기대하지 않는 동작이다.
     */
    private void cancelAll() {
        scheduled.values().forEach(future -> future.cancel(false));
        scheduled.clear();
    }

    @PreDestroy
    public void shutdown() {
        cancelAll();
        scheduler.shutdown();
    }
}
