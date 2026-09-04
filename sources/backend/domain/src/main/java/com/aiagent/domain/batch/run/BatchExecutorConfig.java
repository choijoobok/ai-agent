package com.aiagent.domain.batch.run;

import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 배치가 도는 스레드 — backend/crosscutting.md 과 <b>다른 자리</b>다.
 *
 * <p>그 문서의 {@code ProgressHelper} 는 <i>요청 스레드가 시작하는 작업</i>을 전제하고
 * 배치는 그렇지 않다(screen/batch/schedule/requirements.md). 그래서 여기서 <b>{@code @EnableAsync} 를 켜지 않는다</b> —
 * 켜면 전 애플리케이션의 {@code @Async} 기본 실행기가 정해지고, 그 결정은 30 이 아직
 * 하지 않은 결정이다(Phase 6). 이 슬라이스는 <b>자기 풀 하나</b>만 갖는다.
 *
 * <h2>풀이 작다</h2>
 *
 * <table><caption></caption>
 *   <tr><td>core 2 · max 4</td>
 *       <td>배치는 <b>동시에 여러 개 도는 것이 목적이 아니다.</b> 락이 배치마다 갈리므로
 *           동시 실행 자체는 가능하지만, 그것들이 전부 DB 를 쓰므로 커넥션 풀이 진짜
 *           상한이다 — 여기를 키우면 사용자 요청이 커넥션을 못 잡는다</td></tr>
 *   <tr><td>큐 100</td>
 * <td>등록이 수십 건이라(sys/batch.md) 한 주기에 전부 깨워도 들어간다.
 *           <b>무한 큐를 쓰지 않는다</b> — 넘치면 {@code FAIL} 로 이력에 남는 편이
 *           조용히 쌓이다 메모리로 죽는 것보다 낫다({@link BatchRunner#submit})</td></tr>
 *   <tr><td>{@code waitForTasksToComplete}</td>
 *       <td>종료 시 <b>도는 배치를 기다린다.</b> 안 기다리면 {@code RUNNING} 행이 그대로
 * 남아 유령이 되고(screen/batch/schedule/requirements.md), 그것은 <i>비정상 종료의 증거</i> 라는 그 신호의
 *           값을 떨어뜨린다 — 정상 재기동마다 유령이 생기면 아무도 안 본다</td></tr>
 * </table>
 *
 * <p><b>기다리는 시간에 상한이 있다.</b> 무한이면 오래 걸리는 배치 하나가 배포를 막는다.
 * 상한을 넘겨 죽으면 그때는 <b>정말로</b> 유령이 남고, 그 행이 <i>재기동이 배치를
 * 끊었다</i> 를 말한다.
 */
@Configuration
public class BatchExecutorConfig {

    /** 주입 지점이 하나뿐이지만 이름을 둔다 — {@code Executor} 빈이 늘면 그때 갈린다. */
    public static final String EXECUTOR = "batchTaskExecutor";

    @Bean(name = EXECUTOR, destroyMethod = "shutdown")
    public Executor batchTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        // 로그에서 배치 스레드를 한눈에 가른다 — SQL 로그(backend/logging.md)가 이 이름을 함께 낸다.
        executor.setThreadNamePrefix("batch-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }
}
