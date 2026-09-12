// @feat FEAT-502
package com.aiagent.system.domain.role;

import com.aiagent.domain.authz.ActionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 저장이 받는 부여 하나 — screen/admin/system/role-auth/requirements.md.
 *
 * <p><b>{@code rowState} 가 없다.</b> 다른 화면의 일괄 저장은 행마다 C·U·D 를 싣지만
 * (frontend/grid.md) 여기 오는 것은 <b>켜진 스위치의 목록 전부</b>이고, 서버가 지금 상태와 비교해
 * 추가·삭제를 정한다.
 *
 * <p><b>그래야 하는 이유가 셋이다.</b>
 *
 * <table>
 *   <tr><td>수정이 없다</td><td>권한은 있거나 없거나 둘뿐이라 <b>켜면 추가, 끄면 삭제</b>다 —
 *       U 를 표현할 필드 자체가 없다(§4 주석 1)</td></tr>
 *   <tr><td>{@code READ} 불변식</td><td>검증이 <b>메뉴 하나의 액션 넷을 함께</b> 봐야 성립한다.
 *       변경분만 오면 <i>이미 있던 READ</i> 를 다시 조회해 합쳐야 하고, 그 합침이 두 곳
 *       (화면·서버)에 생긴다</td></tr>
 * <tr><td>트리가 전건이다</td><td>페이징도 필터도 없으므로(screen/admin/system/user/requirements.md) 화면이 든 집합이
 *       <b>완전하다</b> — 부분만 보고 전체를 보냈다고 착각할 자리가 없다</td></tr>
 * </table>
 *
 * <p><b>대신 잃는 것을 적어 둔다</b> — 두 관리자가 같은 역할을 동시에 고치면 <b>나중에 저장한
 * 쪽이 이긴다</b>. sys/menu.md 의 트리 저장처럼 <i>보던 것과 지금이 같은가</i> 를 검사하지 않는데,
 * 여기서는 그 검사가 <b>다른 사람이 다른 메뉴 한 칸을 켠 것</b>까지 실패로 만든다 — 트리
 * 전체가 한 요청이라 충돌 단위가 화면 전체가 되기 때문이다. 역할 권한은 <b>여러 명이 동시에
 * 고치는 데이터가 아니므로</b> 그 마찰을 물리지 않는다.
 */
public record RoleAuthGrant(
        @NotBlank @Size(max = 30) String menuCd, @NotNull ActionType actionCd) {}
