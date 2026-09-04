package com.aiagent.domain.config.admin;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 저장 페이로드의 한 행 — 63 §4.7. <b>저장 하나가 두 가지를 한다.</b>
 *
 * <table><caption></caption>
 * <tr><td>{@code U}</td><td>적용값 수정 — {@code SYS_CONFIG} 행을 <b>만들거나</b> 갱신한다</td></tr>
 * <tr><td>{@code D}</td><td><b>되돌리기</b> — 행을 지운다. 값이 사라지는 것이 아니라
 *     {@code yml} 이 드러난다(63 §4.4)</td></tr>
 * </table>
 *
 * <p><b>{@code C} 가 없다.</b> 화면에 행 추가 버튼이 없고({@code addRow} 를 선언하지 않는다)
 * 서버도 받지 않는다 — 아우터 조인의 <b>왼쪽에 없는 키</b>를 넣으면 <b>아무 데도 읽히지
 * 않는 행</b>이 생기고, 그것은 <b>저장은 되고 동작하지 않는</b> 가장 나쁜 실패다(grid-column-contract.md §5.7).
 *
 * <p><b>수정도 {@code U} 하나다</b> — 화면이 보는 행은 언제나 있으므로(기본값을 복사해
 * 보여준다) 그 행을 고치는 것은 처음이든 두 번째든 <i>수정</i> 이다. {@code SYS_CONFIG} 에
 * 행이 있는지는 <b>서버가 안다</b>.
 *
 * @param cfgVal 되돌리기({@code D})에는 필요 없다. 그때는 값을 보지 않고 행을 지운다
 */
public record ConfigSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 100) String cfgKey,
        @Size(max = 1000) String cfgVal) {}
