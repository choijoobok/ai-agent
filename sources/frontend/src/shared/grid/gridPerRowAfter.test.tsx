import { App } from 'antd';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toRows } from '@/shared/grid/rows';
import { useGridController, type GridController } from '@/shared/grid/useGridController';
import type { ColumnDef, GridApi, PerRowSpec } from '@/shared/grid/types';
import { useAuthStore } from '@/shared/stores/authStore';
import { useMessageStore } from '@/shared/i18n/messageStore';

const post = vi.fn();

vi.mock('@/shared/api/request', () => ({
  post: (url: string, body?: unknown) => post(url, body) as Promise<unknown>,
  get: vi.fn(),
  request: vi.fn(),
}));

/**
 * 건별 처리가 끝난 뒤 <b>그리드를 어떻게 하나</b> — backend/row-transaction.md §7.
 *
 * <p><b>정답이 하나가 아니라 기본값이 없다.</b> 서버가 정한 값을 보여 줘야 하는 화면과
 * 실패한 편집을 지켜야 하는 화면이 반대 방향을 원한다 — 기본값을 두면 아무도 고르지 않고
 * 둘 중 하나가 <b>조용히 틀린 화면</b>이 된다.
 *
 * <p>이 파일이 잠그는 것 —
 *
 * <ol>
 *   <li>{@code 'keepFailed'} 는 <b>실패한 행만</b> 남긴다 — 성공한 행도 손대지 않은 행도 비운다
 *   <li>비웠으면 <b>말한다</b>. 말하지 않으면 사용자는 나머지도 실패한 줄 안다
 *   <li>비운 뒤에 <b>재조회하지 않는다</b> — 방금 남긴 것을 지우게 된다
 *   <li>{@code 'reload'} 는 실패가 있어도 <b>보던 자리를 다시 읽는다</b>
 *   <li><b>전건 성공은 선언과 무관하다</b> — 남길 실패가 없으므로 평소대로 재조회한다
 * </ol>
 */
describe('건별 처리의 뒤처리 — backend/row-transaction.md §7', () => {
  interface Row {
    ordNo: string;
  }

  const columns: ColumnDef<Row>[] = [{ field: 'ordNo', header: '주문번호', type: 'text' }];

  const READ = '/service/x/getList';
  const GO = '/service/x/go';
  const SAVE = '/service/x/save';
  const OK = '확인';
  const KEPT = '비웠습니다';

  const report = (total: number, failures: number[]) => ({
    total,
    done: total - failures.length,
    failed: failures.length,
    rows: failures.map((index) => ({
      index,
      fields: [{ field: 'ordNo', message: '접수 상태가 아닙니다', value: `X${index}` }],
    })),
  });

  const readPage = () => ({
    mode: 'offset',
    content: [{ ordNo: 'Z' }],
    size: 10,
    hasNext: false,
    totalElements: 1,
    totalPages: 1,
    nextCursor: null,
    prevCursor: null,
  });

  let controller: GridController<Row> | null = null;

  function Inner(props: { api: GridApi<Row>; payload?: boolean }) {
    controller = useGridController<Row>({
      menuCd: 'TEST',
      columns,
      api: props.api,
      /*
        <b>{@code toSavePayload} 는 순번을 믿지 않는 길</b>이다 — 화면이 배열을 만들면
        배관은 걸러 냈는지 정렬했는지 알 수 없다(useGridController.ts 의 sent).
      */
      toSaveRow: props.payload === true ? undefined : (row) => row.data,
      toSavePayload: props.payload === true ? (made) => ({ rows: made.length }) : undefined,
    });
    return null;
  }

  function Harness(props: { api: GridApi<Row>; payload?: boolean }) {
    return (
      <App>
        <Inner api={props.api} payload={props.payload} />
      </App>
    );
  }

  const actionApi = (after: PerRowSpec['after']): GridApi<Row> => ({
    read: { url: READ },
    actions: [
      { key: 'go', label: 'go', url: GO, target: 'all', confirm: false, perRow: { after } },
    ],
  });

  const saveApi = (after: PerRowSpec['after']): GridApi<Row> => ({
    read: { url: READ },
    save: { url: SAVE, confirm: false, perRow: { after } },
  });

  const four = () =>
    toRows<Row>([{ ordNo: 'A' }, { ordNo: 'B' }, { ordNo: 'C' }, { ordNo: 'D' }]);

  const settle = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  /** 결과 모달의 <i>확인</i> — 누르지 않으면 뒤처리가 시작되지 않는다. */
  const clickOk = () => {
    act(() => {
      screen.getAllByRole('button', { name: new RegExp(OK) })[0].click();
    });
  };

  const runGo = async (api: GridApi<Row>) => {
    render(<Harness api={api} />);
    act(() => {
      controller?.setRows(four());
    });
    act(() => {
      void controller?.runAction('go');
    });
    await settle();
  };

  /** 넷 중 둘만 고친다 — 보내는 것은 <b>변경된 둘</b> 뿐이다. */
  const saveTwoEdits = async (api: GridApi<Row>, payload?: boolean) => {
    render(<Harness api={api} payload={payload} />);
    act(() => {
      controller?.setRows(four());
    });
    act(() => {
      if (!controller) return;
      controller.edit(controller.rows[0].id, { ordNo: 'A2' });
      controller.edit(controller.rows[1].id, { ordNo: 'B2' });
    });
    act(() => {
      void controller?.save();
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
        'grid.partial.title': '처리 결과',
        'grid.partial.summary': '총 {total}건 · 성공 {done}건 · 실패 {failed}건',
        'grid.partial.kept': '{count}건을 목록에서 비웠습니다. 남은 {failed}건을 고치세요.',
        'grid.issue.column': '컬럼',
        'grid.issue.value': '값',
        'grid.issue.reason': '사유',
        'grid.issue.excel': '실패분 내려받기',
        'grid.confirm.ok': OK,
      },
    });
  });

  /**
   * <b>성공한 행만 지우는 것이 아니다.</b> 손대지 않은 행도 함께 비운다 — 남은 목록이
   * 곧 <i>할 일 목록</i> 이어야 하고, 거기에 이미 끝난 것이 섞이면 사용자가 다시 고른다.
   */
  it('keepFailed 는 실패한 행만 남기고 나머지를 비운다', async () => {
    post.mockResolvedValue(report(4, [2]));

    await runGo(actionApi('keepFailed'));

    await waitFor(() => expect(controller?.rows).toHaveLength(1));
    expect(controller?.rows[0].data.ordNo).toBe('C');
  });

  /** 저장은 <b>변경된 행만</b> 보낸다 — 그래서 비워지는 것이 성공 건수보다 많다. */
  it('저장의 keepFailed 는 미변경 행까지 비운다', async () => {
    post.mockResolvedValue(report(2, [1]));

    await saveTwoEdits(saveApi('keepFailed'));

    // 넷 중 둘을 보냈고 그중 하나가 실패했다 — 남는 것은 그 하나뿐이다.
    await waitFor(() => expect(controller?.rows).toHaveLength(1));
    expect(controller?.rows[0].data.ordNo).toBe('B2');
  });

  /** <b>말하지 않으면 사라진 것으로 보인다.</b> 남은 것이 고칠 것이라는 사실은 배관만 안다. */
  it('비웠으면 표 아래에서 그 사실을 말한다', async () => {
    post.mockResolvedValue(report(4, [2]));

    await runGo(actionApi('keepFailed'));

    await waitFor(() => expect(screen.getByText(/3건을 목록에서 비웠습니다/)).toBeTruthy());
  });

  /** 전건 실패면 비운 것이 없다 — 그때 비웠다고 하면 <b>사실이 아닌 안내</b>다. */
  it('비운 것이 없으면 안내하지 않는다', async () => {
    post.mockResolvedValue(report(4, [0, 1, 2, 3]));

    await runGo(actionApi('keepFailed'));

    await waitFor(() => expect(screen.getByText('총 4건 · 성공 0건 · 실패 4건')).toBeTruthy());
    expect(screen.queryByText(new RegExp(KEPT))).toBeNull();
    expect(controller?.rows).toHaveLength(4);
  });

  /** <b>비운 뒤에 칠한다.</b> {@code setRows} 가 표시를 지우므로 순서가 뒤집히면 셀이 빈다. */
  it('비운 뒤에도 실패한 셀이 칠해져 있다', async () => {
    post.mockResolvedValue(report(4, [2]));

    await runGo(actionApi('keepFailed'));

    await waitFor(() => expect(controller?.issues).toHaveLength(1));
    expect(controller?.issues[0].rowId).toBe(controller?.rows[0].id);
  });

  /** 방금 남긴 것을 재조회가 지우면 <b>비운 의미가 사라진다</b>. */
  it('keepFailed 는 재조회하지 않는다', async () => {
    post.mockResolvedValue(report(4, [2]));

    await runGo(actionApi('keepFailed'));
    await waitFor(() => expect(screen.getAllByText('처리 결과').length).toBeGreaterThan(0));
    clickOk();

    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    expect(controller?.rows).toHaveLength(1);
  });

  /**
   * <b>저장 쪽도 따로 잠근다.</b> 갈림이 하나뿐인 코드라 함께 두기 쉬운데, 둘 중 하나만
   * 잠그면 나머지가 조용히 뒤집힌다 — 이 시험이 없을 때 실제로 <i>저장의 keepFailed 가
   * 재조회한다</i> 는 변형이 살아남았다.
   */
  it('저장의 keepFailed 도 재조회하지 않는다', async () => {
    post.mockImplementation((url: string) =>
      Promise.resolve(url === READ ? readPage() : report(2, [1])),
    );

    await saveTwoEdits(saveApi('keepFailed'));
    await waitFor(() => expect(screen.getAllByText('처리 결과').length).toBeGreaterThan(0));
    clickOk();

    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    expect(controller?.rows).toHaveLength(1);
  });

  /**
   * <b>표는 읽을 수는 있어도 고쳐서 다시 낼 수는 없다.</b> 화면에서 원본 파일로 옮겨 적는
   * 일이 남고, 그 옮겨 적기가 새로운 오타를 만든다.
   */
  it('결과 표 아래에 실패분 내려받기가 있다', async () => {
    post.mockResolvedValue(report(4, [2]));

    await runGo(actionApi('keepFailed'));

    await waitFor(() => expect(screen.getByText('실패분 내려받기')).toBeTruthy());
  });

  /** {@code 'reload'} 는 반대다 — 서버가 정한 값을 보여 주는 대신 편집을 버린다. */
  it('reload 는 실패가 있어도 보던 자리를 다시 읽는다', async () => {
    post.mockImplementation((url: string) =>
      Promise.resolve(url === READ ? readPage() : report(4, [2])),
    );

    await runGo(actionApi('reload'));
    await waitFor(() => expect(screen.getAllByText('처리 결과').length).toBeGreaterThan(0));
    clickOk();

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][0]).toBe(READ);
  });

  /**
   * <b>전건 성공은 선언과 무관하다.</b> 남길 실패가 없으므로 평소의 {@code reloadAfter}
   * 규칙대로 간다 — 여기서 비우면 <b>다 된 일 뒤에 빈 화면</b>이 남는다.
   */
  it('전건 성공이면 keepFailed 여도 재조회한다', async () => {
    post.mockImplementation((url: string) =>
      Promise.resolve(url === READ ? readPage() : report(4, [])),
    );

    await runGo(actionApi('keepFailed'));
    await waitFor(() => expect(screen.getByText('실행했습니다')).toBeTruthy());
    clickOk();

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][0]).toBe(READ);
    expect(controller?.rows[0].data.ordNo).toBe('Z');
  });

  /**
   * 순번 대응이 서지 않으면 <b>비우지 않는다</b>. 화면이 배열을 직접 만들었으면 걸러 냈는지
   * 정렬했는지 배관은 알 수 없고, 그 상태로 비우면 <b>엉뚱한 행을 지운다</b>.
   */
  it('toSavePayload 로 보낸 저장은 비우지 않고 개발자에게 말한다', async () => {
    const complain = vi.spyOn(console, 'error').mockImplementation(() => {});
    post.mockResolvedValue(report(2, [1]));

    await saveTwoEdits(saveApi('keepFailed'), true);

    await waitFor(() => expect(complain).toHaveBeenCalledTimes(1));
    expect(controller?.rows).toHaveLength(4);
    /*
      <b>내려받기도 달지 않는다.</b> 행을 되찾을 수 없으면 파일에 실을 것이 사유뿐이고,
      그것은 표가 이미 보여 주고 있다 — 같은 것을 파일로 한 번 더 주는 셈이 된다.
    */
    expect(screen.queryByText('실패분 내려받기')).toBeNull();
  });
});
