// @feat FEAT-510
package com.aiagent.system.api.searchcond.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 저장 조회조건 입력이며 소유자 ID는 세션에서만 얻는다. */
public record SearchCondSaveRequest(
        @NotBlank @Size(max = 30) String menuCd,
        @NotBlank @Size(max = 100) String condNm,
        @NotBlank String condJson,
        boolean dflt) {}
