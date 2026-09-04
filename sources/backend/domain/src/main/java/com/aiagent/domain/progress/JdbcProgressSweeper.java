package com.aiagent.domain.progress;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * {@code jdbc} store 의 만료 청소 — retention.md · backend/crosscutting.md.
 *
 * <h2>청소가 저장소를 따라다닌다</h2>
 *
 * <p>retention.md 는 <i>"Redis·local store 는 native TTL 로 자동 만료되므로 청소 배치가 필요
 * 없다"</i> 고 적었다. 그래서 이 빈은 {@link JdbcJobProgressStore} 와 <b>같은 조건</b>을
 * 달고 선다 — 배포가 Redis 로 갈아타면 저장소와 함께 <b>사라진다</b>.
 *
 * <h2>{@code @Scheduled} 가 아니다</h2>
 *
 * <p>이유가 셋이다.
 *
 * <ul>
 *   <li>이 프로젝트에는 {@code @EnableScheduling} 이 없다 — 달아도 <b>돌지 않는다</b>.
 *       그리고 그 실패는 <i>아무 일도 안 일어남</i> 이라 드러나지 않는다
 *   <li>{@code BatchScheduler} 가 그 애너테이션을 <b>명시적으로 거절</b>했다: 크론은
 *       {@code SYS_SCHEDULE_BATCH} 에 있다
 *   <li>등록 배치로 만들면 그 행이 <b>Redis 배포에도 남아</b> 아무 일도 하지 않으면서
 *       성공으로 끝난다 — 켜 두었으니 돌고 있다고 믿게 된다
 * </ul>
 *
 * <p>모양은 {@code BatchGhostSweeper} 를 그대로 따른다: 자기 데몬 스케줄러 하나,
 * {@code ApplicationReadyEvent} 에서 시작(Liquibase 와 커넥션 풀이 선 뒤여야 한다).
 *
 * <h2>노드마다 돈다 — 락을 잡지 않는다</h2>
 *
 * <p>지우는 것이 <b>조건부 DELETE</b> 라 둘이 동시에 돌아도 두 번째는 지울 것이 없다.
 * 락을 씌우면 락을 잃은 노드에서 청소가 안 되고, <b>청소가 청소를 필요로 하게 된다</b>
 * ({@code BatchGhostSweeper} 와 같은 자리다).
 */
@Component
// JdbcJobProgressStore 와 <b>같은 조건</b>이다 — 저장소가 없으면 청소할 것도 없다.
@ConditionalOnProperty(name = "app.progress.store", havingValue = "jdbc", matchIfMissing = true)
public class JdbcProgressSweeper {

    private static final Logger log = LoggerFactory.getLogger(JdbcProgressSweeper.class);

    /**
     * 훑는 주기.
     *
     * <p>retention.md 의 표는 <b>일 1회</b>로 적었지만 그 값은 <i>보관 기간이 일 단위</i>라는
     * 전제에서 나온 것이다. 진행률의 보관 기간은 분 단위이므로(기본 30분), 일 1회로 훑으면
     * <b>보관 기간이 사실상 하루</b>가 된다 — 설정한 값과 실제가 갈린다.
     *
     * <p>비용은 인덱스 하나짜리 DELETE 라 자주 돌아도 싸다.
     */
    private static final Duration INTERVAL = Duration.ofMinutes(10);

    /** 기동 직후는 조금 늦춘다 — 뜨자마자 쓰기를 얹지 않는다. */
    private static final Duration INITIAL_DELAY = Duration.ofMinutes(1);

    private final JdbcJobProgressStore store;
    private final Clock clock;
    private final Duration ttl;
    private final Duration ghostAfter;
    private final ScheduledExecutorService scheduler;

    public JdbcProgressSweeper(
            JdbcJobProgressStore store,
            Clock clock,
            @Value("${app.progress.ttl}") Duration ttl,
            @Value("${app.progress.ghost-after}") Duration ghostAfter) {
        this.store = store;
        this.clock = clock;
        this.ttl = ttl;
        this.ghostAfter = ghostAfter;
        this.scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "progress-sweeper");
            thread.setDaemon(true);
            return thread;
        });
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        scheduler.scheduleWithFixedDelay(
                this::sweepQuietly,
                INITIAL_DELAY.toSeconds(),
                INTERVAL.toSeconds(),
                TimeUnit.SECONDS);
    }

    /**
     * 한 번 훑는다 — 지운 건수를 돌려준다.
     *
     * <p>공개인 것은 테스트가 부르기 때문이다. 운영에서 부르는 것은 스케줄 하나뿐이다.
     */
    public int sweep() {
        Instant now = clock.instant();
        return store.purge(now.minus(ttl), now.minus(ghostAfter));
    }

    /**
     * <b>삼킨다.</b> 던지면 {@code scheduleWithFixedDelay} 가 <b>다음 실행을 걸지 않는다</b> —
     * 일시적인 DB 단절 한 번에 청소가 <b>재기동까지 영영</b> 멈춘다.
     */
    private void sweepQuietly() {
        try {
            int purged = sweep();
            if (purged > 0) {
                log.debug("purged {} expired job progress rows", purged);
            }
        } catch (RuntimeException e) {
            log.warn("job progress sweep failed; will retry on the next tick", e);
        }
    }
}
