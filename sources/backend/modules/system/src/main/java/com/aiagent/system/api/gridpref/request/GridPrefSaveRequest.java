// @feat FEAT-510
package com.aiagent.system.api.gridpref.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 사용자별 그리드 설정 저장 입력이다. */
public record GridPrefSaveRequest(
        @NotBlank @Size(max = 30) String menuCd,
        @NotBlank @Size(max = 30) String gridId,
        @NotBlank String prefJson,
        @NotBlank @Size(max = 64) String signature) {}
