package com.aiagent.domain.user.detail;

import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.menu.MenuUserRow.GrantState;
import java.time.Instant;
import java.time.LocalDate;

/**
 * 탭 2 — <b>이 사람이 가진 개인 예외</b>(AUTHZ-07 조회 · screen/user/requirements.md).
 *
 * <h2>조회 전용이며 조회 API 도 {@code USER_AUTH_MGMT} 와 나뉜다</h2>
 *
 * <p>screen/user/requirements.md 가 그 경계를 그었다 — 여기서 묻는 것은 <i>"이 사람이 무슨 예외를 갖고 있나"</i>
 * 이고 저기서 하는 것은 <i>"이 사람에게 예외를 준다"</i> 다. <b>반환 형태가 다르므로</b>
 * 경로가 갈린다: 저쪽은 트리 체크 상태를 함께 내야 해 메뉴 전건이 실리고, 여기는
 * <b>부여된 행만</b> 나오는 납작한 목록이다.
 *
 * <p><b>편집을 여기 두지 않는 것은 권한 때문</b>이다. 사용자 관리 권한이 있다고 예외 권한
 * 부여 권한이 따라오면 안 되며, 권한은 {@code (MENU_CD, ACTION_CD)} 쌍이므로 <b>메뉴가
 * 갈려야 갈린다</b>(screen/user/requirements.md).
 *
 * @param menuPath 조상 경로를 포함한 표시 이름 — {@code 사용자 > 사용자 관리}. 리프 이름만으로는
 * 같은 이름의 다른 가지와 구분되지 않고, frontend/tabs.md 의 검색 결과가 쓰는 것과 같은 형식이다
 * @param menuAuthorizable 게이트 ④를 지나는가 — {@code SYS_MENU.USE_YN='Y'} 이고
 * {@code MENU_URL} 이 있는가(backend/security.md). {@code false} 면 이 행은 유효 권한에 들어가지
 *     <b>못한다</b>: 부여는 살아 있는데 대상이 죽은 것이고, 그것이 <i>"권한을 줬는데 안
 *     보인다"</i> 의 답이다
 * @param grantState 예정 · 유효 · 만료. 기간이 <b>필수</b>라({@code NOT NULL} — sys/menu.md) 셋 중
 *     하나가 반드시 정해진다 — 역할 부여와 갈리는 자리다
 */
public record UserGrantRow(
        String menuCd,
        String menuPath,
        Boolean menuAuthorizable,
        ActionType actionCd,
        GrantState grantState,
        LocalDate validFromDt,
        LocalDate validToDt,
        String grantRsn,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
