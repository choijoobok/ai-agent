package com.aiagent.domain.config;

import java.time.Clock;
import java.time.temporal.TemporalAccessor;
import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * 감사 컬럼 자동 채움 — {@code BaseAuditEntity} 참조.
 *
 * <p>"누가"({@code AuditorAware})는 인증 주체를 아는 api 모듈이 제공하고, 여기서는 타입으로
 * 찾아 쓴다. 그 빈이 없는 슬라이스 테스트에서는 감사자만 비고 나머지는 동작한다.
 *
 * <p>"언제"는 주입된 {@link Clock} 이다 — 기본 제공자({@code CurrentDateTimeProvider})를
 * 그대로 두면 시각의 출처가 하나 더 생기고 <b>테스트에서 시간을 고정할 수 없다</b>.
 */
@Configuration
@EnableJpaAuditing(dateTimeProviderRef = "auditDateTimeProvider")
public class JpaAuditingConfig {

    @Bean
    DateTimeProvider auditDateTimeProvider(Clock clock) {
        return () -> Optional.of((TemporalAccessor) clock.instant());
    }
}
