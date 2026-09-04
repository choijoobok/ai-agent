package com.ordinary.backoffice.domain.authz.menu;

import com.ordinary.backoffice.domain.authz.ActionType;

/**
 * 탭 1 — 이 메뉴가 쓰는 API(62 §4.11). <b>조회 전용이다.</b>
 *
 * <p>행 추가도 삭제도 없다 — 매핑 행 추가가 곧 접근 범위 확장이라 <b>시드로만</b> 바뀐다
 * (security-design.md §4 · ADR-0020). {@code API_CATALOG} 가 조회 전용인 것과 같은 이유이며, 이 탭은 그
 * 화면의 하단 pane 을 <b>반대 축에서</b> 본 것이다 — 저기는 <i>이 API 를 어느 화면이 쓰나</i>,
 * 여기는 <i>이 화면이 어느 API 를 쓰나</i>.
 *
 * @param actionCd <b>API 의 속성이지 이 매핑의 속성이 아니다</b>(42 §5) — 같은 API 가 메뉴
 *     A 에서는 {@code READ}, 메뉴 B 에서는 {@code SAVE} 라는 모순이 구조적으로 저장될 수 없다
 */
public record MenuApiRow(String apiUrl, String apiNm, String apiDesc, ActionType actionCd) {}
