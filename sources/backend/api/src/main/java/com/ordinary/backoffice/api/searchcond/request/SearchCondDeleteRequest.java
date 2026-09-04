package com.ordinary.backoffice.api.searchcond.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 조회조건 삭제 — 이름이 곧 자리다(search-form-contract.md §5.4). */
public record SearchCondDeleteRequest(
        @NotBlank @Size(max = 30) String menuCd, @NotBlank @Size(max = 100) String condNm) {}
