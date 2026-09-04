package com.ordinary.backoffice.core.error;

/**
 * 실패 응답의 {@code code} — 문자열 상수이며 {@code SYS_LO_EXCEPTION.ERR_CD} 에 그대로 남는다
 * (api-conventions.md §2.3 · 45 §4.2).
 *
 * <p><b>enum 이 아니라 인터페이스인 이유</b>는 코드가 모듈마다 늘어나기 때문이다. 하나의
 * enum 에 모으면 도메인이 늘 때마다 core 를 고쳐야 하고, 그것은 core 가 도메인 비종속이라는
 * 규칙(architecture.md §1)을 정면으로 어긴다.
 *
 * <p>{@link #defaultMessage()} 는 <b>폴백</b>이다. 문구의 단일 원본은 {@code SYS_MESSAGE} 이며
 * 서버가 번역을 완성해 담는다(architecture.md §6-1.2) — 메시지 슬라이스가 붙기 전까지 이 값이 나간다.
 */
public interface ErrorCode {

    /** 점 표기 문자열 상수. 예: {@code err.login.failed} */
    String code();

    ErrorType type();

    /** {@code SYS_MESSAGE} 조회 실패 시의 폴백 문구. 최종 문구가 아니다. */
    String defaultMessage();
}
