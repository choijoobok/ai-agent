package com.aiagent.core.search;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 조건 하나 — backend/api.md.
 *
 * <p>{@code field} 는 <b>논리 이름</b>이다. 컬럼명도 별칭도 아니며 컬럼과 1:1 일 의무가 없다 —
 * 파생 조건(backend/api.md)이 그 자유를 쓴다. 판정은 화이트리스트가 이 이름으로 한다(backend/api.md).
 *
 * <p>{@code value} 가 {@code Object} 인 것은 연산자가 형태를 정하기 때문이다 — {@code in} 이면
 * 배열, {@code between} 이면 2원소 배열, {@code isNull} 이면 없다. 자료형으로 좁히려면
 * 연산자마다 레코드를 따로 두어야 하고, 그러면 와이어가 열둘로 갈린다.
 */
public record Condition(@NotBlank String field, @NotNull Op op, Object value) {}
