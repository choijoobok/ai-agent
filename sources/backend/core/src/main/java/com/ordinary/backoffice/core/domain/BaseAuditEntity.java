package com.ordinary.backoffice.core.domain;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import lombok.Getter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;

/**
 * 감사 컬럼 네 개를 얹는 매핑 상위 클래스.
 *
 * <p><b>전 테이블이 상속하는 것이 아니다.</b> 사람이 바꾸는 마스터·설정·업무 테이블만
 * 상속한다. 이력 테이블은 {@code USER_ID + CRE_DTM} 이 곧 "누가 언제" 이고, 인프라
 * 테이블은 애플리케이션이 기계적으로 쓰므로 "누가" 가 존재하지 않는다.
 * 무조건 네 컬럼을 박으면 항상 NULL 인 컬럼이 절반의 테이블에 생기고, 그러면 이
 * 컬럼 자체를 신뢰할 수 없게 된다 — llm-guide/09-knowledge/sys/INDEX.md
 *
 * <p><b>식별자는 여기 없다.</b> {@code @TableGenerator} 의 {@code pkColumnValue} 가
 * 엔티티마다 다르므로(논리 시퀀스명 = 테이블명) 상위 클래스로 올릴 수 없다.
 * 선언 형태는 llm-guide/10-records/adr/0015-table-based-id-generation.md 가 고정한다.
 *
 * <p>시점은 UTC {@link Instant} 다. 업무 달력 날짜({@code _DT})는 시간대가 없는 다른
 * 것이며 이 클래스의 대상이 아니다 — 40 §4.3
 *
 * <p><b>값은 자동으로 채워진다</b> — 누가는 {@code SecurityContext}, 언제는 주입된
 * {@code Clock} 이다. 시각을 SQL 로 구하지 않는 것이 규약이므로({@code SYSDATE} 금지 —
 * db-portability.md §4.5) 두 출처 모두 애플리케이션 안에 있다. 설정은
 * {@code com.ordinary.backoffice.domain.config.JpaAuditingConfig}.
 *
 * <p><b>{@code @EntityListeners} 가 여기 없는 것이 의도다.</b> {@code AuditingEntityListener}
 * 는 {@code spring-data-jpa} 의 클래스이고, 그것을 여기 걸면 core 가 Hibernate 까지 끌고
 * 온다 — core 는 프레임워크 의존을 최소로 두는 커널이다(architecture.md §1). 대신 bootstrap 의
 * {@code META-INF/orm.xml} 이 <b>전 엔티티에</b> 리스너를 건다. 엔티티마다 애너테이션을
 * 붙이는 방식은 <b>빠뜨려도 조용하다</b> — 감사 컬럼이 그냥 NULL 로 남는다.
 */
@Getter
@MappedSuperclass
public abstract class BaseAuditEntity {

    @CreatedBy
    @Column(name = "REG_ID", length = 50, updatable = false)
    private String regId;

    @CreatedDate
    @Column(name = "REG_DTM", updatable = false)
    private Instant regDtm;

    @LastModifiedBy
    @Column(name = "MOD_ID", length = 50)
    private String modId;

    @LastModifiedDate
    @Column(name = "MOD_DTM")
    private Instant modDtm;
}
