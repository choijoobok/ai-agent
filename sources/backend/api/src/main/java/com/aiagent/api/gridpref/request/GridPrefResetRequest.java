package com.aiagent.api.gridpref.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 그리드 설정 초기화 — 행을 지운다(grid-standard.md §5). */
public record GridPrefResetRequest(
        @NotBlank @Size(max = 30) String menuCd, @NotBlank @Size(max = 30) String gridId) {}
