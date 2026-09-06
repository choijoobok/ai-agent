import { useCallback, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { auditColumns } from '@/shared/grid/auditColumns';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useConfirmDiscard } from '@/shared/grid/useConfirmDiscard';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow, RowState } from '@/shared/grid/rows';
import type { ColumnDef, DeleteColumnSpec } from '@/shared/grid/types';
import type { ExcelSpec } from '@/shared/grid/excel/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { SAMPLE_VERT_ENDPOINTS } from '@/features/sample/mdvertical/api/endpoints';
import type { SampleOrder, SampleOrderItem } from '@/features/sample/types';
import { buildItemColumns } from '@/features/sample/itemColumns';

/**
 * `SMPL_MD_VERT` — playbook/INDEX.md. <b>참조 구현이지 업무 화면이 아니다.</b>
 *
 * <p>이 화면이 <b>유일한 실물</b>로 갖는 것 셋(playbook/INDEX.md 의 굵은 ●): 스플리터 상하 분할 ·
 * <b>마스터 삭제 게이트</b> · {@code editable} 함수. 지우면 템플릿에서 그 어휘의 예가
 * 사라진다.
 *
 * <h2>저장 단위가 둘이다</h2>
 *
 * <p>마스터와 디테일이 <b>각자 저장한다</b>(playbook/INDEX.md). 저장 버튼이 그리드마다 따로이며
 * (frontend/grid.md), 묶으면 <i>품목만 고쳤는데 주문도 갱신됨</i> 이 되어 감사 컬럼이 거짓말을 한다.
 *
 * <h2>②가 <b>서버 생성</b>이다 — playbook/excel-download.md 의 세 번째 갈래</h2>
 *
 * <p>이 화면이 그 갈래의 <b>원래 사례</b>다. ADR 은 <i>"헤더 1건 + 상품 N건이고 화면은
 * 상단과 하단으로 쪼개 보여주지만, 사용자는 헤더와 상품을 합친 엑셀 하나를 원한다"</i> 로
 * 갈래를 열었다.
 *
 * <p><b>아래 pane 의 ②는 그대로 프론트 생성이다.</b> 품목 그리드의 표는 화면의 표와 같으므로
 * 서버로 돌릴 이유가 없다 — 왕복이 0 인 것을 왕복 하나로 만들 뿐이다.
 */

const MENU_CD = 'SMPL_MD_VERT';

/** 주문 상태 넷 — playbook/INDEX.md 의 전이표. <b>소스가 값을 갖는다</b>(sys/code.md). */
const STAT_RCV = 'RCV';
const STAT_CFM = 'CFM';
const STAT_DON = 'DON';

/**
 * 편집이 열리는가 — playbook/INDEX.md 의 전이표를 그대로 편다.
 *
 * <p><b>{@code LOCK_YN} 이 먼저다.</b> 상태는 <i>일이 어디까지 갔나</i> 이고 잠금은
 * <i>운영이 잠갔나</i> 이며, 잠긴 것은 상태와 무관하게 닫힌다.
 *
 * <p>신규 행({@code C})은 언제나 열린다 — 아직 상태가 없다.
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

export function SampleMdVerticalPage() {
  const searchForm = useRef<SearchFormHandle>(null);
  /** 지금 보고 있는 주문 — 디테일의 대상이자 저장 페이로드의 부모 키다. */
  const selectedOrdId = useRef<string | null>(null);
  const [selected, setSelected] = useState<GridRow<SampleOrder> | null>(null);

  const header = useSearchFormHeader();

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  const masterColumns = useMemo(() => buildOrderColumns(), []);
  const detailColumns = useMemo(() => buildItemColumns(), []);
  const searchFields = useMemo(() => buildSearchFields(), []);

  const detailSearchParams = useCallback(() => ({ ordId: selectedOrdId.current }), []);

  const masterApi = useMemo(
    () => ({
      read: { url: SAMPLE_VERT_ENDPOINTS.getOrderList, emptyNotice: true },
      save: { url: SAMPLE_VERT_ENDPOINTS.saveOrders },
      actions: [
        {
          key: 'ship',
          label: MSG.SAMPLE_ACTION_SHIP,
          url: SAMPLE_VERT_ENDPOINTS.shipOrders,
          /*
            <b>프로그레스가 없다</b>(playbook/INDEX.md). 상태 하나를 바꾸는 일이라 즉시 끝나며,
            창이 떴다가 바로 닫히는 깜빡임은 <i>무언가 잘못됐나</i> 로 읽힌다(backend/crosscutting.md).
          */
          target: 'selected' as const,
          // 확정만 출고로 간다 — 거르는 것은 UX 이고 판정은 서버다(frontend/grid.md).
          eligible: (row: GridRow<SampleOrder>) =>
            row.data.ordStatCd === STAT_CFM && !row.data.lockYn,
          hint: MSG.SAMPLE_ACTION_SHIP_HINT,
          confirm: MSG.SAMPLE_ACTION_SHIP_CONFIRM,
          /*
            **봉투의 이름은 `targets` 로 고정이다**(frontend/grid.md) — `toTargets` 는 *모양만 바꾸는
            자리* 라 그 이름을 바꾸지 못한다. 여기서 `{ ordIds: [...] }` 를 돌려주고 있었고,
            그러면 몸통이 `{ targets: { ordIds: [...] } }` 가 되어 서버의 `@NotEmpty` 에
            걸린다 — **이 실행은 한 번도 서버에 닿은 적이 없었다**(2026-09-02. ①에서 같은
            것을 고친 날 이 화면이 빠졌다).
          */
          toTargets: (rows: GridRow<SampleOrder>[]) => rows.map((row) => row.data.ordId),
        },
        {
          /*
            **품목 금액 재계산 — 이 템플릿의 행×디테일 진행률이다**(backend/crosscutting.md · playbook/INDEX.md).

            바로 위의 출고 지시와 **나란히 서는 것이 요점이다**: 같은 `EXECUTE`, 같은
            `target:'selected'` 인데 하나는 응답이 곧 끝이고 이쪽은 **고른 주문마다 딸린
            품목 전건**을 돈다 — 주문 하나가 수천 건일 수 있다.

            **화면은 폴링 코드를 쓰지 않는다**(playbook/INDEX.md). `progress: true` 한 줄이면 그리드가
            응답의 `jobId` 를 진행률 훅에 넘기고, 창은 서버가 구간마다 갈아 끼우는 소제목과
            건수를 그린다 — *지금 어느 주문* 은 서버만 알 수 있는 사실이다.

            **`params` 가 없다.** 다시 세는 기준은 품목이 이미 들고 있는 수량과 단가이므로
            사람이 줄 값이 없다 — 그래서 확인 창(`confirm`)이 그 자리를 대신한다(①의 일괄
            재계산은 모달이 실행/취소를 두므로 `confirm` 을 켜지 않았다).

            ── **대상이 `all` 인 이유 — 이 화면의 마스터는 한 행만 고를 수 있다** ──

            `all` 은 *전체* 가 아니라 **지금 그리드에 들어 있는 행**이다(frontend/grid.md). 그래서
            사용자가 조회조건으로 좁힌 그 묶음이 대상이며, 아래 `eligible` 이 그중 대상이
            되는 것만 남긴다.

            `selected` 가 아닌 것은 **이 그리드가 단일 선택**이기 때문이다: 아래 pane 이
            고른 행의 품목을 보이므로(마스터-디테일) 여럿을 고르면 *어느 주문의 품목인가*
            가 사라지고, 선택을 여럿으로 열면 미저장 편집의 거부권(`onSelect` 가 `false`
            를 돌려주는 자리 · UX-10)도 함께 사라진다 — 그 상태로 저장하면 **A 주문의
            품목이 B 주문으로 나간다**.

            그런데 **행×디테일 진행률은 행이 둘 이상이어야 보인다**(구간이 넘어가는 것이
            그 어휘다). 단일 선택과 그 요구가 부딪히는 자리이고, 답은 대상을 **조회된
            묶음**으로 옮기는 것이다 — 고르는 제스처를 바꾸지 않는다.
          */
          key: 'recalcItems',
          label: MSG.SAMPLE_ACTION_RECALC_ITEMS,
          url: SAMPLE_VERT_ENDPOINTS.recalcItems,
          target: 'all' as const,
          progress: true,
          /*
            **접수만, 잠기지 않은 것만, 품목이 있는 것만.** 앞의 둘은 금액의 게이트를 그대로
            편 것이고(`amountEditable` — 확정부터는 금액이 잠긴다), 세 번째는 **일이 없는
            주문**을 빼는 것이다: 품목이 0건이면 그 구간은 `0/0` 이라 진행률 창이 **완료로
            보이는 구간**을 하나 그린다.

            거르는 것은 UX 이고 판정은 서버다(frontend/grid.md). **여기서 거르므로 서버의
            게이트가 화면 경로에서는 걸리지 않는다** — 걸리면 전건 거부이고(절반만 반영된
            금액은 되돌릴 지점이 없다), 조회 결과에 확정된 주문이 섞이는 것은 늘 있는 일이다.

            **`all` 에서도 0건이면 버튼이 꺼진다**(`DataGrid` 의 `off`) — 그때 아래 `hint`
            가 왜 없는지를 말한다.
          */
          eligible: (row: GridRow<SampleOrder>) =>
            row.data.ordStatCd === STAT_RCV && !row.data.lockYn && row.data.itemCnt > 0,
          hint: MSG.SAMPLE_ACTION_RECALC_ITEMS_HINT,
          confirm: MSG.SAMPLE_ACTION_RECALC_ITEMS_CONFIRM,
          toTargets: (rows: GridRow<SampleOrder>[]) => rows.map((row) => row.data.ordId),
        },
      ],
    }),
    [],
  );

  const detailApi = useMemo(
    () => ({
      read: { url: SAMPLE_VERT_ENDPOINTS.getItemList },
      save: { url: SAMPLE_VERT_ENDPOINTS.saveItems },
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
    toSaveRow: (row) => ({
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
        <b>`ordAmt`·`vatAmt`·`lockYn` 을 보내지 않는다.</b> 앞의 둘은 서버가 계산하는
        파생이고 마지막은 운영이 정하는 값이다 — 보낼 경로를 두면 화면이 금액을 스스로
        정하거나 <b>잠긴 주문이 스스로 잠금을 푸는</b> 요청이 성립한다(원칙 P1).
      */
    }),
  });

  const detail = useGridController<SampleOrderItem>({
    menuCd: MENU_CD,
    columns: detailColumns,
    api: detailApi,
    searchParams: detailSearchParams,
    addRow: {
      canAdd: () =>
        selectedOrdId.current !== null
          ? true
          : { ok: false, message: label(MSG.SAMPLE_ITEM_NO_MASTER) },
      defaults: () => ({
        ordId: selectedOrdId.current,
        // 주문 안의 다음 번호는 서버가 정한다 — 화면이 정하면 두 사람이 같은 번호를 만든다.
        itemSeq: null,
        ordNo: '',
        itemCd: '',
        itemNm: '',
        uomCd: 'EA',
        qty: 0,
        unitAmt: 0,
        amt: 0,
        dlvrDt: null,
        itemStatCd: 'WAIT',
        useYn: true,
        rmk: null,
        regId: null,
        regDtm: null,
        modId: null,
        modDtm: null,
      }),
    },
    toSaveRow: (row) => ({
      rowState: row.state,
      itemSeq: row.data.itemSeq,
      ...(row.state === 'D'
        ? {}
        : {
            itemCd: row.data.itemCd,
            itemNm: row.data.itemNm,
            uomCd: row.data.uomCd,
            qty: row.data.qty,
            unitAmt: row.data.unitAmt,
            dlvrDt: row.data.dlvrDt,
            itemStatCd: row.data.itemStatCd,
            useYn: row.data.useYn,
            rmk: row.data.rmk,
          }),
    }),
    saveEnvelope: (rows) => ({ ordId: selectedOrdId.current, rows }),
  });

  const confirmDiscard = useConfirmDiscard();

  /**
   * 주문 선택 — frontend/grid.md 의 상태 셋을 그대로 편다.
   *
   * <p><b>거부할 수 있다.</b> 아래에 미저장 편집이 있으면 묻고, 아니라고 하면 판의 선택이
   * 되돌아간다(UX-10). 거부권이 없으면 <i>보고 있는 것</i>과 <i>고른 것</i>이 갈리고, 그
   * 상태로 저장하면 <b>A 주문의 품목이 B 주문으로 나간다</b>.
   */
  const selectOrder = useCallback(
    async (row: GridRow<SampleOrder> | null): Promise<boolean> => {
      if (detail.dirty && !(await confirmDiscard())) {
        return false;
      }
      setSelected(row);

      if (!row || row.state === 'C') {
        // 신규 행은 부모 키가 아직 DB 에 없다 — 붙이려 하면 FK 위반이다(frontend/grid.md).
        selectedOrdId.current = null;
        detail.setRows([]);
        return true;
      }
      selectedOrdId.current = row.data.ordId;
      await detail.read(true);
      return true;
    },
    [confirmDiscard, detail],
  );

  /**
   * 마스터 조회는 <b>아래를 리셋한다</b> — frontend/grid.md.
   *
   * <p>조회는 목록을 통째로 바꾸므로 이전에 보던 행이 결과에 없을 수도 있다. 아래가 남아
   * 있으면 <b>다른 주문의 품목을 그 주문 것으로 보게 된다</b>.
   */
  const readMaster = useCallback(async () => {
    setSelected(null);
    selectedOrdId.current = null;
    detail.setRows([]);
    await master.read();
  }, [detail, master]);

  /**
   * ②의 셋 — <b>이름은 그대로 두고 경로만 서버</b>다(playbook/excel-download.md).
   *
   * <p>마스터의 아홉 컬럼을 내리지 않는다: 두 항목 모두 서버가 주문과 품목을 조인해 만든
   * <b>한 장</b>을 준다. 그 표는 화면에 없으므로 프론트가 만들 수 없다.
   *
   * <p><b>세 번째 항목은 조회로는 낼 수 없는 표</b>다 — 마스터는 주문을 내고 디테일은
   * 고른 하나의 품목을 내므로, <i>품목이 하나도 없는 주문들</i> 은 어느 그리드의 결과도
   * 아니다.
   */
  const excel = useMemo<ExcelSpec>(
    () => ({
      page: {
        url: SAMPLE_VERT_ENDPOINTS.exportOrderPage,
        // 지금 보이는 것을 화면이 지목한다 — 컬럼 필터와 정렬은 서버가 모른다(frontend/grid.md).
        body: () => ({ ordNos: master.rows.map((row) => row.data.ordNo) }),
      },
      all: {
        url: SAMPLE_VERT_ENDPOINTS.exportOrderAll,
        body: () => ({
          conditions: searchForm.current?.collect() ?? [],
          sorts: [],
          page: { page: 0, size: 1000 },
        }),
      },
      extra: [
        {
          key: 'noItem',
          label: MSG.SAMPLE_EXCEL_NO_ITEM,
          server: { url: SAMPLE_VERT_ENDPOINTS.exportOrderNoItem },
        },
      ],
    }),
    [master.rows],
  );

  /**
   * 지울 수 있는가 — <b>마스터 삭제 게이트</b>(frontend/grid.md). 이 화면의 유일한 실물이다.
   *
   * <p>게이트가 <b>건수 컬럼</b>에서 나온다: 마스터 응답이 품목 수를 갖고 있으므로 행마다
   * 답할 수 있다 — 아래를 조회해야만 아는 것이 아니다. 잠긴 주문도 닫힌다.
   *
   * <p><b>매 렌더 새 객체로 만들지 않는다.</b> 컬럼 선언이 이 객체를 의존성으로 가지므로,
   * 인라인이면 셸이 다시 그릴 때마다 선언이 새로 계산돼 <b>사용자가 끌어 놓은 컬럼 폭</b>이
   * 흔들린다.
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

  const detailDeletable = useMemo<DeleteColumnSpec<SampleOrderItem>>(
    () => ({ enabled: () => true }),
    [],
  );

  /** 고른 주문의 번호를 아래 제목에 붙인다 — 디테일은 자기가 누구의 것인지 말하지 못한다(frontend/grid.md). */
  const detailSuffix = useMemo(
    () => (selected ? { parent: master, fields: ['ordNo', 'ordNm'] } : undefined),
    [selected, master],
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
        {/* 축이 상하다 — 마스터가 컬럼 아홉으로 넓다(frontend/grid.md · screen/menu/requirements.md). */}
        <SplitPane
          storageKey="smplMdVert"
          first={(collapsed, expand, axis) => (
            <DataGrid<SampleOrder>
              title={MSG.SAMPLE_ORDER_GRID_TITLE}
              menuCd={MENU_CD}
              // 개인화의 키다 — 같으면 위아래 설정이 서로를 덮는다(frontend/grid.md).
              gridId="master"
              controller={master}
              deletable={masterDeletable}
              excel={excel}
              emptyText={MSG.SAMPLE_ORDER_EMPTY}
              onSelect={selectOrder}
              collapsed={collapsed}
              collapsedAxis={axis}
              onExpand={expand}
            />
          )}
          second={(collapsed, expand, axis) => (
            <DataGrid<SampleOrderItem>
              title={MSG.SAMPLE_ITEM_GRID_TITLE}
              menuCd={MENU_CD}
              gridId="detail"
              controller={detail}
              deletable={detailDeletable}
              titleSuffix={detailSuffix}
              // 대상이 없으면 ①②③이 통째로 잠긴다 — 탭이 아니라 버튼이다(frontend/grid.md).
              disabled={selectedOrdId.current === null}
              emptyText={MSG.SAMPLE_ITEM_EMPTY}
              collapsed={collapsed}
              collapsedAxis={axis}
              onExpand={expand}
            />
          )}
        />
      </div>
    </FillColumn>
  );
}

/**
 * 마스터 컬럼 아홉 — playbook/INDEX.md.
 *
 * <p>테이블에는 컬럼이 스물여섯이지만(playbook/INDEX.md) 이 화면이 그리는 것은 아홉이다. 나머지는
 * <b>그 어휘를 맡은 화면</b>이 그린다 — 여기서 전부 그리면 이 화면 하나가 frontend/grid.md 의 어휘를
 * 통째로 시연하게 되고, 그러면 <i>레이아웃</i> 이라는 이 화면의 주제가 묻힌다.
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
      /*
        <b>계산은 한 곳에서 둘 다 한다</b>(frontend/grid.md). 수량이 바뀌면 금액이 바뀌고 금액이
        바뀌면 부가세가 바뀌는데, 연쇄로 두면 <b>어느 순서로 도는가</b>가 숨은 규칙이 된다.
        여기서 멈추고 <b>서버가 다시 센다</b> — 이것은 보여주기다(원칙 P1).
      */
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
      /*
        <b>{@code LOCK_YN} 이 근거다</b>(playbook/INDEX.md) — 그 컬럼은 그리지 않지만 여기서 읽는다.
        숨긴 컬럼이 판단에만 쓰이는 자리이며, 그것이 <i>숨김 두 층</i> 중 위쪽의 뜻이다.
      */
      editable: (row, ctx) => textEditable(row, ctx.state),
      editor: 'switch',
    },
    ...auditColumns<SampleOrder>(),
  ];
}


/**
 * 조회조건 넷 — playbook/INDEX.md. <b>마스터에만 있다.</b>
 *
 * <p>디테일은 조회조건을 갖지 않는다 — 대상이 마스터의 선택이며 그것은 `searchParams`
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
