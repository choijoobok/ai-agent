package com.aiagent.core.search;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 정렬 하나 — api-conventions.md §3.7.
 *
 * <p><b>tie-breaker 는 여기 없다.</b> 클라이언트가 보내지 않으며 서버가 {@code ORDER BY
 * {요청}, {PK}} 로 언제나 붙인다 — 화면에 맡기면 빠뜨린 곳에서만 페이징이 흔들리고 그
 * 증상이 <i>"2페이지에 1페이지 행이 또 있다"</i> 라 원인을 짐작하기 어렵다.
 */
public record SortSpec(@NotBlank String field, @NotNull SortDir dir) {}
