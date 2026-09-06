import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { readWorkbook, type ReadText } from '@/shared/excelupload/readWorkbook';
import type { ColumnDef } from '@/shared/grid/types';

interface Item {
  ordNo: string | null;
  qty: number | null;
  statCd: string | null;
}

/*
  헤더가 <b>번역된 이름</b>이라야 한다 — 양식이 곧 ②의 전체 다운로드이고, 그쪽이
  {@code headerText()} 로 쓴다. 검사에서는 키가 안 풀려 원문이 그대로 나오므로 그것을
  기대값으로 쓴다.
*/
const columns: ColumnDef<Item>[] = [
  { field: 'ordNo', header: 'col.ordNo', type: 'text' },
  { field: 'qty', header: 'col.qty', type: 'number' },
  {
    field: 'statCd',
    header: 'col.statCd',
    type: 'code',
    options: [
      { value: 'RCV', text: '접수' },
      { value: 'CFM', text: '확정' },
    ],
  },
];

const text: ReadText = {
  headerMismatch: () => 'headerMismatch',
  tooManyRows: (max, count) => `tooManyRows:${max}:${count}`,
  notNumber: (value) => `notNumber:${value}`,
  notInteger: (value) => `notInteger:${value}`,
  notYn: (value) => `notYn:${value}`,
  unknownCode: (value) => `unknownCode:${value}`,
  ambiguousCode: (value) => `ambiguousCode:${value}`,
};

/** 실제 `.xlsx` 를 만든다 — 파싱을 흉내로 재면 <b>진짜 파일에서만 나는 어긋남</b>을 놓친다. */
async function file(rows: (string | number | null)[][], header = HEADER): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('s');
  sheet.addRow(header);
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

const HEADER = ['col.ordNo', 'col.qty', 'col.statCd'];

/**
 * 파일 → 행 — playbook/excel-upload.md · playbook/INDEX.md.
 *
 * <p><b>진짜 통합 지점이다.</b> `exceljs` 가 어떤 모양으로 셀을 주는지는 문서가 아니라
 * 실물이 답하며(문자열 · 숫자 · {@code Date} · 수식 객체), 여기서 흉내를 내면 <b>흉내가
 * 맞고 파일이 틀린</b> 상태를 통과시킨다.
 */
describe('엑셀 파일 읽기', () => {
  it('헤더가 맞으면 행을 읽는다', async () => {
    const outcome = await readWorkbook(await file([['A-1', 3, '접수']]), columns, 100, text);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.rows).toEqual([{ ordNo: 'A-1', qty: 3, statCd: 'RCV' }]);
    expect(outcome.issues).toEqual([]);
  });

  /*
    <b>어긋난 채로 읽으면 열이 하나 밀린다</b> — 수량 자리에 단가가 들어가고, 그 파일은
    저장까지 통과한다. 그래서 통째로 거절한다(playbook/INDEX.md).
  */
  it('헤더가 다르면 읽지 않는다 — 열이 밀린 파일은 저장까지 통과한다', async () => {
    const outcome = await readWorkbook(
      await file([['A-1', 3, '접수']], ['col.ordNo', 'col.statCd', 'col.qty']),
      columns,
      100,
      text,
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('header');
  });

  it('행이 상한을 넘으면 읽지 않는다 — 조용히 자르지 않는다', async () => {
    const rows = Array.from({ length: 5 }, (_row, index) => [`A-${index}`, 1, '접수']);

    const outcome = await readWorkbook(await file(rows), columns, 3, text);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('tooManyRows');
    expect(outcome.detail).toBe('tooManyRows:3:5');
  });

  /*
    <b>못 읽은 칸은 비우고 사유를 나른다.</b> 원본 글자를 남기면 숫자 컬럼에 글자가 든
    행이 저장 페이로드까지 가고, 조용히 {@code null} 로 떨어뜨리면 <i>비운 칸</i>과
    구별되지 않는다.
  */
  it('못 읽은 칸은 비우고 그 자리를 짚는다', async () => {
    const outcome = await readWorkbook(await file([['A-1', '세 개', '접수']]), columns, 100, text);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.rows[0].qty).toBeNull();
    expect(outcome.issues).toEqual([
      { rowId: 'x1', field: 'qty', message: 'notNumber:세 개' },
    ]);
  });

  /*
    <b>빈 줄은 행이 아니다.</b> 사람이 만진 파일에는 아래쪽에 빈 줄이 남고, 그것을 행으로
    세면 키가 전부 빈 신규 행이 생겨 <b>저장이 통째로 막힌다</b> — 사용자에게는 *고치지도
    않은 줄 때문에 저장이 안 된다* 로 보인다.
  */
  it('빈 줄은 건너뛴다', async () => {
    const outcome = await readWorkbook(
      await file([['A-1', 3, '접수'], [null, null, null], ['A-2', 4, '확정']]),
      columns,
      100,
      text,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.rows).toHaveLength(2);
  });
});
