package com.aiagent.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 시각의 단일 출처.
 *
 * <p><b>{@code Instant.now()} 를 코드에 흩지 않는다.</b> DB 함수({@code SYSDATE}·{@code NOW()})를
 * 금지한 것과 같은 이유다(backend/persistence.md) — 판정이 한 곳에 있어야 벤더·서버 시간대에 흔들리지
 * 않고, 테스트에서 시간을 고정할 수 있다.
 *
 * <p>저장은 UTC {@link java.time.Instant} 다. 업무 달력 날짜는 다른 것이며
 * {@code BusinessCalendar} 가 {@code app.business-timezone} 으로 판정한다(sys/INDEX.md).
 */
@Configuration
public class TimeConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
