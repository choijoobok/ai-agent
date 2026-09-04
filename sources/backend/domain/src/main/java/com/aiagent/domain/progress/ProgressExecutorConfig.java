package com.aiagent.domain.progress;

import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 오래 걸리는 작업이 도는 스레드 — 68 §9.1 의 <i>{@code progressExecutor} 분리</i>.
 *
 * <p><b>일반 {@code @Async} 와 섞지 않는다.</b> 여기 도는 것은 <i>10만 건 재계산</i> 같은
 * 것이라 <b>분 단위</b>로 스레드를 붙잡는데, 같은 풀을 알림 발송·로그 적재가 쓰면 그
 * 짧은 일들이 뒤에 줄을 선다 — 그 순간 사용자가 겪는 것은 <i>알림이 안 온다</i> 이고,
 * 원인은 전혀 다른 화면의 배치다.
 *
 * <p>{@code BatchExecutorConfig} 와도 <b>다른 풀</b>이다. 저쪽은 <i>스케줄러가 깨우는
 * 배치</i> 이고 여기는 <b>사람이 버튼을 눌러 시작한 것</b>이라, 하나를 나눠 쓰면 야간
 * 배치가 큐를 채운 시간에 누른 버튼이 <b>아무 반응 없이</b> 기다린다.
 *
 * <h2>풀이 작다 — 배치와 같은 이유다</h2>
 *
 * <p>여기 도는 작업은 전부 DB 를 쓰므로 <b>커넥션 풀이 진짜 상한</b>이다. 키우면 사용자
 * 요청이 커넥션을 못 잡는다.
 *
 * <p><b>큐가 짧다.</b> 사람이 누른 버튼이므로 <i>언젠가 시작된다</i> 는 답이 되지 않는다 —
 * 넘치면 그 자리에서 거절되어 <b>지금 붐빈다</b> 를 말하는 편이, 눌러 놓고 진행률 창이
 * 0% 에서 멈춘 것을 보는 것보다 낫다.
 *
 * <p><b>종료 때 기다린다.</b> 안 기다리면 {@code RUNNING} 행이 그대로 남고, 사용자에게는
 * <b>영영 도는 작업</b>으로 보인다 — 만료 청소가 지울 때까지 그렇다(32 §5).
 */
@Configuration
public class ProgressExecutorConfig {

    public static final String EXECUTOR = "progressTaskExecutor";

    @Bean(name = EXECUTOR, destroyMethod = "shutdown")
    public Executor progressTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(20);
        // 로그에서 한눈에 가른다 — SQL 로그(system-logging.md §2)가 이 이름을 함께 낸다.
        executor.setThreadNamePrefix("progress-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }
}
