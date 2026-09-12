package com.aiagent.domain.authz.userauth;

import com.aiagent.domain.authz.ActionType;
import java.util.List;
import java.util.Map;

/**
 * 권한 트리의 한 행 — <b>screen/admin/system/user-auth/requirements.md 가 정의를 갖는 그것</b>이다.
 *
 * <p>{@code RoleAuthTreeRow}(screen/menu/requirements.md)가 <i>덜어 낸</i> 쪽이고 여기가 <b>원본</b>이다 —
 * <i>"먼저 쓰는 문서가 정의하고 뒤가 참조한다"</i> 는 screen/admin/system/user-auth/requirements.md 의 말이 타입에서도 그대로다.
 * 셀 상태가 <b>넷에서 일곱으로</b> 는다.
 *
 * <table>
 *   <tr><td>부여 없음</td><td>꺼짐 — {@link #grants} 에 그 액션이 없다</td></tr>
 *   <tr><td>개인 예외 · 유효</td><td><b>켜짐</b></td></tr>
 *   <tr><td>개인 예외 · 예정</td><td>꺼짐 + <b>예정 배지</b> — 행은 이미 있다</td></tr>
 *   <tr><td>개인 예외 · 만료</td><td>꺼짐 + <b>만료 배지</b> — 〃</td></tr>
 *   <tr><td>역할 경유 보유</td><td><b>역할명 배지</b> — {@link #viaRoles}. 배경을 칠하지 않는다</td></tr>
 *   <tr><td>액션 미정의</td><td>{@code —} — {@link #definedActions} 밖이다</td></tr>
 *   <tr><td>구조 노드</td><td>스위치 없음 + 파생 3-state — {@code menuUrl == null}</td></tr>
 * </table>
 *
 * <h2>{@link #viaRoles} 가 이 화면에만 있다</h2>
 *
 * <p>역할 화면에서는 <b>역할 자신이 원본</b>이라 <i>경유</i> 라는 것이 없었다. 여기서는
 * 유효 권한이 <b>역할과 개인 예외의 합집합</b>이므로(backend/security.md ③), 이미 역할로 갖고 있는 칸에
 * 개인 예외를 또 주는 일이 생긴다.
 *
 * <p><b>막지 않는다</b>(screen/admin/system/user-auth/requirements.md). 중복은 무해하고, 막으면 <b>역할 부여가 곧 만료되는
 * 경우</b>를 처리할 수 없다 — 역할이 빠질 때 권한도 함께 사라진다. <i>"지금은 역할로도 갖고
 * 있다"</i> 를 알려주는 것까지가 화면의 몫이다.
 *
 * <p><b>색이 아니라 배지</b>다(screen/admin/system/user-auth/requirements.md). 같은 화면의 예외 목록에 읽기 전용 셀(회색)이 함께
 * 있어서, 회색이 <i>못 고치는 칸</i> 과 <i>역할로 이미 있는 칸</i> 두 뜻이 되면 <b>편집할 수
 * 있는 칸을 편집할 수 없다고 읽는다</b>.
 *
 * <h2>{@link #iconCd} 가 사이더와 <b>같은 값</b>이다</h2>
 *
 * <p>{@code SYS_MENU.ICON_CD} 그대로다 — 뜻의 코드(`user-auth`)이고 무엇으로 그릴지는
 * 프론트의 {@code menuIcons} 가 정한다(frontend/tabs.md). <b>트리가 자기 아이콘 규칙을 갖지 않는
 * 것</b>이 요점이다: 같은 메뉴가 사이더에서는 사람 모양이고 권한 트리에서는 폴더면,
 * <i>같은 것을 두 개로</i> 보게 된다.
 *
 * @param definedActions 이 메뉴에 <b>있는</b> 액션 — {@code MenuActionCatalog} 가 계산한다.
 *     여기 없는 칸은 {@code —} 이며 <i>안 줬다</i> 가 아니라 <b>줄 것이 없다</b> 다
 * @param grants 이 사용자의 개인 예외. <b>정의 밖의 고아가 섞여 있을 수 있다</b> — API 가
 * 사라진 조합이며 <b>지우지 않는다</b>(screen/admin/system/user/requirements.md · seed.md)
 * @param viaRoles 액션 → 그 액션을 주는 <b>지금 유효한</b> 역할들의 이름. 만료된 역할 부여와
 *     꺼진 역할은 여기 오지 않는다 — 배지가 <i>지금 역할로 된다</i> 를 말해야 하기 때문이다
 */
public record UserAuthTreeRow(
        String menuCd,
        String upMenuCd,
        String menuNm,
        /** {@code SYS_MENU.ICON_CD} — 사이더와 같은 코드다. 없으면 프론트가 폴백을 그린다. */
        String iconCd,
        String menuUrl,
        Boolean useYn,
        List<ActionType> definedActions,
        List<PersonalGrant> grants,
        Map<ActionType, List<String>> viaRoles) {}
