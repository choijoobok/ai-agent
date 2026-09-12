package com.aiagent.domain.user.detail;

import com.aiagent.domain.authz.menu.MenuUserRow.GrantState;
import java.time.Instant;
import java.time.LocalDate;

/**
 * 탭 1 — <b>이 사람이 가진 역할</b>(USER-03 · screen/admin/system/user/requirements.md).
 *
 * <p>{@code RoleHolderRow} 를 <b>반대쪽에서 본 것</b>이다. 저기는 <i>"이 역할을 가진
 * 사람"</i> 이라 계정 컬럼이 붙고, 여기는 <i>"이 사람이 가진 역할"</i> 이라 <b>역할 컬럼이
 * 붙는다</b> — 같은 테이블({@code SYS_USER_ROLE})의 같은 행을 세는데 <b>옆에 붙는 것이
 * 다르므로</b> 레코드가 둘이다.
 *
 * <p><b>편집이 여기에만 있다.</b> 62 의 하단 pane 은 읽기 전용이고({@code RoleHolderRow} 의
 * 머리말) 부여를 고치는 곳은 이 탭 하나다 — screen/admin/system/user/requirements.md 가 개인 예외에 대해 정한 것과 같은
 * 규칙이며, 같은 사실을 고치는 화면이 둘이면 규칙도 둘이 된다.
 *
 * @param roleNm 역할명. <b>{@code roleId} 만으로는 고를 수 없다</b> — 후보 콤보가 이 값을
 *     보여주고, 목록에도 이 값이 보여야 <i>무엇을 줬는지</i> 를 읽을 수 있다
 * @param roleUseYn <b>역할 자체</b>의 사용 여부 — sys/menu.md 의 판정 AND 중 앞엣것이다. 부여가
 *     유효기간 안이어도 이것이 {@code false} 면 <b>이 부여는 지금 아무것도 주지 않는다</b>.
 *     상태 배지({@link #grantState})는 <b>기간만</b> 보므로 이 칸이 없으면 <i>유효라는데 왜
 *     안 되나</i> 에 답할 것이 없다
 * @param grantState 예정 · 유효 · 만료. <b>기간에서 파생</b>하며 {@code null} 은 제한 없음이라
 * 양쪽이 다 비면 언제나 유효다(sys/menu.md) — 개인 예외와 갈리는 자리다(그쪽은 기간이 필수)
 */
public record UserRoleRow(
        String roleId,
        String roleNm,
        String roleDesc,
        Boolean roleUseYn,
        LocalDate validFromDt,
        LocalDate validToDt,
        GrantState grantState,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
