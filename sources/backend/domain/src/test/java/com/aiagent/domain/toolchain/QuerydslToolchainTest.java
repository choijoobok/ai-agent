package com.aiagent.domain.toolchain;

import static org.assertj.core.api.Assertions.assertThat;

import com.querydsl.core.types.dsl.BooleanExpression;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** QueryDSL 7.6(OpenFeign 포크) × Spring Boot 4.1 — 20 §4.3 최우선 리스크. */
class QuerydslToolchainTest {

    @Test
    @DisplayName("애너테이션 프로세서가 Q 클래스를 생성하고 경로가 컬럼으로 잡힌다")
    void generatesQueryTypes() {
        QQuerydslProbe probe = QQuerydslProbe.querydslProbe;

        assertThat(probe.id).isNotNull();
        assertThat(probe.name).isNotNull();
        assertThat(probe.occurredDtm).isNotNull();
    }

    @Test
    @DisplayName("상위 매핑 클래스의 감사 컬럼도 경로로 나온다")
    void inheritsMappedSuperclassPaths() {
        QQuerydslProbe probe = QQuerydslProbe.querydslProbe;

        assertThat(probe.regId).isNotNull();
        assertThat(probe.modDtm).isNotNull();
    }

    @Test
    @DisplayName("술어를 조립할 수 있다 — 동적 조건 조회의 전제")
    void buildsPredicates() {
        QQuerydslProbe probe = QQuerydslProbe.querydslProbe;

        BooleanExpression predicate = probe.name.eq("x").and(probe.regId.isNotNull());

        assertThat(predicate.toString()).contains("querydslProbe.name = x");
    }
}
