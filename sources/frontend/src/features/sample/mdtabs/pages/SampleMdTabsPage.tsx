import { useCallback, useMemo, useRef } from 'react';
import { App } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow, RowState } from '@/shared/grid/rows';
import type { ColumnDef, DeleteColumnSpec } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { SAMPLE_TABS_ENDPOINTS } from '@/features/sample/mdtabs/api/endpoints';
import {
  SampleDetailTabs,
  type SampleDetailTabsHandle,
} from '@/features/sample/mdtabs/components/SampleDetailTabs';
import type { SampleOrder } from '@/features/sample/types';

/**
 * `SMPL_MD_TABS` — playbook/INDEX.md. **참조 구현이지 업무 화면이 아니다.**
 *
 * <p>이 화면이 **유일한 실물**로 갖는 것은 하나다(playbook/INDEX.md 의 굵은 ●): **하단 디테일 탭**.
 * 지우면 템플릿에서 그 어휘의 예가 사라진다.
 *
 * <h2>③에 탭을 얹은 것이지 ③을 베낀 것이 아니다</h2>
 *
 * <p>마스터는 ③의 아홉이고 조회조건도 ③과 같다(§7.2 · §7.3). 갈리는 것은 **하단**이며,
 * 그래서 이 파일이 갖는 것은 마스터와 스플리터뿐이고 탭 둘은 `SampleDetailTabs` 가 갖는다 —
 * 한 파일에 컨트롤러 셋을 두면 *어느 `dirty` 가 누구의 것인가* 를 읽는 사람이 세야 한다.
 *
 * <h2>저장 단위가 셋이다</h2>
 *
 * <p>③이 둘이었던 자리에서 하나가 는다(마스터 · 품목 · 태그). 묶지 않는 이유는 그대로다 —
 * 저장 버튼이 그리드마다 따로이며(frontend/grid.md), 묶으면 *태그만 고쳤는데 주문도 갱신됨* 이
 * 되어 감사 컬럼이 거짓말을 한다.
 *
 * <h2>미저장 경고를 **한 번만** 묻는다</h2>
 *
 * <p>playbook/INDEX.md — 마스터의 선택을 바꿀 때 탭 둘 중 하나라도 미저장이면 묻는다. 탭마다 물으면
 * 사용자는 같은 물음에 두 번 답하면서도 **무엇을 잃는지는 여전히 모른다**. 탭을 오가는
 * 것으로는 묻지 않는다 — 표시가 바뀔 뿐 데이터를 버리지 않는다.
 */

const MENU_CD = 'SMPL_MD_TABS';

/** 주문 상태 넷 — playbook/INDEX.md 의 전이표. **소스가 값을 갖는다**(sys/code.md). */
const STAT_RCV = 'RCV';
const STAT_DON = 'DON';

/**
 * 편집이 열리는가 — playbook/INDEX.md 의 전이표를 그대로 편다(③과 같은 규칙이다).
 *
 * <p>**`LOCK_YN` 이 먼저다.** 상태는 *일이 어디까지 갔나* 이고 잠금은 *운영이 잠갔나*
 * 이며, 잠긴 것은 상태와 무관하게 닫힌다. 신규 행(`C`)은 언제나 열린다.
 */
function amountEditable(row: SampleOrder, state: RowState): boolean | { ok: false; message: string } {
  if (state === 'C') return true;
  if (row.lockYn) return { ok: false, message: label(MSG.SAMPLE_LOCKED) };
  // 확정부터는 금액이 잠긴다 — 확정된 금액이다(playbook/INDEX.md).
  return row.ordStatCd === STAT_RCV;
}

function textEditable(row: SampleOrder, state: RowState): boolean | { ok: false; message: string } {
  if (state === 'C') return true;
  if (row.lockYn) return { ok: false, message: label(MSG.SAMPLE_LOCKED) };
  // 완료는 전부 잠긴다.
  return row.ordStatCd !== STAT_DON;
}

export function SampleMdTabsPage() {
  const { modal } = App.useApp();
  const searchForm = useRef<SearchFormHandle>(null);
  /**
   * 하단이 부르는 손잡이 — 선택을 상태로 들지 않는다.
   *
   * <p>③은 `selected` 를 들었지만 그것은 **제목 접미**를 만들기 위해서였다. 여기서는 접미를
   * `SampleDetailTabs` 가 `master.selected` 에서 직접 읽으므로(frontend/grid.md) 같은 사실을 두 곳에
   * 두면 **마스터에서 이름을 고치고 저장하기 전**에 둘이 갈린다.
   */
  const tabs = useRef<SampleDetailTabsHandle | null>(null);

  const header = useSearchFormHeader();

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  const masterColumns = useMemo(() => buildOrderColumns(), []);
  const searchFields = useMemo(() => buildSearchFields(), []);

  const masterApi = useMemo(
    () => ({
      read: { url: SAMPLE_TABS_ENDPOINTS.getOrderList, emptyNotice: true },
      save: { url: SAMPLE_TABS_ENDPOINTS.saveOrders },
    }),
    [],
  );

  const master = useGridController<SampleOrder>({
    menuCd: MENU_CD,
    columns: masterColumns,
    api: masterApi,
    params: collectConditions,
    addRow: {
      defaults: () => ({
        // 채번이다 — 신규 행에서 `null` 이고 서버가 정한다.
        ordId: null,
        ordNo: '',
        ordNm: '',
        custId: '',
        custNm: '',
        ordStatCd: STAT_RCV,
        ordDt: null,
        ordDtm: null,
        ordQty: 0,
        unitAmt: 0,
        // 파생은 서버가 계산한다 — 임의의 값으로 채우면 *계산해 보니 그렇다* 와 구분되지 않는다.
        ordAmt: 0,
        vatAmt: 0,
        dcRt: 0,
        urgentYn: false,
        useYn: true,
        lockYn: false,
        errMsg: null,
        itemCnt: 0,
        regId: null,
        regDtm: null,
        modId: null,
        modDtm: null,
      }),
    },
    toSavePayload: (rows) => ({
      rows: rows.map((row) => ({
        rowState: row.state,
        ordId: row.data.ordId,
        // 삭제는 대상만 가리킨다 — 나머지를 보내면 서버가 쓰지 않을 값을 검증하게 된다.
        ...(row.state === 'D'
          ? {}
          : {
              ordNo: row.data.ordNo,
              ordNm: row.data.ordNm,
              custId: row.data.custId,
              custNm: row.data.custNm,
              ordStatCd: row.data.ordStatCd,
              ordDt: row.data.ordDt,
              ordQty: row.data.ordQty,
              unitAmt: row.data.unitAmt,
              dcRt: row.data.dcRt,
              urgentYn: row.data.urgentYn,
              useYn: row.data.useYn,
            }),
        /*
          **`ordAmt`·`vatAmt`·`lockYn` 을 보내지 않는다.** 앞의 둘은 서버가 계산하는
          파생이고 마지막은 운영이 정하는 값이다 — 보낼 경로를 두면 화면이 금액을 스스로
          정하거나 **잠긴 주문이 스스로 잠금을 푸는** 요청이 성립한다(원칙 P1).
        */
      })),
    }),
  });

  /**
   * **화면이 묻는다.** 그리드에 맡기면 물음의 결과를 화면이 알 수 없고, 그 답을 알아야
   * 선택을 받아들일지 정할 수 있다(frontend/grid.md).
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
   * 주문 선택 — frontend/grid.md 의 상태 셋을 그대로 편다.
   *
   * <p>**거부할 수 있다.** 하단에 미저장 편집이 있으면 묻고, 아니라고 하면 판의 선택이
   * 되돌아간다(UX-10). 거부권이 없으면 *보고 있는 것*과 *고른 것*이 갈리고, 그 상태로
   * 저장하면 **A 주문의 품목이 B 주문으로 나간다**.
   *
   * <p>**묻는 것은 여기 한 번뿐이다**(playbook/INDEX.md). 탭이 둘이어도 물음은 하나이며, 그 판단은
   * `SampleDetailTabsHandle.dirty` 가 둘을 합쳐 답한다.
   */
  const selectOrder = useCallback(
    async (row: GridRow<SampleOrder> | null): Promise<boolean> => {
      if (tabs.current?.dirty() && !(await confirmDiscard())) {
        return false;
      }
      // 신규 행은 부모 키가 아직 DB 에 없다 — 붙이려 하면 FK 위반이다(frontend/grid.md).
      await tabs.current?.select(!row || row.state === 'C' ? null : row.data.ordId);
      return true;
    },
    [confirmDiscard],
  );

  /**
   * 마스터 조회는 **하단을 리셋한다** — frontend/grid.md.
   *
   * <p>조회는 목록을 통째로 바꾸므로 이전에 보던 행이 결과에 없을 수도 있다. 하단이 남아
   * 있으면 **다른 주문의 품목을 그 주문 것으로 보게 된다** — 탭이 둘이라 그 오해가 두 배다.
   */
  const readMaster = useCallback(async () => {
    await tabs.current?.select(null);
    await master.read();
  }, [master]);

  /**
   * 지울 수 있는가 — **마스터 삭제 게이트**(frontend/grid.md).
   *
   * <p>게이트가 **건수 컬럼**에서 나온다: 마스터 응답이 품목 수를 갖고 있으므로 행마다
   * 답할 수 있다. 잠긴 주문도 닫힌다.
   *
   * <p>**태그는 게이트에 넣지 않는다.** 서버는 태그가 붙은 주문의 삭제도 막지만
   * (FK 가 `RESTRICT` 다) 마스터 응답에 태그 수가 없고, 그것을 실으려면 목록 조회가
   * `SMPL_ORDER_TAG` 를 한 번 더 훑는다 — ③이 쓰는 것과 **같은 엔드포인트**라 이 화면
   * 하나 때문에 다른 화면의 조회가 무거워진다. 눌러 보면 서버가 사유를 담아 거절한다.
   */
  const masterDeletable = useMemo<DeleteColumnSpec<SampleOrder>>(
    () => ({
      enabled: (row) => row.data.itemCnt === 0 && !row.data.lockYn,
      reason: (row) =>
        row.data.lockYn
          ? label(MSG.SAMPLE_LOCKED)
          : label(MSG.SAMPLE_DELETE_BLOCKED, { count: row.data.itemCnt }),
    }),
    [],
  );

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void readMaster()}
        onReset={master.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        {/* 축이 상하다 — 마스터가 컬럼 아홉으로 넓고, 하단은 탭바를 얹을 폭이 필요하다. */}
        <SplitPane
          storageKey="smplMdTabs"
          first={(collapsed, expand, axis) => (
            <DataGrid<SampleOrder>
              title={MSG.SAMPLE_ORDER_GRID_TITLE}
              menuCd={MENU_CD}
              // 개인화의 키다 — 같으면 위아래 설정이 서로를 덮는다(frontend/grid.md).
              gridId="master"
              controller={master}
              deletable={masterDeletable}
              emptyText={MSG.SAMPLE_ORDER_EMPTY}
              onSelect={selectOrder}
              collapsed={collapsed}
              collapsedAxis={axis}
              onExpand={expand}
            />
          )}
          second={(collapsed, expand) => (
            <SampleDetailTabs
              menuCd={MENU_CD}
              master={master}
              handleRef={tabs}
              collapsed={collapsed}
              onExpand={expand}
            />
          )}
        />
      </div>
    </FillColumn>
  );
}

/**
 * 마스터 컬럼 아홉 — playbook/INDEX.md 가 **§5.2 의 아홉**이라고 적었다.
 *
 * <p>③과 같은 표이므로 같은 키를 쓴다. 여기에 새 키를 만들면 같은 컬럼이 두 화면에서
 * 다른 이름으로 보이는 날이 온다 — 폴더가 가르는 것은 인가 경계이지(playbook/INDEX.md) 표의
 * 정의가 아니다.
 */
function buildOrderColumns(): ColumnDef<SampleOrder>[] {
  return [
    {
      field: 'ordNo',
      header: MSG.SAMPLE_COL_ORD_NO,
      type: 'text',
      width: 160,
      pinned: 'left',
      sortable: true,
      // 업무 키다 — 신규 행에서만 열리고 고치려면 지우고 다시 만든다(frontend/grid.md).
      pk: true,
      required: true,
    },
    {
      field: 'ordNm',
      header: MSG.SAMPLE_COL_ORD_NM,
      type: 'text',
      width: 200,
      sortable: true,
      required: true,
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      field: 'custNm',
      header: MSG.SAMPLE_COL_CUST_NM,
      type: 'text',
      width: 160,
      sortable: true,
      required: true,
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      field: 'ordStatCd',
      header: MSG.SAMPLE_COL_ORD_STAT,
      type: 'code',
      width: 110,
      sortable: true,
      // 후보가 공통코드에서 온다 — 이름과 순서는 운영이 정한다(sys/code.md).
      grpCd: 'SMPL_ORD_STAT',
      renderer: 'badge',
      // 값이 색을 고른다 — tone 맵(frontend/grid.md).
      tone: { RCV: 'none', CFM: 'ok', SHP: 'warn', DON: 'muted' },
    },
    {
      field: 'ordDt',
      header: MSG.SAMPLE_COL_ORD_DT,
      type: 'date',
      width: 120,
      sortable: true,
      required: true,
      precision: 'day',
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      field: 'ordQty',
      header: MSG.SAMPLE_COL_ORD_QTY,
      type: 'number',
      width: 100,
      sortable: true,
      editable: (row, ctx) => amountEditable(row, ctx.state),
      editor: 'number',
      // 계산은 한 곳에서 둘 다 한다 — 연쇄로 두면 순서가 숨은 규칙이 된다(frontend/grid.md).
      afterEdit: (row) => ({
        ordAmt: (row.ordQty ?? 0) * (row.unitAmt ?? 0),
        vatAmt: (row.ordQty ?? 0) * (row.unitAmt ?? 0) * 0.1,
      }),
    },
    {
      field: 'ordAmt',
      header: MSG.SAMPLE_COL_ORD_AMT,
      type: 'number',
      width: 130,
      sortable: true,
      // 파생이다 — 편집 선언이 없으면 읽기 전용이다(frontend/grid.md).
    },
    {
      field: 'urgentYn',
      header: MSG.SAMPLE_COL_URGENT,
      type: 'ynFlag',
      width: 90,
      sortable: true,
      // 스위치다 — 체크박스가 아니다(frontend/grid.md).
      editable: (row, ctx) => textEditable(row, ctx.state),
      editor: 'switch',
    },
    {
      field: 'useYn',
      header: MSG.SAMPLE_COL_USE,
      type: 'ynFlag',
      width: 90,
      sortable: true,
      editable: (row, ctx) => textEditable(row, ctx.state),
      editor: 'switch',
    },
    ...auditColumns<SampleOrder>(),
  ];
}

/**
 * 조회조건 넷 — playbook/INDEX.md 이 **§5.3 과 같다**고 적었다. **마스터에만 있다.**
 *
 * <p>탭 둘은 조회조건을 갖지 않는다 — 대상이 마스터의 선택이며 그것은 `searchParams`
 * (구조)이지 `conditions`(사용자가 좁힌 것)가 아니다(backend/api.md).
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      field: 'ordNo',
      label: MSG.SAMPLE_COND_ORD_NO,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      field: 'custNm',
      label: MSG.SAMPLE_COND_CUST_NM,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      field: 'ordStatCd',
      label: MSG.SAMPLE_COND_ORD_STAT,
      type: 'select',
      op: 'in',
      grpCd: 'SMPL_ORD_STAT',
      // 완료를 뺀 셋이 기본이다 — 끝난 주문이 목록을 채우면 지금 할 일이 묻힌다.
      defaultValue: ['RCV', 'CFM', 'SHP'],
    },
    {
      field: 'ordDt',
      label: MSG.SAMPLE_COND_ORD_DT,
      type: 'dateRange',
      // **`DATE` 컬럼이다** — 적지 않으면 시각까지 보내고 서버가 그 값을 못 읽는다.
      precision: 'day',
      // 기간이 필수가 아니다 — 이 표는 대용량 이력이 아니다(screen/log/access/requirements.md 와 갈리는 자리).
      required: false,
      rangeDays: { default: 30, max: 365 },
    },
  ];
}
