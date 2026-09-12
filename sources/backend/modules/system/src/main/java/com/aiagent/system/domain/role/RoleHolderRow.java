// @feat FEAT-502
package com.aiagent.system.domain.role;

import com.aiagent.domain.authz.menu.MenuUserRow;
import java.time.LocalDate;

/**
 * 하단 pane 의 한 행 — <b>두 화면이 같은 그리드다</b>(screen/menu/requirements.md).
 *
 * <p>{@code ROLE_MGMT} 에서는 <i>보유 사용자</i>, {@code ROLE_AUTH_MGMT} 에서는 <i>영향 인원</i>
 * 이라 부르지만 <b>제목만 다르고 질문은 하나</b>다 — <i>"이 역할을 가진 사람이 누구인가"</i>.
 * 그래서 API 도 하나다(screen/admin/system/role/requirements.md — {@code role/getUserList} 를 따로 두면 같은 질문에 답이 둘이
 * 된다).
 *
 * <p><b>읽기 전용이며 저장 대상이 아니다.</b> 부여를 고치는 곳은 {@code USER_MGMT} 의 보유
 * 역할 탭이다(screen/admin/system/user/requirements.md 탭 1).
 *
 * <p><b>screen/admin/system/role/requirements.md 의 {@link MenuUserRow} 와 다른 것</b>이 여기서 갈린다. 저것은 <i>"이 메뉴에
 * 닿는 사람"</i> 이라 <b>경유가 여럿</b>이고 액션 열이 붙는다. 여기는 <i>"이 역할을 가진
 * 사람"</i> 이라 경유가 <b>이 역할 하나</b>이고, 대신 <b>공집합 판정의 입력</b> 둘이 붙는다.
 *
 * @param accountUsable 계정이 <b>관리자가 정한 뜻으로</b> 살아 있는가({@code USE_YN} 과 계정
 * 유효기간). 잠금·휴면은 보지 않는다 — sys/user-role.md 가 넷을 <b>축이 다르다</b> 고 갈랐고 뒤의
 *     둘은 스스로 풀린다
 * @param grantState 예정 · 유효 · 만료 — sys/menu.md 의 기간에서 <b>파생</b>한다. 컬럼으로 두면
 *     배치가 갱신해야 하고 그 배치가 실패한 동안 화면과 판정이 갈린다
 * @param hasPersonalGrant <b>공집합 판정의 입력 ①</b> — screen/admin/system/role/requirements.md 의 <i>개인 예외 보유</i> 열이다.
 * 유효 권한은 합집합이므로(backend/security.md) 개인 예외가 있는 사람은 이 역할을 잃어도 공집합이
 *     되지 않는다. <b>지금 유효한</b> 예외이고 <b>살아 있는 리프</b> 위의 것만 센다 —
 *     만료된 예외나 꺼진 메뉴의 예외는 유효 권한에 들어가지 않아 판정의 입력이 아니다
 * @param hasOtherRole <b>공집합 판정의 입력 ②</b> — screen/admin/system/role/requirements.md 의 확인 문구가 <i>"다른 역할 없음 ·
 * 개인 예외 없음"</i> 두 사유를 나란히 내므로 입력도 둘이다. screen/admin/system/role/requirements.md 의 컬럼 표에는
 *     <i>개인 예외 보유</i> 만 적혀 있지만, <b>같은 자리에서 같은 일을 하는 값을 하나만
 *     보여줄 근거가 없다</b> — 그래서 함께 낸다(2026-08-30)
 */
public record RoleHolderRow(
        String userId,
        String userNm,
        boolean accountUsable,
        MenuUserRow.GrantState grantState,
        LocalDate validFromDt,
        LocalDate validToDt,
        boolean hasPersonalGrant,
        boolean hasOtherRole) {}
