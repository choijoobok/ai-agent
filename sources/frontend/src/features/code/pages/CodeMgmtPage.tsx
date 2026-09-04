import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type {
  ColumnDef,
  DeleteColumnSpec,
  GridControl,
  GridIssue,
  SelectOption,
} from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { CODE_ENDPOINTS } from '@/features/code/api/endpoints';
import { getRefDefList, getRefKeyCodes } from '@/features/code/api/codeApi';
import { RefDefModal } from '@/features/code/components/RefDefModal';
import type { CodeGroupRow, CodeRefDefRow, CodeRow } from '@/features/code/types';

/**
 * `CODE_MGMT` — screen/code/requirements.md. <b>단계가 둘이 아니라 셋이고, 셋째는 컬럼이다.</b>
 *
 * <pre>
 * 그룹 → 코드 → 참조
 *                ├ 정의(SYS_CODE_GRP_REF) : **모달** — 이 그룹이 어떤 속성을 쓰는가
 *                └ 값(SYS_CODE_REF)       : **하단 그리드의 동적 컬럼** — 매트릭스의 셀
 * </pre>
 *
 * <p><b>참조가 pane 도 탭도 아닌 이유</b>(sys/code.md) — 본질이 매트릭스(코드 × 속성)다. 값을
 * 모달에 담았던 이전 판은 <b>한 코드씩만 보여</b> *"어느 코드가 아직 안 채워졌나"* 에 답할
 * 수 없었다. 펼쳐 놓으면 <b>빈 칸 자체가 할 일</b>이 된다 — 별도 배지도, *값 없는 것 우선*
 * 정렬도 두지 않는 이유다.
 *
 * <p><b>조회가 둘이고 둘 다 도착한 뒤에 그린다</b>(screen/code/requirements.md). 컬럼 없이 행을 그리면 값이 갈
 * 자리가 없고, 행 없이 컬럼만 그리면 빈 그리드가 한 번 깜빡인다.
 *
 * <p><b>코드명은 여기서 입력한다</b>(screen/code/requirements.md). 값은 `SYS_MESSAGE` 로 가며 채우는 것은
 * <b>지금 세션 언어 하나</b>다 — 다른 언어는 `MESSAGE_MGMT` 로 간다. 언어를 컬럼으로 늘리면
 * 지원 언어를 하나 켤 때마다 그리드가 옆으로 자라고 저장된 컬럼 목록이 어긋난다.
 *
 * <p><b>하단이 DB 에 붙어 있다</b> — screen/code/requirements.md 의 메시지 화면과 갈리는 자리다. 그래서 frontend/grid.md
 * 의 제약 둘을 그대로 치른다: 미저장 신규 그룹의 하단은 <b>잠기고</b>(FK), 다른 그룹으로
 * 옮길 때 미저장 편집이 있으면 <b>묻는다</b>.
 */

const MENU_CD = 'CODE_MGMT';

/** 하단 조건은 마스터도 거른다 — 같은 이름으로 두 요청에 실린다(screen/code/requirements.md). */
const DETAIL_CONDITION_FIELDS = ['dtlCd', 'codeNm'];

export function CodeMgmtPage() {
  const { modal } = App.useApp();
  const searchForm = useRef<SearchFormHandle>(null);
  const [group, setGroup] = useState<GridRow<CodeGroupRow> | null>(null);
  const [refDefs, setRefDefs] = useState<CodeRefDefRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  /**
   * 하단의 빈 상태 문구 — frontend/grid.md 의 세 상태 중 <b>둘이 여기서 갈린다</b>.
   *
   * <p><i>"그룹을 선택하세요"</i> 와 <i>"저장 후 편집할 수 있습니다"</i> 는 같은 빈 판이지만
   * <b>다음에 할 일이 다르다</b> — 하나로 합치면 미저장 신규 행을 고른 사람이 왜 아무 것도
   * 못 하는지 알 수 없다.
   */
  const [detailEmpty, setDetailEmpty] = useState<string>(MSG.CODE_DETAIL_EMPTY);

  /*
    <b>선택된 그룹을 ref 로도 든다.</b> 조회·저장 콜백이 이 값을 읽는데, 행을 고른 <b>바로
    그 순간</b>에 하단 조회가 나가야 하므로 상태 갱신을 기다릴 수 없다 — 기다리면 첫 조회가
    <i>이전 그룹</i> 의 코드를 가져온다.
  */
  const selectedGrpCd = useRef<string | null>(null);

  /**
   * <b>저장된</b> 그룹의 코드 — 렌더가 보는 값이다.
   *
   * <p>{@link selectedGrpCd} 와 같은 사실을 담지만 축이 다르다: 저것은 <b>콜백이 그 순간에</b>
   * 읽는 값이고 이것은 <b>화면이 다시 그릴 때</b> 읽는 값이다. ref 하나로 둘을 다 하면
   * 버튼의 활성 상태가 그룹을 바꿔도 그대로다 — ref 는 렌더를 유발하지 않는다.
   */
  const savedGrpCd = group && group.state !== 'C' ? group.data.grpCd : null;

  const header = useSearchFormHeader();

  /*
    참조 코드의 후보 — `CODE_REF_KEY` 공통코드다(sys/code.md).

    <b>전용 API 를 두지 않는다.</b> 이 화면은 이미 *한 그룹의 코드* 를 읽는 경로를 갖고 있고
    화이트리스트도 그 하나다 — 새 경로를 내면 같은 질의가 두 벌이 된다.

    `staleTime: Infinity` 인 것은 이 목록이 <b>거의 바뀌지 않고</b>, 바뀌는 자리가 이 화면
    자신이기 때문이다 — `CODE_REF_KEY` 그룹을 골라 코드를 더하면 그때 다시 받는다.
  */
  const refCdCodes = useQuery({
    queryKey: ['code', 'refCdWhitelist'],
    staleTime: Infinity,
    queryFn: () => getRefKeyCodes(),
  });

  const refCdOptions = useMemo<SelectOption[]>(
    () =>
      (refCdCodes.data?.content ?? [])
        .filter((code) => code.useYn)
        // 코드값이 아니라 이름을 보여준다 — 이름이 아직 없으면 키 문자열이 그대로 보인다.
        .map((code) => ({ value: code.dtlCd, text: `${code.dtlCd} · ${code.codeNm}` })),
    [refCdCodes.data],
  );

  // 매 렌더 새 함수를 넘기지 않는다 — 컨트롤러의 조회·저장 콜백이 전부 새것이 된다.
  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  /** 하단은 폼의 조건 중 <b>자기 것 둘만</b> 받는다 — screen/code/requirements.md. */
  const detailConditions = useCallback(
    () =>
      Promise.resolve(
        (searchForm.current?.collect() ?? []).filter((condition) =>
          DETAIL_CONDITION_FIELDS.includes(condition.field),
        ),
      ),
    [],
  );

  const detailSearchParams = useCallback(() => ({ grpCd: selectedGrpCd.current }), []);

  const masterColumns = useMemo(() => buildGroupColumns(), []);
  const detailColumns = useMemo(() => buildCodeColumns(refDefs), [refDefs]);
  // 매 렌더 새 배열이면 폼의 콜백도 새것이 되고, 저장된 조건이 그때마다 서버를 부른다.
  const searchFields = useMemo(() => buildSearchFields(), []);

  const masterApi = useMemo(
    () => ({
      read: { url: CODE_ENDPOINTS.getGroupList, emptyNotice: true },
      save: { url: CODE_ENDPOINTS.saveGroup, validate: { grid: validateGrpCds } },
    }),
    [],
  );

  const detailApi = useMemo(
    () => ({
      read: { url: CODE_ENDPOINTS.getList },
      save: {
        url: CODE_ENDPOINTS.save,
        validate: { grid: validateDtlCds },
        // 참조값이 함께 사라진다는 것을 건수보다 **먼저** 말한다(frontend/grid.md · screen/code/requirements.md).
        warn: deleteWarnings,
      },
    }),
    [],
  );

  const master = useGridController<CodeGroupRow>({
    menuCd: MENU_CD,
    columns: masterColumns,
    api: masterApi,
    params: collectConditions,
    addRow: {
      defaults: () => ({
        grpCd: '',
        grpNm: '',
        grpDesc: null,
        sortNo: 0,
        codeCount: 0,
        // 화면이 만드는 그룹은 언제나 업무 그룹이다 — 서버도 이 값을 받지 않는다(sys/code.md).
        sysYn: false,
      }),
    },
    toSavePayload: (rows) => ({
      rows: rows.map((row) => ({
        rowState: row.state,
        grpCd: row.data.grpCd,
        // 삭제는 대상만 가리킨다 — 나머지를 보내면 서버가 쓰지 않을 값을 검증하게 된다.
        ...(row.state === 'D'
          ? {}
          : {
              grpNm: row.data.grpNm,
              grpDesc: row.data.grpDesc,
              sortNo: row.data.sortNo,
            }),
      })),
    }),
  });

  const detail = useGridController<CodeRow>({
    menuCd: MENU_CD,
    columns: detailColumns,
    api: detailApi,
    params: detailConditions,
    searchParams: detailSearchParams,
    addRow: {
      canAdd: () =>
        selectedGrpCd.current !== null
          ? true
          : { ok: false, message: label(MSG.CODE_DETAIL_EMPTY) },
      defaults: () => ({
        dtlCd: '',
        codeNm: '',
        dtlDesc: null,
        useYn: true,
        sortNo: 0,
        sysYn: false,
        refs: {},
      }),
    },
    toSavePayload: (rows) => ({
      grpCd: selectedGrpCd.current,
      rows: rows.map((row) => ({
        rowState: row.state,
        dtlCd: row.data.dtlCd,
        ...(row.state === 'D'
          ? {}
          : {
              codeNm: row.data.codeNm,
              dtlDesc: row.data.dtlDesc,
              useYn: row.data.useYn,
              sortNo: row.data.sortNo,
              refs: row.data.refs,
            }),
      })),
    }),
  });

  /** 정의 목록 — 컬럼 집합의 원본이다. 하단 조회와 <b>병렬로</b> 나간다(screen/code/requirements.md). */
  const readRefDefs = useCallback(async (grpCd: string) => {
    const page = await getRefDefList(grpCd);
    setRefDefs(page.content);
  }, []);

  const clearDetail = useCallback(
    (emptyText: string) => {
      selectedGrpCd.current = null;
      setRefDefs([]);
      detail.setRows([]);
      setDetailEmpty(emptyText);
    },
    [detail],
  );

  /**
   * <b>화면이 묻는다.</b> 그리드가 스스로 묻는 것과 같은 문구이며(frontend/grid.md) 여기로 올라온
   * 이유는 <i>답을 알아야 선택을 받아들일지 정할 수 있기</i> 때문이다 — 그리드에 맡기면
   * 물음의 결과를 화면이 알 수 없다.
   */
  const confirmDiscard = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        modal.confirm({
          title: label(MSG.GRID_DISCARD_TITLE),
          content: label(MSG.GRID_DISCARD_BODY),
          okText: label(MSG.GRID_CONFIRM_OK),
          cancelText: label(MSG.COMMON_CANCEL),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
    [modal],
  );

  /**
   * 그룹 선택 — frontend/grid.md 의 상태 셋을 그대로 편다.
   *
   * <p><b>거부할 수 있다.</b> 하단에 미저장 편집이 있으면 묻고, 아니라고 하면 판의 선택이
   * 되돌아간다(UX-10). 거부권이 없으면 <i>보고 있는 것</i>과 <i>고른 것</i>이 갈리고, 그
   * 상태로 저장하면 <b>A 그룹의 행이 B 그룹으로 나간다</b>.
   *
   * <p>물음이 여기서 한 번 나가므로 하단 조회에는 <b>이미 물었다</b>고 알린다 — 그러지
   * 않으면 같은 질문이 두 번 뜬다.
   */
  const selectGroup = useCallback(
    async (row: GridRow<CodeGroupRow> | null): Promise<boolean> => {
      if (detail.dirty && !(await confirmDiscard())) {
        return false;
      }
      setGroup(row);

      if (!row) {
        clearDetail(MSG.CODE_DETAIL_EMPTY);
        return true;
      }
      if (row.state === 'C') {
        // 부모 키가 아직 DB 에 없다 — 붙이려 하면 FK 위반이다(frontend/grid.md).
        clearDetail(MSG.CODE_DETAIL_LOCKED);
        return true;
      }
      const grpCd = row.data.grpCd;
      selectedGrpCd.current = grpCd;
      setDetailEmpty(MSG.CODE_DETAIL_EMPTY);
      // 둘을 함께 보내고 둘 다 도착한 뒤에 그린다 — screen/code/requirements.md.
      await Promise.all([readRefDefs(grpCd), detail.read(true)]);
      return true;
    },
    [detail, confirmDiscard, clearDetail, readRefDefs],
  );

  /**
   * 마스터 조회는 <b>하단을 리셋한다</b> — frontend/grid.md.
   *
   * <p>조회는 마스터 목록을 통째로 바꾸므로 이전에 보던 행이 결과에 없을 수도 있다. 하단이
   * 남아 있으면 <b>다른 사람의 데이터를 그 사람 것으로 보게 된다</b> — 그래서 자동 선택도
   * 하지 않는다.
   */
  const readMaster = useCallback(async () => {
    setGroup(null);
    clearDetail(MSG.CODE_DETAIL_EMPTY);
    await master.read();
  }, [clearDetail, master]);

  /**
   * ⓐ — <b>서버를 부르지 않고 모달을 연다</b>(frontend/grid.md 의 `button` 첫 실물 · screen/code/requirements.md).
   *
   * <p>미저장 편집이 있으면 <b>비활성</b>이다. 정의가 바뀌면 컬럼 집합이 바뀌고 하단
   * 재조회가 편집을 버리므로, 열고 나서 묻는 것보다 <b>누를 수 없는 것이 먼저 보이는
   * 편</b>이 낫다 — 사유는 툴팁이 아니라 눌렀을 때가 아니라 <b>지금</b> 말해야 하므로
   * 라벨 옆 문구가 아니라 토스트로 낸다(frontend/grid.md 이 모든 컨트롤에 같은 상태를 준다).
   */
  /**
   * 지울 수 있는가 — <b>매 렌더 새 객체로 만들지 않는다</b>(frontend/grid.md).
   *
   * <p>{@code <DataGrid>} 의 컬럼 선언이 이 객체를 의존성으로 갖는다. 인라인으로 두면
   * 셸이 초당 한 번 다시 그릴 때마다(세션 잔여 시간) 선언이 새로 계산돼 판이 <b>사용자가
   * 끌어 놓은 컬럼 폭</b>을 흔든다 — 367246c 가 환경설정에서 고친 것과 같은 자리다.
   *
   * <p><b>게이트는 코드 수다</b>(frontend/grid.md 의 *건수 컬럼* 경로 · screen/code/requirements.md). 마스터 응답이 그
   * 수를 갖고 있으므로 <b>행마다</b> 답할 수 있다 — 하단을 조회해야만 아는 것이 아니다.
   *
   * <p>시스템 그룹에는 <b>체크박스가 아예 없다</b>(screen/code/requirements.md) — 비활성이 아니라 없는 것이며,
   * 그 사유는 자기 배지가 이미 말한다.
   */
  const masterDeletable = useMemo<DeleteColumnSpec<CodeGroupRow>>(
    () => ({
      enabled: (row) => !row.data.sysYn && row.data.codeCount === 0,
      reason: (row) =>
        row.data.sysYn
          ? null
          : label(MSG.CODE_GROUP_HAS_CODE, { count: row.data.codeCount }),
    }),
    [],
  );

  /** 시스템 코드는 지울 수 없다 — sys/code.md. 배지가 사유를 말한다. */
  const detailDeletable = useMemo<DeleteColumnSpec<CodeRow>>(
    () => ({ enabled: (row) => !row.data.sysYn, reason: () => null }),
    [],
  );

  const controls = useMemo<GridControl[]>(
    () => [
      {
        key: 'refDef',
        slot: 'beforeRead',
        type: 'button',
        label: MSG.CODE_REF_DEF_BUTTON,
        // `READ` 만 가진 사용자에게는 버튼이 없다 — 정의는 컬럼 헤더로 이미 보인다(screen/code/requirements.md).
        actionCd: 'SAVE',
        menuCd: MENU_CD,
        disabled: savedGrpCd === null || detail.dirty,
        // 왜 눌리지 않는가 — 회색 버튼만 두면 버그로 읽힌다(screen/code/requirements.md).
        hint: savedGrpCd === null ? MSG.CODE_REF_DEF_NO_GROUP : MSG.CODE_REF_DEF_DIRTY,
        onClick: () => setModalOpen(true),
      },
    ],
    [savedGrpCd, detail.dirty],
  );

  /** 모달이 닫히면 <b>하단을 재조회한다</b> — 컬럼 집합이 바뀌었을 수 있다(screen/code/requirements.md). */
  const closeModal = useCallback(async () => {
    setModalOpen(false);
    const grpCd = selectedGrpCd.current;
    if (!grpCd) return;
    await Promise.all([readRefDefs(grpCd), detail.read()]);
  }, [detail, readRefDefs]);

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void readMaster()}
        // 조건과 컬럼 필터를 함께 지운다 — frontend/grid.md.
        onReset={master.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <SplitPane
          storageKey="code"
          first={(collapsed, expand) => (
            <DataGrid
              title={MSG.CODE_GROUP_TITLE}
              menuCd={MENU_CD}
              // 개인화의 키다 — 같으면 위아래 설정이 서로를 덮는다(frontend/grid.md).
              gridId="master"
              controller={master}
              deletable={masterDeletable}
              onSelect={selectGroup}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
          second={(collapsed, expand) => (
            <DataGrid
              title={MSG.CODE_DETAIL_TITLE}
              menuCd={MENU_CD}
              gridId="detail"
              controller={detail}
              controls={controls}
              deletable={detailDeletable}
              emptyText={detailEmpty}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
        />
      </div>

      <RefDefModal
        open={modalOpen}
        grpCd={savedGrpCd}
        grpNm={group?.data.grpNm ?? ''}
        menuCd={MENU_CD}
        refCdOptions={refCdOptions}
        onClose={() => void closeModal()}
      />
    </FillColumn>
  );
}

// ── 컬럼 ──────────────────────────────────────────────────────────

function buildGroupColumns(): ColumnDef<CodeGroupRow>[] {
  return [
    {
      field: 'grpCd',
      header: MSG.CODE_COL_GRP_CD,
      type: 'text',
      width: 180,
      pinned: 'left',
      sortable: true,
      // PK 다 — 신규 행에서만 열리고, 필수이고, 헤더에 필수 표시가 붙는다(frontend/grid.md).
      // 고치려면 지우고 다시 만든다(screen/code/requirements.md).
      pk: true,
      // 왜 못 지우는지가 <b>눌러 보기 전에</b> 보여야 한다(screen/code/requirements.md).
      badge: (row) =>
        row.sysYn ? { text: label(MSG.CODE_SYSTEM_BADGE), tone: 'muted' } : null,
    },
    {
      field: 'grpNm',
      header: MSG.CODE_COL_GRP_NM,
      type: 'text',
      width: 200,
      sortable: true,
      required: true,
      // <b>다국어가 아니다</b> — 관리 화면 전용 명칭이라 컬럼 값이다(sys/code.md).
      editable: true,
    },
    {
      field: 'grpDesc',
      header: MSG.CODE_COL_GRP_DESC,
      type: 'text',
      width: 200,
      fill: true,
      filter: false,
      editable: true,
      editor: 'largeText',
    },
    /*
      <b>사용 컬럼이 없다</b>(sys/code.md). 그룹은 콤보의 후보가 아니라 <b>소스가 이름으로
      지목하는 것</b>이라 끄는 것의 뜻이 정의되지 않는다 — 끄면 콤보가 통째로 비어 화면이
      못 쓰거나, 무시되어 스위치가 아무 일도 안 한다. 코드 쪽에는 그대로 있다.
    */
    { field: 'sortNo', header: MSG.CODE_COL_SORT_NO, type: 'number', width: 90, sortable: true, editable: true },
    {
      field: 'codeCount',
      header: MSG.CODE_COL_COUNT,
      type: 'number',
      width: 90,
      // 파생이라 정렬 대상이 아니다(frontend/grid.md) — 서버 화이트리스트에도 없다.
      filter: false,
    },
    {
      field: 'sysYn',
      header: MSG.CODE_COL_SYS_YN,
      type: 'ynFlag',
      width: 90,
      sortable: true,
      /*
        <b>편집 선언이 없다.</b> 켤 수 있게 하면 관리자가 아무 그룹이나 잠글 수 있고,
        끌 수 있게 하면 보호가 한 번의 클릭으로 사라진다 — sys/code.md 이 저장 서비스에서
        거부한다고 한 것을 화면은 <b>입력 수단을 없애는 것</b>으로 갚는다(screen/code/requirements.md).
      */
    },
    // 감사 4컬럼은 켤 수 있다 — 이 행은 사람이 만들고 사람이 고치므로 감사가 실제로
    // 갈린다(screen/code/requirements.md 가 메시지 화면만 `hidden` 으로 둔 이유의 반대편이다).
    ...auditColumns<CodeGroupRow>({ sortable: true }),
  ];
}

/**
 * 하단 — <b>고정 컬럼 + 정의 수만큼</b>이다(screen/code/requirements.md · frontend/grid.md).
 *
 * <p>`DTL_CD` 와 코드명이 <b>좌측 고정</b>인 것은 사실상 필수다 — 정의가 늘면 그리드가 옆으로
 * 자라고, 고정하지 않으면 스크롤 중에 *"어느 코드의 값인가"* 가 사라진다(screen/code/requirements.md).
 */
function buildCodeColumns(refDefs: CodeRefDefRow[]): ColumnDef<CodeRow>[] {
  return [
    {
      field: 'dtlCd',
      header: MSG.CODE_COL_DTL_CD,
      type: 'text',
      width: 160,
      pinned: 'left',
      sortable: true,
      // 그룹과 복합 PK 다 — frontend/grid.md.
      pk: true,
      badge: (row) =>
        row.sysYn ? { text: label(MSG.CODE_SYSTEM_BADGE), tone: 'muted' } : null,
    },
    {
      field: 'codeNm',
      header: MSG.CODE_COL_CODE_NM,
      type: 'text',
      width: 200,
      pinned: 'left',
      /*
        값이 `SYS_MESSAGE` 로 간다 — screen/code/requirements.md. **필수가 아니다**: 비우면 그 언어의 행을
        지우는 것이 규약이고(빈 문자열이 아니다), 지운 뒤 셀에 보이는 <b>키 문자열</b>이
        *아직 안 채웠다* 는 사실을 그대로 드러낸다(sys/code.md).
      */
      editable: true,
    },
    {
      field: 'dtlDesc',
      header: MSG.CODE_COL_DTL_DESC,
      type: 'text',
      width: 200,
      filter: false,
      editable: true,
      editor: 'largeText',
    },
    {
      field: 'useYn',
      header: MSG.CODE_COL_USE_YN,
      type: 'ynFlag',
      width: 90,
      sortable: true,
      editable: (row) =>
        row.sysYn ? { ok: false, message: label(MSG.CODE_SYSTEM_BADGE) } : true,
    },
    // <b>콤보 정렬</b>이다 — 관리 화면용이 아니다(screen/code/requirements.md).
    { field: 'sortNo', header: MSG.CODE_COL_SORT_NO, type: 'number', width: 90, sortable: true, editable: true },

    { field: 'sysYn', header: MSG.CODE_COL_SYS_YN, type: 'ynFlag', width: 90, sortable: true },
    ...auditColumns<CodeRow>({ sortable: true }),

    /*
      <b>참조 컬럼은 선언의 맨 뒤다</b>(2026-08-31 — 지시). 가운데에 끼우면 그룹을 옮길
      때마다 <b>선언 컬럼들 한가운데가 늘었다 줄었다</b> 한다 — 오른쪽 끝에 모여 있으면
      <i>여기서부터가 이 그룹의 속성</i> 이라는 경계가 자리로 드러난다.

      <b>설정을 저장한 화면과도 여기서 맞는다.</b> 개인화 값은 동적 컬럼을 담지 않으므로
      (frontend/grid.md) `applyPref` 가 그것을 <i>남은 것</i>으로 <b>맨 뒤에 붙인다</b> — 선언이
      가운데에 두면 저장한 사람과 아닌 사람의 컬럼 순서가 갈린다.
    */
    ...refDefs.map(toRefColumn),
  ];
}

/**
 * 정의 한 줄 → <b>동적 컬럼 하나</b> — frontend/grid.md.
 *
 * <p>값은 `refs` <b>맵의 한 칸</b>이라 읽기는 `derive`, 쓰기는 `patch` 다. 빈 셀은 <b>값이
 * 없는 것</b>이고 비우고 저장하면 그 행을 지운다(sys/code.md) — 빈 문자열을 저장하지 않는다.
 *
 * <p><b>`SYS_YN='Y'` 인 행에서도 열린다</b>(screen/code/requirements.md). `SYS_YN` 이 지키는 것은 <b>코드의
 * 존재</b>이지 그 속성값이 아니다 — 참조값은 운영 데이터다.
 */
function toRefColumn(def: CodeRefDefRow): ColumnDef<CodeRow> {
  return {
    // `colId` 를 직접 준다 — 없으면 교체마다 컬럼 상태가 끊긴다(frontend/grid.md).
    field: `ref.${def.refCd}`,
    // <b>메시지 키가 아니다</b> — 정의 행의 `REF_NM` 이며 그것이 이 컬럼의 존재 이유다.
    header: def.refNm,
    dynamic: true,
    type: 'text',
    width: 140,
    editable: true,
    derive: (row) => row.refs?.[def.refCd] ?? '',
    patch: (row, value) => {
      const next = { ...(row.refs ?? {}) };
      // 셀 편집기가 내는 것은 문자열이다 — 그 밖의 것은 값이 아니라 사고이므로 빈 칸으로
      // 접는다. `String(value)` 로 두면 객체가 `[object Object]` 로 저장된다(frontend/grid.md).
      const text = typeof value === 'string' ? value : '';
      // 비운 칸은 <b>키를 지운다</b> — 빈 문자열을 남기면 "없음" 의 표현이 둘이 된다.
      if (text.trim() === '') {
        delete next[def.refCd];
      } else {
        next[def.refCd] = text;
      }
      return { refs: next };
    },
  };
}

// ── 조회조건 (screen/code/requirements.md) ────────────────────────────────────────────

/**
 * <b>하단 조건 둘이 마스터를 거른다</b> — screen/code/requirements.md.
 *
 * <p>*"이 코드값이 어느 그룹에 있더라"* 가 실제로 자주 묻는 것이며, 마스터만 거르면 답할 수
 * 없다. 고르면 하단이 그 조건으로 <b>미리 걸려 있다</b>.
 *
 * <p><b>참조값 조건이 없다.</b> 컬럼이 그룹마다 다르므로 폼도 그룹에 따라 바뀌어야 하고,
 * 그러면 *"그룹을 고르기 전에는 검색할 수 없는 조건"* 이 생긴다 — 참조값은 <b>컬럼 필터</b>로
 * 거른다(frontend/grid.md). 하단이 전량이라 그 범위가 곧 전부다.
 *
 * <p><b>사용 여부·시스템 여부도 없다</b>(2026-08-30 개정). 같은 이름의 컬럼이 <b>위아래 두
 * 그리드에 다 있어서</b>, 폼의 라벨만으로는 <i>어느 쪽을 거르는가</i> 를 말할 수 없었다 —
 * 바로 아래 *코드* · *코드명* 은 하단의 것인데 그 둘은 마스터의 것이었다. 값 집합이 둘뿐인
 * 조건이라 <b>컬럼 필터</b>로 충분하고, 거기서는 <b>어느 그리드의 것인지가 자리로 드러난다</b>.
 * (그룹의 *사용 여부* 는 컬럼 자체가 없어졌다 — sys/code.md.)
 *
 * <p>남은 넷이 <b>두 쌍</b>으로 읽힌다 — 앞 둘은 마스터, 뒤 둘은 하단이며 뒤 둘이 마스터도
 * 거른다.
 */
function buildSearchFields(): SearchField[] {
  return [
  {
    field: 'grpCd',
    label: MSG.CODE_SEARCH_GRP_CD,
    type: 'text',
    op: 'contains',
    ops: ['eq', 'startsWith', 'contains', 'endsWith'],
  },
  {
    field: 'grpNm',
    label: MSG.CODE_SEARCH_GRP_NM,
    type: 'text',
    op: 'contains',
    ops: ['eq', 'startsWith', 'contains', 'endsWith'],
  },
  {
    field: 'dtlCd',
    label: MSG.CODE_SEARCH_DTL_CD,
    type: 'text',
    op: 'contains',
    // 파생이라 서버가 문자열 비교만 편다 — 없는 연산자를 열면 400 이다(screen/code/requirements.md).
    ops: ['eq', 'startsWith', 'contains', 'endsWith'],
  },
  {
    field: 'codeNm',
    label: MSG.CODE_SEARCH_CODE_NM,
    type: 'text',
    op: 'contains',
    ops: ['eq', 'startsWith', 'contains', 'endsWith'],
  },
  ];
}

// ── 검증 · 경고 (frontend/grid.md 의 3층) ──────────────────────────────────

function validateGrpCds(rows: GridRow<CodeGroupRow>[]): GridIssue[] {
  return duplicates(rows, 'grpCd', (row) => row.data.grpCd);
}

function validateDtlCds(rows: GridRow<CodeRow>[]): GridIssue[] {
  return duplicates(rows, 'dtlCd', (row) => row.data.dtlCd);
}

/** 같은 그리드 안의 중복은 클라이언트가 판정할 수 있다. DB 에 이미 있는 값은 서버다. */
function duplicates<T>(
  rows: GridRow<T>[],
  field: string,
  keyOf: (row: GridRow<T>) => string,
): GridIssue[] {
  const issues: GridIssue[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = keyOf(row)?.trim() ?? '';
    if (key === '') continue;
    if (seen.has(key)) {
      issues.push({ rowId: row.id, field, message: label(MSG.CODE_DUPLICATE) });
    }
    seen.add(key);
  }
  return issues;
}

/**
 * 코드를 지우면 <b>참조값이 함께 사라진다</b>(screen/code/requirements.md).
 *
 * <p>게이트가 아니라 확인인 이유는 <b>DB 가 거부하지 않기</b> 때문이다 — 참조값은 그 행의
 * 파생이라 서비스가 먼저 지운다. 여기에 게이트를 두면 <b>아무것도 지울 수 없다</b>: 정의를
 * 쓰는 그룹의 코드는 대개 참조 1건 이상이다.
 */
function deleteWarnings(rows: GridRow<CodeRow>[]): string[] {
  return rows
    .filter((row) => row.state === 'D' && Object.keys(row.data.refs ?? {}).length > 0)
    .map((row) =>
      label(MSG.CODE_DELETE_REF_WARN, {
        dtlCd: row.data.dtlCd,
        count: Object.keys(row.data.refs ?? {}).length,
      }),
    );
}
