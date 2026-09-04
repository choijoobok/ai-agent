import ExcelJS from 'exceljs';
import { headerText } from '@/shared/grid/cell';
import type { ColumnDef } from '@/shared/grid/types';
import { parseCell, type ParseText } from '@/shared/excelupload/parseCell';
import type { GridIssue } from '@/shared/grid/types';

/**
 * 파일 → 행 배열 — ADR-0024 · 68 §9.2 의 <i>하는 일 다섯</i> 중 1·2·5.
 *
 * <p><b>서버에 올리지 않는다</b>(ADR-0024 §3). 브라우저가 읽으므로 `SYS_FILE` 에 아무것도
 * 남지 않고, 업로드 엔드포인트도 없다 — 저장은 <b>업무 탭과 같은 `api.save`</b> 다.
 *
 * <p><b>양식이 곧 ②의 전체 다운로드다</b>(grid-standard.md §2.2 · 68 §8.2). 그래서 헤더는 컬럼의
 * <b>번역된 이름</b>이며, 다르면 <b>읽지 않는다</b>: 어긋난 채로 읽으면 열이 하나 밀려
 * <b>수량 자리에 단가가</b> 들어가고, 그 파일은 저장까지 통과한다.
 */

export type ReadOutcome<T> =
  | { ok: true; rows: T[]; issues: GridIssue[] }
  /** 파일을 <b>통째로 거절</b>한 경우 — 68 §8.7 의 예외 화면 둘이다. */
  | { ok: false; reason: 'header' | 'tooManyRows'; detail: string };

export interface ReadText extends ParseText {
  /** `{expected}` · `{actual}` — 무엇이 와야 했고 무엇이 왔나. */
  headerMismatch: (expected: string, actual: string) => string;
  /** `{max}` · `{count}` — 상한과 파일의 행 수. */
  tooManyRows: (max: number, count: number) => string;
}

/**
 * @param columns 업무 탭과 <b>같은 배열</b>이다 — 양식이 갈릴 수 없다(68 §9.2)
 * @param maxRows `ui.excel.max-rows`. 넘으면 <b>조용히 자르지 않고</b> 거절한다
 */
export async function readWorkbook<T>(
  buffer: ArrayBuffer,
  columns: ColumnDef<T>[],
  maxRows: number,
  text: ReadText,
): Promise<ReadOutcome<T>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  // 시트 하나짜리 양식이다 — 다운로드가 그렇게 만든다(`downloadExcel`).
  const sheet = workbook.worksheets[0];

  const expected = columns.map((column) => headerText(column));
  const actual = headerRow(sheet, expected.length);
  if (!sameHeader(expected, actual)) {
    return {
      ok: false,
      reason: 'header',
      detail: text.headerMismatch(expected.join(', '), actual.join(', ')),
    };
  }

  /*
    <b>헤더를 뺀 줄 수</b>다. {@code rowCount} 는 마지막으로 쓰인 행의 번호라, 사람이
    아래쪽 빈 칸을 한 번 눌렀다 지운 파일에서는 실제보다 크다 — 아래 루프가 <i>값이
    하나도 없는 줄</i>을 건너뛰므로 최종 건수는 다시 맞는다. 여기 상한은 <b>읽기 전에</b>
    막는 것이 목적이며(68 §8.7 — <i>읽지 않는다</i>), 크게 잡힌 쪽으로 틀리는 것이 안전하다.
  */
  const dataRows = Math.max(0, sheet.rowCount - 1);
  if (dataRows > maxRows) {
    return { ok: false, reason: 'tooManyRows', detail: text.tooManyRows(maxRows, dataRows) };
  }

  const rows: T[] = [];
  const issues: GridIssue[] = [];

  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const source = sheet.getRow(index);
    const data: Record<string, unknown> = {};
    let empty = true;

    columns.forEach((column, at) => {
      const cell: unknown = source.getCell(at + 1).value;
      const parsed = parseCell(column, cell, text);
      if (!parsed.ok) {
        /*
          <b>못 읽은 칸은 비운다.</b> 원본 글자를 남기면 컬럼의 타입과 어긋난 값이 행에
          들어가고, 그 행은 <i>숫자 컬럼에 글자가 든 채</i> 저장 페이로드까지 간다.
          사유는 아래 {@code issues} 가 나르며 셀에 붙는다(grid-edit-validation.md §3.3).
        */
        data[column.field] = null;
        issues.push({ rowId: `x${rows.length + 1}`, field: column.field, message: parsed.message });
        empty = false;
        return;
      }
      data[column.field] = parsed.value;
      if (parsed.value !== null) empty = false;
    });

    /*
      <b>빈 줄은 행이 아니다.</b> 사람이 만진 파일에는 아래쪽에 빈 줄이 남으며, 그것을
      행으로 세면 <b>키가 전부 빈 신규 행</b>이 생겨 저장이 통째로 막힌다 — 사용자에게는
      <i>고치지도 않은 줄 때문에 저장이 안 된다</i> 로 보인다.
    */
    if (empty) continue;
    rows.push(data as T);
  }

  return { ok: true, rows, issues };
}

/** 첫 줄 — <b>선언한 컬럼 수만큼</b>만 본다. 오른쪽에 붙은 메모 열은 양식의 일부가 아니다. */
function headerRow(sheet: ExcelJS.Worksheet, width: number): string[] {
  const row = sheet.getRow(1);
  const headers: string[] = [];
  /*
    <b>한 칸 더 읽는다</b>(2026-09-02 실물 — 68 §8 이 서면서 드러났다). 기대한 폭까지만
    읽으면 배열 길이가 <b>언제나 같아져</b> {@code sameHeader} 의 길이 비교가 죽은 검사가
    되고, <b>뒤에 열이 더 붙은 파일이 조용히 통과</b>한다.

    조용한 것이 문제다: 사용자가 양식에 메모 열을 하나 붙여 올리면 <i>읽었습니다</i> 만
    나오고 그 열은 <b>아무 데도 가지 않는다</b> — 저장까지 성공하므로 값이 사라졌다는
    사실을 아무도 모른다. 68 §8.7 은 <i>컬럼이 양식과 다른 파일은 읽지 않는다</i> 이며,
    <b>더 있는 것도 다른 것</b>이다.

    <b>빈 칸은 세지 않는다.</b> 사람이 만진 파일에는 헤더 오른쪽에 빈 칸이 남을 수 있고,
    그것까지 열로 세면 <b>멀쩡한 양식이 거절</b>된다.
  */
  for (let index = 1; index <= width + 1; index += 1) {
    const value: unknown = row.getCell(index).value;
    const header = typeof value === 'string' ? value.trim() : '';
    if (index > width && header === '') break;
    headers.push(header);
  }
  return headers;
}

/**
 * <b>순서까지 같아야 한다.</b> 이름만 맞고 순서가 다르면 열이 서로 바뀐 채 읽히는데,
 * 그 어긋남은 <i>값이 이상하다</i> 로만 보인다 — 수량과 단가가 자리를 맞바꾼 파일은
 * 금액이 그럴듯해서 눈으로 잡히지 않는다.
 *
 * <p><b>개수도 같아야 한다.</b> {@link headerRow} 가 한 칸 더 읽어 주므로 이 비교가 살아
 * 있으며, 없으면 뒤에 붙은 열이 조용히 버려진다(위).
 */
function sameHeader(expected: string[], actual: string[]): boolean {
  return expected.length === actual.length
    && expected.every((header, index) => header === actual[index]);
}
