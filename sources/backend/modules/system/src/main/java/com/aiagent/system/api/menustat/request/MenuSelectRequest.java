// @feat FEAT-510
package com.aiagent.system.api.menustat.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** system 공개 계약의 메뉴 선택 기록 요청이다. */
public record MenuSelectRequest(@NotBlank @Size(max = 30) String menuCd) {}
