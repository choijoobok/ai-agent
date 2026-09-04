import { settableColumns } from '@/shared/grid/pref/gridPref';
import type { ColumnDef } from '@/shared/grid/types';

/**
 * 틀고정 경계선 — grid-standard.md §4·§5. <b>고정은 컬럼의 속성이 아니라 자리의 결과다.</b>
 *
 * <p>컬럼마다 *좌·없음·우* 를 고르게 두면 **왼쪽 고정이 가운데 컬럼에 붙는** 상태를 만들
 * 수 있는데 그리드에는 그런 자리가 없다 — 고정은 **양끝에서 몇 개까지인가**다. 선 둘이
 * 그 사실을 그대로 그린다: 위 선보다 **위**가 왼쪽 고정, 아래 선보다 **아래**가 오른쪽
 * 고정이며 **위 선이 아래 선을 넘지 못한다**.
 *
 * <p>컴포넌트에서 갈라 둔 이유는 <b>화면 없이 잴 수 있어야</b> 하기 때문이다 — 넘지 못하게
 * 막는 규칙은 드래그 없이는 눈으로 확인할 길이 없고, 틀리면 **고정 아닌 컬럼이 고정 구역에
 * 섞인다.**
 */

/** 두 경계선의 정렬 id — 컬럼 필드와 섞이지 않게 접두사를 둔다. */
export const LEFT_LINE = '__pinLeft';
export const RIGHT_LINE = '__pinRight';

/**
 * 고정된 컬럼을 <b>양끝으로 모은다</b> — 창을 여는 순간 한 번.
 *
 * <p>선언이 가운데 컬럼에 `pinned: 'left'` 를 적어 두었을 수 있는데 그리드에는 그런 자리가
 * 없다(판이 알아서 끝으로 옮겨 그린다). 목록이 그 상태를 그대로 그리면 **선 위에 고정
 * 아닌 컬럼**이 섞여 경계선의 뜻이 무너진다.
 */
export function normalize<T>(columns: ColumnDef<T>[]): ColumnDef<T>[] {
  const shown = settableColumns(columns);
  return [
    ...shown.filter((column) => column.pinned === 'left'),
    ...shown.filter((column) => column.pinned !== 'left' && column.pinned !== 'right'),
    ...shown.filter((column) => column.pinned === 'right'),
    ...columns.filter((column) => column.hidden),
  ];
}

/** 지금 목록에서 두 선이 있어야 할 자리. */
export function linesOf<T>(rows: ColumnDef<T>[]): { left: number; right: number } {
  return {
    left: boundary(rows, (column) => column.pinned !== 'left'),
    right: boundary(rows, (column) => column.pinned === 'right'),
  };
}

/** 자리 → 고정. */
export function pinnedAt(index: number, left: number, right: number): 'left' | 'right' | undefined {
  if (index < left) return 'left';
  if (index >= right) return 'right';
  return undefined;
}

/** 컬럼 필드 사이에 경계선 둘을 끼운 <b>정렬 대상 목록</b>. */
export function sequenceOf(fields: string[], left: number, right: number): string[] {
  const sequence: string[] = [];
  for (let index = 0; index <= fields.length; index += 1) {
    if (index === left) sequence.push(LEFT_LINE);
    if (index === right) sequence.push(RIGHT_LINE);
    if (index < fields.length) sequence.push(fields[index]);
  }
  return sequence;
}

/**
 * 옮긴 뒤의 목록 → 필드 순서와 경계선 자리.
 *
 * <p><b>위 선이 아래 선을 넘지 못한다.</b> 넘겼으면 <i>끌고 있던 쪽</i>이 상대 선에서
 * 멈춘다 — 벽에 닿는 것과 같다. 반대로 처리하면 **건드리지 않은 선이 따라 움직여**
 * 사용자가 의도하지 않은 고정이 생긴다.
 */
export function parseSequence(
  sequence: string[],
  dragged: string,
): { fields: string[]; left: number; right: number } {
  const fields: string[] = [];
  let left = 0;
  let right = 0;

  for (const id of sequence) {
    if (id === LEFT_LINE) left = fields.length;
    else if (id === RIGHT_LINE) right = fields.length;
    else fields.push(id);
  }

  if (left > right) {
    if (dragged === LEFT_LINE) left = right;
    else right = left;
  }
  return { fields, left, right };
}

/** 그 조건을 처음 만족하는 자리 — 없으면 목록의 끝이다. */
function boundary<T>(rows: ColumnDef<T>[], hit: (column: ColumnDef<T>) => boolean): number {
  const index = rows.findIndex(hit);
  return index < 0 ? rows.length : index;
}
