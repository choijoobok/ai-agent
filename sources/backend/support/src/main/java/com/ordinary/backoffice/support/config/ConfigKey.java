package com.ordinary.backoffice.support.config;

/**
 * 관리 화면의 <b>왼쪽 테이블 한 줄</b> — 63 §4.2.
 *
 * <p>넷 다 <b>코드에서 온다.</b> {@code SYS_CONFIG} 는 이 행에 값 하나를 덮을 수 있을
 * 뿐이며(아우터 조인의 오른쪽), 덮지 않은 키가 <b>정상</b>이다.
 *
 * @param key {@code CFG_KEY} — {@code @ConfigurationProperties.prefix} 에서 루트
 *     {@code sys-config.} 를 뺀 것 + 필드명(kebab-case). 중첩 객체는 마디가 는다
 * @param type 필드 타입에서 도출한 유형. 화면은 이것에 맞는 <b>형식</b>만 검사한다(63 §4.5)
 * @param description 필드 Javadoc — {@code META-INF/spring-configuration-metadata.json} 에서
 *     온다. {@code CFG_DESC} 가 아니다(63 §4.2). 프로세서가 빠지면 <b>여기만</b> 빈다
 * @param defaultValue {@code Environment} 유효값 — 프로필 {@code yml}·환경변수까지 포함한
 *     <i>배포가 정한 값</i>. {@code SYS_CONFIG} 가 프로퍼티 소스가 아니므로 <b>뺄 것이
 *     없다</b>(ADR-0026). <b>언제나 있다</b> — 없으면 기동이 이미 실패했다(43 §6.1)
 */
public record ConfigKey(String key, ConfigValueType type, String description, String defaultValue) {}
