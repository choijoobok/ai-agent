package com.aiagent.domain.menustat;

/**
 * 자주 쓰는 메뉴 한 줄 — 화면이 읽는 형태다.
 *
 * <p><b>이름이 없다.</b> 이름의 단일 원본은 {@code SYS_MESSAGE} 이고(43 §4.4) 화면은 이미
 * 메뉴 트리를 갖고 있다 — 여기서 함께 내면 같은 이름이 두 경로로 오고, 언어를 바꿨을 때
 * 한쪽만 따라온다.
 *
 * @param useCnt 창 안의 <b>합계</b>다. 이번 달만의 값이 아니다
 */
public record FrequentMenu(String menuCd, long useCnt) {}
