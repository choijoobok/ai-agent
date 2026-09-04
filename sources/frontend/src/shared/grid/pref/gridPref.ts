import type { ColumnDef } from '@/shared/grid/types';

/**
 * 그리드 개인화의 값 — UX-06 · UX-13 · frontend/grid.md.
 *
 * <p>**너비는 여기 없다.** 27인치에서 맞춘 폭이 노트북에서는 틀리므로 **기기의 속성**이고
 * (sys/user-role.md) `localStorage` 다. 표시 여부·순서·틀고정은 *"이 컬럼을 붙잡고 나머지를
 * 스크롤한다"* 는 **읽는 방식**이라 사람의 속성이다.
 */
export interface ColumnPref {
  field: string;
  visible: boolean;
  /** `null` 이 *고정 없음* 이다 — 키를 빼면 *모른다* 와 구분되지 않는다. */
  pinned: 'left' | 'right' | null;
}

export interface GridPrefValue {
  columns: ColumnPref[];
}

/**
 * 설정 창에 나오는 컬럼 — frontend/grid.md의 *목록에 없는 셋* 을 뺀 것이다.
 *
 * <p>시스템 컬럼(번호·상태·삭제)은 **선언에 없으므로** 자연히 빠지고, `hidden` 과 **동적
 * 컬럼**은 여기서 뺀다.
 *
 * <p>**동적 컬럼을 빼는 것이 시그니처에서 특히 중요하다**(frontend/grid.md · sys/code.md). 그 집합은
 * *고른 그룹* 을 따라 바뀌므로, 넣으면 그룹을 옮길 때마다 시그니처가 달라져 **자기 설정이
 * 자기를 폐기한다** — 사용자가 겪는 것은 *"설정이 저장되지 않는다"* 이고 원인을 짐작할 수
 * 없다. 목록에서 빼는 이유는 하나 더 있다: **끄거나 옮겨도 저장할 곳이 없다**.
 */
export function settableColumns<T>(columns: ColumnDef<T>[]): ColumnDef<T>[] {
  return columns.filter((column) => !column.hidden && !column.dynamic);
}

/**
 * 시그니처(UX-13) — **화면의 컬럼 목록이 바뀌면 저장된 설정을 폐기한다**.
 *
 * <p>계산식은 frontend/grid.md 그대로다: `전체 − 시스템 − hidden − 동적`. 저장된 설정에 들어 있지도
 * 않은 컬럼이 늘거나 줄었다고 사용자의 표시·순서·고정을 버릴 이유가 없다.
 *
 * <p>**순서를 보지 않는다** — 이름을 정렬해 해시한다. 사용자가 바꾼 순서가 섞이면 순서를
 * 바꿀 때마다 시그니처가 달라져 **자기 설정이 자기를 폐기하고**, 사용자가 겪는 것은
 * *"설정이 저장되지 않는다"* 인데 원인을 짐작할 수 없다. 부르는 쪽이 선언을 넘기도록
 * 규약을 두는 것으로는 부족하다 — **함수가 그것을 보장해야** 한 번의 실수로 깨지지 않는다.
 *
 * <p>해시는 FNV-1a 다 — `crypto.subtle` 은 비동기라 렌더 중에 쓸 수 없고, 여기서 막는 것은
 * 공격이 아니라 **어긋남**이므로 충돌 저항이 필요 없다.
 */
export function signatureOf<T>(columns: ColumnDef<T>[]): string {
  const fields = settableColumns(columns).map((column) => column.field);
  const source = [...fields].sort().join('|');

  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}:${fields.length}`;
}

/** 지금 화면의 상태를 값으로 — 저장 버튼이 보내는 것이다. */
export function toPrefValue<T>(columns: ColumnDef<T>[]): GridPrefValue {
  return {
    columns: settableColumns(columns).map((column) => ({
      field: column.field,
      visible: column.visible !== false,
      pinned: column.pinned ?? null,
    })),
  };
}

/**
 * 저장된 값을 선언에 입힌다.
 *
 * <p>**모르는 필드는 버리고 빠진 필드는 선언 그대로 뒤에 남긴다.** 시그니처가 이미 그런
 * 경우를 막지만, 막지 못한 경로(손으로 고친 행)에서도 **화면이 그려져야 한다**.
 */
export function applyPref<T>(
  columns: ColumnDef<T>[],
  pref: GridPrefValue | null,
): ColumnDef<T>[] {
  if (!pref) return columns;

  const remaining = new Map(columns.map((column) => [column.field, column]));
  const ordered: ColumnDef<T>[] = [];

  for (const entry of pref.columns) {
    const column = remaining.get(entry.field);
    if (!column) continue;
    remaining.delete(entry.field);
    ordered.push({ ...column, visible: entry.visible, pinned: entry.pinned ?? undefined });
  }
  // `hidden` 과 저장 뒤에 늘어난 컬럼이 여기 남는다 — 선언 순서 그대로다.
  for (const column of columns) {
    if (remaining.has(column.field)) ordered.push(column);
  }
  return ordered;
}

/** 저장된 문자열을 값으로 — 깨진 JSON 은 없는 것으로 친다(frontend/grid.md 의 폐기와 같은 태도). */
export function parsePref(prefJson: string): GridPrefValue | null {
  try {
    const parsed: unknown = JSON.parse(prefJson);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const columns = (parsed as GridPrefValue).columns;
    return Array.isArray(columns) ? { columns } : null;
  } catch {
    return null;
  }
}
