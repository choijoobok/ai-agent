import { useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type { ColumnDef, GridIssue, SelectOption } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { CONFIG_ENDPOINTS } from '@/features/config/api/endpoints';
import { getConfigPrefixes } from '@/features/config/api/configApi';
import type { ConfigRow, ConfigValueType } from '@/features/config/types';

/**
 * `CONFIG_MGMT` — 63 §4. <b>목록이 아우터 조인이다.</b>
 *
 * <pre>
 * yml 이 정한 키 목록   LEFT OUTER JOIN   SYS_CONFIG   ON key
 * </pre>
 *
 * <p><b>왼쪽 테이블이 코드에 있다는 것이 이 화면의 전부다.</b> 행 수는 설정 키 수로
 * 고정이며 `SYS_CONFIG` 의 행 수와 무관하다 — 오른쪽이 비어 있는 것이 <b>정상</b>이고,
 * 그 비어 있음은 *값이 없다* 가 아니라 <b>*아무도 안 바꿨다*</b> 를 뜻한다.
 *
 * <p><b>행을 더할 수 없다.</b> `addRow` 를 선언하지 않는다(grid-api-contract.md §3.6) — 왼쪽에 없는 키를
 * 넣으면 <b>아무 데도 읽히지 않는 행</b>이 생기고, 그것은 *저장은 되고 동작하지 않는*
 * 가장 나쁜 실패다(grid-column-contract.md §5.7).
 *
 * <p><b>지우기가 아니라 되돌리기다.</b> 행을 지우면 값이 사라지는 것이 아니라 `yml` 이
 * 드러나며(63 §4.4), 그래서 목록에서 그 행이 <b>사라지지 않는다</b> — 이 화면만의
 * 성질이고 라벨이 그 기대를 만든다.
 *
 * <p><b>화면이 아는 것은 유형까지다</b>(63 §4.5). `@Min` 도 상호 제약도 여기 옮겨 적지
 * 않는다 — 제약의 단일 원본은 서버의 바인딩 객체이고(43 §6.2), 복제하면 어긋날 때 어느
 * 쪽이 맞는지 알 수 없다. 서버의 거부는 <b>그 셀로 되돌아온다</b>(grid-edit-validation.md §3.4).
 *
 * <p><b>엑셀이 없다</b> — 감춘 것이 아니라 `EXPORT` 액션 자체가 없다(52 §4.2).
 */

const MENU_CD = 'CONFIG_MGMT';

/** `auth.password.admin-reset-enabled` 를 끄면 <b>잠긴 계정을 풀 수 없다</b> — 43 §6.3. */
const ADMIN_RESET_KEY = 'auth.password.admin-reset-enabled';

const TYPE_LABEL: Record<ConfigValueType, string> = {
  STRING: MSG.CONFIG_TYPE_STRING,
  NUMBER: MSG.CONFIG_TYPE_NUMBER,
  BOOLEAN: MSG.CONFIG_TYPE_BOOLEAN,
  JSON: MSG.CONFIG_TYPE_JSON,
};

export function ConfigMgmtPage() {
  const searchForm = useRef<SearchFormHandle>(null);

  const header = useSearchFormHeader();

  /*
    <b>매 렌더 새 함수를 넘기지 않는다.</b> 조회 콜백이 새것이면 컨트롤러 안의
    {@code read}·{@code save} 가 전부 새것이 되고, 그 봉투를 파생시키는 화면의
    {@code useMemo} 도 함께 다시 돈다 — 셸이 1초마다 다시 그리므로 그 연쇄도 초당 한 번이다.
    폼은 {@code ref} 로 읽으므로 의존이 없다.
  */
  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  const columns = useMemo(() => buildColumns(), []);

  // 선언이지 값이 아니다 — 매 렌더 새 객체를 만들면 컨트롤러의 콜백이 전부 새것이 된다.
  const api = useMemo(
    () => ({
      read: { url: CONFIG_ENDPOINTS.getList, emptyNotice: true },
      save: {
        url: CONFIG_ENDPOINTS.save,
        warn: buildWarnings,
        locateFieldErrors: locateFieldErrors,
      },
    }),
    [],
  );

  const grid = useGridController<ConfigRow>({
    menuCd: MENU_CD,
    columns,
    api,
    // `addRow` 가 없다 — 키는 `yml` 이 정한다(63 §4.3).
    params: collectConditions,
    toSavePayload: (rows) => ({
      rows: rows.map((row) => ({
        rowState: row.state,
        cfgKey: row.data.cfgKey,
        // 되돌리기는 값을 보내지 않는다 — 서버는 행을 지울 뿐이다(63 §4.4).
        cfgVal: row.state === 'D' ? undefined : row.data.cfgVal,
      })),
    }),
  });

  /*
    접두사는 <b>전 키에서 도출</b>된 고정 집합이라 목록 응답에 실리지 않는다(63 §4.6).
    지금 걸린 조건의 결과를 후보로 내면 <b>한 번 좁힌 뒤 넓힐 수 없는 콤보</b>가 된다.

    `staleTime: Infinity` 인 것은 이 목록이 <b>빌드 산출물</b>이기 때문이다 — 배포가
    바뀌지 않는 한 바뀌지 않으며, 배포가 바뀌면 세션도 다시 시작한다.
  */
  const prefixes = useQuery({
    queryKey: ['config', 'prefixes'],
    queryFn: () => getConfigPrefixes(),
    enabled: grid.canRead,
    staleTime: Infinity,
  });

  const searchFields = useMemo(() => buildSearchFields(prefixes.data ?? []), [prefixes.data]);

  /*
    <b>매 렌더 새 객체를 넘기지 않는다.</b> 넘기면 {@code <DataGrid>} 의 컬럼 선언이 매번
    다시 계산되고, 판은 그것을 선언의 갱신으로 받아 <b>사용자가 끌어 놓은 폭을 되돌린다</b>.
    셸이 세션 잔여 시간을 1초마다 다시 그리므로 그 되돌림도 <b>초당 한 번</b>이었다.
  */
  const revertColumn = useMemo(
    () => ({
      header: MSG.CONFIG_COL_REVERT,
      enabled: (row: GridRow<ConfigRow>) => row.data.overridden,
      // *되돌리기* 는 *삭제* 보다 길다 — 좁으면 헤더 글자가 잘린다.
      width: 104,
      /*
        취소선은 <b>적용값 한 칸</b>에만 긋는다. 이 화면에서 사라지는 것은 행이 아니라
        오버라이드 한 줄이고 <b>키는 목록에 남는다</b>(63 §4.4) — 전 셀에 그으면
        <i>"이 행이 통째로 없어진다"</i> 로 읽혀 저장 뒤에 기대가 어긋난다.
      */
      strikeField: 'cfgVal',
    }),
    [],
  );

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void grid.read()}
        // 조건과 컬럼 필터를 함께 지운다 — grid-standard.md §2.4.
        onReset={grid.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          title={MSG.CONFIG_GRID_TITLE}
          menuCd={MENU_CD}
          controller={grid}
          /*
            <b>삭제가 아니라 되돌리기</b>이고 <b>변경됨 인 행만</b> 체크된다(63 §4.4).
            오버라이드 행이 없는 키는 지울 것이 없다 — 체크하게 두면 저장이 *없는 것을
            지운다* 로 나간다.
          */
          deletable={revertColumn}
        />
      </div>
    </FillColumn>
  );
}

// ── 컬럼 ──────────────────────────────────────────────────────────

function buildColumns(): ColumnDef<ConfigRow>[] {
  return [
    {
      field: 'cfgKey',
      header: MSG.CONFIG_COL_KEY,
      type: 'text',
      width: 300,
      pinned: 'left',
      sortable: true,
      // <b>열리지 않는다.</b> 키를 화면에서 만들거나 고치면 아무 데도 읽히지 않는 행이
      // 생긴다 — 왼쪽 테이블은 코드다(63 §4.3).
      editable: false,
    },
    {
      /*
        <b>숨기지 않는다</b>(63 §4.3). 되돌리면 무엇이 되는지가 행마다 보여야 §4.4 의
        확인이 놀라움을 주지 않는다 — 그리고 배포가 기본값을 올렸을 때 그 사실이
        드러나는 자리도 여기다.
      */
      field: 'defaultVal',
      header: MSG.CONFIG_COL_DEFAULT,
      type: 'text',
      width: 160,
      editable: false,
    },
    {
      field: 'cfgVal',
      header: MSG.CONFIG_COL_VALUE,
      type: 'text',
      width: 220,
      required: true,
      editable: true,
      /*
        값이 기본값과 <b>다를 때만</b> 굵다. 배지는 <b>행이 있으면</b> 붙는다 — 근거가
        다르다(63 §4.3). 값을 기본값과 똑같이 저장해 두면 다음 배포가 `yml` 기본값을
        올려도 그 키만 옛 값에 묶이는데, 두 값이 같아 눈으로는 구분되지 않으므로
        <b>배지가 유일한 신호</b>다.
      */
      emphasis: (row) => row.overridden && row.cfgVal !== row.defaultVal,
      badge: (row) =>
        row.overridden ? { text: label(MSG.CONFIG_OVERRIDDEN), tone: 'warn' } : null,
      // 1층 — 유형에 맞는 <b>형식</b>만 본다(grid-edit-validation.md §3.2 · 63 §4.5).
      validate: (value, row) => formatIssue(value, row.cfgType),
    },
    {
      field: 'cfgType',
      header: MSG.CONFIG_COL_TYPE,
      type: 'code',
      width: 110,
      // 코드값이 아니라 이름을 보여준다 — 43 §4.4. 값 집합이 닫혀 있어 고르는 필터다.
      options: typeOptions(),
      editable: false,
    },
    {
      /*
        <b>읽기 전용이다.</b> 편집하게 두면 값을 안 바꿨는데 오버라이드 행이 생기고,
        그 키가 <i>변경됨</i> 이 된다(63 §4.2). 원천은 필드 Javadoc 이다.

        필터를 끈다 — 훑어 읽는 칸이지 거르는 칸이 아니고, 같은 말을 조회조건의
        *키 · 설명* 한 칸이 이미 한다.
      */
      field: 'cfgDesc',
      header: MSG.CONFIG_COL_DESC,
      type: 'text',
      /*
        <b>최소 폭이 작다.</b> 남는 폭을 먹는 칸의 일은 <i>슬랙을 흡수하는 것</i>이라,
        최소가 크면 좁은 화면에서 <b>이 칸 때문에 가로 스크롤이 생긴다</b> — 그러면 정작
        빈 띠를 없애려던 자리에서 스크롤이 대신 나온다(2026-08-30 실물: 320 이면 1344px
        그리드에서 합이 넘쳤다).
      */
      width: 200,
      // 남는 폭을 이 칸이 먹는다 — 마지막 컬럼과 판 사이에 빈 띠가 남지 않는다(grid-standard.md §2).
      fill: true,
      filter: false,
      editable: false,
      /*
        <b>셀 한 줄로는 다 못 읽는다.</b> 필드 Javadoc 이라 두세 문장짜리가 흔하다 —
        더블클릭하면 펼쳐 읽는다(grid-column-contract.md §5.5).

        <b>편집기가 아니다.</b> 편집하게 두면 값을 안 바꿨는데 오버라이드 행이 생기고
        그 키가 <i>변경됨</i> 이 된다(63 §4.2) — 여는 순간 고칠 수 있는 것처럼 보이는
        것부터가 사고의 시작이다.
      */
      viewer: 'largeText',
    },
    /*
      감사 4컬럼은 `visible: false` 다 — 설정 창에서 켤 수 있다(grid-column-contract.md §2.1).

      메시지 화면과 달리 `hidden` 이 아닌 것은, 여기 값이 <b>사람이 남긴 것</b>이기
      때문이다. 이 테이블의 쓰기 경로는 이 화면 하나이므로 *누가 언제 이 설정을 바꿨나*
      가 실제 질문이 된다 — 다만 <b>오버라이드 행이 있는 키에만</b> 값이 있다.
    */
    ...auditColumns<ConfigRow>(),
  ];
}

function typeOptions(): SelectOption[] {
  return (Object.keys(TYPE_LABEL) as ConfigValueType[]).map((type) => ({
    value: type,
    text: label(TYPE_LABEL[type]),
  }));
}

// ── 검증 (grid-edit-validation.md §3.2 의 1층) ─────────────────────────────────────────

/**
 * 유형에 맞는 <b>형식</b>만 본다 — 63 §4.5.
 *
 * <p><b>범위를 보지 않는다.</b> `0` 이 *끔* 인 키가 있고(43 §6.3) 상한을 원하는 조직도
 * 다르다 — 그 판단은 서버의 바인딩 객체 하나가 갖는다.
 */
function formatIssue(value: unknown, type: ConfigValueType): string | null {
  // 셀의 값은 문자열이다 — 아닌 것이 오면 그것은 형식 오류가 아니라 선언의 오류다.
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') {
    // 필수 검증이 이미 말한다 — 같은 칸에 문구 둘을 붙이지 않는다(grid-column-contract.md §5.1).
    return null;
  }
  if (type === 'NUMBER' && !/^-?\d+(\.\d+)?$/.test(text)) {
    return label(MSG.CONFIG_VALIDATE_NUMBER);
  }
  if (type === 'BOOLEAN' && text !== 'true' && text !== 'false') {
    return label(MSG.CONFIG_VALIDATE_BOOLEAN);
  }
  return null;
}

// ── 저장 전 경고 (63 §4.4 · §4.5) ─────────────────────────────────

/**
 * 건수가 말하지 못하는 둘을 말한다.
 *
 * <p><b>되돌리기</b>는 기본값을 함께 말한다 — 값이 사라지는 것이 아니라 `yml` 이
 * 드러난다는 것을 미리 말해 두지 않으면, 되돌린 뒤 목록에 남은 같은 키가
 * *"지웠는데 그대로다"* 로 읽힌다.
 *
 * <p><b>관리자 재설정을 끄는 것</b>은 되돌릴 수는 있지만 <b>되돌릴 사람이 못 들어올 수</b>
 * 있다. 62 §4.5.3 이 *"되돌리기가 안 되니까 묻는다"* 고 한 것의 변형이며, 여기서는
 * 되돌리기가 <i>안 되는</i> 것이 아니라 <b><i>닿을 수 없는</i></b> 것이다.
 */
function buildWarnings(rows: GridRow<ConfigRow>[]): string[] {
  const warnings: string[] = [];
  for (const row of rows) {
    if (row.state === 'D') {
      warnings.push(
        label(MSG.CONFIG_REVERT_WARN, {
          key: row.data.cfgKey,
          defaultVal: row.data.defaultVal,
        }),
      );
      continue;
    }
    if (row.data.cfgKey === ADMIN_RESET_KEY && row.data.cfgVal.trim() === 'false') {
      warnings.push(label(MSG.CONFIG_ADMIN_RESET_WARN));
    }
  }
  return warnings;
}

// ── 서버 거부 → 셀 (grid-edit-validation.md §3.4) ──────────────────────────────────────

/**
 * 서버의 `field` 가 곧 `CFG_KEY` 다 — 이 화면에서는 그것이 <b>행의 이름</b>이다.
 *
 * <p>그래서 다른 화면과 달리 매칭이 자명하다. 못 찾은 실패는 <b>버리지 않는다</b> —
 * 모달이 이미 그 문구를 내고 있으므로 여기서는 붙일 자리가 없을 뿐이다.
 */
function locateFieldErrors(
  fields: { field: string; message: string }[],
  rows: GridRow<ConfigRow>[],
): GridIssue[] {
  const issues: GridIssue[] = [];
  for (const failure of fields) {
    const row = rows.find((candidate) => candidate.data.cfgKey === failure.field);
    if (row) {
      issues.push({ rowId: row.id, field: 'cfgVal', message: failure.message });
    }
  }
  return issues;
}

// ── 조회조건 (63 §4.6) ────────────────────────────────────────────

/**
 * 분류가 없으니 <b>접두사와 검색</b>이다.
 *
 * <p>`CFG_GRP_CD` 를 두지 않은 이유는 *"설정 하나는 한 영역에만 속한다"* 가 참이 아니기
 * 때문이다(43 §6.1) — `auth.login.deny-empty-authority` 는 인증이면서 화면 랜딩 정책이다.
 * 탭이나 트리로 나누면 등록할 때마다 판단해야 하고, 그 판단이 읽는 사람의 기대와
 * 어긋나도 <b>조용하다</b>.
 */
function buildSearchFields(prefixes: string[]): SearchField[] {
  return [
    {
      field: 'keyword',
      label: MSG.CONFIG_SEARCH_KEYWORD,
      type: 'text',
      op: 'contains',
      // 값 없음·값 있음이 없다 — 키는 NOT NULL 이고 설명은 빌드 산출물이라 전건이거나 0건이다.
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      field: 'prefix',
      label: MSG.CONFIG_SEARCH_PREFIX,
      type: 'select',
      // 접두사는 <b>시작</b> 하나다 — 후보가 하나면 셀렉터가 나타나지 않는다(search-form-contract.md §3.4).
      ops: ['startsWith'],
      // <b>관리하지 않는다.</b> 전 키에서 도출한 것을 서버가 준다(63 §4.6).
      options: prefixes.map((prefix) => ({ value: prefix, text: prefix })),
    },
    {
      field: 'overridden',
      label: MSG.CONFIG_SEARCH_OVERRIDDEN,
      type: 'select',
      // 서버가 `=` 만 받는다 — 판정은 <b>행의 존재</b>이지 값 비교가 아니다(63 §4.3).
      ops: ['eq'],
      options: [
        { value: 'Y', text: label(MSG.CONFIG_OVERRIDDEN) },
        { value: 'N', text: label(MSG.CONFIG_DEFAULTED) },
      ],
    },
  ];
}
