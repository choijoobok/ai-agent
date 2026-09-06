import { App } from 'antd';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfirmDiscard } from '@/shared/grid/useConfirmDiscard';
import { useGridController, type GridController } from '@/shared/grid/useGridController';
import type { ColumnDef, GridApi } from '@/shared/grid/types';
import { useAuthStore } from '@/shared/stores/authStore';
import { useMessageStore } from '@/shared/i18n/messageStore';

const post = vi.fn();

vi.mock('@/shared/api/request', () => ({
  post: (url: string, body?: unknown) => post(url, body) as Promise<unknown>,
  get: vi.fn(),
  request: vi.fn(),
}));

/**
 * <b>버리기 전에 묻는가</b> — frontend/grid.md · playbook/master-detail.md.
 *
 * <p>이 물음은 <b>일곱 벌</b>이었고 <b>한 벌도 테스트가 없었다</b>. 2026-09-06 에
 * {@code useConfirmDiscard} 로 모으면서 함께 잠근다 — 모으는 것만으로는 <i>같은 것 하나</i>
 * 가 될 뿐, 그 하나가 <b>맞는지</b> 는 여전히 아무도 보지 않기 때문이다.
 *
 * <p>여기가 지키는 것은 셋이다 — <b>깨끗하면 묻지 않고</b>, <b>취소는 재조회를 막고</b>,
 * <b>어느 길로 닫히든 promise 가 끝난다</b>. 셋 중 마지막이 조용한 사고다: 끝나지 않으면
 * {@code await} 한 선택 로직이 <i>영영 멈추고</i>, 화면은 아무 말 없이 굳는다.
 */
describe('미저장을 버리기 전에 묻는다 — frontend/grid.md', () => {
  interface Row {
    id: string;
  }

  const columns: ColumnDef<Row>[] = [{ field: 'id', header: 'x', type: 'text', editable: true }];

  const READ = '/service/x/getList';
  const TITLE = '편집 중인 내용이 있습니다';
  const OK = '확인';
  const CANCEL = '취소';

  const page = () => ({
    mode: 'offset',
    content: [{ id: 'a' }],
    size: 10,
    hasNext: false,
    totalElements: 1,
    totalPages: 1,
    nextCursor: null,
    prevCursor: null,
  });

  const api: GridApi<Row> = { read: { url: READ } };

  let controller: GridController<Row> | null = null;

  function Inner() {
    controller = useGridController<Row>({ menuCd: 'TEST', columns, api, addRow: {} });
    return null;
  }

  /* 모달은 {@code App.useApp()} 이 준다 — 프로바이더 밖이면 정적 폴백이 와서 DOM 이 빈다. */
  function Harness() {
    return (
      <App>
        <Inner />
      </App>
    );
  }

  const settle = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  /**
   * 다이얼로그가 뜰 때까지 기다렸다가 <b>그 버튼</b>을 누른다.
   *
   * <p><b>가장 나중 것</b>을 고른다 — AntD 는 닫은 모달의 껍데기를 잠시 남겨 두므로
   * 첫 번째를 누르면 <i>이미 닫힌 창</i>을 누르게 된다.
   */
  const answer = async (text: string) => {
    await waitFor(() => expect(screen.queryAllByText(TITLE).length).toBeGreaterThan(0));
    const buttons = screen.getAllByRole('button', { name: text });
    await act(async () => {
      fireEvent.click(buttons[buttons.length - 1]);
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue(page());
    controller = null;
    useAuthStore.setState({ permissions: ['TEST:READ', 'TEST:WRITE'] });
    useMessageStore.setState({
      status: 'ready',
      messages: {
        'grid.discard.title': TITLE,
        'grid.discard.body': '다시 읽으면 사라집니다',
        'grid.confirm.ok': OK,
        'common.cancel': CANCEL,
      },
    });
  });

  /**
   * <b>깨끗한 그리드는 묻지 않는다.</b> 물으면 <i>잃을 것이 없는데도</i> 확인을 누르게
   * 되고, 그 습관이 붙으면 <b>진짜 물음도 읽지 않고 누른다</b>.
   */
  it('미저장이 없으면 묻지 않고 바로 읽는다', async () => {
    render(<Harness />);
    await act(async () => {
      await controller?.read();
    });

    expect(screen.queryByText(TITLE)).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  /**
   * <b>취소는 재조회를 막는다.</b> 막지 못하면 사용자가 <i>아니오</i> 를 눌렀는데 편집이
   * 사라진다 — 그 순간 이 다이얼로그는 <b>있으나 마나</b>가 아니라 <b>거짓말</b>이 된다.
   */
  it('미저장이 있으면 묻고, 취소하면 읽지 않는다', async () => {
    render(<Harness />);
    await act(async () => {
      await controller?.read(true);
    });
    act(() => controller?.addRow());

    let done: boolean | undefined;
    void act(() => {
      void controller?.read().then(() => {
        done = true;
      });
    });
    await answer(CANCEL);
    await settle();

    // 첫 조회 하나뿐이다 — 두 번째는 나가지 않았다.
    expect(post).toHaveBeenCalledTimes(1);
    // 그리고 <b>끝났다</b>. 취소가 promise 를 열어 둔 채 두면 화면이 굳는다.
    expect(done).toBe(true);
  });

  /** <b>확인은 통과다.</b> 이것이 없으면 다이얼로그가 재조회를 아예 막는 문이 된다. */
  it('확인하면 재조회가 나간다', async () => {
    render(<Harness />);
    await act(async () => {
      await controller?.read(true);
    });
    act(() => controller?.addRow());

    void act(() => {
      void controller?.read();
    });
    await answer(OK);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });

  /**
   * <b>훅은 판정하지 않는다</b> — {@code dirty} 를 받지 않으므로 부르면 언제나 묻는다.
   * 화면이 {@code detail.dirty} 를 앞에 세우는 이유이며(playbook/master-detail.md),
   * 그 계약이 뒤집히면 마스터-디테일에서 <b>깨끗한데도 매번 물음이 뜬다</b>.
   */
  it('훅은 dirty 를 보지 않는다 — 부르면 묻고 답을 돌려준다', async () => {
    let ask: (() => Promise<boolean>) | null = null;

    function Bare() {
      ask = useConfirmDiscard();
      return null;
    }

    render(
      <App>
        <Bare />
      </App>,
    );

    let answered: boolean | undefined;
    void act(() => {
      void ask?.().then((value) => {
        answered = value;
      });
    });
    await answer(OK);
    await waitFor(() => expect(answered).toBe(true));
  });
});
