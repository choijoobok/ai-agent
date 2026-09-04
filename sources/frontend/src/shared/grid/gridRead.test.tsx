import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
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
 * ①의 <b>조회 버튼이 어디서 나오는가</b> — frontend/grid.md.
 *
 * <p><b>원천이 둘이고 버튼은 하나다.</b> 보통은 {@code api.read} 선언이 낸다. 그럴 수 없는
 * 그리드가 있어서 — 행이 <b>다른 조회에서</b> 오는 경우 — 화면이 {@code onRead} 로 거는
 * 길이 함께 있다. 셋째 자리는 <b>아무것도 없는 것</b>이며 그것도 결정이다.
 *
 * <p>이 파일이 지키는 것은 <b>셋이 서로 새지 않는다</b>는 것이다 —
 *
 * <ol>
 *   <li>{@code api.read} 만 있으면 컨트롤러가 조회한다(서버를 부른다)
 *   <li>{@code onRead} 만 있으면 <b>화면이 준 함수</b>가 불리고 <b>서버는 부르지 않는다</b>
 * <li>둘 다 없으면 <b>버튼이 없다</b> — `list` 디테일이 그 자리다(frontend/grid.md)
 * </ol>
 *
 * <p>2번이 뒤집히면 `USER_AUTH_MGMT` 의 하단이 <b>트리 응답을 `PageResponse` 로 파싱</b>하게
 * 되고, 3번이 뒤집히면 `MESSAGE_MGMT` 의 하단에서 <b>`list` 의 미저장 편집이 날아간다</b>.
 */
describe('그리드 ①의 조회 — frontend/grid.md', () => {
  interface Row {
    id: string;
  }

  const columns: ColumnDef<Row>[] = [{ field: 'id', header: 'x', type: 'text', width: 120 }];

  const READ_LABEL = '조회';

  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ mode: 'all', content: [], size: null, hasNext: false,
      totalElements: 0, totalPages: null, nextCursor: null, prevCursor: null });
    window.localStorage.clear();
    useAuthStore.setState({ permissions: ['TEST:READ'] });
    useMessageStore.setState({ status: 'ready', messages: { 'grid.read': READ_LABEL } });
  });

  function Harness(props: { api?: GridApi<Row>; onRead?: () => void; disabled?: boolean }) {
    const controller = useGridController<Row>({ menuCd: 'TEST', columns, api: props.api });
    return (
      <App>
        <DataGrid<Row>
          title="t"
          menuCd="TEST"
          controller={controller}
          onRead={props.onRead}
          disabled={props.disabled}
          // 개인화를 읽지 않는다 — 이 파일이 보는 것은 ①의 버튼 하나다.
          settings={false}
          height={200}
        />
      </App>
    );
  }

  it('`api.read` 를 선언하면 버튼이 서고, 누르면 그 URL 로 나간다', async () => {
    render(<Harness api={{ read: { url: '/service/x/getList' } }} />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(READ_LABEL) }));

    // 미저장 확인(frontend/grid.md)을 거쳐 나가므로 한 틱 뒤다 — `onRead` 가 동기인 것과 갈린다.
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe('/service/x/getList');
  });

  /**
   * `USER_AUTH_MGMT` 의 하단이 이 자리다 — 트리와 목록을 조회 하나가 함께 먹이므로
   * (screen/user/requirements.md) 자기 `api.read` 가 없다. <b>그래도 다시 읽을 길은 있어야 한다.</b>
   */
  it('`onRead` 를 주면 버튼이 서고, **서버를 부르지 않고** 그 함수가 불린다', () => {
    const onRead = vi.fn();
    render(<Harness onRead={onRead} />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(READ_LABEL) }));

    expect(onRead).toHaveBeenCalledTimes(1);
    // 컨트롤러의 조회가 아니다 — 응답 모양이 `PageResponse` 가 아니라서 이 길이 있다.
    expect(post).not.toHaveBeenCalled();
  });

  /**
   * `MESSAGE_MGMT` 의 하단이 이 자리다(screen/code/requirements.md) — 행이 마스터 행의 `list` 값이라
   * 부를 곳이 없고, 버튼이 있으면 <b>미저장 편집이 날아간다</b>(frontend/grid.md).
   */
  it('둘 다 없으면 버튼이 아예 없다 — `list` 디테일', () => {
    render(<Harness />);

    expect(screen.queryByRole('button', { name: new RegExp(READ_LABEL) })).toBeNull();
  });

  it('`disabled` 면 `onRead` 버튼도 함께 잠긴다 — 대상이 없는 디테일', () => {
    const onRead = vi.fn();
    render(<Harness onRead={onRead} disabled />);

    const button = screen.getByRole('button', { name: new RegExp(READ_LABEL) });
    expect(button.hasAttribute('disabled')).toBe(true);

    fireEvent.click(button);
    expect(onRead).not.toHaveBeenCalled();
  });

  it('`READ` 권한이 없으면 `api.read` 버튼이 사라진다 — 화면이 감싸지 않았는데도', () => {
    useAuthStore.setState({ permissions: [] });
    render(<Harness api={{ read: { url: '/service/x/getList' } }} />);

    expect(screen.queryByRole('button', { name: new RegExp(READ_LABEL) })).toBeNull();
  });
});
