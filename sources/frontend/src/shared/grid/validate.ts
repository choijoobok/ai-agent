import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { cellValue } from '@/shared/grid/cell';
import { requiredOf } from '@/shared/grid/columnRules';
import type { GridRow } from '@/shared/grid/rows';
import type { ApiValidation, ColumnDef, EditContext, GridIssue } from '@/shared/grid/types';

/**
 * 두 시점, 세 층 — frontend/grid.md.
 *
 * <p><b>입력 시점에는 1층만 돈다.</b> 그때는 사용자가 어느 버튼을 누를지 모르므로, 저장
 * 규칙으로 검사했는데 다른 버튼을 누르면 검사가 어긋난다.
 *
 * <p><b>API 호출 전에는 세 층 전부</b>가 돈다. 입력 시에만 하면 붙여넣기 · 후작업 · 팝업으로
 * 들어온 값이 검사를 건너뛴다 — <b>사람이 타이핑한 값만</b> 검사하게 된다.
 */

/** 입력 시점 — 그 셀 + 그 행. 1층만이다. */
export function validateCell<T>(
  column: ColumnDef<T>,
  value: unknown,
  row: T,
  ctx: EditContext,
): string | null {
  if (requiredOf(column, row, ctx) && isEmpty(value)) {
    // 필수 검사가 먼저다. 값이 비어 있으면 validate 를 부르지 않는다 — frontend/grid.md.
    return label(MSG.GRID_VALIDATION_REQUIRED);
  }
  if (isEmpty(value)) {
    return null;
  }
  return column.validate ? column.validate(value, row) : null;
}

/**
 * API 호출 전 — 세 층 전부.
 *
 * <p><b>삭제 상태 행은 컬럼 검증에서 뺀다</b>(frontend/grid.md) — 지울 행의 값은 저장되지 않는다.
 * 반대로 <b>그리드 검증은 삭제 행을 뺀 결과로 계산한다</b>: 합계·최소 1건은 <i>저장 후의
 * 모습</i>을 물어야 한다.
 *
 * <p><b>무변경 행도 검증한다</b> — 그리드 검증(합계·중복)의 대상이기 때문이다.
 */
export function validateAll<T>(
  rows: GridRow<T>[],
  columns: ColumnDef<T>[],
  api?: ApiValidation<T>,
): GridIssue[] {
  const issues: GridIssue[] = [];

  for (const row of rows) {
    if (row.state === 'D') continue;

    for (const column of columns) {
      // hidden 컬럼은 검증 대상이 아니다 — 포커스를 줄 수 없는 곳에 오류를 남기지 않는다.
      if (column.hidden) continue;

      const value = cellValue(column, row.data);
      const first = validateCell(column, value, row.data, { state: row.state });
      if (first) {
        issues.push({ rowId: row.id, field: column.field, message: first });
        continue;
      }
      const perApi = api?.columns?.[column.field];
      const second = perApi ? perApi(value, row.data) : null;
      if (second) {
        issues.push({ rowId: row.id, field: column.field, message: second });
      }
    }
  }

  if (api?.grid) {
    issues.push(...api.grid(rows.filter((row) => row.state !== 'D')));
  }
  return issues;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
