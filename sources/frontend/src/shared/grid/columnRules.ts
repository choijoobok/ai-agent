import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { ColumnDef, EditContext, EditableResult } from '@/shared/grid/types';

/**
 * 컬럼 선언을 <b>편집·필수 판단으로 펴는 곳</b> — frontend/grid.md.
 *
 * <p><b>한 곳인 것이 요점이다.</b> 어댑터(`columnDefs`)와 검증(`validate`)이 각자 같은 규칙을
 * 쓰고 있었다 — 그 상태에서 규칙을 하나 더하면 <b>한쪽만 알게 되고</b>, 그러면 셀은 잠기는데
 * 검증은 값을 요구하거나(저장이 안 되는데 이유가 화면에 없다) 그 반대가 된다. `cell.ts` 가
 * 값을 읽고 쓰는 규칙에 대해 한 것과 같은 자리다.
 *
 * <h2>`pk` 가 셋을 한 번에 정한다</h2>
 *
 * PK 컬럼은 <b>언제나 같은 셋</b>을 원한다 — 신규 행에서만 열리고, 필수이고, 저장된 행에서는
 * 잠긴다. 화면마다 손으로 적으면 그 셋이 매번 세 줄이고 <b>빠뜨려도 조용하다</b>:
 * `editable: true` 로 두면 저장된 PK 가 열리고, 그 저장은 서버에서 <i>없는 행 수정</i> 이
 * 된다(신규도 아니라 만들어지지도 않는다).
 *
 * <p><b>고치는 화면이 아주 없지는 않다.</b> 그때는 `pk: { renamable: true }` 로 <b>명시해서</b>
 * 연다 — 기본이 잠그는 쪽이고 여는 것이 선언이어야, 빠뜨렸을 때 <b>덜 위험한 쪽</b>으로
 * 떨어진다(`deny by default` 와 같은 방향 — backend/security.md).
 */

/** `pk` 가 정한 것을 화면이 <b>덮어쓸 수 없다</b> — 덮을 수 있으면 기본이 기본이 아니다. */
function pkOf<T>(column: ColumnDef<T>): { renamable: boolean } | null {
  if (!column.pk) return null;
  return column.pk === true ? { renamable: false } : column.pk;
}

/**
 * 이 셀이 열리는가 — frontend/grid.md 의 `(row, ctx)`.
 *
 * <p><b>거부에 이유를 붙인다.</b> 저장된 PK 를 두드리는 사람은 <i>왜 안 되는지</i> 를 묻고
 * 있고, 그 답이 <i>고치려면 지우고 다시 만든다</i> 라는 것은 화면 어디에도 적혀 있지 않다.
 */
export function editableOf<T>(column: ColumnDef<T>, row: T, ctx: EditContext): EditableResult {
  const pk = pkOf(column);
  if (pk) {
    if (pk.renamable) return true;
    // 신규 행에서만 — 저장된 PK 를 고치는 것은 다른 행을 만드는 일이다.
    return ctx.state === 'C' ? true : { ok: false, message: label(MSG.GRID_PK_LOCKED) };
  }
  if (column.editable === undefined) return false;
  if (typeof column.editable !== 'function') return column.editable;
  return column.editable(row, ctx);
}

/** {@link editableOf} 의 예·아니오만 — 거부 사유가 필요 없는 자리가 쓴다. */
export function isEditable<T>(column: ColumnDef<T>, row: T, ctx: EditContext): boolean {
  return editableOf(column, row, ctx) === true;
}

/**
 * 이 셀이 필수인가 — frontend/grid.md.
 *
 * <p><b>편집할 수 없는 칸은 필수가 아니다.</b> 사용자가 채울 방법이 없는데 저장을 막으면
 * 그 화면은 <b>영영 저장되지 않는다</b> — 저장된 행의 PK 가 그 자리다: 값은 이미 있고
 * 잠겨 있으므로 다시 물을 것이 없다.
 */
export function requiredOf<T>(column: ColumnDef<T>, row: T, ctx: EditContext): boolean {
  if (!isEditable(column, row, ctx)) return false;
  if (pkOf(column)) return true;
  if (!column.required) return false;
  return typeof column.required === 'function' ? column.required(row, ctx) : column.required;
}

/**
 * 헤더에 <b>필수 표시(`*`)</b>를 붙이는가 — frontend/grid.md.
 *
 * <p><b>컬럼 하나에 대한 답이라 행을 보지 않는다.</b> 그래서 셋을 가른다.
 *
 * <table>
 *   <tr><td>`pk`</td><td><b>붙는다</b> — 신규 행에서 언제나 필수다</td></tr>
 *   <tr><td>`required: true`</td><td><b>붙는다</b> — 단, 편집할 수 있는 컬럼일 때만</td></tr>
 *   <tr><td>`required: (row) => …`</td><td><b>안 붙는다</b> — 행마다 갈리므로 헤더가
 *       말하면 <b>거짓말이 된다</b>: 아닌 행에서도 별표가 보인다</td></tr>
 * </table>
 *
 * <p><b>읽기 전용 컬럼에는 붙지 않는다.</b> {@link requiredOf} 가 그 행에서 필수를 풀어
 * 주는데 헤더만 별표를 달고 있으면, 채우려 해도 열리지 않는 칸을 두고 <i>왜 안 되나</i> 를
 * 묻게 된다.
 */
export function marksRequired<T>(column: ColumnDef<T>): boolean {
  if (column.pk) return true;
  if (column.required !== true) return false;
  // 함수는 여기서 판정할 수 없다 — 열리는 행이 하나라도 있으면 있는 것으로 본다.
  return column.editable !== undefined && column.editable !== false;
}
