package com.aiagent.core.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * {@code Boolean} ↔ {@code CHAR(1)} {@code 'Y'}/{@code 'N'} — backend/persistence.md.
 *
 * <p>공통 테이블의 불리언 성격 컬럼에 {@code BOOLEAN} 을 쓰지 않는 이유는 Oracle 에
 * boolean 컬럼이 없어 {@code NUMBER(1)} 로 매핑되고, 그러면 MyBatis 쿼리의
 * {@code WHERE USE_YN = true} 가 벤더마다 깨지기 때문이다.
 *
 * <p><b>DB 쪽 타입이 {@code String} 이 아니라 {@code Character} 인 것이 핵심이다.</b>
 * {@code String} 이면 Hibernate 가 {@code VARCHAR(1)} 로 잡고, changelog 의 {@code CHAR(1)} 과
 * 어긋나 {@code ddl-auto=validate} 가 기동을 막는다 — PostgreSQL 이 돌려주는 이름은
 * {@code bpchar} 다. {@code Character} 면 {@code CHAR} 로 잡혀 컬럼마다
 * {@code @JdbcTypeCode(CHAR)} 를 붙일 일이 없다. <b>빠뜨릴 수 있는 자리를 없앤다.</b>
 *
 * <p><b>{@code autoApply} 를 쓰지 않는다.</b> 켜면 이 모듈이 만들 모든 엔티티의 모든
 * {@code Boolean} 필드가 조용히 {@code CHAR(1)} 이 된다 — 업무 테이블이 진짜
 * {@code BOOLEAN} 을 쓰고 싶을 때 그것을 끄는 방법이 애매해진다. 컬럼마다 명시한다.
 */
@Converter
public class YnConverter implements AttributeConverter<Boolean, Character> {

    private static final char YES = 'Y';
    private static final char NO = 'N';

    @Override
    public Character convertToDatabaseColumn(Boolean attribute) {
        return Boolean.TRUE.equals(attribute) ? YES : NO;
    }

    @Override
    public Boolean convertToEntityAttribute(Character dbData) {
        return dbData != null && Character.toUpperCase(dbData) == YES;
    }
}
