/**
 * 행 상태 넷과 그 전이 — frontend/grid.md.
 *
 * <p><b>한 행은 상태 하나만 갖는다.</b> 수정한 행을 삭제하면 삭제이고, <b>되돌리면 수정으로
 * 돌아가는 것이 아니라 무변경</b>으로 돌아간다 — 셀 값도 함께 되돌린다. 부분적으로 되돌리면
 * <i>"무엇이 남았는지"</i> 를 화면이 설명할 수 없다.
 *
 * <p><b>상태는 값에서 나온다</b>(2026-08-31 · {@link editRow}). 고친 값을 손으로 다시
 * 원래대로 돌려놓으면 상태도 <b>무변경으로 돌아간다</b> — <i>고쳤다</i> 는 사실을 따로
 * 기억하지 않는다. 기억하면 <b>되돌렸는데 표시가 안 사라지고</b>, 그 행이 저장 건수에
 * 들어가며 서버는 같은 값을 쓰는 {@code UPDATE} 를 한 번 낸다.
 *
 * <p>여기 순수 함수만 둔다. React 상태는 {@code useGridRows} 가 갖고, 이 파일은 <b>테스트가
 * 화면 없이 전이를 먹여 볼 수 있게</b> 분리된 것이다.
 */

/** {@code null} 이 무변경이다 — 넷째 값을 두면 저장 페이로드에서 걸러야 할 것이 하나 는다. */
export type RowState = 'C' | 'U' | 'D' | null;

export interface GridRow<T> {
  /** 화면 안에서만 쓰는 식별자. PK 가 아니다 — 신규 행에는 PK 가 아직 없다. */
  id: string;
  state: RowState;
  data: T;
  /** 되돌리기의 원본. 신규 행에는 없다. */
  original: T | null;
}

let sequence = 0;

/** 조회 결과 → 무변경 행. */
export function toRows<T>(content: T[]): GridRow<T>[] {
  return content.map((data) => ({
    id: `r${(sequence += 1)}`,
    state: null,
    data,
    original: data,
  }));
}

/** 새 행은 <b>맨 위에</b> 붙는다 — 방금 만든 것이 바로 보여야 한다(frontend/grid.md). */
export function addRow<T>(rows: GridRow<T>[], data: T): GridRow<T>[] {
  return [{ id: `n${(sequence += 1)}`, state: 'C', data, original: null }, ...rows];
}

/**
 * 셀 편집. <b>신규 행은 끝까지 신규다</b> — 수정으로 바뀌면 저장 시 0건을 갱신하는
 * {@code UPDATE} 가 나간다(frontend/grid.md).
 *
 * <h2>원본과 같아지면 <b>무변경으로 돌아간다</b> — 2026-08-31</h2>
 *
 * <p><b>상태를 값에서 낸다.</b> 한동안 <i>고치면 U</i> 로만 두었더니, 손으로 고친 값을
 * <b>다시 원래대로 돌려놓아도 U 가 남았다</b> — 그 행은 저장 대상에 들고, 확인 모달의
 * <i>수정 N건</i> 이 실제로 바뀐 것보다 많으며, 서버는 <b>같은 값을 쓰는 UPDATE</b> 를
 * 한 번 낸다. 무엇보다 사용자에게는 <i>되돌렸는데 표시가 안 사라진다</i> 로 보인다.
 *
 * <p><b>되돌리기 아이콘과 축이 같다.</b> {@link revertRow} 는 <i>한 번에 전부</i> 되돌리고
 * 이것은 <i>한 칸씩</i> 되돌린 결과가 마침 전부인 경우다 — 두 길의 끝이 같아야
 * <b>상태 컬럼이 값과 어긋나지 않는다</b>(frontend/grid.md).
 *
 * <p><b>{@link sameData} 가 판정한다</b> — 직렬화 비교라 동적 컬럼처럼 <b>맵을 새로 만들어
 * 쓰는</b> 칸도 내용으로 비교된다({@code refs} — frontend/grid.md). 참조 비교로는 그 칸이 영영
 * <i>바뀐 것</i>이 된다.
 */
export function editRow<T>(rows: GridRow<T>[], id: string, patch: Partial<T>): GridRow<T>[] {
  return rows.map((row) => {
    if (row.id !== id) return row;
    // 삭제 상태의 행은 셀 편집이 막힌다 — 지울 행을 고치는 것은 의미가 없다(frontend/grid.md).
    if (row.state === 'D') return row;

    const data = { ...row.data, ...patch };
    if (row.state === 'C') return { ...row, data };
    /*
      원본이 없으면 비교할 것이 없다 — 신규 행뿐이며 위에서 이미 갈렸다. 남는 경우가
      있다면 <b>U 로 두는 쪽</b>이 안전하다: 저장에서 빠지는 것보다 한 번 더 나가는 것이
      덜 나쁘다.
    */
    const unchanged = row.original !== null && sameData(row.original, data);
    return { ...row, state: unchanged ? null : 'U', data };
  });
}

/**
 * 삭제 아이콘. <b>상태이지 실행이 아니다</b>(frontend/grid.md).
 *
 * <p>신규 행은 <b>즉시 제거</b>한다 — 서버에 없는 행을 지우라고 보내게 된다(frontend/grid.md).
 */
export function toggleDelete<T>(rows: GridRow<T>[], id: string): GridRow<T>[] {
  const target = rows.find((row) => row.id === id);
  if (target && target.state === 'C') {
    return rows.filter((row) => row.id !== id);
  }
  return rows.map((row) => {
    if (row.id !== id) return row;
    if (row.state === 'D') {
      // 무변경으로 되돌린다 — 값도 함께다.
      return { ...row, state: null, data: row.original ?? row.data };
    }
    return { ...row, state: 'D' };
  });
}

/**
 * 편집 취소 — 상태 컬럼의 되돌리기 아이콘이 부른다(frontend/grid.md).
 *
 * <p><b>수정한 행만 대상이다.</b> 신규 행을 되돌리는 것은 <i>없애는 것</i> 이고 그것은
 * 삭제 아이콘의 일이며({@link toggleDelete}), 삭제 표시를 되돌리는 것도 거기 있다 —
 * 되돌리기가 셋을 다 하면 <b>같은 아이콘이 상태마다 다른 일</b>을 하게 된다.
 *
 * <p><b>값도 함께 되돌린다.</b> 상태만 지우면 화면에는 고친 값이 남은 채 <i>무변경</i> 이
 * 되고, 그 행은 저장되지 않으면서 사용자에게는 저장된 것처럼 보인다.
 */
export function revertRow<T>(rows: GridRow<T>[], id: string): GridRow<T>[] {
  return rows.map((row) => {
    if (row.id !== id || row.state !== 'U' || row.original === null) return row;
    return { ...row, state: null, data: row.original };
  });
}

/**
 * 행의 내용이 원본과 같은가 — <b>{@link editRow} 와 마스터-디테일이 함께 쓴다</b>(screen/admin/system/code/requirements.md).
 *
 * <p>하단에서 되돌린 값이 마스터 행으로 흘러갈 때, 마스터가 원본과 같아졌는지는
 * <b>내용을 비교해야만</b> 안다. 서버가 준 JSON 을 그대로 들고 있는 행이라
 * 직렬화 비교가 성립한다 — 키 순서는 같은 객체를 편 것이므로 유지된다.
 *
 * <p><b>셀 편집도 같은 판정을 쓴다</b>(2026-08-31). 처음에는 이 함수가 마스터-디테일
 * 하나만을 위한 것이었는데, <i>한 칸씩 되돌린 결과가 마침 전부인 경우</i>도 <b>같은
 * 질문</b>이었다 — 판정이 둘이면 <b>하단에서 되돌린 행과 위에서 되돌린 행의 상태가
 * 갈리는</b> 날이 온다.
 */
export function sameData<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function changedRows<T>(rows: GridRow<T>[]): GridRow<T>[] {
  return rows.filter((row) => row.state !== null);
}

export function hasChanges<T>(rows: GridRow<T>[]): boolean {
  return rows.some((row) => row.state !== null);
}

export interface ChangeCounts {
  added: number;
  updated: number;
  removed: number;
  total: number;
}

/** 저장 전 확인이 말하는 건수 — frontend/grid.md. 일괄 저장에서 <b>건수가 유일한 요약</b>이다. */
export function countChanges<T>(rows: GridRow<T>[]): ChangeCounts {
  const added = rows.filter((row) => row.state === 'C').length;
  const updated = rows.filter((row) => row.state === 'U').length;
  const removed = rows.filter((row) => row.state === 'D').length;
  return { added, updated, removed, total: added + updated + removed };
}
