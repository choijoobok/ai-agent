package com.ordinary.backoffice.api.favorite.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 즐겨찾기 등록·제거 — 대상은 메뉴 하나다(42 §7). */
public record FavoriteMenuRequest(@NotBlank @Size(max = 30) String menuCd) {}
