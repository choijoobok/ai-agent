package com.ordinary.backoffice.domain.authz.userauth;

import com.ordinary.backoffice.domain.authz.ActionType;
import com.ordinary.backoffice.domain.authz.menu.MenuUserRow.GrantState;
import java.time.LocalDate;

/**
 * 개인 예외 한 칸 — {@code SYS_USER_MENU_AUTH} 의 행 하나(42 §6 · AUTHZ-07).
 *
 * <p><b>트리와 하단 목록이 같은 이것을 본다</b>(61 §4.4 — <i>"같은 데이터의 두 표시"</i>).
 * 트리는 {@link #state} 로 스위치와 배지를 그리고, 목록은 기간·사유까지 펴서 편집한다 —
 * <b>응답을 하나로 두는 것이 둘이 어긋나지 않는 유일한 방법</b>이다.
 *
 * <p>화면이 이 값에서 하단 그리드를 만든다. 서버가 목록을 따로 내면 <b>같은 질문에 답이
 * 둘</b>이 되고, 그 둘이 갈리는 순간 <i>"트리에는 있는데 목록에 없다"</i> 가 된다.
 *
 * @param state <b>기간에서 파생</b>한다 — 배치가 컬럼을 갱신하지 않는다(61 §4.7 · security-design.md §4).
 *     스위치가 켜지는 것은 {@link GrantState#ACTIVE} 하나뿐이고, 나머지 둘은 <b>꺼진 채
 *     배지</b>가 붙는다: 스위치가 답해야 하는 질문은 <i>"이 사람 지금 이거 되나"</i> 다
 * @param grantRsn <b>필수</b>다(AUTHZ-07). 역할 부여에는 없는 컬럼이며 그 차이가 의도다 —
 *     <b>개인 예외에는 마찰이 있어야 하고</b> 역할 부여는 일상 운영이다(42 §6)
 */
public record PersonalGrant(
        ActionType actionCd,
        GrantState state,
        LocalDate validFromDt,
        LocalDate validToDt,
        String grantRsn) {}
