// @feat FEAT-510
package com.aiagent.system.api.gridpref.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 기본 화면 선언으로 돌아가도록 저장 행만 제거한다. */
public record GridPrefResetRequest(
        @NotBlank @Size(max = 30) String menuCd, @NotBlank @Size(max = 30) String gridId) {}
