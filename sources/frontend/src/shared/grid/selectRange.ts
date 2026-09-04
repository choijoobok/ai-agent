/**
 * 체크박스의 <b>범위 선택</b> — `Shift` 로 여러 행을 한 번에 고른다(grid-standard.md §4).
 *
 * <p><b>판에 있는 기능인데 우리에게 오지 않는다.</b> AG Grid 의 내장 선택 컬럼은
 * `Shift`·`Ctrl` 을 이미 처리하지만(`inferNodeSelections`), 우리는 그 컬럼을 쓰지 않는다 —
 * 그것은 {@code lockPosition: 'left'} 라 <b>번호보다 왼쪽</b>에 서고, 번호를 왼쪽에 두는
 * 내장 행번호 컬럼은 <b>Enterprise</b> 다. 그래서 체크박스를 우리가 그리고
 * (`columnDefs.selectionColumn`), 수식키 처리도 여기서 한다.
 *
 * <p><b>이름이 판의 것과 겹치지 않게 두었다.</b> AG Grid 의 <i>Range Selection</i> 은
 * <b>셀 범위</b>(Enterprise)이고 이것은 <b>행 선택</b>이다 — 같은 말을 쓰면 다음 사람이
 * 유료 기능을 흉내 낸 것으로 읽는다.
 *
 * <h2>규칙 셋</h2>
 *
 * <ol>
 *   <li><b>수식키 없는 클릭이 앵커를 옮긴다</b> — 그 행 하나만 토글하고, 다음 `Shift` 가
 *       거기서부터 칠한다
 *   <li><b>`Shift`</b> — 앵커부터 누른 행까지 <b>칠한다</b>. 이미 칠한 범위 안을 다시
 *       누르면 <b>줄어든다</b>(밖으로 밀려난 행은 해제된다) — 판의 내장 동작과 같다
 *   <li><b>`Ctrl`(`⌘`) + `Shift`</b> — 같은 범위를 <b>해제한다</b>
 * </ol>
 *
 * <h2>고른 것을 함부로 비우지 않는다</h2>
 *
 * <p>판의 내장 동작은 앵커가 선택돼 있지 않으면 <b>선택 전체를 리셋</b>하는데, 여기서는
 * 하지 않는다. 이 체크박스가 가리키는 것은 <b>실행의 대상</b>이고(grid-api-contract.md §7) 그 목록은
 * 사용자가 여러 번에 걸쳐 모은다 — 범위를 하나 칠했다고 앞서 고른 행이 사라지면
 * <b>무엇이 사라졌는지 화면이 말해 주지 않는다</b>.
 *
 * <p>대신 <b>직전 `Shift` 가 칠한 범위만</b> 기억해 두었다가 줄어들 때 거기서 뺀다
 * ({@link SelectAnchor.painted}) — 줄어드는 것은 <i>방금 한 일을 고치는 것</i> 이라
 * 사용자가 잃는 것을 알고 있다.
 *
 * <h2>자리로 센다 — 그래서 앵커가 살았는지 묻는다</h2>
 *
 * <p>범위는 <b>화면에 보이는 순서</b>의 구간이므로 행 ID 가 아니라 인덱스로 잡는다.
 * 그런데 조회·정렬·필터·페이지 이동이 그 자리를 통째로 갈아 끼우므로, 쓰기 전에
 * <b>그 자리에 그 행이 아직 있는지</b> 를 확인해야 한다({@link SelectAnchor.rowId} 가
 * 그것을 위해 있다). 어긋나면 범위를 잡지 않고 <b>한 행 토글로 떨어진다</b> — 남의
 * 자리를 칠하는 것보다 아무것도 안 하는 편이 낫다.
 */

/** 다음 `Shift` 가 어디서부터 칠할지 — 그리드 하나에 하나다. */
export interface SelectAnchor {
  /** 마지막으로 수식키 없이 누른 행의 <b>표시 인덱스</b>. */
  index: number | null;
  /** 그 자리에 있던 행의 ID — 인덱스가 아직 같은 행을 가리키는지 확인하는 데 쓴다. */
  rowId: string | null;
  /** 직전 `Shift` 가 칠한 범위 — 다음 `Shift` 가 줄어들 때 여기서 뺀다. */
  painted: number[];
}

export interface SelectRangePlan {
  /** 고를 자리. */
  select: number[];
  /** 풀 자리. */
  deselect: number[];
  /** 이번에 칠한 범위 — 호출자가 {@link SelectAnchor.painted} 에 담아 둔다. */
  painted: number[];
}

export function newAnchor(): SelectAnchor {
  return { index: null, rowId: null, painted: [] };
}

/**
 * `Shift` 클릭 한 번이 무엇을 고르고 무엇을 푸는가.
 *
 * @param remove `Ctrl`(`⌘`) 이 함께 눌렸다 — 칠하는 대신 <b>지운다</b>.
 * @returns 앵커가 없으면 {@code null} — 호출자는 <b>한 행 토글</b>로 떨어진다.
 */
export function planSelectRange(
  anchor: SelectAnchor,
  clicked: number,
  remove: boolean,
): SelectRangePlan | null {
  if (anchor.index === null) return null;

  const span: number[] = [];
  for (let i = Math.min(anchor.index, clicked); i <= Math.max(anchor.index, clicked); i += 1) {
    span.push(i);
  }

  /*
    <b>지운 범위는 기억하지 않는다.</b> `painted` 는 *다음에 줄어들면 뺄 것* 이라
    이미 풀린 행을 담아 두면 그다음 `Shift` 가 <b>고르지도 않은 행을 푸는</b> 일이 된다.
  */
  if (remove) return { select: [], deselect: span, painted: [] };

  const inSpan = new Set(span);
  return { select: span, deselect: anchor.painted.filter((i) => !inSpan.has(i)), painted: span };
}
