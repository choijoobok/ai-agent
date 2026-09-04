import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGridPref, resetGridPref, saveGridPref } from '@/shared/grid/pref/api/gridPrefApi';
import { useGridPref } from '@/shared/grid/pref/useGridPref';
import type { ColumnDef } from '@/shared/grid/types';

vi.mock('@/shared/grid/pref/api/gridPrefApi', () => ({
  getGridPref: vi.fn(),
  saveGridPref: vi.fn(),
  resetGridPref: vi.fn(),
}));

const read = vi.mocked(getGridPref);
const save = vi.mocked(saveGridPref);
const reset = vi.mocked(resetGridPref);

interface Row {
  a: string;
  b: string;
}

const DECLARED: ColumnDef<Row>[] = [
  { field: 'a', header: 'A', width: 100 },
  { field: 'b', header: 'B', width: 100 },
];

const SWAPPED = JSON.stringify({
  columns: [
    { field: 'b', visible: true, pinned: null },
    { field: 'a', visible: false, pinned: null },
  ],
});

const fieldsOf = (columns: ColumnDef<Row>[]) => columns.map((column) => column.field);

/**
 * 설정 창의 버튼 둘이 보는 것 — frontend/grid.md.
 *
 * <p><b>축이 둘이고 하나가 둘을 겸하면 안 된다.</b> {@code saved} 는 <i>DB 에 행이
 * 있는가</i>(초기화가 켜지는 조건)이고 {@code cancel} 은 <i>확정된 상태로 되감는 일</i>
 * (취소)이다. 하나로 합쳤더니 창에서 컬럼을 켜고 끄기만 해도 초기화가 켜졌고, 사용자는
 * 그것을 <b>저장됐다</b> 로 읽었다(2026-08-30 실물).
 */
describe('그리드 개인화 — 저장된 것과 해 보는 중인 것', () => {
  beforeEach(() => {
    read.mockReset();
    save.mockReset().mockResolvedValue(undefined);
    reset.mockReset().mockResolvedValue(undefined);
  });

  const mount = () => renderHook(() => useGridPref<Row>('MENU', 'main', DECLARED));

  it('저장된 것이 없으면 꺼진다 — 초기화가 지울 행이 없다', async () => {
    read.mockResolvedValue(null);

    const { result } = mount();

    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(result.current.saved).toBe(false);
    // 선언 그대로여야 한다 — 입힐 것이 없다.
    expect(fieldsOf(result.current.columns)).toEqual(['a', 'b']);
  });

  it('저장된 것이 있으면 켜지고 그것이 입혀진다', async () => {
    read.mockResolvedValue({ prefJson: SWAPPED });

    const { result } = mount();

    await waitFor(() => expect(result.current.saved).toBe(true));
    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);
  });

  it('읽기가 실패해도 꺼진다 — 조용히 선언 그대로 간다', async () => {
    read.mockRejectedValue(new Error('boom'));

    const { result } = mount();

    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(result.current.saved).toBe(false);
  });

  it('미리보기만으로는 켜지지 않는다 — 저장을 누르지 않았으면 DB 에 아무것도 없다', async () => {
    read.mockResolvedValue(null);

    const { result } = mount();
    await waitFor(() => expect(read).toHaveBeenCalled());

    act(() => {
      result.current.apply([DECLARED[1], DECLARED[0]]);
    });

    // 화면은 바뀌었지만 초기화는 여전히 꺼져 있다 — 지울 행이 없다.
    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);
    expect(result.current.saved).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('고치는 중인 것은 취소가 물린다 — 저장도 적용도 없으면 선언으로', async () => {
    read.mockResolvedValue(null);

    const { result } = mount();
    await waitFor(() => expect(read).toHaveBeenCalled());

    act(() => {
      result.current.apply([DECLARED[1], DECLARED[0]]);
    });
    act(() => {
      result.current.cancel();
    });

    expect(fieldsOf(result.current.columns)).toEqual(['a', 'b']);
    expect(result.current.saved).toBe(false);
  });

  it('취소는 선언이 아니라 <b>저장된 것</b>으로 돌아간다 — 마지막으로 확정된 상태다', async () => {
    read.mockResolvedValue({ prefJson: SWAPPED });

    const { result } = mount();
    await waitFor(() => expect(result.current.saved).toBe(true));

    act(() => {
      result.current.apply(DECLARED);
    });
    expect(fieldsOf(result.current.columns)).toEqual(['a', 'b']);

    act(() => {
      result.current.cancel();
    });

    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);
    expect(result.current.saved).toBe(true);
  });

  it('헤더를 끌어 바꾼 순서도 취소가 물린다 — 창 밖에서 만든 것도 확정된 것이 아니다', async () => {
    read.mockResolvedValue(null);

    const { result } = mount();
    await waitFor(() => expect(read).toHaveBeenCalled());

    act(() => {
      result.current.reorder(['b', 'a']);
    });
    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);

    act(() => {
      result.current.cancel();
    });

    expect(fieldsOf(result.current.columns)).toEqual(['a', 'b']);
  });

  /**
   * 헤더 드래그가 <b>순서 말고 다른 것을 바꾸면 안 된다</b> — frontend/grid.md.
   *
   * <p>판은 <b>꺼진 컬럼도 함께</b> 알려 주므로(`getAllGridColumns`) 그 칸들이 전부 이
   * 경로를 지난다. 모르는 칸을 <i>보임 · 고정 없음</i> 으로 채우던 동안, 저장된 설정이
   * 없는 그리드에서 <b>헤더를 한 번 끌면 숨겨 둔 컬럼이 전부 쏟아지고 틀고정도 풀렸다</b>
   * (2026-08-31 실물).
   */
  it('헤더를 끌어도 꺼 둔 컬럼이 켜지지 않는다 — 바뀐 것은 순서뿐이다', async () => {
    read.mockResolvedValue(null);
    const declared: ColumnDef<Row>[] = [
      { field: 'a', header: 'A', width: 100, pinned: 'left' },
      { field: 'b', header: 'B', width: 100, visible: false },
    ];

    const { result } = renderHook(() => useGridPref<Row>('MENU', 'main', declared));
    await waitFor(() => expect(read).toHaveBeenCalled());

    act(() => {
      result.current.reorder(['b', 'a']);
    });

    const byField = new Map(result.current.columns.map((column) => [column.field, column]));
    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);
    // 선언이 꺼 둔 것은 꺼진 채로, 고정한 것은 고정된 채로 남는다.
    expect(byField.get('b')?.visible).toBe(false);
    expect(byField.get('a')?.pinned).toBe('left');
  });

  it('창에서 껐다가 헤더를 끌어도 그 끔이 남는다 — 확정 전이어도 지금 화면의 상태다', async () => {
    read.mockResolvedValue(null);

    const { result } = mount();
    await waitFor(() => expect(read).toHaveBeenCalled());

    act(() => {
      result.current.apply([{ ...DECLARED[0], visible: false }, DECLARED[1]]);
    });
    act(() => {
      result.current.reorder(['b', 'a']);
    });

    const byField = new Map(result.current.columns.map((column) => [column.field, column]));
    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);
    expect(byField.get('a')?.visible).toBe(false);
  });

  it('저장하면 켜지고, 그 뒤의 취소는 그것으로 돌아간다', async () => {
    read.mockResolvedValue(null);

    const { result } = mount();
    await waitFor(() => expect(read).toHaveBeenCalled());

    await act(async () => {
      await result.current.save([DECLARED[1], DECLARED[0]]);
    });
    expect(result.current.saved).toBe(true);

    act(() => {
      result.current.apply(DECLARED);
    });
    act(() => {
      result.current.cancel();
    });

    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);
  });

  /**
   * <b>되감을 자리를 옮기는 것은 저장이 아니라 적용이다</b> — frontend/grid.md(2026-08-31 — 지시).
   *
   * <p>적용이 그 자리를 옮기지 않던 동안, <i>적용</i> 으로 맞춰 둔 화면은 <b>그 뒤에 창을
   * 열어 무엇 하나만 고치고 취소해도 통째로 날아갔다</b> — 되감을 자리가 <i>저장한 것</i>
   * 하나뿐이었기 때문이다.
   */
  it('적용한 뒤의 취소는 적용한 자리로 돌아온다 — 선언까지 가지 않는다', async () => {
    read.mockResolvedValue(null);

    const { result } = mount();
    await waitFor(() => expect(read).toHaveBeenCalled());

    act(() => {
      result.current.keep([DECLARED[1], DECLARED[0]]);
    });
    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);
    // DB 에는 아무것도 가지 않았다 — 초기화는 그대로 꺼져 있다.
    expect(result.current.saved).toBe(false);
    expect(save).not.toHaveBeenCalled();

    // 다시 열어 고치다가 취소한다.
    act(() => {
      result.current.apply(DECLARED);
    });
    expect(fieldsOf(result.current.columns)).toEqual(['a', 'b']);
    act(() => {
      result.current.cancel();
    });

    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);
  });

  it('적용한 뒤 헤더를 끌어도 취소는 적용한 자리로 되감는다', async () => {
    read.mockResolvedValue(null);

    const { result } = mount();
    await waitFor(() => expect(read).toHaveBeenCalled());

    act(() => {
      result.current.keep([DECLARED[1], DECLARED[0]]);
    });
    act(() => {
      result.current.reorder(['a', 'b']);
    });
    expect(fieldsOf(result.current.columns)).toEqual(['a', 'b']);

    act(() => {
      result.current.cancel();
    });

    expect(fieldsOf(result.current.columns)).toEqual(['b', 'a']);
  });

  it('초기화는 적용한 자리까지 지운다 — 되감을 곳이 선언이 된다', async () => {
    read.mockResolvedValue({ prefJson: SWAPPED });

    const { result } = mount();
    await waitFor(() => expect(result.current.saved).toBe(true));

    act(() => {
      result.current.keep(DECLARED);
    });
    await act(async () => {
      await result.current.reset();
    });
    expect(fieldsOf(result.current.columns)).toEqual(['a', 'b']);

    act(() => {
      result.current.cancel();
    });

    expect(fieldsOf(result.current.columns)).toEqual(['a', 'b']);
  });

  it('초기화하면 다시 꺼진다 — 행을 지우고 선언으로 돌아간다', async () => {
    read.mockResolvedValue({ prefJson: SWAPPED });

    const { result } = mount();
    await waitFor(() => expect(result.current.saved).toBe(true));

    await act(async () => {
      await result.current.reset();
    });

    expect(reset).toHaveBeenCalledWith('MENU', 'main');
    expect(result.current.saved).toBe(false);
    expect(fieldsOf(result.current.columns)).toEqual(['a', 'b']);
  });
});
