import { useCallback, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow } from '@/shared/grid/rows';
import type { DeleteColumnSpec, SaveApi } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { ScreenTabs, type ScreenTabItem } from '@/shared/screentabs/ScreenTabs';
import {
  ExcelUploadTab,
  type ExcelUploadTabHandle,
} from '@/shared/excelupload/ExcelUploadTab';
import { SAMPLE_EXCEL_ENDPOINTS } from '@/features/sample/excel/api/endpoints';
import {
  buildItemFormColumns,
  ITEM_KEY_FIELDS,
} from '@/features/sample/excel/itemFormColumns';
import { duplicatedKeys } from '@/features/sample/excel/itemKeyRules';
import type { SampleOrderItem } from '@/features/sample/types';

/**
 * `SMPL_EXCEL` — playbook/INDEX.md. **참조 구현이지 업무 화면이 아니다.**
 *
 * <p>이 화면이 **유일한 실물**로 갖는 것 둘(playbook/INDEX.md 의 굵은 ●): **화면 안 최상단 탭**과
 * **엑셀 업로드**. 지우면 템플릿에서 그 어휘의 예가 사라진다.
 *
 * <h2>대상이 `SMPL_ORDER_ITEM` 이다 — `SMPL_ORDER` 가 아니다</h2>
 *
 * <p>playbook/excel-upload.md 가 평면 엑셀 한 장을 전제하는데 주문에는 `list` 컬럼(`TAG_LIST`)이 있어
 * **같은 이유로 기각**된다(playbook/INDEX.md) — `CODE_MGMT`(2단계)와 `MESSAGE_MGMT`(`list`)를 그
 * ADR 이 이미 같은 기준으로 기각했다. 부모는 `ORD_NO` 로 나른다(playbook/INDEX.md).
 *
 * <h2>최상단 탭 둘이 **같은 것 셋**을 나눠 쓴다</h2>
 *
 * <p>컬럼 배열 · 조회 API · 저장 API 다. 갈릴 수 없는 것들이다:
 *
 * - **컬럼**이 갈리면 ②의 전체 다운로드가 양식이 아니게 된다(frontend/grid.md)
 * - **조회**가 갈리면 *화면이 보는 표* 와 *대조하는 표* 가 달라져 **이미 있는 행이
 * 신규로** 잡힌다(playbook/excel-upload.md)
 * - **저장**이 갈리면 같은 표에 규칙이 둘 생기고, 그 둘은 반드시 갈린다
 *
 * <h2>업로드 탭이 `S` 권한에 매인다</h2>
 *
 * <p>playbook/INDEX.md — 그 탭의 액션이 저장 하나뿐이라 권한이 없으면 들어가 봐야 할 일이 없다.
 * `ScreenTabs` 가 항목을 걸러 내며, 남는 항목이 하나면 **컨트롤 자체를 내지 않는다** —
 * 조회조건이 후보 하나면 셀렉터를 내지 않는 것과 같은 규칙이다(frontend/search-form.md).
 */

const MENU_CD = 'SMPL_EXCEL';

const TAB_DATA = 'data';
const TAB_UPLOAD = 'upload';

export function SampleExcelPage() {
  const searchForm = useRef<SearchFormHandle>(null);
  const [tab, setTab] = useState<string>(TAB_DATA);
  const upload = useRef<ExcelUploadTabHandle | null>(null);

  const header = useSearchFormHeader();

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  /** **두 탭이 같은 배열을 쓴다** — 양식이 갈릴 수 없다(playbook/INDEX.md). */
  const columns = useMemo(() => buildItemFormColumns(), []);
  const searchFields = useMemo(() => buildSearchFields(), []);

  /**
   * **두 탭이 같은 저장 API 를 쓴다** — playbook/excel-upload.md 가 업로드에 새 경로를 두지 않기로
   * 한 자리다.
   *
   * <p>3층 검증이 함께 붙으므로 **양쪽에서 같은 규칙이 돈다**(frontend/grid.md): 업로드가 읽는
   * 시점에 이미 겹침을 짚지만(`ExcelUploadTab`), 사용자가 읽어들인 뒤 셀을 고쳐 겹치게
   * 만들 수 있고 업무 탭은 행 추가로 그렇게 만들 수 있다.
   */
  const saveApi = useMemo<SaveApi<SampleOrderItem>>(
    () => ({
      url: SAMPLE_EXCEL_ENDPOINTS.saveFlatItems,
      validate: { grid: duplicatedKeys },
    }),
    [],
  );

  const readApi = useMemo(
    () => ({ url: SAMPLE_EXCEL_ENDPOINTS.getFlatItemList, emptyNotice: true }),
    [],
  );

  /**
   * 저장 페이로드 — **두 탭이 같은 함수를 쓴다**.
   *
   * <p>업로드 탭에도 이것을 넘긴다: 컴포넌트가 스스로 만들면 서버가 **파생 컬럼과 감사
   * 컬럼까지** 받게 되고(원칙 P1) 업무 탭이 보내는 것과 갈린다 — 같은 경로에 두 가지
   * 요청이 도착한다.
   *
   * <p>**`amt` 를 보내지 않는다.** `afterEdit` 이 계산해 화면에 보이는 파생이고 서버가
   * 다시 센다 — 보낼 경로를 두면 화면이 금액을 스스로 정하게 된다.
   *
   * <p>**삭제도 키 둘은 보낸다.** 다른 화면에서는 삭제가 대상만 가리키지만 여기서는
   * `(주문번호, 품목코드)` **가 곧 대상**이라(playbook/INDEX.md) 뺄 수가 없다.
   */
  const toSaveRow = useCallback(
    (row: GridRow<SampleOrderItem>) => ({
      rowState: row.state,
      ordNo: row.data.ordNo,
      itemCd: row.data.itemCd,
      ...(row.state === 'D'
        ? {}
        : {
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
    [],
  );

  const business = useGridController<SampleOrderItem>({
    menuCd: MENU_CD,
    columns,
    api: { read: readApi, save: saveApi },
    params: collectConditions,
    addRow: {
      defaults: () => ({
        // 서버가 정한다 — 양식에 없는 것이 여기서도 없다(playbook/INDEX.md).
        ordId: null,
        itemSeq: null,
        ordNo: '',
        itemCd: '',
        itemNm: '',
        uomCd: 'EA',
        qty: 0,
        unitAmt: 0,
        // 파생이다 — 서버가 다시 센다.
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
    toSaveRow,
  });

  /** **삭제는 업무 탭의 삭제 컬럼이다**(playbook/INDEX.md) — 업로드에는 `D` 가 생기지 않는다. */
  const deletable = useMemo<DeleteColumnSpec<SampleOrderItem>>(
    () => ({ enabled: () => true }),
    [],
  );

  /**
   * 최상단 탭을 옮기기 전에 묻는다 — playbook/INDEX.md.
   *
   * <p>**하단 디테일 탭과 규칙이 다르다**(§7.7 은 묻지 않는다). 저기는 한 화면 안의 부분이
   * 갈리는 것이고 여기는 **화면 전체**가 갈린다 — 묻지 않으면 사용자는 *탭을 옮긴 것*으로
   * 알고 읽어들인 412행을 남겨 둔 채 다른 일을 한다.
   *
   * <p>물음은 `ScreenTabs` 가 낸다. 여기서는 **지금 어느 쪽이 미저장인지**만 답한다.
   */
  const dirtyOf = useCallback(
    (key: string) => (key === TAB_UPLOAD ? (upload.current?.dirty() ?? false) : business.dirty),
    [business.dirty],
  );

  const items = useMemo<ScreenTabItem[]>(
    () => [
      {
        key: TAB_DATA,
        label: MSG.SAMPLE_EXCEL_SEG_DATA,
        content: (
          <FillColumn>
            {/*
              **조회조건이 업무 탭의 것이다**(playbook/INDEX.md) — 업로드 탭에는 없다. 대상이
              파일이므로 거를 것이 없고, 탭 밖에 두면 **쓰지 않는 탭에서도 보인다**.
            */}
            <SearchForm
              handleRef={searchForm}
              fields={searchFields}
              onSubmit={() => void business.read()}
              onReset={business.clearFilters}
              onActiveCountChange={header.onActiveCountChange}
              collapsed={header.collapsed}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
              <DataGrid<SampleOrderItem>
                title={MSG.SAMPLE_EXCEL_DATA_TITLE}
                menuCd={MENU_CD}
                gridId="data"
                controller={business}
                deletable={deletable}
                emptyText={MSG.SAMPLE_EXCEL_EMPTY}
                /*
                  **개인화를 열지 않는다.** 이 그리드의 컬럼은 사용자의 표가 아니라
                  **양식**이다(frontend/grid.md · playbook/INDEX.md) — 하나를 감추거나 순서를 바꾸면 ②의
                  다운로드가 그 상태로 나가고, 그 파일은 업로드가 거절한다. 즉
                  **자기가 방금 내려받은 파일이 양식이 아니게** 된다.
                */
                settings={false}
              />
            </div>
          </FillColumn>
        ),
      },
      {
        key: TAB_UPLOAD,
        // `S` 가 없으면 이 항목이 아예 없다 — 그 탭의 액션이 저장 하나뿐이다(playbook/INDEX.md).
        actionCd: 'SAVE',
        label: MSG.SAMPLE_EXCEL_SEG_UPLOAD,
        content: (
          <ExcelUploadTab<SampleOrderItem>
            title={MSG.SAMPLE_EXCEL_UPLOAD_TITLE}
            menuCd={MENU_CD}
            columns={columns}
            keyFields={ITEM_KEY_FIELDS}
            read={readApi}
            save={saveApi}
            toSaveRow={toSaveRow}
            handleRef={upload}
          />
        ),
      },
    ],
    [
      business,
      columns,
      deletable,
      header.collapsed,
      header.onActiveCountChange,
      readApi,
      saveApi,
      searchFields,
      toSaveRow,
    ],
  );

  return (
    <FillColumn>
      {/* 브레드크럼 아래, 조회조건 위 — playbook/INDEX.md 의 자리다. */}
      <ScreenTabs
        menuCd={MENU_CD}
        items={items}
        value={tab}
        onChange={setTab}
        dirty={dirtyOf}
      />
    </FillColumn>
  );
}

/**
 * 조회조건 넷 — playbook/INDEX.md. **업무 데이터 탭에만 있다.**
 *
 * <p>업로드 탭은 대상이 파일이라 거를 것이 없다. 그래서 이 폼이 탭 **안**에 있으며,
 * 밖에 두면 쓰지 않는 탭에서도 보인다.
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
      field: 'itemCd',
      label: MSG.SAMPLE_COND_ITEM_CD,
      type: 'text',
      op: 'contains',
      ops: ['eq', 'startsWith', 'contains', 'endsWith'],
    },
    {
      field: 'itemStatCd',
      label: MSG.SAMPLE_COND_ITEM_STAT,
      type: 'select',
      op: 'in',
      grpCd: 'SMPL_ITEM_STAT',
    },
    {
      field: 'dlvrDt',
      label: MSG.SAMPLE_COND_DLVR_DT,
      type: 'dateRange',
      // **`DATE` 컬럼이다** — 적지 않으면 시각까지 보내고 서버가 그 값을 못 읽는다.
      precision: 'day',
      required: false,
      rangeDays: { default: 30, max: 365 },
    },
  ];
}
