package com.aiagent.domain.user.detail;

import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.menu.MenuUserRow;
import com.aiagent.domain.authz.menu.MenuUserRow.GrantState;
import java.time.LocalDate;
import java.util.List;

/**
 * 탭 5 — <b>이 사람의 유효 권한</b>(61 §3.8.1). 52 §8 의 미결을 닫는 화면이다.
 *
 * <p>AUTHZ-09(권한 시뮬레이션)가 제외되며 <i>"이 사용자가 왜 이 메뉴를 못 보나"</i> 에 답할
 * 자리가 비었고, security-design.md §4 가 <b>대체할 사용자 기준 진단</b>을 여기로 넘겼다.
 *
 * <h2>메뉴 하나가 여러 행일 수 있다 — <b>경유가 둘이면 행이 둘</b>이다</h2>
 *
 * <p>{@link MenuUserRow} 를 <b>반대쪽에서 본 것</b>이며 그 규칙을 그대로 가져온다. 역할 둘로
 * 같은 메뉴에 닿으면 <b>출처가 둘</b>이고, 그것이 이 탭이 답해야 하는 것이다 — <i>"무엇을
 * 회수해야 이 사람이 이 화면을 못 보는가"</i>. 합쳐 한 행으로 내면 액션 합집합은 맞아도
 * <b>어느 부여를 건드려야 하는지를 잃는다</b>.
 *
 * <p>61 §3.8.1 의 컬럼 표는 <i>메뉴 · 액션 4열 · 출처 · 상태</i> 넷이다. 한 행이 <b>한
 * 출처</b>일 때만 그 표가 성립한다 — 출처가 둘인 메뉴를 한 행에 담으면 <i>출처</i> 칸과
 * <i>상태</i> 칸이 <b>어느 쪽 것인지 말할 수 없게</b> 되고, 그 순간 이 탭은 진단이 아니라
 * 요약이 된다.
 *
 * <h2>없는 것도 낸다</h2>
 *
 * <p><i>"왜 못 보나"</i> 는 <b>권한이 없는 행</b>에 답이 있다(61 §3.8.1 의 요구 2). 그래서
 * <i>전체 메뉴</i> 모드에서는 부여가 하나도 없는 메뉴도 행으로 나오며, 그때 {@link #via} 가
 * {@code null} 이고 {@link #actions} 가 비어 있다 — 화면이 회색으로 그린다.
 *
 * @param definedActions 그 메뉴에 <b>정의된</b> 액션(52 §4.2 · ADR-0027). 여기 없는 액션은
 *     화면에서 {@code —} 이며 <b>부여할 수도 없다</b> — <i>안 줬다</i> 와 <i>줄 것이 없다</i>
 *     를 가르는 값이다(61 §4.4 의 같은 어휘)
 * @param actions <b>이 경유가 주는</b> 액션이다. 합집합이 아니다 — 합치는 것은 유효 권한
 *     계산의 일이고(security-design.md §4 ③) 이 탭이 하는 일은 <b>그 앞의 출처를 펴는 것</b>이다
 * @param via 역할명 또는 {@link MenuUserRow#PERSONAL}. 부여가 없는 행에서는 {@code null} 이다
 * @param roleId 경유가 역할일 때만 채운다 — 화면이 <b>그 역할을 열</b> 수 있어야 하는데
 *     이름만으로는 열 수 없다
 * @param menuAuthorizable 게이트 ④ — {@code SYS_MENU.USE_YN='Y'} 이고 {@code MENU_URL} 이
 *     있는가(security-design.md §4). 부여가 유효해도 이것이 {@code false} 면 유효 권한에 <b>들어가지 못한다</b>
 * @param effective 이 행이 <b>지금 실제로 권한을 주는가</b> — {@code grantState == ACTIVE}
 *     이고 {@code menuAuthorizable} 이다. 서버가 내는 이유는 61 §3.8.1 의 요구 1 이다:
 *     <b>화면 전용 계산을 두면 실제 판정과 갈리고, 갈리는 순간 이 탭은 진단이 아니라 또
 *     하나의 거짓말</b>이 된다
 */
public record EffectiveAuthRow(
        String menuCd,
        String menuPath,
        Boolean menuAuthorizable,
        List<ActionType> definedActions,
        String via,
        String roleId,
        List<ActionType> actions,
        Boolean effective,
        GrantState grantState,
        LocalDate validFromDt,
        LocalDate validToDt,
        String grantRsn) {}
