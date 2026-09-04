import ExcelJS from 'exceljs';
import { cellValue as readCell } from '@/shared/grid/cell';
import type { ColumnDef } from '@/shared/grid/types';
import { recordDownload, type ExcelScope } from '@/shared/grid/excel/downloadLog';

/**
 * 엑셀 파일을 <b>브라우저에서 만든다</b> — ADR-0019.
 *
 * <p><b>왜 서버가 아닌가</b> — 현재 페이지는 이미 브라우저에 있는 데이터이므로 서버 생성이면
 * *다시 조회해서 다시 내려보내는* 일이 된다. 그리고 **마스킹이 자동으로 지켜진다**: 화면에
 * 마스킹된 값을 그대로 쓰므로 응답 직렬화 계층(27 §2)을 이미 통과한 값이다.
 *
 * <p><b>`exceljs` 다.</b> SheetJS(`xlsx`)는 npm 배포를 중단했고 registry 에 남은 마지막
 * 버전에 미수정 취약점이 있다 — 폐쇄망 빌드와 보안 검사 둘 다에서 막힌다(ADR-0019).
 *
 * <p><b>값은 화면의 어휘로 만든다</b>(grid-column-contract.md §5). 판(AG Grid)의 렌더러를 거치지 않는 이유는
 * *전체* 경로에 판이 없기 때문이다 — 거기서만 다른 규칙을 쓰면 두 파일의 같은 컬럼이
 * 다른 글자로 나온다.
 */

/** 파일에 실릴 컬럼 하나 — <b>보이는 것만, 보이는 순서로</b>다(grid-standard.md §2.2). */
export interface ExcelColumn<T> {
  column: ColumnDef<T>;
  header: string;
}

/**
 * 셀 하나의 글자 — <b>화면에 보이는 것</b>이다.
 *
 * <p>코드값 대신 이름을, 배열 대신 사람이 읽는 나열을 넣는다. *"화면에 없던 값이 파일에
 * 있다"* 도 *"화면의 이름이 파일에서는 코드"* 도 그 자체로 문의가 된다.
 */
export function cellValue<T>(column: ColumnDef<T>, row: T): string | number | boolean | null {
  // 파생·동적 컬럼의 읽는 규칙은 `cell.ts` 한 곳이다 — 여기서 따로 알면 셀에는 보이는데
  // 파일에는 빈 칸인 컬럼이 생긴다(grid-column-contract.md §2.2 · §3).
  const raw = readCell(column, row);

  if (raw === null || raw === undefined) return null;

  if (Array.isArray(raw)) {
    // `list` 컬럼 — 셀 하나에 여럿이 들어간다(grid-column-contract.md §5.6).
    return raw.map((item) => (column.display ? column.display(item) : String(item))).join(', ');
  }
  if (typeof raw === 'boolean') return raw ? 'Y' : 'N';
  /*
    <b>큰 정수는 숫자로 쓰지 않는다</b> — 68 §9.10.

    값은 이미 문자열로 왔지만(그것이 이 타입의 전부다) 여기서 아무 말도 하지 않으면
    아래 문자열 가지로 흘러 <b>지금은 맞게 동작한다</b> — 그리고 어느 날 서버가 숫자로
    내리기 시작하면 위의 {@code number} 가지가 그것을 조용히 받아 <b>엑셀에서 다시
    정밀도를 잃는다</b>. 파일은 화면과 달리 <i>나중에 다른 사람이</i> 여는 것이라
    그 손실은 아무에게도 보이지 않는다.
  */
  if (column.type === 'bigint' && (typeof raw === 'string' || typeof raw === 'number')) {
    return String(raw);
  }
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') {
    // 객체가 오면 빈 칸이다 — `[object Object]` 를 파일에 넣지 않는다(grid-column-contract.md §5.3).
    return null;
  }
  const option = column.options?.find((candidate) => candidate.value === raw);
  return option ? option.text : raw;
}

/**
 * 만들어서 내려받게 한다.
 *
 * <p><b>파일 이름에 시각을 붙인다</b> — 같은 화면을 두 번 내리면 브라우저가 `(1)` 을 붙여
 * 주지만, 그 둘 중 어느 것이 최신인지는 파일 목록만 봐서는 알 수 없다.
 *
 * @param scope 이력에 남길 갈래 — grid-standard.md §2.2 의 드롭다운 항목
 */
export async function downloadExcel<T>(
  baseName: string,
  columns: ExcelColumn<T>[],
  rows: T[],
  stamp: string,
  scope: ExcelScope,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(baseName.slice(0, 31));

  sheet.columns = columns.map((entry) => ({
    header: entry.header,
    key: entry.column.field,
    width: widthOf(entry.column),
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(
      Object.fromEntries(
        columns.map((entry) => [entry.column.field, cellValue(entry.column, row)]),
      ),
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], { type: XLSX_MIME }), `${baseName}_${stamp}.xlsx`);
  recordDownload(scope, rows.length, columns.map((entry) => entry.column.field));
}

/**
 * 컬럼 선언 없이 <b>이미 만들어진 표</b>를 내린다 — 62 §4.9 의 트리 엑셀이 요구했다.
 *
 * <p>위의 것과 갈리는 이유가 하나다. 트리는 <b>계층을 경로 컬럼으로</b> 펴는데(엑셀의
 * 들여쓰기는 필터·정렬 한 번에 무너진다) 그 컬럼은 <b>어느 행에도 없는 파생</b>이라
 * {@link ExcelColumn} 으로 표현할 자리가 없다 — `ColumnDef` 를 지어내면 화면에 없는
 * 컬럼 선언이 엑셀만을 위해 생긴다.
 *
 * <p><b>파일을 만드는 코드는 여전히 여기 하나다.</b> 갈리는 것은 <i>표를 어떻게 얻는가</i>
 * 이고, 시트·굵은 헤더·파일명 규칙은 위와 같은 것을 쓴다.
 */
export async function downloadRows(
  baseName: string,
  columns: PlainColumn[],
  rows: (string | number | null)[][],
  stamp: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(baseName.slice(0, 31));

  sheet.addRow(columns.map((column) => column.header));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  // 경로 컬럼이 길다 — 첫 칸만 넓히고 나머지는 판이 정하는 기본을 쓴다.
  sheet.getColumn(1).width = 48;

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], { type: XLSX_MIME }), `${baseName}_${stamp}.xlsx`);
  /*
    <b>트리는 언제나 전량이다</b>(62 §4.9) — 페이지가 없어 *현재 페이지* 와 *전체* 가 같고,
    그래서 버튼도 드롭다운을 열지 않는다(grid-standard.md §2.2).
  */
  recordDownload('ALL', rows.length, columns.map((column) => column.key));
}

/**
 * 표를 직접 만드는 쪽의 컬럼 — <b>키와 이름이 함께 온다</b>.
 *
 * <p>이력이 요구했다(ADR-0019 의 {@code columnKeys}). 헤더만 받던 때는 보낼 것이 <b>번역된
 * 이름</b>뿐이었는데, 그러면 같은 컬럼이 언어마다 다른 값으로 남아 <i>무엇을 내려받았나</i>
 * 를 세지 못한다. 키는 {@code ColumnDef.field} 와 같은 층이며 <b>파생 컬럼도 이름을
 * 갖는다</b>(트리의 경로 컬럼 — 어느 행에도 없지만 식별자는 있어야 한다).
 */
export interface PlainColumn {
  key: string;
  header: string;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 화면 폭(px)을 엑셀의 문자 폭으로 옮긴다 — 대략 7px 이 한 글자다. */
function widthOf<T>(column: ColumnDef<T>): number {
  return Math.min(60, Math.max(10, Math.round((column.width ?? 120) / 7)));
}

/**
 * 파일을 사용자의 디스크로 — <b>세 갈래가 같은 자리를 쓴다</b>.
 *
 * <p>서버 생성 경로도 이것을 부른다(ADR-0019). 저장하는 방법이 갈래마다 다르면 어느
 * 하나에서만 {@code revokeObjectURL} 을 빠뜨리는 날이 오고, 그 누수는 <b>탭이 닫힐
 * 때까지 파일 크기만큼</b>이라 눈에 띄지 않는다.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // 놓아주지 않으면 파일 크기만큼의 메모리가 탭이 닫힐 때까지 남는다.
  URL.revokeObjectURL(url);
}
