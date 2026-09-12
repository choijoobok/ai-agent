// @feat FEAT-503
package com.aiagent.system.domain.apicatalog;

/**
 * 하단 pane 의 한 행 — <b>이 API 를 쓰는 메뉴</b>(screen/menu/requirements.md).
 *
 * <p>탭이 아니라 pane 하나다 — 탭 하나짜리 탭바는 누를 곳이 없는 크롬이다(screen/menu/requirements.md).
 *
 * @param menuPath {@code 시스템 › 이력 · 로그 › 에러 로그} — <b>전체 경로</b>다. 메뉴명만으로는
 * 어느 것인지 모른다. 이름의 원본은 {@code SYS_MESSAGE}({@code menu.{MENU_CD}} — sys/code.md)라
 *     조인이 아니라 메시지 캐시에서 온다
 * @param useYn 메뉴가 꺼져 있으면 이 매핑은 <b>살아 있어도 소용없다</b>(backend/security.md 게이트 ④)
 * @param accessibleUserCount AUTHZ-13 — screen/menu/requirements.md 탭 2 와 같은 계산이다.
 *     <p><b>게이트 ④를 적용하지 않는다.</b> {@code EffectiveAuthorityService} 가 ②(출처 자격)와
 *     ④(대상 생존)를 한 쿼리로 합치지 않은 것과 같은 이유다 — 합치면 <i>사용 여부</i> 가 꺼진
 *     메뉴의 인원이 전부 {@code 0} 이 되어 <b>"역할을 켜면 되는 문제" 와 "메뉴를 켜야 하는
 *     문제" 가 구분되지 않는다</b>. 여기서는 두 컬럼이 나란히 서서 각자 다른 말을 한다:
 *     인원이 <i>줄 사람이 있나</i>, 사용 여부가 <i>대상이 살아 있나</i>
 */
public record ApiMenuRow(String menuCd, String menuPath, Boolean useYn, long accessibleUserCount) {}
