import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import type { SearchField } from '@/shared/searchform/types';

/**
 * 폼이 내놓는 조건 — frontend/search-form.md · backend/api.md.
 *
 * <p><b>빈 칸을 보내지 않는 것이 프로토콜의 전제다.</b> 보내면 서버가 <i>"값이 NULL 인 것을
 * 찾아라"</i> 와 구분할 수 없고, 그 구분은 {@code isNull} 이 따로 있는 이유다.
 *
 * <p>번들이 없는 테스트에서는 메시지 키가 그대로 글자로 나온다 — 연산자 버튼의 {@code title}
 * 과 드롭다운 항목을 그 키로 찾는다.
 */
describe('SearchForm', () => {
  const fields: SearchField[] = [
    { field: 'msgKey', label: 'x', type: 'text', op: 'contains' },
    { field: 'useScope', label: 'x', type: 'select', options: [{ value: 'NONE', text: 'n' }] },
    { field: 'memo', label: 'x', type: 'text', op: 'isNull' },
  ];

  function mount(given: SearchField[] = fields, onSubmit: () => void = () => undefined) {
    const handle = createRef<SearchFormHandle>();
    render(<SearchForm fields={given} handleRef={handle} onSubmit={onSubmit} />);
    return handle;
  }

  it('빈 칸은 조건에 들어가지 않는다', () => {
    const handle = mount([fields[0], fields[1]]);
    expect(handle.current?.collect()).toEqual([]);
  });

  it('값을 받지 않는 연산자는 값 없이 조건이 성립한다 — 유일한 예외다', () => {
    const handle = mount([fields[2]]);
    expect(handle.current?.collect()).toEqual([{ field: 'memo', op: 'isNull' }]);
  });

  it('기본값이 있으면 처음부터 조건이 실린다 — 초기화가 빈칸이 아니라 기본값인 이유', () => {
    const handle = mount([
      { field: 'useYn', label: 'x', type: 'text', op: 'eq', defaultValue: 'Y' },
    ]);
    expect(handle.current?.collect()).toEqual([{ field: 'useYn', op: 'eq', value: 'Y' }]);
  });

  it('연산자를 적지 않으면 타입의 기본이다 — text 는 contains, select 는 eq', () => {
    const handle = mount([
      { field: 'a', label: 'x', type: 'text', defaultValue: 'v' },
      { field: 'b', label: 'x', type: 'select', defaultValue: 'NONE' },
    ]);
    expect(handle.current?.collect()).toEqual([
      { field: 'a', op: 'contains', value: 'v' },
      { field: 'b', op: 'eq', value: 'NONE' },
    ]);
  });

  it('후보가 하나면 고를 수 없다 — 다만 표시는 남는다(frontend/search-form.md 의 정렬)', () => {
    mount([{ field: 'uri', label: 'x', type: 'text', ops: ['startsWith'] }]);

    // 통째로 없애면 그 칸의 값 입력만 왼쪽에서 시작해 줄이 어긋난다.
    expect(screen.getByLabelText('search.op.startsWith').hasAttribute('disabled')).toBe(true);
  });

  it('후보가 둘 이상이면 드롭다운이 이름을 낸다 — 기호만으로는 뜻이 닫히지 않는다', async () => {
    mount([{ field: 'uri', label: 'x', type: 'text' }]);

    fireEvent.click(screen.getByLabelText('search.op.contains'));

    await waitFor(() => expect(screen.queryByText('search.op.endsWith')).not.toBeNull());
  });

  describe('포함(in) — 콤보만의 연산자', () => {
    const combo: SearchField = {
      field: 'useScope',
      label: 'x',
      type: 'select',
      defaultValue: 'NONE',
      options: [{ value: 'NONE', text: 'n' }, { value: 'BOTH', text: 'b' }],
    };

    /** 열려 있는 드롭다운에서 연산자 하나를 고른다. */
    const pick = async (from: string, to: string) => {
      fireEvent.click(screen.getByLabelText(from));
      await waitFor(() => expect(screen.queryByText(to)).not.toBeNull());
      fireEvent.click(screen.getByText(to));
    };

    it('포함으로 바꾸면 고른 값이 배열로 옮겨간다 — 다중 선택의 첫 항목이다', async () => {
      const handle = mount([combo]);

      await pick('search.op.eq', 'search.op.in');

      await waitFor(() =>
        expect(handle.current?.collect()).toEqual([
          { field: 'useScope', op: 'in', value: ['NONE'] },
        ]));
    });

    it('동일로 되돌리면 전체가 된다 — 고른 적 없는 조건이 남으면 안 된다', async () => {
      const handle = mount([combo]);

      await pick('search.op.eq', 'search.op.in');
      await pick('search.op.in', 'search.op.eq');

      // frontend/search-form.md 의 *첫 원소만 남긴다* 를 콤보에서는 따르지 않는다 — 거기서 빈 값은
      // 값이 아니라 *묻지 않음* 이고, 첫 원소를 남기면 조용히 걸린 조건이 된다.
      await waitFor(() => expect(handle.current?.collect()).toEqual([]));
    });

    /**
     * 목록이 <b>열린 채로</b> Enter 를 받는다 — 다중 선택의 정상 상태다.
     *
     * <p>단일은 고르는 순간 접히지만 다중은 남는다. 그 Enter 가 rc-select 까지 가면
     * 커서가 앉은 항목을 토글해 <b>방금 고른 것이 풀린 채로</b> 조회된다.
     */
    it('다중 선택에서 Enter 는 고르지도 풀지도 않는다 — 그대로 조회만 한다', async () => {
      const submits: number[] = [];
      const handle = mount([combo], () => submits.push(1));

      await pick('search.op.eq', 'search.op.in');
      const input = screen.getByRole('combobox');
      fireEvent.mouseDown(input);
      await waitFor(() => expect(screen.queryByText('n')).not.toBeNull());

      fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, which: 13 });

      expect(submits).toHaveLength(1);
      expect(handle.current?.collect()).toEqual([
        { field: 'useScope', op: 'in', value: ['NONE'] },
      ]);
    });
  });
  /**
   * 크기 계열의 <b>마지막 둘</b> — playbook/INDEX.md · backend/api.md.
   *
   * <p>여는 근거는 frontend/search-form.md 그대로다(<i>쓰는 화면이 왔다</i>). 여기서 지키는 것은 둘이다 —
   * <b>후보로 나오되 기본에는 없다</b>는 것, 그리고 <b>기간 칸에서 텍스트로 떨어지지
   * 않는다</b>는 것: 후보로만 열고 그리는 쪽을 빠뜨리면 그 칸은 사람이 날짜를 손으로 치는
   * 입력칸이 되고, 형식이 틀리면 <b>조용히 값이 되지 않는다</b>.
   */
  describe('초과·미만', () => {
    it('텍스트 칸의 기본 후보에 없다 — 열려면 화면이 적어야 한다', async () => {
      mount([{ field: 'uri', label: 'x', type: 'text' }]);

      fireEvent.click(screen.getByLabelText('search.op.contains'));

      await waitFor(() => expect(screen.queryByText('search.op.endsWith')).not.toBeNull());
      expect(screen.queryByText('search.op.gt')).toBeNull();
      expect(screen.queryByText('search.op.lt')).toBeNull();
    });

    it('선언하면 조건이 그대로 나간다 — 서버는 이미 아는 연산자다(backend/api.md)', () => {
      const handle = mount([
        { field: 'ordAmt', label: 'x', type: 'text', op: 'gt', defaultValue: '1000' },
      ]);

      expect(handle.current?.collect()).toEqual([
        { field: 'ordAmt', op: 'gt', value: '1000' },
      ]);
    });

    it('기간 칸에서는 달력 하나다 — 텍스트 칸으로 떨어지면 손으로 친 형식이 조용히 버려진다', () => {
      mount([{ field: 'ordDt', label: 'x', type: 'dateRange', ops: ['between', 'gt'], op: 'gt' }]);

      // AntD 의 단일 달력은 placeholder 로 스스로를 밝힌다 — 범위 칸은 둘을 낸다.
      expect(screen.getAllByPlaceholderText('Select date')).toHaveLength(1);
    });
  });

  /**
   * 태그 입력 — 텍스트 칸의 {@code in}(playbook/INDEX.md).
   *
   * <p>콤보의 {@code in} 과 <b>값의 모양이 같고 고르는 방법이 다르다</b>. 여기서 지키는
   * 것은 <b>빈 칩이 만들어지지 않는다</b> 하나다 — 서버의 {@code IN} 절에 빈 문자열이
   * 섞이면 그 조건은 <i>걸린 것처럼 보이고 아무 행도 맞히지 못한다</i>.
   */
  describe('태그 입력', () => {
    const tagField: SearchField = {
      field: 'ordNo',
      label: 'x',
      type: 'text',
      ops: ['contains', 'in'],
      op: 'in',
      defaultValue: ['SO-1', 'SO-2'],
    };

    it('칩 여럿이 배열 하나로 나간다', () => {
      const handle = mount([tagField]);

      expect(handle.current?.collect()).toEqual([
        { field: 'ordNo', op: 'in', value: ['SO-1', 'SO-2'] },
      ]);
    });

    it('빈 배열은 묻지 않음이다 — IN () 은 문법도 되지 않는다', () => {
      const handle = mount([{ ...tagField, defaultValue: [] }]);

      expect(handle.current?.collect()).toEqual([]);
    });
  });
});
