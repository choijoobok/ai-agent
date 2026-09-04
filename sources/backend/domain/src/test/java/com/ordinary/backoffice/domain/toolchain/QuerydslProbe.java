package com.ordinary.backoffice.domain.toolchain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import com.ordinary.backoffice.core.domain.BaseAuditEntity;

/**
 * 툴체인 확인용 엔티티. <b>도메인이 아니다 — 실엔티티가 들어오면 지운다.</b>
 *
 * <p>aidd-guide/standard/stack.md 이 "QueryDSL 7.6 + Spring Boot 4.1 조합 미검증"
 * 을 Phase 7 walking skeleton 의 최우선 리스크로 적었다. 확인해야 할 것은 애너테이션
 * 프로세서가 Q 클래스를 만들어 내는가이고, 그것은 DB 없이 컴파일만으로 갈린다.
 */
@Entity
@Table(name = "TOOLCHAIN_PROBE")
public class QuerydslProbe extends BaseAuditEntity {

    @Id
    private Long id;

    private String name;

    private Instant occurredDtm;
}
