package com.ordinary.backoffice.core.search;

import com.querydsl.core.types.EntityPath;
import com.querydsl.core.types.Predicate;

/**
 * 조인 하나 — 34 §4.4. <b>스펙이 갖는다.</b>
 *
 * <p>서비스에 {@code .from()}·{@code .leftJoin()} 을 두면 스펙과 어긋날 수 있고 아무도 안 본다.
 * 조인이 빠진 채 그 별칭의 컬럼을 열어 두면 <b>묵시적 크로스 조인</b>이 되어 결과가 조용히
 * 틀린다 — 한 곳에 있으면 어긋날 수가 없다.
 */
public record JoinSpec(EntityPath<?> target, Predicate on, boolean left) {}
