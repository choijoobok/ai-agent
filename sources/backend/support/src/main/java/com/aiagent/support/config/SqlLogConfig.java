package com.aiagent.support.config;

import com.aiagent.support.config.props.SqlLogProps;
import com.aiagent.support.logging.SqlLogSettings;
import com.p6spy.engine.spy.P6DataSource;
import javax.sql.DataSource;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/**
 * 파라미터가 바인딩된 SQL 로그 — system-logging.md §2 · ADR-0011.
 *
 * <p><b>{@code DataSource} 를 감싸는 것이 전부다.</b> JPA · QueryDSL · MyBatis 가 반드시
 * 지나는 유일한 지점이 JDBC 이고, 거기서 가로채야 <b>세 경로가 한 벌로</b> 해결된다.
 * Hibernate 의 {@code show-sql} 은 JPA 만 잡고 파라미터가 물음표로 남는다.
 *
 * <p><b>스타터를 쓰지 않는다</b>(system-logging.md §2.0). 스타터가 해 주는 일은 자동 래핑과 yml
 * 바인딩뿐이고, 그 둘이 이 파일 하나다 — 대신 판(Spring Boot)의 버전에 매이지 않는다.
 *
 * <p><b>{@link Binder} 로 직접 읽는다.</b> {@link ConfigLookup} 을 쓰지 않는 이유는
 * 시점이다 — {@code BeanPostProcessor} 는 <b>거의 모든 빈보다 먼저</b> 만들어져야 하고,
 * 거기에 다른 빈을 물리면 그 빈과 그것이 끌고 오는 것들이 <b>후처리 대상에서 빠진다</b>
 * (스프링이 경고를 찍는 바로 그 상황이다).
 */
@Configuration(proxyBeanMethods = false)
public class SqlLogConfig {

    /** 켜지 않으면 아무것도 감싸지 않는다 — 운영 기본이 꺼짐이다(system-logging.md §8). */
    private static final SqlLogProps OFF = new SqlLogProps(false, false, java.util.List.of());

    /**
     * {@code DataSource} 를 P6Spy 로 감싼다.
     *
     * <p><b>{@code static} 이다.</b> {@code BeanPostProcessor} 를 내는 메서드가 인스턴스
     * 메서드면 <b>설정 클래스 자신이 너무 일찍</b> 만들어진다.
     *
     * <p><b>이미 감싼 것은 다시 감싸지 않는다.</b> 커넥션 하나가 두 겹으로 기록되면 같은
     * SQL 이 두 줄로 나오고, 시간도 바깥 겹이 안쪽을 포함해 <b>두 번 센다</b>.
     */
    @Bean
    static BeanPostProcessor sqlLogDataSourceDecorator(Environment environment) {
        SqlLogProps props = read(environment);
        // 언박싱하지 않는다 — 프로파일이 enabled 만 적어 두면 나머지가 null 이고,
        // 그 NPE 는 <b>기동 실패</b>로 나타난다. 안 적은 것은 끈 것이다.
        boolean enabled = Boolean.TRUE.equals(props.enabled());
        SqlLogSettings.apply(Boolean.TRUE.equals(props.traceCaller()), props.excludePatterns());

        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) {
                if (!enabled || !(bean instanceof DataSource) || bean instanceof P6DataSource) {
                    return bean;
                }
                return new P6DataSource((DataSource) bean);
            }
        };
    }

    /** 값이 하나도 없으면 꺼진 것이다 — 설정을 안 적었다고 기동이 실패할 이유가 없다. */
    private static SqlLogProps read(Environment environment) {
        return Binder.get(environment)
                .bind("app.logging.sql", Bindable.of(SqlLogProps.class))
                .orElse(OFF);
    }
}
