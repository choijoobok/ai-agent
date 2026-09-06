import { createElement, type ReactElement } from 'react';
import type { FieldError, RowError } from '@/shared/api';
import { cellValue, headerText } from '@/shared/grid/cell';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef, GridIssue } from '@/shared/grid/types';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 저장이 거부된 이유를 <b>표</b>로 만든다 — frontend/grid.md ④.
 *
 * <p><b>붉은 셀만으로는 부족하다.</b> 일괄 저장은 화면에 안 보이는 행까지 내보내고, 판이
 * 데려가는 것은 <i>첫</i> 실패 하나뿐이며, 셀 색은 눈치채지 못할 수 있다. 그래서 <b>무엇이
 * 몇 건인지</b> 를 글로도 말한다 — 둘은 경쟁하지 않는다.
 *
 * <p><b>행 번호 칸을 두지 않는다.</b> 판에 클라이언트 정렬이 걸리면 우리가 센 배열 순서와
 * 화면의 번호가 어긋나고, <i>틀린 번호는 없는 번호보다 나쁘다</i>. 어느 줄인지는 붉은
 * 셀이 말한다.
 *
 * <p><b>서버 실패와 화면 검증 실패가 같은 표를 쓴다.</b> 사용자에게 둘은 구분되지 않는
 * 사건이다 — <i>저장이 안 됐고 이유가 있다</i>. 표시가 갈리면 같은 일이 두 얼굴로 보인다.
 */

/** 표 한 줄. 셋 다 완성된 문자열이다 — 여기서 조립하지 않는다(backend/packages.md). */
export interface IssueEntry {
  column: string;
  value: string;
  message: string;
}

/**
 * <b>표가 스크롤되는 높이</b> — 열 줄쯤이다.
 *
 * <p>한때 <b>열 줄에서 잘라 버렸다</b>. 잘린 목록은 남은 것을 <i>볼 방법이 없고</i>, 그
 * 상태에서 사용자가 할 수 있는 일은 <b>고친 뒤 다시 저장해 보는 것</b>뿐이다 — 엑셀로
 * 오백 행을 올리고 중복 서른 건을 만난 자리에서 그것은 서른 번의 왕복이다.
 *
 * <p>그래서 <b>끊지 않고 스크롤한다.</b> 처음 보이는 양은 같으므로 흔한 경우(한두 건)의
 * 모달 크기는 그대로이고, 많을 때만 안에서 굴러간다.
 */
const TABLE_MAX_HEIGHT = 320;

/**
 * 그래도 <b>상한은 둔다</b> — 오천 건을 DOM 에 그리면 모달이 뜨는 데 시간이 걸린다.
 *
 * <p>이 수를 넘으면 남은 수만 말한다. 여기까지 왔다는 것은 <b>한 줄씩 고칠 상황이
 * 아니라</b>는 뜻이고, 그때 필요한 것은 목록이 아니라 <i>무엇이 얼마나 틀렸나</i> 다.
 */
const TABLE_ROWS = 200;

/**
 * 선 색은 <b>판이 쓰는 토큰</b>에서 온다 — `rgba(0,0,0,…)` 은 다크 모드에서 <b>검정 위의
 * 검정</b>이라 표가 줄 없는 글 뭉치가 된다(theme.md).
 *
 * <p>토큰은 훅으로만 얻을 수 있고 이 파일에는 컴포넌트가 없으므로 <b>인자로 받는다</b>.
 */
export interface IssueTableColors {
  /** 머리 아래 굵은 선 — 글자에 가깝게 둔다. */
  head: string;
  /** 행 사이 선. */
  row: string;
  /** 머리글의 배경 — 스크롤할 때 행이 그 아래로 지나가야 한다. */
  bg: string;
}

function th(colors: IssueTableColors): React.CSSProperties {
  return {
    textAlign: 'left',
    padding: '4px 8px',
    borderBottom: `1px solid ${colors.head}`,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    /*
      <b>굴러가도 머리는 남는다.</b> 스무 줄째에서 가운데 칸이 *값* 인지 *사유* 인지
      알 수 없으면 표가 아니라 글 뭉치다. 배경을 함께 주지 않으면 <b>지나가는 행이
      머리글에 겹쳐 보인다</b> — 투명한 sticky 의 언제나 같은 함정이다.
    */
    position: 'sticky',
    top: 0,
    background: colors.bg,
  };
}

function td(color: string): React.CSSProperties {
  return {
    textAlign: 'left',
    padding: '4px 8px',
    borderBottom: `1px solid ${color}`,
    verticalAlign: 'top',
    /*
      <b>{@code break-all} 이 아니다.</b> 그것은 넘치지 않아도 아무 데서나 끊어
      {@code SO-2026-1005} 를 <i>SO-202</i> / <i>6-1005</i> 로 갈라 놓는다 — 값은 사용자가
      <b>화면에서 찾아야 하는 문자열</b>이라 모양이 유지돼야 한다.

      {@code anywhere} 는 <b>넘칠 때만</b> 끊는다. 한글은 원래 아무 데서나 접히므로
      사유 문구는 어느 쪽이든 같고, 갈리는 것은 코드값 쪽이다.
    */
    overflowWrap: 'anywhere',
  };
}

/**
 * 표에 실을 수 있는 값만 글자로 바꾼다.
 *
 * <p><b>객체는 빈 칸이다.</b> `[object Object]` 는 사용자에게 아무 말도 하지 않으면서
 * <i>값이 있다</i> 고 주장해 접기 판정까지 뒤집는다 — 없는 것으로 두는 편이 정확하다.
 */
function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

/**
 * <b>같은 줄은 한 번만</b> — 그리고 그것이 곧 *값이 있으면 펴고 없으면 접는다* 가 된다.
 *
 * <p>필수값 누락은 값이 비어 있어 열 행이 <b>같은 줄</b>을 만들므로 하나로 접힌다(고치는
 * 일이 하나다). 중복·형식 위반은 행마다 값이 달라 <b>펴진다</b> — 값 하나하나가 별개의
 * 사건이고, 사용자가 그 값들을 각각 고쳐야 하기 때문이다.
 */
export function collapse(entries: IssueEntry[]): IssueEntry[] {
  const seen = new Map<string, IssueEntry>();
  for (const entry of entries) {
    // 구분자를 손으로 고르지 않는다 — 어떤 문자를 골라도 값 안에 그것이 들어올 수 있다.
    const key = JSON.stringify([entry.column, entry.value, entry.message]);
    if (!seen.has(key)) seen.set(key, entry);
  }
  return [...seen.values()];
}

/** 화면 검증 실패 → 표. 값은 <b>사용자가 지금 보고 있는 것</b>을 그대로 읽는다. */
export function entriesOfIssues<T>(
  issues: GridIssue[],
  rows: GridRow<T>[],
  columns: ColumnDef<T>[],
): IssueEntry[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const byField = new Map(columns.map((column) => [column.field, column]));

  return issues.map((issue) => {
    const column = issue.field === undefined ? undefined : byField.get(issue.field);
    const row = byId.get(issue.rowId);
    return {
      column: column ? headerText(column) : '',
      value: column && row ? text(cellValue(column, row.data)) : '',
      message: issue.message,
    };
  });
}

/**
 * 서버 실패 → 붉힐 셀과 표.
 *
 * <p><b>{@code sent} 가 `null` 이면 셀을 칠하지 않는다.</b> 서버는 <i>요청 배열의 몇 번째</i>
 * 로 행을 가리키는데, 그 배열을 화면이 만들었다면({@code toSavePayload}) 순번이 화면의 어느
 * 행인지 배관은 알 수 없다 — <b>틀린 행을 칠하느니 칠하지 않는다</b>. 표는 그대로 낸다.
 *
 * <p>값은 행을 되찾았으면 <b>화면의 것</b>을, 못 되찾았으면 서버가 실어 보낸
 * {@link FieldError.value} 를 쓴다.
 */
export function serverIssues<T>(
  failures: RowError[],
  fields: FieldError[],
  sent: GridRow<T>[] | null,
  columns: ColumnDef<T>[],
): { issues: GridIssue[]; entries: IssueEntry[] } {
  const byField = new Map(columns.map((column) => [column.field, column]));
  const issues: GridIssue[] = [];
  const entries: IssueEntry[] = [];

  for (const failure of failures) {
    const row = sent === null ? undefined : sent[failure.index];
    for (const failed of failure.fields) {
      const column = byField.get(failed.field);
      if (row) {
        // 판에 없는 컬럼을 가리키면 행만 표시한다 — 없는 칸을 칠할 수는 없다.
        issues.push({
          rowId: row.id,
          field: column ? failed.field : undefined,
          message: failed.message,
        });
      }
      entries.push({
        column: column ? headerText(column) : failed.field,
        value: column && row ? text(cellValue(column, row.data)) : text(failed.value),
        message: failed.message,
      });
    }
  }

  // 행에 매이지 않은 실패 — 단건 저장의 필드 오류가 이쪽이다(backend/api.md).
  for (const failed of fields) {
    const column = byField.get(failed.field);
    entries.push({
      column: column ? headerText(column) : failed.field,
      value: text(failed.value),
      message: failed.message,
    });
  }

  return { issues, entries };
}

/** 표 하나 — 첫 줄이 건수이고 열 줄을 넘으면 남은 수만 말한다. */
export function issueTable(entries: IssueEntry[], colors: IssueTableColors): ReactElement {
  const collapsed = collapse(entries);
  const shown = collapsed.slice(0, TABLE_ROWS);
  const rest = collapsed.length - shown.length;

  const head = createElement(
    'tr',
    null,
    createElement('th', { style: th(colors) }, label(MSG.GRID_ISSUE_COLUMN)),
    createElement('th', { style: th(colors) }, label(MSG.GRID_ISSUE_VALUE)),
    createElement('th', { style: th(colors) }, label(MSG.GRID_ISSUE_REASON)),
  );

  const body = shown.map((entry, index) =>
    createElement(
      'tr',
      { key: `${index}` },
      createElement('td', { style: td(colors.row) }, entry.column),
      createElement('td', { style: td(colors.row) }, entry.value),
      createElement('td', { style: td(colors.row) }, entry.message),
    ),
  );

  const children: ReactElement[] = [
    createElement(
      'div',
      { key: 'count', style: { marginBottom: 8 } },
      label(MSG.GRID_VALIDATION_COUNT, { count: collapsed.length }),
    ),
    createElement(
      'div',
      {
        key: 'scroll',
        /*
          <b>가로 스크롤은 만들지 않는다.</b> 오류 모달에서 옆으로 미는 일은 <i>고치는
          일</i> 과 아무 상관이 없고, 사유 칸이 오른쪽으로 사라지면 표가 무용해진다.
          아래 {@code tableLayout: 'fixed'} 가 칸 폭을 미리 정해 <b>넘칠 일 자체를
          없앤다</b> — 이 {@code hidden} 은 그것이 어긋났을 때의 마지막 방어다.
        */
        style: { maxHeight: TABLE_MAX_HEIGHT, overflowY: 'auto', overflowX: 'hidden' },
      },
      createElement(
        'table',
        {
          style: {
            width: '100%',
            borderCollapse: 'collapse',
            /*
              <b>칸 폭을 내용이 정하지 않게 한다.</b> 자동 배치는 긴 값 하나가 표를
              밀어내고, 그때 넘치는 것은 <b>맨 오른쪽의 사유</b>다 — 사용자가 가장
              읽어야 하는 칸이다.
            */
            tableLayout: 'fixed',
          },
        },
        createElement(
          'colgroup',
          null,
          // 사유가 가장 넓다 — 문장이고 나머지 둘은 이름과 값이다.
          createElement('col', { key: 'c', style: { width: '24%' } }),
          createElement('col', { key: 'v', style: { width: '28%' } }),
          createElement('col', { key: 'm', style: { width: '48%' } }),
        ),
        createElement('thead', null, head),
        createElement('tbody', null, body),
      ),
    ),
  ];

  if (rest > 0) {
    children.push(
      createElement(
        'div',
        { key: 'more', style: { marginTop: 8 } },
        label(MSG.GRID_VALIDATION_MORE, { count: rest }),
      ),
    );
  }

  return createElement('div', null, children);
}
