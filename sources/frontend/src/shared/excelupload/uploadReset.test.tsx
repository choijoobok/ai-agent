import { App } from 'antd';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExcelUploadTab, type ExcelUploadTabHandle } from '@/shared/excelupload/ExcelUploadTab';
import type { ColumnDef } from '@/shared/grid/types';
import { useAuthStore } from '@/shared/stores/authStore';
import { useMessageStore } from '@/shared/i18n/messageStore';

const post = vi.fn();

vi.mock('@/shared/api/request', () => ({
  post: (url: string, body?: unknown) => post(url, body) as Promise<unknown>,
  get: vi.fn(),
  request: vi.fn(),
}));

/*
  <b>파일을 진짜로 읽지 않는다.</b> 이 파일이 보는 것은 <i>저장이 끝난 뒤</i> 이고, 파싱은
  excelUpload.test.ts 와 readWorkbook.test.ts 가 이미 잠근다 — 여기서 xlsx 를 만들면
  시험이 느려지고 깨질 자리가 둘로 는다.
*/
vi.mock('@/shared/excelupload/readWorkbook', () => ({
  readWorkbook: () => Promise.resolve({ ok: true, rows: [{ ordNo: 'A' }, { ordNo: 'B' }], issues: [] }),
}));

/**
 * 엑셀 업로드가 <b>저장에 성공한 뒤</b> — backend/row-transaction.md §7.
 *
 * <p><b>업무 탭에는 재조회가 있고 여기에는 없다.</b> 그래서 아무것도 하지 않으면 방금 올린
 * 파일이 판에 그대로 남고, 사용자에게 그것은 <i>저장이 안 된 것</i> 과 구분되지 않는다 —
 * 그 상태로 저장을 한 번 더 누르면 <b>전부 중복으로 걸린다</b>.
 *
 * <p>반대로 <b>실패하면 비우지 않는다.</b> 전건 롤백이라 화면에 있는 것이 곧 다시 낼
 * 입력이고, 그것을 지우면 사용자는 파일을 처음부터 다시 올려야 한다.
 */
describe('엑셀 업로드의 저장 뒤 — backend/row-transaction.md §7', () => {
  interface Item {
    ordNo: string;
  }

  const columns: ColumnDef<Item>[] = [{ field: 'ordNo', header: '주문번호', type: 'text' }];

  const READ = '/service/x/getList';
  const SAVE = '/service/x/save';
  const PICK = '파일 선택';
  const SAVE_LABEL = '저장';
  const OK = '확인';

  const emptyPage = {
    mode: 'all',
    content: [],
    size: null,
    hasNext: false,
    totalElements: 0,
    totalPages: null,
    nextCursor: null,
    prevCursor: null,
  };

  let handle: React.RefObject<ExcelUploadTabHandle | null> | null = null;

  function Harness() {
    const ref = useRef<ExcelUploadTabHandle | null>(null);
    handle = ref;
    return (
      <App>
        <ExcelUploadTab<Item>
          title="업로드"
          menuCd="TEST"
          columns={columns}
          keyFields={['ordNo']}
          read={{ url: READ }}
          save={{ url: SAVE, confirm: false }}
          toSaveRow={(row) => row.data}
          handleRef={ref}
          height={200}
        />
      </App>
    );
  }

  /**
   * 파일 하나를 흘려 넣는다 — 읽기는 모킹돼 있으므로 <b>내용은 상관없다</b>.
   *
   * <p>{@code dirty} 로 확인하는 것이 결정이다. 판이 무엇을 그렸나가 아니라 <b>미저장이
   * 남았나</b> 가 이 화면의 관심사이고, 그것이 곧 탭을 닫을 때 사용자가 보는 것이다.
   */
  const load = async () => {
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error('파일 입력이 없다');
    const file = new File([new ArrayBuffer(8)], 'x.xlsx');
    act(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => expect(handle?.current?.dirty()).toBe(true));
  };

  const clickSave = async () => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(SAVE_LABEL) }));
    await act(async () => {
      await Promise.resolve();
    });
  };

  const clickOk = () => {
    act(() => {
      screen.getAllByRole('button', { name: new RegExp(OK) })[0].click();
    });
  };

  beforeEach(() => {
    post.mockReset();
    handle = null;
    useAuthStore.setState({
      permissions: ['TEST:READ', 'TEST:SAVE'],
      excelMaxUploadRows: 1000,
    });
    useMessageStore.setState({
      status: 'ready',
      messages: {
        'excel.upload.pick': PICK,
        'excel.upload.loaded': '{count}건을 읽었습니다',
        'grid.save': SAVE_LABEL,
        'grid.save.done': '저장했습니다',
        'grid.confirm.ok': OK,
      },
    });
  });

  it('전건 성공이면 올린 파일을 판에서 비운다', async () => {
    post.mockImplementation((url: string) =>
      url === READ ? Promise.resolve(emptyPage) : Promise.resolve(null),
    );

    render(<Harness />);
    await load();
    await clickSave();

    await waitFor(() => expect(screen.getByText('저장했습니다')).toBeTruthy());
    clickOk();

    // 비었으므로 미저장이 없다 — 탭을 닫아도 묻지 않는다.
    await waitFor(() => expect(handle?.current?.dirty()).toBe(false));
  });

  /** 전건 롤백이다 — 화면에 있는 것이 곧 <b>다시 낼 입력</b>이고, 지우면 처음부터다. */
  it('저장이 실패하면 비우지 않는다', async () => {
    post.mockImplementation((url: string) =>
      url === READ ? Promise.resolve(emptyPage) : Promise.reject(new Error('안 됩니다')),
    );

    render(<Harness />);
    await load();
    await clickSave();

    await waitFor(() => expect(screen.getByText(/안 됩니다/)).toBeTruthy());
    expect(handle?.current?.dirty()).toBe(true);
  });
});
