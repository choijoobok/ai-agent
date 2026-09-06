import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFailures } from '@/shared/grid/excel/workbook';
import { readWorkbook, type ReadText } from '@/shared/excelupload/readWorkbook';
import type { ColumnDef } from '@/shared/grid/types';

interface Item {
  ordNo: string;
  qty: number;
}

/**
 * 실패한 행만 담은 파일 — backend/row-transaction.md §7.
 *
 * <p><b>이 파일이 잠그는 것 하나: 내려받은 것을 그대로 다시 올릴 수 있다.</b>
 *
 * <p>사유를 첫 시트에 열로 붙이고 싶어지는 것이 자연스러운데, 그러면 {@code readWorkbook}
 * 이 <b>양식이 다르다며 거절</b>한다 — 뒤에 붙은 열까지 세어 막도록 일부러 만들었기
 * 때문이다(조용히 버려지는 열을 없애려고). 그래서 사유는 <b>둘째 시트</b>로 간다.
 *
 * <p>둘 사이의 이 규약은 <b>두 파일에 나뉘어 있어</b> 한쪽만 고치면 조용히 깨진다. 왕복을
 * 실제로 돌려 보는 것이 그것을 잡는 유일한 방법이다.
 */
describe('실패분 파일 — backend/row-transaction.md §7', () => {
  const columns: ColumnDef<Item>[] = [
    { field: 'ordNo', header: '주문번호', type: 'text' },
    { field: 'qty', header: '수량', type: 'number' },
  ];

  const TEXT: FailureTextLike = { sheet: '실패 사유', row: '행', reason: '사유' };

  interface FailureTextLike {
    sheet: string;
    row: string;
    reason: string;
  }

  /** 읽는 쪽의 문구 — 갈래만 구분되면 된다(excelUpload.test.ts 와 같은 규약). */
  const readText: ReadText = {
    headerMismatch: (expected, actual) => `header:${expected}|${actual}`,
    tooManyRows: (max, count) => `tooMany:${max}:${count}`,
    notNumber: (value) => `notNumber:${value}`,
    notInteger: (value) => `notInteger:${value}`,
    notYn: (value) => `notYn:${value}`,
    unknownCode: (value) => `unknownCode:${value}`,
    ambiguousCode: (value) => `ambiguousCode:${value}`,
  };

  let saved: Blob | null = null;

  beforeEach(() => {
    saved = null;
    /*
      {@code saveBlob} 이 디스크로 보내는 자리를 가로챈다 — jsdom 에는 이 둘이 없다.
      파일 내용은 여기 잡힌 {@code Blob} 이 전부다.
    */
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        saved = blob;
        return 'blob:x';
      },
      revokeObjectURL: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const make = async (failures: { data: Item; reason: string }[]) => {
    await downloadFailures('SAMPLE_실패분', columns, failures, '20260906_1200', TEXT);
    if (saved === null) throw new Error('파일이 만들어지지 않았다');
    return saved.arrayBuffer();
  };

  const TWO = [
    { data: { ordNo: 'SO-1', qty: 3 }, reason: '접수 상태가 아닙니다' },
    { data: { ordNo: 'SO-2', qty: 5 }, reason: '재고가 모자랍니다' },
  ];

  /**
   * <b>왕복이다.</b> 만든 파일을 업로드 탭의 파서에 그대로 먹여 본다 — 이것이 통과해야
   * 사용자가 <i>고쳐서 그대로 다시 올리는</i> 동선이 성립한다.
   */
  it('내려받은 파일을 그대로 다시 읽을 수 있다', async () => {
    const outcome = await readWorkbook<Item>(await make(TWO), columns, 1000, readText);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.rows).toEqual([
      { ordNo: 'SO-1', qty: 3 },
      { ordNo: 'SO-2', qty: 5 },
    ]);
  });

  it('첫 시트의 머리는 양식 그대로다 — 사유 열이 붙지 않는다', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await make(TWO));
    const header = workbook.worksheets[0].getRow(1);

    expect(header.getCell(1).value).toBe('주문번호');
    expect(header.getCell(2).value).toBe('수량');
    // 셋째 칸이 비어 있어야 한다 — 여기에 `사유` 가 오면 다시 올릴 수 없다.
    expect(header.getCell(3).value).toBeNull();
  });

  /** 사유는 <b>둘째 시트</b>다 — 읽는 쪽은 첫 시트만 보므로 있어도 없는 것과 같다. */
  it('사유는 둘째 시트에 번호와 함께 있다', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await make(TWO));

    expect(workbook.worksheets).toHaveLength(2);
    const why = workbook.worksheets[1];
    expect(why.name).toBe('실패 사유');
    expect(why.getRow(1).getCell(1).value).toBe('행');
    expect(why.getRow(1).getCell(2).value).toBe('사유');
    // 번호는 첫 시트의 <b>데이터 줄</b>이다 — 머리글을 빼고 센다.
    expect(why.getRow(2).getCell(1).value).toBe(1);
    expect(why.getRow(3).getCell(2).value).toBe('재고가 모자랍니다');
  });

  /** 코드 컬럼은 <b>이름으로</b> 나간다 — 내려받기와 같은 규칙이어야 다시 올라간다. */
  it('코드는 화면에 보이는 이름으로 나간다', async () => {
    interface Coded {
      statCd: string;
    }
    const coded: ColumnDef<Coded>[] = [
      {
        field: 'statCd',
        header: '상태',
        type: 'code',
        options: [{ value: 'WAIT', text: '대기' }],
      },
    ];

    await downloadFailures('X', coded, [{ data: { statCd: 'WAIT' }, reason: 'r' }], 's', TEXT);
    if (saved === null) throw new Error('파일이 만들어지지 않았다');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await saved.arrayBuffer());

    expect(workbook.worksheets[0].getRow(2).getCell(1).value).toBe('대기');
  });
});
