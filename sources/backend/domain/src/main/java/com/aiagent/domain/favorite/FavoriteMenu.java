package com.aiagent.domain.favorite;

import java.time.Instant;

/**
 * 즐겨찾기 한 줄 — 화면이 읽는 형태다.
 *
 * <p><b>메뉴 이름이 없다.</b> 이름의 단일 원본은 {@code SYS_MESSAGE} 이고(43 §4.4) 화면은
 * 이미 메뉴 트리를 갖고 있다 — 여기서 이름을 함께 내면 <b>같은 이름이 두 경로로</b> 오고,
 * 언어를 바꿨을 때 한쪽만 따라온다.
 */
public record FavoriteMenu(String menuCd, int sortNo, Instant creDtm) {}
