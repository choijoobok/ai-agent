package com.aiagent.domain.authz.role;

import com.aiagent.domain.authz.ActionType;
import java.util.List;

/**
 * 권한 트리의 한 행 — screen/menu/requirements.md. <b>정의는 screen/user/requirements.md 가 갖고 여기는 덜어 내기만 한다.</b>
 *
 * <p>셀 상태가 <b>일곱에서 넷</b>으로 준다. 기간 컬럼이 없으므로(sys/menu.md) <i>예정</i>·<i>만료</i>
 * 배지가 사라지고, <b>역할 자신이 원본</b>이라 <i>역할 경유 보유</i> 배지도 사라진다 —
 * 켜짐 · 꺼짐 · {@code —} · 구조 노드 넷뿐이다.
 *
 * <h2>필드가 셋으로 갈리는 이유</h2>
 *
 * <table>
 *   <tr><td>{@code menuUrl == null}</td><td><b>구조 노드</b> — 스위치가 없고 파생 3-state 다</td></tr>
 *   <tr><td>{@link #definedActions}</td><td>이 메뉴에 <b>있는</b> 액션 — 나머지 칸은 {@code —} 다</td></tr>
 *   <tr><td>{@link #grantedActions}</td><td>이 역할이 <b>준</b> 액션 — 스위치의 켜짐이다</td></tr>
 * </table>
 *
 * <p><b>{@code —} 는 <i>안 줬다</i> 가 아니라 <i>줄 것이 없다</i> 다</b>(screen/user/requirements.md). 권한의 단위가
 * {@code (MENU_CD, ACTION_CD)} 이고 그것이 뜻하는 바는 <b>이 메뉴에서 이 액션의 API 를 부를
 * 수 있다</b> 는 것이므로, 부를 API 가 없으면 부여할 것이 없다. 빈 스위치로 두면 <i>"줄 수
 * 있는데 안 준 것"</i> 으로 읽히고, 관리자가 켜서 저장했는데 사용자는 여전히 못 한다면
 * <b>화면이 거짓말을 한 것</b>이다.
 *
 * @param menuNm <b>메뉴명이지 메시지 키가 아니다</b> — {@code SYS_MENU.MENU_NM} 에 들어 있는
 * 것은 {@code menu.{MENU_CD}} 이고(sys/menu.md) 서버가 세션 언어로 풀어 내려준다
 * @param useYn 메뉴의 최종 게이트(backend/security.md ④). <b>꺼진 메뉴에도 권한을 줄 수 있다</b> — 부여는
 *     남고 게이트에서 걸릴 뿐이며, 그것이 <i>켜기 전에 구성한다</i> 는 동선의 메뉴 쪽 짝이다.
 *     화면은 이 값으로 이름을 흐리게 그린다
 * @param iconCd {@code SYS_MENU.ICON_CD} — <b>사이더와 같은 코드</b>다(frontend/tabs.md). 뜻의 코드이고
 *     무엇으로 그릴지는 프론트의 {@code menuIcons} 가 정한다. 트리가 자기 아이콘 규칙을 갖지
 *     않는 것이 요점이다 — 같은 메뉴가 사이더에서는 사람 모양이고 권한 트리에서는 폴더면
 *     <b>같은 것을 두 개로</b> 보게 된다({@code UserAuthTreeRow} 와 같은 자리)
 * @param definedActions sys/menu.md 의 <b>액션 열</b>이 데이터로 온 것이다. {@code SYS_MENU_API} →
 * {@code SYS_API.ACTION_CD} 의 distinct 이며 <b>고정이 아니다</b>(backend/api.md) — 그 화면에
 *     {@code EXECUTE} 로 떨어지는 API 가 하나 생기면 시드 재생성으로 {@code —} 가 스위치로 바뀐다
 * @param grantedActions {@code SYS_ROLE_MENU_AUTH} 의 이 역할 · 이 메뉴 행들. <b>정의에 없는
 *     액션이 여기 있을 수 있다</b> — API 가 사라져 고아가 된 부여이며 <b>지우지 않는다</b>
 * (screen/user/requirements.md · seed.md): 배포가 운영 결정을 지우지 않는다
 */
public record RoleAuthTreeRow(
        String menuCd,
        String upMenuCd,
        String menuNm,
        String iconCd,
        String menuUrl,
        Boolean useYn,
        List<ActionType> definedActions,
        List<ActionType> grantedActions) {}
