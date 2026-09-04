import { describe, expect, it } from 'vitest';
import { newAnchor, planSelectRange, type SelectAnchor } from '@/shared/grid/selectRange';

/**
 * 체크박스 범위 선택 — grid-standard.md §4.
 *
 * <p>여기서 세는 것은 <b>사용자가 잃는 것</b>이다. 고르는 쪽은 틀려도 다시 누르면 되지만,
 * <b>푸는 쪽</b>이 틀리면 방금 모은 대상이 조용히 사라진다.
 */
describe('체크박스 범위 선택', () => {
  const anchorAt = (index: number, painted: number[] = []): SelectAnchor => ({
    index,
    rowId: `row-${String(index)}`,
    painted,
  });

  it('앵커가 없으면 계획이 없다 — 호출자가 한 행 토글로 떨어진다', () => {
    expect(planSelectRange(newAnchor(), 5, false)).toBeNull();
  });

  it('앵커부터 누른 행까지 칠한다', () => {
    expect(planSelectRange(anchorAt(2), 5, false)).toEqual({
      select: [2, 3, 4, 5],
      deselect: [],
      painted: [2, 3, 4, 5],
    });
  });

  it('위로 눌러도 같다 — 방향이 아니라 구간이다', () => {
    expect(planSelectRange(anchorAt(5), 2, false)?.select).toEqual([2, 3, 4, 5]);
  });

  it('앵커 자신을 누르면 그 한 행이다', () => {
    expect(planSelectRange(anchorAt(3), 3, false)?.select).toEqual([3]);
  });

  /*
    <b>줄어드는 것이 이 파일의 이유다.</b> 범위 안을 다시 누르면 밖으로 밀려난 행이
    풀려야 한다 — 남겨 두면 사용자가 <i>줄였다고 믿는</i> 것과 <b>실제 대상</b>이 갈린다.
  */
  it('칠한 범위 안을 다시 누르면 줄어든다 — 밀려난 행은 풀린다', () => {
    expect(planSelectRange(anchorAt(3, [3, 4, 5, 6, 7]), 5, false)).toEqual({
      select: [3, 4, 5],
      deselect: [6, 7],
      painted: [3, 4, 5],
    });
  });

  /*
    <b>범위 밖에서 고른 행은 건드리지 않는다</b> — 판의 내장 동작은 여기서 선택 전체를
    리셋하지만, 이 체크박스가 가리키는 것은 <b>실행의 대상</b>이라(grid-api-contract.md §7) 사용자가 여러
    번에 걸쳐 모은다.
  */
  it('직전 범위 밖은 풀지 않는다 — 따로 고른 행이 남는다', () => {
    // 9번은 사용자가 따로 눌러 고른 행이다. `painted` 에 없으므로 계획에도 없다.
    expect(planSelectRange(anchorAt(3, [3, 4]), 6, false)?.deselect).toEqual([]);
  });

  it('Ctrl + Shift 는 같은 구간을 푼다', () => {
    expect(planSelectRange(anchorAt(2), 4, true)).toEqual({
      select: [],
      deselect: [2, 3, 4],
      painted: [],
    });
  });

  /*
    지운 구간을 `painted` 에 남기면 <b>그다음 Shift 가 고르지도 않은 행을 푼다</b> —
    풀린 행을 *직전에 칠한 것* 으로 기억하는 셈이다.
  */
  it('푼 구간은 기억하지 않는다 — 다음 Shift 가 그것을 또 풀지 않는다', () => {
    const after = planSelectRange(anchorAt(2), 6, true);

    expect(planSelectRange(anchorAt(2, after?.painted ?? []), 4, false)?.deselect).toEqual([]);
  });
});
