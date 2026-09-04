import { createRef } from 'react';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import type { SearchField } from '@/shared/searchform/types';
import {
  deleteSavedCond,
  getSavedConds,
  saveSavedCond,
} from '@/shared/searchform/api/searchCondApi';
import { TabIdentityProvider } from '@/layouts/ShellLayout/tabContext';

vi.mock('@/shared/searchform/api/searchCondApi', () => ({
  getSavedConds: vi.fn(),
  saveSavedCond: vi.fn(),
  deleteSavedCond: vi.fn(),
}));

const list = vi.mocked(getSavedConds);
const store = vi.mocked(saveSavedCond);
const remove = vi.mocked(deleteSavedCond);

/**
 * 저장된 조회조건 — UX-07 · frontend/search-form.md.
 *
 * <p>여기서 지키는 것 셋이다 — ① <b>담기는 것은 기본값과 다른 칸뿐</b>(§5.2), ② <b>선언이
 * 바뀌면 조용히 버린다</b>(§5.3), ③ <b>기본 조건은 진입할 때 폼을 채운다</b>(§5.4).
 *
 * <p>①이 이 기능의 값어치를 지탱한다. 전부 담으면 <i>최근 7일</i> 이 절대값으로 굳어
 * <b>내일 열었을 때 어제 것</b>이 나온다.
 */
describe('저장된 조회조건', () => {
  const fields: SearchField[] = [
    { field: 'msgKey', label: 'x', type: 'text', op: 'contains' },
    { field: 'useScope', label: 'x', type: 'select', options: [{ value: 'NONE', text: 'n' }] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue([]);
  });

  function mount(given: SearchField[] = fields) {
    const handle = createRef<SearchFormHandle>();
    render(
      <App>
        <TabIdentityProvider value={{ tabKey: 't1', menuCd: 'MESSAGE_MGMT' }}>
          <SearchForm fields={given} handleRef={handle} onSubmit={() => undefined} />
        </TabIdentityProvider>
      </App>,
    );
    return handle;
  }

  const openMenu = async (item: string) => {
    fireEvent.click(screen.getByRole('button', { name: /searchCond\.title/ }));
    await waitFor(() => expect(screen.queryByText(item)).not.toBeNull());
    fireEvent.click(screen.getByText(item));
  };

  it('셸 밖에는 버튼이 없다 — 조건이 매이는 자리(MENU_CD)가 없다', () => {
    const handle = createRef<SearchFormHandle>();
    render(
      <App>
        <SearchForm fields={fields} handleRef={handle} onSubmit={() => undefined} />
      </App>,
    );

    expect(screen.queryByRole('button', { name: /searchCond\.title/ })).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('기본 조건이 있으면 진입할 때 폼이 채워진다 — 열 때 읽으면 이것을 못 한다', async () => {
    list.mockResolvedValue([
      { condNm: '미번역', condJson: '{"useScope":{"value":"NONE"}}', dflt: true, sortNo: 1 },
    ]);
    const handle = mount();

    await waitFor(() =>
      expect(handle.current?.collect()).toEqual([
        { field: 'useScope', op: 'eq', value: 'NONE' },
      ]));
  });

  it('기본이 아니면 저절로 적용되지 않는다 — 목록에 있다는 것과 걸린다는 것은 다르다', async () => {
    list.mockResolvedValue([
      { condNm: '미번역', condJson: '{"useScope":{"value":"NONE"}}', dflt: false, sortNo: 1 },
    ]);
    const handle = mount();

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(handle.current?.collect()).toEqual([]);
  });

  it('고르면 그때 채워진다', async () => {
    list.mockResolvedValue([
      { condNm: '미번역', condJson: '{"useScope":{"value":"NONE"}}', dflt: false, sortNo: 1 },
    ]);
    const handle = mount();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    await openMenu('미번역');

    await waitFor(() =>
      expect(handle.current?.collect()).toEqual([
        { field: 'useScope', op: 'eq', value: 'NONE' },
      ]));
  });

  describe('담기는 것', () => {
    const save = async (name: string) => {
      await openMenu('searchCond.save');
      await waitFor(() => expect(screen.queryByLabelText('searchCond.name')).not.toBeNull());
      fireEvent.change(screen.getByLabelText('searchCond.name'), { target: { value: name } });
      fireEvent.click(screen.getByRole('button', { name: 'grid.confirm.ok' }));
    };

    /** 저장 호출에 실린 JSON 을 되읽는다 — 이 기능의 계약이 그 문자열이다. */
    const savedJson = () => JSON.parse(store.mock.calls[0][2]) as unknown;

    it('기본값과 같은 칸은 담지 않는다 — 전부 담으면 상대 날짜가 절대값으로 굳는다', async () => {
      store.mockResolvedValue([]);
      mount();
      await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

      const input = screen.getAllByRole('textbox')[0];
      fireEvent.change(input, { target: { value: 'shell.' } });
      await save('키만');

      await waitFor(() => expect(store).toHaveBeenCalledTimes(1));
      // useScope 는 손대지 않았다 — 그래서 없다.
      expect(savedJson()).toEqual({ msgKey: { value: 'shell.' } });
    });

    it('연산자만 바꿔도 담는다 — 그것은 선언이 아니라 사용자가 고른 것이다', async () => {
      store.mockResolvedValue([]);
      mount();
      await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByLabelText('search.op.contains'));
      await waitFor(() => expect(screen.queryByText('search.op.startsWith')).not.toBeNull());
      fireEvent.click(screen.getByText('search.op.startsWith'));
      await save('앞 일치');

      await waitFor(() => expect(store).toHaveBeenCalledTimes(1));
      // 값은 기본 그대로라 `value` 가 없다 — `op` 만 담긴다(frontend/search-form.md).
      expect(savedJson()).toEqual({ msgKey: { op: 'startsWith' } });
    });
  });

  describe('선언이 바뀌었을 때 — 조용히 버린다(§5.3)', () => {
    const pick = async () => {
      await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
      await openMenu('옛것');
    };

    it('없어진 필드는 버린다 — 그대로 보내면 400 이다', async () => {
      list.mockResolvedValue([
        {
          condNm: '옛것',
          condJson: '{"gone":{"value":"x"},"msgKey":{"value":"shell."}}',
          dflt: false,
          sortNo: 1,
        },
      ]);
      const handle = mount();

      await pick();

      await waitFor(() =>
        expect(handle.current?.collect()).toEqual([
          { field: 'msgKey', op: 'contains', value: 'shell.' },
        ]));
    });

    it('후보에서 빠진 연산자는 기본으로 되돌린다', async () => {
      list.mockResolvedValue([
        { condNm: '옛것', condJson: '{"msgKey":{"op":"regex","value":"a"}}', dflt: false, sortNo: 1 },
      ]);
      const handle = mount([{ field: 'msgKey', label: 'x', type: 'text', op: 'contains' }]);

      await pick();

      await waitFor(() =>
        expect(handle.current?.collect()).toEqual([
          { field: 'msgKey', op: 'contains', value: 'a' },
        ]));
    });

    it('모양이 어긋난 값은 버린다 — 배열이어야 할 칸에 문자열이 왔다', async () => {
      list.mockResolvedValue([
        { condNm: '옛것', condJson: '{"useScope":{"op":"in","value":"NONE"}}', dflt: false, sortNo: 1 },
      ]);
      const handle = mount();

      await pick();

      // 연산자는 살아남고 값만 비워진다 — `IN ()` 은 조건이 되지 않으므로 빠진다.
      await waitFor(() => expect(handle.current?.collect()).toEqual([]));
    });

    it('깨진 JSON 은 없는 것으로 친다 — 배포마다 뜨는 경고는 고칠 수 없다', async () => {
      list.mockResolvedValue([{ condNm: '옛것', condJson: '{{{', dflt: true, sortNo: 1 }]);
      const handle = mount();

      await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
      expect(handle.current?.collect()).toEqual([]);
    });
  });

  it('목록이 비면 그렇게 말한다 — 빈 드롭다운은 고장으로 보인다', async () => {
    mount();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /searchCond\.title/ }));

    await waitFor(() => expect(screen.queryByText('searchCond.empty')).not.toBeNull());
    expect(remove).not.toHaveBeenCalled();
  });
});
