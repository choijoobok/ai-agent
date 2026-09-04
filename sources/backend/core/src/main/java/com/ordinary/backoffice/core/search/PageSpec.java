package com.ordinary.backoffice.core.search;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 요청의 페이징 — api-conventions.md §3.8. <b>모드가 없다.</b>
 *
 * <pre>
 * { "page": 0, "size": 20 }              // 첫 장 — 언제나 이 모양
 * { "size": 100, "cursor": "eyJ…" }      // 다음 장 — 커서는 앞 응답이 준 것
 * </pre>
 *
 * <p><b>모드는 엔드포인트가 정하고 응답이 나른다.</b> 요청에도 화면 선언에도 두지 않는다 —
 * 페이징 여부는 이미 서버 소스가 정하므로 한 번 더 적으면 미러링이다.
 *
 * <p><b>{@link #MAX_SIZE} 는 상수다.</b> grid-standard.md §9 가 <i>"상한을 {@code SYS_CONFIG} 로 뺄지"</i> 를
 * 미결로 남겼고 {@code SYS_CONFIG} 가 아직 없다. 상한 자체를 미루지는 않는다 — 없으면
 * {@code size} 하나로 전량을 끌어갈 수 있다.
 */
public record PageSpec(
        @Min(0) Integer page,
        @Min(1) @Max(PageSpec.MAX_SIZE) Integer size,
        String cursor) {

    public static final int MAX_SIZE = 1000;
    public static final int DEFAULT_SIZE = 20;

    /** 전량 조회({@code mode: 'all'})의 상한 — 넘으면 조용히 자르지 않고 에러다(api-conventions.md §3.8). */
    public static final int ALL_LIMIT = 5000;

    public int pageOrFirst() {
        return page == null ? 0 : page;
    }

    public int sizeOrDefault() {
        return size == null ? DEFAULT_SIZE : size;
    }
}
