package com.ordinary.backoffice.api.trace;

import org.slf4j.MDC;

/**
 * 요청 하나를 특정하는 값. <b>{@code X-Request-Id} 와 같은 값이다</b>(00 §3-13).
 *
 * <p>응답 봉투의 {@code traceId}(api-conventions.md §2.3) · 사용 이력 · 에러 로그가 전부 이 값을 쓴다.
 * 그래서 사용자가 화면에서 본 문자열 하나로 그 요청을 찾을 수 있다.
 */
public final class TraceId {

    public static final String MDC_KEY = "traceId";
    public static final String HEADER = "X-Request-Id";

    private TraceId() {}

    /** MDC 에 없으면 {@code null} — 필터 밖(스케줄러·부팅)에서 부르는 경우다. */
    public static String current() {
        return MDC.get(MDC_KEY);
    }
}
