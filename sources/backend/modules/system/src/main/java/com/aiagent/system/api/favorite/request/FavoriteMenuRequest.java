// @feat FEAT-510
package com.aiagent.system.api.favorite.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 즐겨찾기 등록·제거 대상이며 사용자 ID는 세션에서만 얻는다. */
public record FavoriteMenuRequest(@NotBlank @Size(max = 30) String menuCd) {}
