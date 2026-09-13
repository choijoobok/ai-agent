// @feat FEAT-503
import { useCallback, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { SplitPane } from '@/shared/grid/SplitPane';
import { useConfirmDiscard } from '@/shared/grid/useConfirmDiscard';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow, RowState } from '@/shared/grid/rows';
import type { ColumnDef, DeleteColumnSpec } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { SAMPLE_HORZ_ENDPOINTS } from '@/modules/sample/features/mdhorizontal/api/endpoints';
import { buildItemColumns } from '@/modules/sample/itemColumns';
import type { SampleOrder, SampleOrderItem } from '@/modules/sample/types';
// 팝업 등록은 모듈 로드에서 일어난다 — 이 임포트가 그 등록이다(playbook/INDEX.md).
import '@/modules/sample/popups';

/**
 * `SMPL_MD_HORZ` — playbook/INDEX.md. **좌우 분할의 유일한 실물이다.**
 *
 * <h2>왜 ③과 화면을 나누는가</h2>
 *
 * <p>screen/README.md 은 *"좌우 분할은 `direction` prop 으로 시연한다 — 화면을 나누지 않는다"* 고
 * 적었고 playbook/INDEX.md 이 그것을 개정했다. 근거 둘:
 *
 * <ul>
 * <li>**축은 데이터가 정한다**(frontend/grid.md) — *마스터가 넓으면 상하, 좁으면 좌우*. 한 화면에서
 *       토글하면 **같은 마스터가 두 축을 오가고**, 그것은 규약이 금지하는 모양이다
 *   <li>**샘플은 회귀 픽스처이기도 하다** — 토글이면 CI 가 한 시점에 한 축만 본다. 세로
 *       제목(`writing-mode`) · `SPLIT_GAP` 8px · 접힘 세로 띠 48px 은 **좌우에서만** 나는
 *       것이라 그 축이 상시 렌더되어야 잡힌다
 * </ul>
 *
 * <h2>마스터를 좁힌다 — 그것이 이 축의 전제다</h2>
 *
 * <p>컬럼 **셋**이 곧 근거다(playbook/INDEX.md). ③처럼 아홉인 채로 좌우에 두면 왼쪽이 가로
 * 스크롤되고, 그러면 **좌우로 나눈 이유가 사라진다**.
 *
 * <p>디테일은 ③과 **같은 표**다 — 그래서 컬럼 선언을 `modules/sample/itemColumns.ts` 가
 * 갖는다. 갈려야 하는 것은 마스터와 축이지 품목의 정의가 아니다.
 *
 * <h2>엔드포인트를 새로 열지 않았다</h2>
 *
 * <p>①②와 갈리는 자리다. ①은 서른을 그려 아홉짜리 응답으로는 스물하나가 빈 칸이 되고
 * ②는 모드가 달라 봉투가 다르지만, ④는 **③이 싣는 아홉 중 셋만 그린다** — 부분집합에는
 * 새 경로가 필요 없다.
 */

const MENU_CD = 'SMPL_MD_HORZ';

const STAT_RCV = 'RCV';
const STAT_DON = 'DON';

function textEditable(
  row: SampleOrder,
  state: RowState,
): boolean | { ok: false; message: string } {
  if (state === 'C') return true;
  if (row.lockYn) return { ok: false, message: label(MSG.SAMPLE_LOCKED) };
  return row.ordStatCd !== STAT_DON;
}

export function SampleMdHorizontalPage() {
  const searchForm = useRef<SearchFormHandle>(null);
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
      read: { url: SAMPLE_HORZ_ENDPOINTS.getOrderList, emptyNotice: true },
      save: { url: SAMPLE_HORZ_ENDPOINTS.saveOrders },
      // **실행이 없다**(playbook/INDEX.md 의 액션 `R S E`). ③의 출고 지시는 저기 있으면 된다.
    }),
    [],
  );

  const detailApi = useMemo(
    () => ({
      read: { url: SAMPLE_HORZ_ENDPOINTS.getItemList },
      save: { url: SAMPLE_HORZ_ENDPOINTS.saveItems },
    }),
    [],
  );

  const master = useGridController<SampleOrder>({
    menuCd: MENU_CD,
    columns: masterColumns,
    api: masterApi,
    params: collectConditions,
    /*
      **행 추가가 없다**(구현에서 나온 결정 — playbook/INDEX.md 를 좁힌다).

      서버가 요구하는 필수는 넷이다: 주문번호·주문명·고객·주문일(`SampleOrderService`).
      이 화면이 그리는 것은 셋이고 그중 주문명과 주문일이 **없다** — 신규 행을 열면
      사용자가 채울 수 없는 칸 때문에 **저장이 반드시 실패한다**.

      채우려고 컬럼을 늘리면 왼쪽이 넓어져 **좌우로 나눈 이유가 사라지고**, 화면이
      기본값을 지어내면 *주문명이 주문번호와 같은* 행이 조용히 쌓인다.

      **그 어휘는 이미 실물이 있다** — ③의 마스터와 ①이 행 추가를 그린다. 여기서 빠지는
      것은 버튼 하나이지 어휘가 아니다.
    */
    toSaveRow: (row) => ({
      rowState: row.state,
      ordId: row.data.ordId,
      /*
        **그리지 않는 칸도 보낸다.** 화면은 셋만 그리지만 행은 조회가 실어 준 아홉을
        그대로 들고 있다 — 보내지 않으면 서버가 그 칸을 `null` 로 읽어 **안 보이는
        컬럼이 지워진다**(`SmplOrderSaveRow` 가 적은 *받는 컬럼이 곧 고칠 수 있는 컬럼*).
      */
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

  const selectOrder = useCallback(
    async (row: GridRow<SampleOrder> | null): Promise<boolean> => {
      if (detail.dirty && !(await confirmDiscard())) {
        return false;
      }
      setSelected(row);

      if (!row || row.state === 'C') {
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

  const readMaster = useCallback(async () => {
    setSelected(null);
    selectedOrdId.current = null;
    detail.setRows([]);
    await master.read();
  }, [detail, master]);

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

  /**
   * **항목이 하나다** — ③은 둘을 붙인다(playbook/INDEX.md).
   *
   * <p>좌우 축에서는 오른쪽 pane 이 좁아 둘이 들어가면 말줄임표만 남는다. 고객명을 뺄 수
   * 있는 것은 **왼쪽 마스터가 늘 화면에 있기** 때문이다 — frontend/grid.md 이 접미를 요구한 근거가
   * *마스터의 선택 행이 화면에서 벗어난다* 인데, 그 걱정이 이 축에서는 절반이다.
   */
  const detailSuffix = useMemo(
    () => (selected ? { parent: master, fields: ['ordNo'] } : undefined),
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
        {/* 축이 좌우다 — 마스터가 컬럼 셋으로 좁다(frontend/grid.md · playbook/INDEX.md). */}
        <SplitPane
          storageKey="smplMdHorz"
          axis="horizontal"
          first={(collapsed, expand, axis) => (
            <DataGrid<SampleOrder>
              title={MSG.SAMPLE_ORDER_GRID_TITLE}
              menuCd={MENU_CD}
              gridId="master"
              controller={master}
              deletable={masterDeletable}
              /*
                **개인화할 것이 없다**(playbook/INDEX.md). 컬럼이 셋이고 전부 봐야 하므로 감출 것도
                옮길 것도 없다 — 버튼만 감추는 것이 아니라 **저장된 설정을 읽지도
                않는다**(frontend/grid.md): 읽으면 다른 화면에서 저장된 폭이 여기 적용된다.
              */
              settings={false}
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
              /*
                **하단만 다시 읽는다**(playbook/INDEX.md). 왼쪽 조회를 누르면 고른 주문을 잃는데,
                품목만 새로 보고 싶은 경우가 그것과 다른 일이다.
              */
              onRead={() => void detail.read(true)}
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

/** 조회조건은 ③과 같다 — playbook/INDEX.md. 갈리는 것은 축이지 조건이 아니다. */
function buildSearchFields(): SearchField[] {
  return [
    {
      field: 'ordNo',
      label: MSG.SAMPLE_COND_ORD_NO,
      type: 'text',
      op: 'contains',
      ops: ['contains', 'eq', 'startsWith'],
    },
    {
      field: 'custNm',
      label: MSG.SAMPLE_COND_CUST_NM,
      type: 'text',
      op: 'contains',
      ops: ['contains', 'eq'],
    },
    {
      field: 'ordStatCd',
      label: MSG.SAMPLE_COND_ORD_STAT,
      type: 'select',
      op: 'in',
      ops: ['in', 'eq'],
      grpCd: 'SMPL_ORD_STAT',
      defaultValue: [STAT_RCV, 'CFM'],
    },
    {
      field: 'ordDt',
      label: MSG.SAMPLE_COND_ORD_DT,
      type: 'dateRange',
      op: 'between',
      ops: ['between', 'gte', 'lte'],
      precision: 'day',
      rangeDays: { default: 30, max: 366 },
    },
  ];
}

/**
 * 마스터 컬럼 **셋** — playbook/INDEX.md.
 *
 * <p>**셋인 것이 이 화면의 전제다.** 왼쪽 pane 이 좁아야 좌우 분할이 뜻을 갖는데, 컬럼이
 * 넷째부터는 가로 스크롤이 생기고 그러면 나눈 이유가 사라진다.
 *
 * <p>**고객이 팝업 칸이다.** 이름만 고칠 수 있게 두면 아이디와 이름이 어긋난 행이
 * 저장된다 — 그 사고를 구조로 막는 것이 참조 팝업의 존재 이유이며(frontend/grid.md), 고르면 둘이
 * 함께 채워진다.
 */
function buildOrderColumns(): ColumnDef<SampleOrder>[] {
  return [
    {
      field: 'ordNo',
      header: MSG.SAMPLE_COL_ORD_NO,
      type: 'text',
      width: 150,
      sortable: true,
      pk: { renamable: false },
      required: true,
    },
    {
      field: 'custNm',
      header: MSG.SAMPLE_COL_CUST_NM,
      type: 'popupRef',
      width: 150,
      sortable: true,
      required: true,
      editable: (row, ctx) => textEditable(row, ctx.state),
      popup: {
        key: 'sample.customer',
        /*
          **이름 칸이 팝업을 연다.** ①은 아이디 칸이 열지만(그 화면은 둘 다 그린다) 여기는
          이름만 그리므로 여는 칸도 이름이다 — 값을 담는 칸과 여는 칸이 갈리면 사용자는
          **보이지 않는 칸을 고치는** 셈이 된다.
        */
        apply: (_row, picked) =>
          picked === null
            ? { custId: '', custNm: '' }
            : { custId: text(picked.custId), custNm: text(picked.custNm) },
      },
    },
    {
      field: 'ordStatCd',
      header: MSG.SAMPLE_COL_ORD_STAT,
      type: 'code',
      width: 110,
      sortable: true,
      grpCd: 'SMPL_ORD_STAT',
      editor: 'select',
      renderer: 'badge',
      tone: { RCV: 'none', CFM: 'ok', SHP: 'warn', DON: 'muted' },
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
  ];
}

/** 팝업 행에는 타입이 없다 — 타입이 필요한 자리는 `apply` 다(frontend/grid.md). */
function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
