package com.aiagent.domain.user.detail;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 보유 역할 저장의 한 행 — 61 §3.8 탭 1 · grid-standard.md §3.1.
 *
 * <p><b>{@link UserAuthSaveRow} 와 두 자리가 다르고 둘 다 42 §3.1 이 정한 것</b>이다:
 * 기간이 <b>선택</b>이고({@code null} 이 무기한) <b>사유 칸이 없다</b>. 개인 예외에 사유가
 * 필수인 이유는 그것이 <i>예외</i> 이기 때문이며, 계약직에게 계약 기간만큼 역할을 주는 것은
 * <b>정상 운영</b>이다 — 모든 부여에 사유를 강제하면 아무도 쓰지 않는다.
 *
 * <table>
 *   <tr><td>{@code C}</td><td>새 부여</td></tr>
 *   <tr><td>{@code U}</td><td>기간 변경. <b>회수도 이것</b>이다 — 종료일을 어제로 한다(42 §3.1)</td></tr>
 *   <tr><td>{@code D}</td><td><b>잘못 등록한 행 정리</b>뿐이다 — 회수가 아니다(61 §4.7 의 셋째 줄)</td></tr>
 * </table>
 *
 * <p><b>{@code roleId} 는 {@code U} 에서 바뀌지 않는다</b> — PK 의 절반이다(42 §3.2). 다른
 * 역할을 주려면 이 행을 정리하고 새로 만드는 것이며, 그것이 맞다: 다른 역할은 <b>다른
 * 사실</b>이지 같은 부여의 수정이 아니다.
 */
public record UserRoleSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 30) String roleId,
        LocalDate validFromDt,
        LocalDate validToDt) {}
