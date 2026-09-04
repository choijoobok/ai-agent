package com.aiagent.domain.config;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * QueryDSL 조립기 — backend/packages.md 이 동적 조건 목록 조회의 표준으로 정한 것.
 *
 * <p><b>{@link EntityManager} 를 그대로 주입해도 된다.</b> Spring 이 주는 것은 프록시이며
 * 요청마다 트랜잭션에 묶인 실제 {@code EntityManager} 로 위임한다 — 팩토리를 싱글턴으로
 * 두어도 스레드마다 다른 영속성 컨텍스트를 본다.
 */
@Configuration
public class QueryDslConfig {

    @Bean
    public JPAQueryFactory jpaQueryFactory(EntityManager entityManager) {
        return new JPAQueryFactory(entityManager);
    }
}
