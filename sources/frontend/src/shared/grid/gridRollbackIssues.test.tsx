import { App } from 'antd';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api';
import { toRows } from '@/shared/grid/rows';
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
 * <b>전건 롤백</b>이 화면에 어떻게 오는가 — backend/row-transaction.md §7 · frontend/grid.md.
 *
 * <p><b>저장과 실행이 같은 얼굴이어야 한다.</b> 사용자에게 벌어진 일이 둘 다 같기 때문이다 —
 * <i>아무것도 안 됐고, 화면에 있는 편집이 곧 다시 낼 입력이다</i>. 그런데 실행만 문구 한
 * 줄로 닫던 시절이 있었고(2026-09-06 이전), 그때 500건 확정이 12건 때문에 되돌아가면
 * 사용자는 <b>어느 12건인지 알 방법이 없었다</b> — 서버가 짚어 준 행을 화면이 버렸다.
 *
 * <p>함께 잠그는 것이 하나 더 있다: <b>롤백 뒤에는 재조회하지 않는다.</b> 커밋된 것이 없어
 * 지울 성공 행이 없고, 재조회는 <b>실패한 행의 편집까지</b> 지워 재시도를 불가능하게 한다.
 */
describe('전건 롤백의 얼굴 — backend/row-transaction.md §7', () => {
  interface Row {
    ordNo: string;
  }

  const columns: ColumnDef<Row>[] = [{ field: 'ordNo', header: '주문번호', type: 'text' }];

  const READ = '/service/x/getList';
  const GO = '/service/x/go';
  const SAVE = '/service/x/save';
  const TITLE = '접수 상태가 아닌 주문이 있습니다';
  const REASON = '접수 상태가 아닙니다';

  /** 서버가 <b>행을 짚어</b> 되돌린 실패 — 순번은 보낸 배열의 것이다. */
  const pointed = () =>
    new ApiError({
      code: 'err.order.state',
      message: TITLE,
      status: 400,
      rows: [{ index: 1, fields: [{ field: 'ordNo', message: REASON, value: 'B' }] }],
    });

  /** 행을 못 짚은 실패 — 옛 응답이거나 행과 무관한 실패다. */
  const plain = () =>
    new ApiError({ code: 'err.unknown', message: '처리 중 오류가 발생했습니다', status: 500 });

  let controller: GridController<Row> | null = null;

  function Inner(props: { api: GridApi<Row>; saves?: boolean }) {
    controller = useGridController<Row>({
      menuCd: 'TEST',
      columns,
      api: props.api,
      toSaveRow: props.saves === true ? (row) => row.data : undefined,
    });
    return null;
  }

  /* 모달은 {@code App.useApp()} 이 준다 — 밖에서 부르면 정적 폴백이 와서 DOM 이 빈다. */
  function Harness(props: { api: GridApi<Row>; saves?: boolean }) {
    return (
      <App>
        <Inner api={props.api} saves={props.saves} />
      </App>
    );
  }

  const three = () => toRows<Row>([{ ordNo: 'A' }, { ordNo: 'B' }, { ordNo: 'C' }]);

  const settle = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  /** 실행 — {@code target: 'all'} 이라 화면의 세 행이 그대로 보낸 배열이 된다. */
  const actionApi = (): GridApi<Row> => ({
    read: { url: READ },
    actions: [{ key: 'go', label: 'go', url: GO, target: 'all', confirm: false }],
  });

  const runGo = async (api: GridApi<Row>) => {
    render(<Harness api={api} />);
    act(() => {
      controller?.setRows(three());
    });
    act(() => {
      void controller?.runAction('go');
    });
    await settle();
  };

  beforeEach(() => {
    post.mockReset();
    controller = null;
    useAuthStore.setState({ permissions: ['TEST:READ', 'TEST:SAVE', 'TEST:EXECUTE'] });
    useMessageStore.setState({
      status: 'ready',
      messages: {
        'grid.action.done': '실행했습니다',
        'grid.save.done': '저장했습니다',
        'grid.validation.count': '{count}건을 확인하세요',
        'grid.issue.column': '컬럼',
        'grid.issue.value': '값',
        'grid.issue.reason': '사유',
        'grid.issue.excel': '실패분 내려받기',
        'grid.confirm.ok': '확인',
      },
    });
  });

  it('실행이 전건 롤백되면 서버가 짚은 행을 표로 낸다', async () => {
    post.mockRejectedValue(pointed());

    await runGo(actionApi());

    // 제목은 서버가 완성한 문구다 — 표는 그 상세다(backend/packages.md).
    await waitFor(() => expect(screen.getAllByText(TITLE).length).toBeGreaterThan(0));
    expect(screen.getByText(REASON)).toBeTruthy();
    // 두 번째 행의 값이다 — 순번이 밀리면 엉뚱한 행이 빨개진다.
    expect(screen.getByText('B')).toBeTruthy();
  });

  /** <b>셀도 칠한다.</b> 표는 닫히고 나면 사라지지만 사용자가 고칠 자리는 그리드에 있다. */
  it('실행이 짚은 행의 셀을 칠한다', async () => {
    post.mockRejectedValue(pointed());

    await runGo(actionApi());

    await waitFor(() => expect(controller?.issues.length).toBe(1));
    expect(controller?.issues[0].rowId).toBe(controller?.rows[1].id);
    expect(controller?.issues[0].field).toBe('ordNo');
  });

  /**
   * <b>롤백 뒤에 재조회하지 않는다.</b> 아무것도 커밋되지 않았으므로 지울 성공 행이 없고,
   * 재조회는 화면에 남은 편집을 지워 <b>다시 낼 입력을 없앤다</b>.
   */
  it('실행이 롤백되면 재조회하지 않는다', async () => {
    post.mockRejectedValue(pointed());

    await runGo(actionApi());

    await waitFor(() => expect(screen.getAllByText(TITLE).length).toBeGreaterThan(0));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe(GO);
  });

  /**
   * 행을 못 짚은 실패는 <b>표를 만들지 않는다</b> — 빈 표를 띄우면 사용자가 고칠 것을
   * 찾다 못 찾는다.
   */
  it('행을 못 짚은 실행 실패는 평소의 오류 모달이다', async () => {
    post.mockRejectedValue(plain());

    await runGo(actionApi());

    await waitFor(() => expect(screen.getByText('처리 중 오류가 발생했습니다')).toBeTruthy());
    expect(screen.queryByText('사유')).toBeNull();
    expect(controller?.issues).toHaveLength(0);
  });

  /**
   * <b>전건 롤백에 더 필요하다.</b> 되돌아간 오백 행 전부가 다시 낼 것이므로, 사용자가
   * 고쳐야 하는 것은 <i>그중 어느 열둘인가</i> 하나다.
   */
  it('전건 롤백 표에도 실패분 내려받기가 있다', async () => {
    post.mockRejectedValue(pointed());

    await runGo(actionApi());

    await waitFor(() => expect(screen.getByText('실패분 내려받기')).toBeTruthy());
  });

  /** 저장은 원래 이 얼굴이었다 — 함수를 함께 쓰게 바꾸면서 <b>깨지지 않았나</b> 를 본다. */
  it('저장이 전건 롤백되면 같은 표다', async () => {
    post.mockRejectedValue(pointed());

    render(<Harness api={{ save: { url: SAVE, confirm: false } }} saves />);
    act(() => {
      controller?.setRows(three());
    });
    act(() => {
      // 값이 같으면 변경으로 치지 않는다 — 저장이 아예 나가지 않는다(rows.ts).
      if (controller) controller.edit(controller.rows[1].id, { ordNo: 'B2' });
    });
    act(() => {
      void controller?.save();
    });
    await settle();

    await waitFor(() => expect(screen.getAllByText(TITLE).length).toBeGreaterThan(0));
    expect(screen.getByText(REASON)).toBeTruthy();
  });
});
