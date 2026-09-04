package com.aiagent.api.favorite.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 즐겨찾기 등록·제거 — 대상은 메뉴 하나다(sys/menu.md). */
public record FavoriteMenuRequest(@NotBlank @Size(max = 30) String menuCd) {}
