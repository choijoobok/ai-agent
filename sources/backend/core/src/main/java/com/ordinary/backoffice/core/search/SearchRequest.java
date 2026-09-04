package com.ordinary.backoffice.core.search;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * 동적형 조회의 봉투 — api-conventions.md §3.1. <b>프로젝트에 하나다.</b>
 *
 * <p>넷이며 <b>앞의 셋이 공통</b>이다. {@code params} 만 화면마다 다르고 없는 화면이
 * 대부분이다 — 그 화면은 {@code SearchRequest<Void>} 를 받는다(34 §4.1).
 *
 * <p><b>컨트롤러는 이것만 받고 화이트리스트를 모른다.</b> 그것은 전송의 일이 아니라
 * 애그리거트의 일이다(34 §4.1).
 *
 * @param params 화면 전용 레코드 — api-conventions.md §3.1.1. <b>열린 맵이 아니다.</b> 서비스가 이름으로
 *     직접 읽으므로 화이트리스트도 인젝션 표면도 없다
 */
public record SearchRequest<P>(
        @Valid @NotNull List<Condition> conditions,
        @Valid List<SortSpec> sorts,
        @Valid @NotNull PageSpec page,
        @Valid P params) {

    public List<Condition> conditionsOrEmpty() {
        return conditions == null ? List.of() : conditions;
    }

    public List<SortSpec> sortsOrEmpty() {
        return sorts == null ? List.of() : sorts;
    }
}
