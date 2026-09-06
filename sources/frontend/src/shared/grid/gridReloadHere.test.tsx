import { App } from 'antd';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
 * 저장·실행이 끝난 뒤 <b>어디를 다시 읽는가</b> — frontend/grid.md.
 *
 * <p><b>커서형에는 페이지 번호가 없다</b>(backend/api.md). 위치를 나르는 것은 {@code page} 가
 * 아니라 커서이고 {@code page} 는 늘 0 이라, 재조회가 쪽수만 들고 가면 사용자는 <b>보던
 * 자리를 잃고 맨 앞으로 튄다</b> — 3천 건짜리 이력에서 그것은 <i>다시 찾아오라</i> 는 말이다.
 *
 * <p>오프셋형은 반대로 커서가 없으므로, <b>둘을 함께 실어도 분기가 생기지 않는다</b>는 것이
 * 이 파일이 함께 잠그는 것이다 — 분기를 만들면 모드가 하나 늘 때마다 갈래가 는다.
 */
describe('재조회는 보던 자리로 — frontend/grid.md', () => {
  interface Row {
    id: string;
  }

  const columns: ColumnDef<Row>[] = [{ field: 'id', header: 'x', type: 'text' }];

  const READ = '/service/x/getList';
  const GO = '/service/x/go';
  const DONE = '실행했습니다';
  const OK = '확인';

  /** 커서형 응답 — 쪽수도 총건수도 없다. */
  const cursorPage = (nextCursor: string | null, prevCursor: string | null) => ({
    mode: 'cursor',
    content: [{ id: 'a' }],
    size: 10,
    hasNext: nextCursor !== null,
    totalElements: null,
    totalPages: null,
    nextCursor,
    prevCursor,
  });

  const offsetPage = () => ({
    mode: 'offset',
    content: [{ id: 'a' }],
    size: 10,
    hasNext: true,
    totalElements: 100,
    totalPages: 10,
    nextCursor: null,
    prevCursor: null,
  });

  const api: GridApi<Row> = {
    read: { url: READ },
    actions: [{ key: 'go', label: 'go', url: GO, target: 'none', confirm: false }],
  };

  let controller: GridController<Row> | null = null;

  function Inner() {
    controller = useGridController<Row>({ menuCd: 'TEST', columns, api });
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

  /** 요청 하나에서 <b>커서 칸</b>만 꺼낸다. */
  const cursorSent = (call: number) =>
    (post.mock.calls[call][1] as { page: { cursor?: string } }).page.cursor;

  const settle = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    post.mockReset();
    controller = null;
    useAuthStore.setState({ permissions: ['TEST:READ', 'TEST:EXECUTE'] });
    useMessageStore.setState({
      status: 'ready',
      messages: { 'grid.action.done': DONE, 'grid.confirm.ok': OK },
    });
  });

  /**
   * <b>실행 뒤의 재조회가 커서를 들고 간다.</b> 이것이 없으면 2쪽에서 실행한 사용자가
   * 1쪽으로 돌아오고, 방금 처리한 행이 어떻게 됐는지 <b>보이지 않는다</b>.
   */
  it('커서형은 보던 커서로 다시 읽는다', async () => {
    post.mockImplementation((url: string) =>
      Promise.resolve(url === READ ? cursorPage('C2', 'C0') : { ok: true }),
    );

    render(<Harness />);
    await act(async () => {
      await controller?.read(true);
    });
    await act(async () => {
      await controller?.goNextPage();
    });
    // ① 첫 조회는 커서가 없고 ② 다음 쪽은 서버가 준 커서로 간다.
    expect(cursorSent(0)).toBeUndefined();
    expect(cursorSent(1)).toBe('C2');

    act(() => {
      void controller?.runAction('go');
    });
    await settle();
    // 성공 모달의 확인이 재조회를 트리거한다(frontend/grid.md).
    await waitFor(() => expect(screen.getByText(DONE)).toBeTruthy());
    act(() => {
      screen.getAllByRole('button', { name: new RegExp(OK) })[0].click();
    });

    // ③ 실행 ④ 재조회 — 그 재조회가 ②의 자리를 들고 가야 한다.
    await waitFor(() => expect(post).toHaveBeenCalledTimes(4));
    expect(post.mock.calls[2][0]).toBe(GO);
    expect(post.mock.calls[3][0]).toBe(READ);
    expect(cursorSent(3)).toBe('C2');
  });

  /**
   * <b>오프셋형은 그대로다.</b> 커서를 함께 싣는 배관이 쪽수를 밀어내지 않는지 본다 —
   * 밀어냈다면 번호 페이징 화면 전부가 저장할 때마다 1쪽으로 돌아간다.
   */
  it('오프셋형은 쪽수로 다시 읽고 커서를 싣지 않는다', async () => {
    post.mockImplementation((url: string) =>
      Promise.resolve(url === READ ? offsetPage() : { ok: true }),
    );

    render(<Harness />);
    await act(async () => {
      await controller?.read(true);
    });
    await act(async () => {
      await controller?.goToPage(2);
    });

    act(() => {
      void controller?.runAction('go');
    });
    await settle();
    await waitFor(() => expect(screen.getByText(DONE)).toBeTruthy());
    act(() => {
      screen.getAllByRole('button', { name: new RegExp(OK) })[0].click();
    });

    await waitFor(() => expect(post).toHaveBeenCalledTimes(4));
    const reload = post.mock.calls[3][1] as { page: { page: number; cursor?: string } };
    expect(reload.page.page).toBe(2);
    expect(reload.page.cursor).toBeUndefined();
  });
});
