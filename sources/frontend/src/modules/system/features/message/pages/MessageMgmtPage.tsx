// @feat FEAT-505
import { useCallback, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { codeLabel, LANG_CD } from '@/shared/i18n/codeLabel';
import { useMessageStore } from '@/shared/i18n/messageStore';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { editRow, revertRow, sameData, type GridRow } from '@/shared/grid/rows';
import { useGridController } from '@/shared/grid/useGridController';
import type { ColumnDef, GridIssue, SelectOption, Tone } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { MESSAGE_ADMIN_ENDPOINTS } from '@/modules/system/features/message/api/endpoints';
import type { MessageKeyRow, MessageScope, MessageValue } from '@/modules/system/features/message/types';

/**
 * `MESSAGE_MGMT` — screen/admin/system/message/requirements.md. <b>키를 만드는 화면이 아니라 값을 채우고 죽은 키를 찾는 화면이다.</b>
 *
 * <p><b>행을 더할 수 없다</b>(2026-08-30). 키의 원본은 <b>소스 상수</b>(sys/message.md)이거나
 * <b>데이터</b>(`code.*` · `menu.*` — sys/code.md)이고 이 화면은 그 어느 쪽도 아니다. 손으로
 * 더한 키는 태어날 때부터 <i>사용처 없음</i> 이고, 다음 시드 생성도 그것을 알지 못하므로
 * <b>이 화면이 스스로 죽은 키로 표시하는 행</b>을 만드는 셈이 된다 — 지우라고 만드는 행이다.
 *
 * <p><b>지우기는 남는다.</b> 죽은 키를 걷어내는 것이 이 화면의 두 일 중 하나다(screen/admin/system/message/requirements.md).
 *
 * <p><b>저장 단위는 마스터 하나다</b>(screen/admin/system/message/requirements.md). 테이블도 둘이고 화면도 둘이지만 하단의
 * 언어별 목록은 마스터 행의 <b>`list` 컬럼</b>이며(frontend/grid.md), 그래서 하단에는 <b>버튼이
 * 하나도 없다</b> — 감춘 것이 아니라 `api` 선언이 없는 것이다(frontend/grid.md).
 *
 * <p>그 결과 frontend/grid.md 이 마스터-디테일에 건 제약 둘이 여기서 성립하지 않는다. 하단이 DB 에
 * 붙지 않으므로 <b>FK 위반이 없고</b>, 행 집합이 서버 조회가 아니라 <b>번들 캐시</b>에서
 * 오므로 신규 행 추가 직후에도 잠기지 않는다 — <b>2단계 등록을 치르지 않는다.</b>
 *
 * <p><b>조회 직후 리셋은 그대로다.</b> 그 이유(*"다른 사람의 데이터를 그 사람 것으로 보게
 * 된다"*)는 여전히 성립한다.
 */

const MENU_CD = 'MESSAGE_MGMT';

const SCOPE_LABEL: Record<MessageScope, string> = {
  BOTH: MSG.MESSAGE_SCOPE_BOTH,
  FRONT: MSG.MESSAGE_SCOPE_FRONT,
  BACK: MSG.MESSAGE_SCOPE_BACK,
  DATA: MSG.MESSAGE_SCOPE_DATA,
  NONE: MSG.MESSAGE_SCOPE_NONE,
};

/**
 * 사용처의 색 — <b>묶음이 정한다</b>(frontend/grid.md).
 *
 * <p><b>`미사용` 하나만 칠한다.</b> 정상이 압도적인 목록에서는 칠하지 않는 것이 기본이고,
 * 죽은 키만 눈에 남아야 한다. `BACK` 은 번들에 없지만 <b>결함이 아니라 사실</b>이다.
 */
const SCOPE_TONE: Record<string, Tone> = { NONE: 'warn' };

export function MessageMgmtPage() {
  const langs = useMessageStore((state) => state.langs);
  const searchForm = useRef<SearchFormHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const header = useSearchFormHeader();

  const scopeOptions = useMemo<SelectOption[]>(
    () =>
      (Object.keys(SCOPE_LABEL) as MessageScope[]).map((scope) => ({
        value: scope,
        text: label(SCOPE_LABEL[scope]),
      })),
    [],
  );

  const masterColumns = useMemo(() => buildMasterColumns(langs, scopeOptions), [langs, scopeOptions]);
  const detailColumns = useMemo(() => buildDetailColumns(langs), [langs]);
  // 매 렌더 새 배열이면 폼의 콜백도 새것이 되고, 저장된 조건이 그때마다 서버를 부른다.
  const searchFields = useMemo(() => buildSearchFields(langs, scopeOptions), [langs, scopeOptions]);

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

  /*
    <b>선언이지 값이 아니다.</b> 매 렌더 새 객체를 만들면 컨트롤러의 조회·저장 콜백이 전부
    새것이 되고, 그것을 파생시키는 아래 {@code masterController} 도 함께 다시 만들어져
    <b>컬럼 선언이 초당 한 번 판에 다시 밀린다</b>(셸이 1초마다 다시 그린다).
  */
  const masterApi = useMemo(
    () => ({
      read: { url: MESSAGE_ADMIN_ENDPOINTS.getList, emptyNotice: true },
      save: {
        url: MESSAGE_ADMIN_ENDPOINTS.save,
        validate: { grid: (rows: GridRow<MessageKeyRow>[]) => validateKeys(rows) },
      },
    }),
    [],
  );

  const master = useGridController<MessageKeyRow>({
    menuCd: MENU_CD,
    columns: masterColumns,
    api: masterApi,
    // `addRow` 가 없다 — 이 화면은 <b>키를 만드는 화면이 아니다</b>(위 주석 · screen/admin/system/message/requirements.md).
    params: collectConditions,
    toSaveRow: (row) => ({
      rowState: row.state,
      msgKey: row.data.msgKey,
      // 삭제는 값을 보내지 않는다 — 서버가 값 → 키 순서로 지운다(screen/admin/system/message/requirements.md).
      values: row.state === 'D' ? undefined : row.data.values,
    }),
  });

  const detail = useGridController<MessageValue>({
    menuCd: MENU_CD,
    columns: detailColumns,
    // 저장 단위가 마스터라 자기 `api.save` 가 없다 — 편집 가능 여부를 넘겨받는다(screen/admin/system/message/requirements.md).
    editable: master.canSave,
  });

  const selectMaster = useCallback(
    (row: GridRow<MessageKeyRow> | null) => {
      setSelectedId(row?.id ?? null);
      // 서버를 부르지 않는다 — 하단의 원본은 마스터 행의 `list` 다(screen/admin/system/message/requirements.md).
      detail.setRows(row ? detailRows(row) : []);
    },
    [detail],
  );

  /**
   * 하단 편집이 <b>마스터 행</b>으로 돌아간다 — frontend/grid.md 의 *"화면의 다른 그리드"* 경로.
   *
   * <p>그래서 마스터 행의 상태가 <b>수정(✎)</b> 이 되고 저장에 실린다. 다른 경로로 들어온
   * 값이라고 규약을 비껴가지 않는다.
   *
   * <p><b>하단도 자기 상태를 갖는다</b>(2026-08-30). 전에는 값만 갈아 끼워 하단의 상태
   * 컬럼이 영영 비었다 — <i>"어느 언어를 고쳤더라"</i> 를 하단에서 알 수 없었다.
   * 전이는 {@code rows.ts} 의 순수 함수를 그대로 태운다.
   */
  /**
   * 마스터를 되돌리면 <b>하단도 함께 돌아간다</b> — screen/admin/system/message/requirements.md.
   *
   * <p>하단은 마스터 행의 {@code values} 를 펴 놓은 것이라 <b>한 몸</b>이다. 아래에서
   * 고치면 위가 <i>수정</i> 이 되고, 아래에서 되돌리면 위도 풀린다 — 그런데 <b>위에서
   * 되돌릴 때만</b> 아래가 그대로 남아 있었다(2026-08-30 실물).
   *
   * <p>그 상태가 나쁜 이유는 <b>화면이 거짓말을 하기</b> 때문이다: 저장할 것이 없는데
   * 하단에는 {@code ✎} 가 남고, 저장을 눌러도 아무 일이 일어나지 않는다.
   */
  const masterController = useMemo(
    () => ({
      ...master,
      revert: (rowId: string) => {
        master.revert(rowId);

        const row = master.rows.find((candidate) => candidate.id === rowId);
        // 고른 행이 아니면 하단은 다른 행을 보고 있다 — 건드릴 것이 없다.
        if (rowId !== selectedId || row?.state !== 'U' || row.original === null) {
          return;
        }
        // 되돌린 뒤의 마스터 행에서 하단을 다시 편다 — 전부 무변경이 된다.
        detail.setRows(detailRows({ ...row, state: null, data: row.original }));
      },
    }),
    [master, detail, selectedId],
  );

  const detailController = useMemo(
    () => ({
      ...detail,
      edit: (rowId: string, patch: Partial<MessageValue>) => {
        const next = editRow(detail.rows, rowId, patch);
        detail.setRows(next);
        if (selectedId) {
          master.edit(selectedId, { values: next.map((row) => row.data) });
        }
      },
      /**
       * 되돌리면 <b>마스터의 수정 표시도 함께 내려갈 수 있다</b> — 고친 것이 그 값
       * 하나뿐이었다면 마스터는 이제 원본과 같다. 그대로 두면 저장할 것이 없는데
       * {@code ✎} 가 남아 <i>"저장이 안 된다"</i> 로 읽힌다.
       *
       * <p><b>그 판정을 여기서 하지 않는다</b>(2026-08-31). 한동안 {@code sameData} 로
       * 직접 재서 같으면 {@code master.revert} 를 불렀는데, 이제 {@code editRow} 가 <b>모든
       * 셀 편집에 대해</b> 같은 판정을 한다 — 값이 원본과 같아지면 상태가 무변경으로
       * 돌아간다(frontend/grid.md). 판정이 둘이면 <b>하단에서 되돌린 행과 위에서 되돌린 행의 상태가
       * 갈리는</b> 날이 온다.
       */
      revert: (rowId: string) => {
        const next = revertRow(detail.rows, rowId);
        detail.setRows(next);
        if (!selectedId) return;
        master.edit(selectedId, { values: next.map((row) => row.data) });
      },
    }),
    [detail, master, selectedId],
  );

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void master.read()}
        // 조건과 컬럼 필터를 함께 지운다 — frontend/grid.md.
        onReset={master.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <SplitPane
          storageKey="message"
          first={(collapsed, expand) => (
            <DataGrid
              title={MSG.MESSAGE_MASTER_TITLE}
              menuCd={MENU_CD}
              // 개인화의 키다 — 같으면 위아래 설정이 서로를 덮는다(frontend/grid.md).
              gridId="master"
              controller={masterController}
              // SYS_MESSAGE_KEY 는 물리 삭제한다 — 값 → 키 순서라 게이트가 필요 없다(screen/admin/system/message/requirements.md).
              deletable
              onSelect={selectMaster}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
          second={(collapsed, expand) => (
            /* 컬럼 넷이 전부 필요하다 — 끄거나 옮길 것이 없으면 설정 창도 뜻이 없다
               (frontend/grid.md · screen/admin/system/code/requirements.md). */
            <DataGrid
              title={MSG.MESSAGE_DETAIL_TITLE}
              menuCd={MENU_CD}
              gridId="detail"
              settings={false}
              controller={detailController}
              emptyText={MSG.MESSAGE_DETAIL_EMPTY}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
        />
      </div>
    </FillColumn>
  );
}

// ── 하단 행 ───────────────────────────────────────────────────────

/**
 * 마스터 행 하나 → 언어별 행들.
 *
 * <p><b>원본은 마스터 행의 원본이다</b> — 고친 뒤 다른 행을 봤다 돌아와도 <i>그 고친 값</i>
 * 이 원본이 되지 않는다. 그러지 않으면 <b>되돌리기가 되돌리지 못하는</b> 상태가 생긴다.
 *
 * <p>신규 마스터 행에는 원본이 없다({@code original === null}) — 그 행의 값은 전부
 * 새것이므로 되돌릴 곳도 없다.
 */
function detailRows(row: GridRow<MessageKeyRow>): GridRow<MessageValue>[] {
  const originals = row.original?.values ?? [];
  return row.data.values.map((value) => {
    const origin = originals.find((candidate) => candidate.langCd === value.langCd) ?? null;
    return {
      id: `${row.id}:${value.langCd}`,
      state: origin !== null && !sameData(value, origin) ? ('U' as const) : null,
      data: value,
      original: origin,
    };
  });
}

// ── 컬럼 ──────────────────────────────────────────────────────────

function buildMasterColumns(
  langs: string[],
  scopeOptions: SelectOption[],
): ColumnDef<MessageKeyRow>[] {
  return [
    {
      field: 'msgKey',
      header: MSG.MESSAGE_COL_KEY,
      type: 'text',
      width: 300,
      pinned: 'left',
      sortable: true,
      /*
        <b>열리지 않는다.</b> 키의 원본은 소스 상수이거나 데이터이며(sys/message.md · sys/code.md)
        이 화면은 그 어느 쪽도 아니다 — 여기서 고친 키는 다음 생성이 되돌린다.

        그래서 <b>`pk` 도 `required` 도 아니다.</b> PK 인 것은 맞지만 신규 행조차 없으므로
        열릴 자리가 없고, 채울 수 없는 칸에 필수 표시를 붙이면 <i>왜 안 되나</i> 를 묻게
        된다(frontend/grid.md). `required: true` 가 적혀 있었는데 <b>이미 죽은 선언</b>이었다 —
        편집할 수 없는 칸은 검증이 필수로 보지 않는다.
      */
      editable: false,
    },
    {
      field: 'useScope',
      header: MSG.MESSAGE_COL_SCOPE,
      type: 'code',
      width: 110,
      sortable: true,
      renderer: 'badge',
      tone: SCOPE_TONE,
      options: scopeOptions,
    },
    { field: 'bundled', header: MSG.MESSAGE_COL_BUNDLED, type: 'ynFlag', width: 90 },
    {
      field: 'translated',
      header: MSG.MESSAGE_COL_TRANSLATED,
      type: 'text',
      width: 130,
      // 파생이므로 정렬 대상이 아니다(frontend/grid.md) — 서버 화이트리스트에도 없다.
      // 필터도 없다: 이 컬럼이 답하는 질문(*"en 이 안 채워진 키"*)은 전량을 물어야 하고
      // 그것은 조회조건 쪽에 이미 있다(screen/admin/system/message/requirements.md).
      filter: false,
      renderer: 'badge',
      tone: translatedTone(langs.length),
      options: translatedOptions(langs.length),
      derive: (row) => `${filledCount(row.values)}/${langs.length}`,
    },
    // 설명은 훑어 읽는 칸이지 거르는 칸이 아니다 — 같은 말을 조회조건의 값 조건이 한다.
    //
    // 남는 폭을 이 칸이 먹는다(frontend/grid.md). 상수의 Javadoc 이라 길고, 셀 한 줄로 다 못 읽는
    // 것은 더블클릭해 펼친다 — <b>편집기가 아니다</b>: 시드가 소유하는 값이다(sys/message.md).
    {
      field: 'msgDesc',
      header: MSG.MESSAGE_COL_DESC,
      type: 'text',
      // 최소 폭이다 — 남는 폭을 먹는 칸이 최소까지 크면 좁은 화면에서 스크롤이 생긴다.
      width: 200,
      fill: true,
      filter: false,
      viewer: 'largeText',
    },
    // 하단이 편집하는 값. 컬럼으로 두지 않는다 — 번역 컬럼이 이미 그 요약을 낸다.
    { field: 'values', header: MSG.MESSAGE_COL_VALUE, type: 'list', hidden: true },
    /*
      감사 4컬럼은 `hidden` 이다 — 켤 수단조차 두지 않는다(frontend/grid.md).

      이 테이블의 행은 <b>코드가 소유한다</b>(sys/message.md). `generateMessageSeed` 가 만들고
      Liquibase 가 적용하므로 등록자·수정자가 언제나 시드이며, 화면에서 더한 키도 다음
      생성이 사용처를 다시 계산한다 — <b>네 칸이 말하는 것이 사실상 하나</b>다.
      설정 창의 목록에 두면 <i>켤 수 있는데 켜 봐야 같은 값</i> 인 줄이 넷 생긴다.
    */
    ...auditColumns<MessageKeyRow>({ hidden: true }),
  ];
}

/**
 * 하단 컬럼 — <b>필터가 없다.</b>
 *
 * <p>행이 언제나 지원 언어 수만큼(둘)이다. 두 줄짜리 목록에서 거를 것이 없고, 헤더 메뉴는
 * <b>잊힌 필터</b>가 숨는 자리만 된다(frontend/grid.md).
 */
function buildDetailColumns(langs: string[]): ColumnDef<MessageValue>[] {
  return [
    {
      field: 'langCd',
      header: MSG.MESSAGE_COL_LANG,
      // 코드값이 아니라 이름을 보여준다 — sys/code.md. `options` 가 그 표다.
      type: 'code',
      width: 140,
      filter: false,
      options: langs.map((lang) => ({ value: lang, text: codeLabel(LANG_CD, lang) })),
    },
    {
      field: 'msgVal',
      header: MSG.MESSAGE_COL_VALUE,
      type: 'text',
      // 남는 폭을 이 칸이 먹는다 — 하단은 컬럼이 둘뿐이라 빈 띠가 특히 크게 남았다(frontend/grid.md).
      width: 240,
      fill: true,
      filter: false,
      // 2000자다. 셀에는 한 줄이 잘려 보이고 편집은 펼쳐서 한다(frontend/grid.md).
      editor: 'largeText',
      editable: true,
    },
  ];
}

// ── 조회조건 ──────────────────────────────────────────────────────

function buildSearchFields(langs: string[], scopeOptions: SelectOption[]): SearchField[] {
  return [
    {
      field: 'msgKey',
      label: MSG.MESSAGE_SEARCH_KEY,
      type: 'text',
      op: 'contains',
      // 값 없음 · 값 있음을 빼는 이유는 <b>키가 NOT NULL</b> 이라서다 — 전건이거나 0건이다.
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      field: 'msgVal',
      label: MSG.MESSAGE_SEARCH_VALUE,
      type: 'text',
      op: 'contains',
      // 파생이라 서버가 문자열 비교만 편다 — 없는 연산자를 열면 400 이다(screen/admin/system/message/requirements.md).
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      field: 'useScope',
      label: MSG.MESSAGE_SEARCH_SCOPE,
      type: 'select',
      // 실컬럼이라 `IN` 이 그대로 선다 — 사용처 둘을 한 번에 보는 것이 흔한 동선이다.
      options: scopeOptions,
    },
    {
      field: 'untranslated',
      label: MSG.MESSAGE_SEARCH_UNTRANSLATED,
      type: 'select',
      // 파생 서브쿼리가 `=` 만 받는다(screen/admin/system/message/requirements.md) — 콤보의 기본 후보 셋을 열면 400 이다.
      ops: ['eq'],
      // 코드값(`ko`)이 아니라 이름(`한국어`)을 보여준다 — sys/code.md.
      options: langs.map((lang) => ({ value: lang, text: codeLabel(LANG_CD, lang) })),
    },
  ];
}

// ── 검증 (frontend/grid.md 의 3층) ─────────────────────────────────────────

function validateKeys(rows: GridRow<MessageKeyRow>[]): GridIssue[] {
  const issues: GridIssue[] = [];
  const seen = new Map<string, string>();

  for (const row of rows) {
    const key = row.data.msgKey?.trim() ?? '';
    if (key !== '') {
      // 같은 그리드 안의 중복은 클라이언트가 판정할 수 있다. DB 에 이미 있는 키는 서버다.
      if (seen.has(key)) {
        issues.push({ rowId: row.id, field: 'msgKey', message: label(MSG.MESSAGE_DUPLICATE_KEY) });
      }
      seen.set(key, row.id);
    }
  }
  return issues;
}

// ── 파생 ──────────────────────────────────────────────────────────

function filledCount(values: MessageValue[] | undefined): number {
  return (values ?? []).filter((value) => (value.msgVal ?? '').trim() !== '').length;
}

/** `1/2` 은 경고, `2/2` 는 칠하지 않는다 — 맵이지 함수가 아니다(frontend/grid.md). */
function translatedTone(total: number): Record<string, Tone> {
  const tone: Record<string, Tone> = {};
  for (let filled = 0; filled < total; filled += 1) {
    tone[`${filled}/${total}`] = 'warn';
  }
  return tone;
}

/**
 * 배지의 글자 — 비율과 <b>`미번역`</b> 을 함께 낸다.
 *
 * <p>색만으로 말하지 않는다(frontend/grid.md). 비율만 두면 색각 이상이 있는 사용자에게 `1/2` 와
 * `2/2` 의 차이가 숫자 하나이고, 단어를 붙이면 훑을 때 바로 걸린다.
 */
function translatedOptions(total: number): SelectOption[] {
  const options: SelectOption[] = [];
  for (let filled = 0; filled <= total; filled += 1) {
    const ratio = `${filled}/${total}`;
    options.push({
      value: ratio,
      text: filled < total ? `${ratio} · ${label(MSG.MESSAGE_UNTRANSLATED)}` : ratio,
    });
  }
  return options;
}
