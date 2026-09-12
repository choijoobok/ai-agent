// @feat FEAT-503
package com.aiagent.system.domain.menu;

import com.aiagent.domain.authz.ActionType;
import java.util.List;

/**
 * 탭 3 — 이 메뉴에 권한을 준 역할(screen/menu/requirements.md). <b>조회 전용이다.</b>
 *
 * <p>편집은 {@code ROLE_AUTH_MGMT}(screen/menu/requirements.md)이며, 행을 더블 클릭하면 그 화면을 그 역할로
 * 연다(UX-02 멀티탭).
 *
 * @param useYn <b>{@code 'N'} 인 역할도 나온다.</b> 권한 행은 살아 있고(backend/security.md 의 입력 필터는
 *     판정에서 거를 뿐이다) FK 도 살아 있다 — 삭제 게이트가 막는 것은 <b>행의 존재</b>이지
 * 역할의 상태가 아니다(screen/menu/requirements.md)
 * @param actions 이 역할이 이 메뉴에 가진 액션들. <b>{@link ActionType} 의 선언 순서</b>로
 *     정렬한다 — DB 가 내는 순서에 기대면 벤더마다 열이 흔들린다
 */
public record MenuRoleRow(String roleId, String roleNm, Boolean useYn, List<ActionType> actions) {}
