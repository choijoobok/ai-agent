// @feat FEAT-510
package com.aiagent.system.api.searchcond.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 저장 조회조건 삭제 키다. */
public record SearchCondDeleteRequest(
        @NotBlank @Size(max = 30) String menuCd, @NotBlank @Size(max = 100) String condNm) {}
