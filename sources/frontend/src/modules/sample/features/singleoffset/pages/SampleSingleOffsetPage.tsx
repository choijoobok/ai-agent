// @feat FEAT-503
import { useCallback, useMemo, useRef, useState } from 'react';
import { App } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { GridRow, RowState } from '@/shared/grid/rows';
import type { ColumnDef, DeleteColumnSpec, GridControl } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { useParamModal } from '@/shared/formmodal/paramModalContext';
import { SAMPLE_OFFSET_ENDPOINTS } from '@/modules/sample/features/singleoffset/api/endpoints';
import type { SampleOrderFull, SampleTag } from '@/modules/sample/types';
import { tooManyTags } from '@/modules/sample/tagRules';
// 팝업 등록은 모듈 로드에서 일어난다 — 이 임포트가 그 등록이다(playbook/INDEX.md).
import '@/modules/sample/popups';

/**
 * `SMPL_SINGLE_OFFSET` — playbook/INDEX.md. **어휘의 본진이다.**
 *
 * <p>playbook/INDEX.md 의 커버리지 표에서 굵은 ●이 **열둘**인 화면이다. 지우면 템플릿에서 그 어휘의
 * 예가 통째로 사라진다 — 에디터 셋 · `viewer` · 숨김 두 층 · `params` 모달 · 진행률 ·
 * `bigint` · `controls` 우가 전부 여기에만 있다.
 *
 * <h2>컬럼을 서른 전부 그린다</h2>
 *
 * <p>③이 아홉만 그리는 것과 반대다(playbook/INDEX.md). 저기서는 *레이아웃* 이 주제라 컬럼이 많으면
 * 주제가 묻히고, 여기서는 **컬럼 자체가 주제**다 — playbook/INDEX.md 의 표에서 하나라도 빼면 그 어휘가
 * 실물을 잃는다.
 *
 * <h2>실행 둘이 갈리는 것이 이 화면의 핵심 시연이다</h2>
 *
 * <p>*확정* 과 *일괄 재계산* 은 **둘 다 `X` 액션**인데 사용자 경험이 다르다. 앞은 고른 행
 * 몇의 상태를 바꾸고 응답이 곧 끝이며, 뒤는 `params` 모달로 인자를 받고 `jobId` 를 받아
 * 진행률을 훑는다. backend/crosscutting.md 이 그 갈림을 정했고 **화면에서 어떻게 보이는지는 여기가 유일한
 * 실물**이다.
 *
 * <p>**화면이 폴링 코드를 쓰지 않는다.** `progress: true` 한 줄이면 그리드가 훅에 넘긴다 —
 * frontend/grid.md 이 렌더 함수를 열지 않은 것과 같은 이유로, 화면마다 주기·중단 조건·실패 처리가
 * 갈리면 **같은 기능이 화면 수만큼** 생긴다.
 *
 * <h2>엑셀 선언이 없다</h2>
 *
 * <p>③과 갈리는 자리다(playbook/INDEX.md). 이 화면이 그리는 표가 곧 내려받을 표이므로 **프론트가
 * 만든다** — 왕복이 0 인 것을 왕복 하나로 만들 이유가 없다. `EXPORT` 권한은 메뉴가
 * 선언한다(sys/menu.md).
 */

const MENU_CD = 'SMPL_SINGLE_OFFSET';

/** 주문 상태 넷 — playbook/INDEX.md 의 전이표. **소스가 값을 갖는다**(sys/code.md). */
const STAT_RCV = 'RCV';
const STAT_DON = 'DON';

/** 표시 범위 — `controls` 좌(`beforeRead`)가 고르는 값이다. 조회조건이 아니다(frontend/grid.md). */
const RANGE_ALL = 'ALL';
const RANGE_MINE = 'MINE';

/** 소요시간 조회조건은 **초로 받아 밀리초로 보낸다**(frontend/search-form.md). */
const MILLIS = 1000;

/**
 * 편집이 열리는가 — playbook/INDEX.md 의 전이표를 그대로 편다.
 *
 * <p>**`LOCK_YN` 이 먼저다.** 상태는 *일이 어디까지 갔나* 이고 잠금은 *운영이 잠갔나* 이며,
 * 잠긴 것은 상태와 무관하게 닫힌다. `hidden` 컬럼을 **근거로만** 읽는 자리다(frontend/grid.md).
 *
 * <p>신규 행(`C`)은 언제나 열린다 — 아직 상태가 없다.
 */
function amountEditable(
  row: SampleOrderFull,
  state: RowState,
): boolean | { ok: false; message: string } {
  if (state === 'C') return true;
  if (row.lockYn) return { ok: false, message: label(MSG.SAMPLE_LOCKED) };
  // 확정부터는 금액이 잠긴다 — 확정된 금액이다(playbook/INDEX.md).
  return row.ordStatCd === STAT_RCV;
}

function textEditable(
  row: SampleOrderFull,
  state: RowState,
): boolean | { ok: false; message: string } {
  if (state === 'C') return true;
  if (row.lockYn) return { ok: false, message: label(MSG.SAMPLE_LOCKED) };
  // 완료는 전부 잠긴다.
  return row.ordStatCd !== STAT_DON;
}

export function SampleSingleOffsetPage() {
  const { modal } = App.useApp();
  // frontend/grid.md 의 params 모달 — 호스트는 AppProviders 가 이미 걸어 두었다.
  const openParams = useParamModal();
  const searchForm = useRef<SearchFormHandle>(null);
  const [range, setRange] = useState(RANGE_ALL);

  const header = useSearchFormHeader();

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  const columns = useMemo(() => buildColumns(), []);
  const searchFields = useMemo(() => buildSearchFields(), []);

  /**
   * `controls` 좌가 고른 값이 여기로 흘러든다 — **컨트롤이 컨트롤러를 직접 부르지 않는다**
   * (frontend/grid.md). 부르면 셀렉트 하나가 그리드의 미저장 편집을 말없이 버릴 수 있다.
   */
  const searchParams = useCallback(() => ({ range }), [range]);

  const api = useMemo(
    () => ({
      read: { url: SAMPLE_OFFSET_ENDPOINTS.getOrderOffsetList, emptyNotice: true },
      /*
        **저장은 `keepFailed` 다**(screen/sample/single-offset/requirements.md §6-1). 가르는 물음은
        하나다 — *실패한 행을 사용자가 이 화면에서 고쳐 다시 내나?* 저장이 거부되는
        이유는 대개 **값이 틀린 것**이라 답이 예이고, 그때 재조회하면 **고치던 값이
        서버 값으로 되돌아간다** — 방금 읽은 사유가 가리키는 자리를 다시 찾아 들어가야 한다.

        치르는 값은 **성공한 신규 행의 채번값이 화면에 오지 않는 것**이다. 재조회하지
        않기 때문이며, 고쳐 낼 것이 남은 화면에서는 그쪽이 더 싸다.
      */
      save: {
        url: SAMPLE_OFFSET_ENDPOINTS.saveOffsetOrders,
        perRow: { after: 'keepFailed' as const },
      },
      actions: [
        {
          /*
            **확정 — 프로그레스가 없다.** 상태 하나를 바꾸는 일이라 응답이 곧 끝이며,
            여기에 진행률을 붙이면 창이 떴다가 바로 닫혀 *무언가 잘못됐나* 로 읽힌다(backend/crosscutting.md).
          */
          key: 'confirm',
          label: MSG.SAMPLE_ACTION_CONFIRM,
          url: SAMPLE_OFFSET_ENDPOINTS.confirmOrders,
          target: 'selected' as const,
          // 접수만 확정으로 간다 — 거르는 것은 UX 이고 판정은 서버다(frontend/grid.md).
          eligible: (row: GridRow<SampleOrderFull>) =>
            row.data.ordStatCd === STAT_RCV && !row.data.lockYn,
          hint: MSG.SAMPLE_ACTION_CONFIRM_HINT,
          confirm: MSG.SAMPLE_ACTION_CONFIRM_CONFIRM,
          /*
            **확정은 `reload` 다** — 같은 화면인데 저장과 답이 다르다. 선언이 화면이 아니라
            `save` 와 `actions[]` **각각**에 붙는 것이 그래서다.

            실행 실패는 *값이 틀린 것* 이 아니라 **그 사이 상태가 바뀐 것**이라 이 화면에서
            고칠 수 없다. 남겨 두면 손댈 수 없는 행이 목록에 박혀 다음 조회까지 남는다.

            대신 **닫는 순간 실패 목록이 사라지므로** 결과 모달이 그 사실을 먼저 말한다
            (`grid.partial.gone`) — 남는 것은 내려받아 둔 파일뿐이다.
          */
          perRow: { after: 'reload' as const },
          /*
            **봉투의 이름은 `targets` 로 고정이다**(frontend/grid.md) — `toTargets` 는 *모양만 바꾸는
            자리* 라 그 이름을 바꾸지 못한다. 여기서 `{ ordIds: [...] }` 를 돌려주면 몸통이
            `{ targets: { ordIds: [...] } }` 가 되어 서버의 `@NotEmpty` 에 걸리고, 화면에는
            **고른 행이 분명히 있는데** *입력값을 확인하세요* 만 뜬다(2026-09-02 에 겪었다).

            그래서 다른 화면들과 같은 모양이다 — `rows.map(id)`(`USER_MGMT` · `BATCH_*`).
          */
          toTargets: (rows: GridRow<SampleOrderFull>[]) => rows.map((row) => row.data.ordId),
        },
        {
          /*
            **일괄 재계산 — `params` 모달 + 진행률.** 인자 둘을 모달이 받는다(playbook/INDEX.md).

            **대상이 `none` 이다.** `all` 이었는데, 그것은 *전체* 가 아니라 **지금 그리드에
            들어 있는 행**이다(frontend/grid.md — 어느 묶음을 보나). 이 실행이 다시 세는 것은
            **기준일에 든 전량**이라 화면의 한 쪽수와 아무 상관이 없고, 그 행들을 몸통에
            실으면 서버가 **읽지도 않을 판 하나**를 매번 받는다 — 그리고 코드는 *고른 행이
            실리지 않는다* 고 적혀 있었으니, 적힌 것과 나가는 것이 갈려 있었다.

            버튼은 그대로 켜져 있다 — 비활성은 `target:'selected'` 에서 0건일 때뿐이다.

            `confirm` 을 함께 두지 않는다 — 모달이 실행/취소를 이미 두므로 켜면 같은 것을
            두 번 묻는다(frontend/grid.md).
          */
          key: 'recalc',
          label: MSG.SAMPLE_ACTION_RECALC,
          url: SAMPLE_OFFSET_ENDPOINTS.recalculateOrders,
          target: 'none' as const,
          progress: true,
          params: () =>
            openParams({
              title: MSG.SAMPLE_ACTION_RECALC_TITLE,
              fields: [
                {
                  name: 'baseDt',
                  label: MSG.SAMPLE_RECALC_BASE_DT,
                  type: 'date' as const,
                  required: true,
                },
                {
                  name: 'vatRate',
                  label: MSG.SAMPLE_RECALC_VAT_RATE,
                  type: 'number' as const,
                  required: true,
                  // 평소의 값이다 — 모달은 *바꿀 수 있다* 를 보이는 자리이지 빈 칸이 아니다.
                  defaultValue: 0.1,
                },
              ],
            }),
        },
      ],
    }),
    [openParams],
  );

  const controller = useGridController<SampleOrderFull>({
    menuCd: MENU_CD,
    columns,
    api,
    params: collectConditions,
    searchParams,
    addRow: {
      defaults: () => ({
        // 채번이다 — 신규 행에서 `null` 이고 서버가 정한다.
        ordId: null,
        ordNo: '',
        ordNm: '',
        custId: '',
        custNm: '',
        custGrdCd: null,
        ordStatCd: STAT_RCV,
        chnlCd: 'WEB',
        priorityCd: 'NORMAL',
        ordDt: null,
        dlvrYm: null,
        ordDtm: null,
        ordQty: 0,
        unitAmt: 0,
        // 파생은 서버가 계산한다 — 임의의 값으로 채우면 *계산해 보니 그렇다* 와 구분되지 않는다.
        ordAmt: 0,
        vatAmt: 0,
        dcRt: 0,
        procMs: null,
        urgentYn: false,
        useYn: true,
        tagList: [],
        memo: null,
        rmk: null,
        errMsg: null,
        lockYn: false,
        srcSysCd: null,
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
            custGrdCd: row.data.custGrdCd,
            ordStatCd: row.data.ordStatCd,
            chnlCd: row.data.chnlCd,
            priorityCd: row.data.priorityCd,
            ordDt: row.data.ordDt,
            dlvrYm: row.data.dlvrYm,
            ordQty: row.data.ordQty,
            unitAmt: row.data.unitAmt,
            dcRt: row.data.dcRt,
            urgentYn: row.data.urgentYn,
            useYn: row.data.useYn,
            tagList: row.data.tagList,
            memo: row.data.memo,
            rmk: row.data.rmk,
          }),
      /*
        **`ordAmt`·`vatAmt`·`procMs`·`lockYn`·`srcSysCd`·`errMsg` 를 보내지 않는다.**
        앞의 셋은 서버가 만드는 파생이고 뒤의 셋은 운영·시스템의 것이다 — 보낼 경로를
        두면 화면이 금액을 스스로 정하거나 **잠긴 주문이 스스로 잠금을 푸는** 요청이
        성립한다(원칙 P1). 화면에서 읽기 전용인 것과 요청이 조작될 수 있는 것은 다르다.
      */
    }),
  });

  /**
   * `controls` 넷 — 좌 하나(`beforeRead`)와 우 셋(`beforeTools`).
   *
   * <p>**표시 범위가 조회조건이 아닌 이유**가 frontend/grid.md 다. 여기서 고르는 것은 *거르기* 가
   * 아니라 **무엇을 행으로 낼지**이며, 조회조건 칸으로 두면 검색 폼이 접혀 있을 때
   * **보이지 않는 곳에서 그리드의 뜻이 바뀐다**.
   */
  const controls = useMemo<GridControl[]>(
    () => [
      {
        key: 'range',
        slot: 'beforeRead',
        type: 'select',
        label: MSG.SAMPLE_CONTROL_RANGE,
        options: [
          { value: RANGE_ALL, text: label(MSG.SAMPLE_CONTROL_RANGE_ALL) },
          { value: RANGE_MINE, text: label(MSG.SAMPLE_CONTROL_RANGE_MINE) },
        ],
        value: range,
        onChange: setRange,
        width: 140,
      },
      {
        key: 'help',
        slot: 'beforeTools',
        type: 'button',
        label: MSG.SAMPLE_CONTROL_HELP,
        // **서버를 부르지 않는다** — 부르면 `api.actions` 다(frontend/grid.md).
        onClick: () => {
          modal.info({
            title: label(MSG.SAMPLE_CONTROL_HELP),
            content: label(MSG.SAMPLE_HELP_BODY),
          });
        },
      },
      {
        key: 'print',
        slot: 'beforeTools',
        type: 'button',
        label: MSG.SAMPLE_CONTROL_PRINT,
        /*
          **`actionCd` 가 붙은 유일한 컨트롤이다**(playbook/INDEX.md). 인쇄는 화면 밖으로 데이터를
          내보내는 일이라 `E` 로 통제하며, 권한이 없으면 **버튼이 아예 없다**(frontend/grid.md).
        */
        actionCd: 'EXPORT' as const,
        menuCd: MENU_CD,
        onClick: () => window.print(),
      },
    ],
    [modal, range],
  );

  /**
   * **게이트가 없는 삭제 컬럼이다** — playbook/INDEX.md 의 커버리지 표에서 *마스터 삭제 게이트* 는
   * ③④⑤의 것이고 여기는 *삭제 컬럼* 만 있다.
   *
   * <p>품목이 있는 주문을 지우려 하면 **서버가 사유를 담아 거절한다**. 그 편이 이 화면에서
   * 옳은 것은 목록이 품목 수를 싣지 않기 때문이다 — 싣게 하면 서른 컬럼짜리 조회에
   * `group by` 가 한 벌 더 붙는데, 이 화면의 주제는 레이아웃이 아니라 **컬럼**이다.
   */
  const deletable = useMemo<DeleteColumnSpec<SampleOrderFull>>(
    () => ({
      enabled: (row) => !row.data.lockYn,
      reason: (row) => (row.data.lockYn ? label(MSG.SAMPLE_LOCKED) : null),
    }),
    [],
  );

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void controller.read()}
        onReset={controller.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid<SampleOrderFull>
          title={MSG.SAMPLE_OFFSET_GRID_TITLE}
          menuCd={MENU_CD}
          controller={controller}
          controls={controls}
          deletable={deletable}
          // 단일 선택이다 — 확정이 `target:'selected'` 이므로 체크박스가 아니라 행 선택이다.
          selection="multiple"
          emptyText={MSG.SAMPLE_OFFSET_EMPTY}
        />
      </div>
    </FillColumn>
  );
}

/**
 * 조회조건 **열둘** — playbook/INDEX.md. **57 의 컨트롤이 전부 나오는 유일한 화면이다.**
 *
 * <p>`gt`·`lt`·태그 입력·팝업 필드 넷이 여기서 처음 쓰인다(playbook/INDEX.md). frontend/search-form.md 가
 * *"쓰이지 않는 후보를 미리 열지 않는다"* 고 한 그 문을 **요구하는 화면이 와서** 연다.
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      // 연산자 전 8종 — 텍스트 칸이 받을 수 있는 것을 전부 낸다.
      field: 'ordNo',
      label: MSG.SAMPLE_COND_ORD_NO,
      type: 'text',
      op: 'contains',
      ops: ['contains', 'eq', 'ne', 'startsWith', 'endsWith', 'in', 'isNull', 'isNotNull'],
    },
    {
      field: 'ordNm',
      label: MSG.SAMPLE_COND_ORD_NM,
      type: 'text',
      op: 'contains',
      ops: ['contains', 'startsWith', 'endsWith', 'eq', 'ne'],
    },
    {
      /*
        **참조 팝업 필드** — playbook/INDEX.md. 칸에 직접 칠 수 없다: 칠 수 있으면 목록에 없는 키가
        만들어지고, 그 조건은 *걸렸는데 0건* 이 되어 사용자가 자기 오타를 의심할 근거가 없다.

        **보내는 것은 키 하나**이고 이름은 조건에 들어가지 않는다 — 이름까지 보내면
        *이름으로도 걸러 달라* 는 뜻이 되어 버린다.
      */
      field: 'custId',
      label: MSG.SAMPLE_COND_CUST_ID,
      type: 'popupRef',
      op: 'eq',
      ops: ['eq'],
      popup: 'sample.customer',
      popupValue: (picked) => text(picked.custId),
      popupText: (picked) => text(picked.custNm),
    },
    {
      field: 'ordStatCd',
      label: MSG.SAMPLE_COND_ORD_STAT,
      type: 'select',
      op: 'in',
      ops: ['in', 'eq', 'ne', 'isNull', 'isNotNull'],
      grpCd: 'SMPL_ORD_STAT',
      // 진행 중인 것이 기본이다 — 완료까지 기본에 넣으면 목록이 지난 일로 채워진다.
      defaultValue: [STAT_RCV, 'CFM'],
    },
    {
      // 후보가 스물둘이다 — 다중 선택이며 셀의 `richSelect` 와 같은 코드 그룹을 본다.
      field: 'chnlCd',
      label: MSG.SAMPLE_COND_CHNL,
      type: 'select',
      op: 'in',
      ops: ['in', 'eq'],
      grpCd: 'SMPL_CHNL',
    },
    {
      field: 'ordDt',
      label: MSG.SAMPLE_COND_ORD_DT,
      type: 'dateRange',
      op: 'between',
      ops: ['between', 'gte', 'lte'],
      // 날짜만 묻는 칸이다 — `ORD_DT` 가 `DATE` 라 시각을 고르게 하면 뜻 없는 값을 정한다.
      precision: 'day',
      rangeDays: { default: 30, max: 366 },
    },
    {
      /*
        **년월 달력** — `precision:'month'` 의 조회 측 실물이다(playbook/INDEX.md). 값은 `202608`
        문자열로 나가며(playbook/INDEX.md), 서버는 `VARCHAR(6)` 의 사전순을 시간순으로 읽는다
        (`FieldSpec.ordered`).
      */
      field: 'dlvrYm',
      label: MSG.SAMPLE_COND_DLVR_YM,
      type: 'dateRange',
      op: 'between',
      ops: ['between', 'eq'],
      precision: 'month',
    },
    {
      /*
        **`gt`·`lt` 가 여기서 열린다**(playbook/INDEX.md). backend/api.md 의 열셋이 이로써 전부 쓰인다.

        숫자 칸이라 *초과*·*미만* 을 사람이 잘못 읽을 여지가 없다 — 기간 칸의 경계 하루
        문제를 피한 자리다.
      */
      field: 'ordAmt',
      label: MSG.SAMPLE_COND_ORD_AMT,
      type: 'text',
      op: 'gte',
      ops: ['between', 'gt', 'gte', 'lt', 'lte'],
    },
    {
      // **입력은 초, 전송은 ms**(frontend/search-form.md) — 라벨이 단위를 말한다.
      field: 'procMs',
      label: MSG.SAMPLE_COND_PROC_SEC,
      type: 'text',
      op: 'gte',
      ops: ['gte'],
      scale: MILLIS,
    },
    {
      // **연산자 셀렉터가 없다** — 값이 둘뿐인 칸에서 연산자를 고르게 할 이유가 없다.
      field: 'urgentYn',
      label: MSG.SAMPLE_COND_URGENT,
      type: 'select',
      op: 'eq',
      ops: ['eq'],
      /*
        **`select` 이지 `ynFlag` 가 아니다**(frontend/search-form.md — 폼의 타입은 넷뿐이다). 스위치로 두면
        *끄기 = N* 이 되어 **전체를 표현할 자리가 없다**.

        값이 `Y`/`N` 인 것은 DB 가 `CHAR(1)` 이기 때문이며, 서버가 `true`/`false` 도 함께
        받는다(`ValueCoercion`) — 화면이 어느 쪽을 보내도 같은 뜻이다.
      */
      options: [
        { value: 'Y', text: label(MSG.SAMPLE_YN_Y) },
        { value: 'N', text: label(MSG.SAMPLE_YN_N) },
      ],
    },
    {
      /*
        **태그 입력** — playbook/INDEX.md. 서버에서 이것은 파생 조건이며 자식 테이블의 `EXISTS` 로
        펴진다(playbook/INDEX.md). 문자열 컬럼이었으면 `LIKE '%…%'` 라 **`개발` 이 `개발자` 에 걸린다**.
      */
      field: 'tagNm',
      label: MSG.SAMPLE_COND_TAG,
      type: 'text',
      op: 'in',
      ops: ['in'],
    },
    {
      /*
        **값 칸이 사라진다** — `isNull`·`isNotNull` 은 값을 받지 않는다(playbook/INDEX.md).

        **기본 연산자는 값을 받는 쪽이다**(2026-09-02 에 고쳤다). `isNotNull` 이 기본이었고,
        값을 받지 않는 연산자는 **채울 것이 없으므로 늘 조건으로 나간다** — 그래서 이
        화면은 열자마자 *오류 메시지가 있는 주문만* 으로 걸러져 **총 0건**이었다. 사용자가
        고른 적 없는 조건이고, 화면은 그것을 *조건에 맞는 주문이 없습니다* 로만 말한다.

        어휘는 그대로 남는다 — 연산자를 고르면 값 칸이 사라지는 것을 그 자리에서 본다.
      */
      field: 'errMsg',
      label: MSG.SAMPLE_COND_ERR_MSG,
      type: 'text',
      op: 'contains',
      ops: ['contains', 'isNotNull', 'isNull'],
    },
  ];
}

/**
 * 컬럼 **서른** — playbook/INDEX.md 의 표 그대로다.
 *
 * <p>**여기서 줄이면 어휘가 하나 실물을 잃는다.** 이 화면의 컬럼 수가 많은 것은 업무가
 * 요구해서가 아니라 frontend/grid.md 의 타입 아홉 · 에디터 열 · 렌더러 여섯이 하나씩 실물을 가져야
 * 하기 때문이다.
 */
function buildColumns(): ColumnDef<SampleOrderFull>[] {
  return [
    {
      /*
        **`bigint`** — API 가 문자열로 내려야 뜻이 있다(frontend/packages.md). 자바스크립트의 수는 2^53 을
        넘기면 조용히 정밀도를 잃고, 그 손실은 화면이 아니라 **저장 요청이 다른 행을
        가리키는 것**으로 드러난다.
      */
      field: 'ordId',
      header: MSG.SAMPLE_COL_ORD_ID,
      type: 'bigint',
      width: 90,
      pinned: 'left',
      sortable: true,
      renderer: 'link',
    },
    {
      // 업무 키다 — 신규 행에서만 열리고 고치려면 지우고 다시 만든다(frontend/grid.md).
      field: 'ordNo',
      header: MSG.SAMPLE_COL_ORD_NO,
      type: 'text',
      width: 160,
      pinned: 'left',
      sortable: true,
      pk: { renamable: false },
      required: true,
    },
    {
      field: 'ordNm',
      header: MSG.SAMPLE_COL_ORD_NM,
      type: 'text',
      width: 200,
      sortable: true,
      required: true,
      editor: 'text',
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      /*
        **참조 팝업** — 고르면 이름과 등급을 함께 채운다(frontend/grid.md). `apply` 가 부분 객체를
        돌려주는 것이 계약의 중심이며, **여러 칸을 한 번에 채우는 것이 기본**이다.

        `picked === null` 은 **지우는 것**이다 — 값을 비웠는데 이름이 남으면 그것이 곧
        불일치이고, 채울 때와 지울 때가 대칭이어야 한다.
      */
      field: 'custId',
      header: MSG.SAMPLE_COL_CUST_ID,
      type: 'popupRef',
      width: 120,
      sortable: true,
      required: true,
      editable: (row, ctx) => textEditable(row, ctx.state),
      popup: {
        key: 'sample.customer',
        apply: (_row, picked) =>
          picked === null
            ? { custId: '', custNm: '', custGrdCd: null }
            : {
                custId: text(picked.custId),
                custNm: text(picked.custNm),
                custGrdCd: text(picked.custGrdCd) || null,
              },
      },
    },
    {
      // 팝업이 채우는 칸이다 — 사람이 타이핑하면 아이디와 이름이 다른 행이 만들어진다.
      field: 'custNm',
      header: MSG.SAMPLE_COL_CUST_NM,
      type: 'text',
      width: 160,
      sortable: true,
      required: true,
      editable: false,
    },
    {
      // **tone 맵** — 값이 무엇인가로 색을 고른다(frontend/grid.md). 팝업이 함께 채운다.
      field: 'custGrdCd',
      header: MSG.SAMPLE_COL_CUST_GRD,
      type: 'code',
      width: 100,
      sortable: true,
      grpCd: 'SMPL_CUST_GRD',
      renderer: 'badge',
      tone: { VIP: 'ok', GOLD: 'warn', SILVER: 'none', BRONZE: 'muted' },
      editable: false,
    },
    {
      // 상태 전이 — `editable` 함수와 `eligible` 이 이 값을 근거로 판단한다(playbook/INDEX.md).
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
    {
      /*
        **후보가 많은 콤보** — frontend/grid.md. 후보가 스물둘이라 드롭다운을 스크롤로 뒤지게 되고,
        `richSelect` 에서는 **타이핑이 필터**다(입력이 아니다 — 목록에 없는 값은 만들어지지
        않는다).

        이름이 판의 것이어도 어휘는 우리 것이다(frontend/grid.md) — 어댑터가 자체 구현을 붙인다.
      */
      field: 'chnlCd',
      header: MSG.SAMPLE_COL_CHNL,
      type: 'code',
      width: 130,
      sortable: true,
      grpCd: 'SMPL_CHNL',
      editor: 'richSelect',
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      // **아이콘 렌더러** — 값이 아이콘을 고른다. 값 자체는 바뀌지 않는다(frontend/grid.md).
      field: 'priorityCd',
      header: MSG.SAMPLE_COL_PRIORITY,
      type: 'code',
      width: 100,
      sortable: true,
      grpCd: 'SMPL_PRIORITY',
      editor: 'select',
      renderer: 'icon',
      icons: {
        LOW: 'low',
        NORMAL: 'none',
        HIGH: 'high',
        URGENT: 'warn',
      },
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      // **`precision:'day'`** — 정밀도 셋 중 첫째.
      field: 'ordDt',
      header: MSG.SAMPLE_COL_ORD_DT,
      type: 'date',
      width: 120,
      sortable: true,
      required: true,
      // **편집기를 적지 않는다** — 날짜 칸의 편집기는 달력 말고 있을 수가 없어 타입이
      // 이미 정한다(`EditorType` 에 `date` 가 없는 이유다).
      precision: 'day',
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      // **`precision:'month'`** — DB 는 `VARCHAR(6)` 이다(playbook/INDEX.md).
      field: 'dlvrYm',
      header: MSG.SAMPLE_COL_DLVR_YM,
      type: 'date',
      width: 110,
      sortable: true,
      precision: 'month',
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      // **`precision:'second'`** — 시스템이 적는 값이라 읽기 전용이다.
      field: 'ordDtm',
      header: MSG.SAMPLE_COL_ORD_DTM,
      type: 'dateTime',
      width: 160,
      sortable: true,
      precision: 'second',
      editable: false,
    },
    {
      field: 'ordQty',
      header: MSG.SAMPLE_COL_ORD_QTY,
      type: 'number',
      width: 100,
      sortable: true,
      required: true,
      editor: 'number',
      editable: (row, ctx) => amountEditable(row, ctx.state),
      /*
        **계산은 한 곳에서 둘 다 한다**(frontend/grid.md). 수량이 바뀌면 금액이 바뀌고 금액이 바뀌면
        부가세가 바뀌는데, 연쇄로 두면 **어느 순서로 도는가**가 숨은 규칙이 된다. 여기서
        멈추고 **서버가 다시 센다** — 이것은 보여주기다(원칙 P1).
      */
      afterEdit: (row) => amounts(row),
    },
    {
      field: 'unitAmt',
      header: MSG.SAMPLE_COL_UNIT_AMT,
      type: 'number',
      width: 120,
      sortable: true,
      required: true,
      editor: 'number',
      editable: (row, ctx) => amountEditable(row, ctx.state),
      afterEdit: (row) => amounts(row),
    },
    {
      field: 'ordAmt',
      header: MSG.SAMPLE_COL_ORD_AMT,
      type: 'number',
      width: 130,
      sortable: true,
      editable: false,
    },
    {
      field: 'vatAmt',
      header: MSG.SAMPLE_COL_VAT_AMT,
      type: 'number',
      width: 120,
      sortable: true,
      editable: false,
    },
    {
      /*
        **tone 범위**(`ToneRange`) — 값이 **어디에 드는가**로 색을 고른다(frontend/grid.md).
        맵으로는 쓸 수 없다: 할인율은 연속값이라 전부 적을 수 없고, 적지 않은 값은 조용히
        색이 없다.

        막대는 원본 숫자를 그린다 — 정렬·필터·엑셀이 전부 같은 값을 본다.
      */
      field: 'dcRt',
      header: MSG.SAMPLE_COL_DC_RT,
      type: 'number',
      width: 110,
      sortable: true,
      editor: 'number',
      renderer: 'progress',
      tone: [
        { max: 5, tone: 'none' },
        { max: 15, tone: 'warn' },
        { max: 100, tone: 'err' },
      ],
      editable: (row, ctx) => amountEditable(row, ctx.state),
      /*
        **조건부 필수는 함수다**(frontend/grid.md). 할인이 있으면 비고가 필요하다 — 그 판정을 여기에
        두는 것은 근거가 이 행에 있기 때문이며, 서버도 같은 것을 다시 본다(frontend/grid.md).
      */
      validate: (value) =>
        Number(value) < 0 || Number(value) > 100 ? label(MSG.SAMPLE_DC_RT_RANGE) : null,
    },
    {
      /*
        **값은 ms 그대로다**(frontend/grid.md) — 렌더러가 사람이 읽는 단위로 바꾼다. 서버가 포맷한
        문자열을 따로 주면 그 컬럼의 정렬이 **문자열 정렬**이 되어 `9분` 이 `10분` 보다
        뒤에 온다(screen/admin/system/batch/schedule/requirements.md).

        일괄 재계산이 이 값을 적는다 — 아무도 쓰지 않으면 **영원히 비어 있는 칸**이다.
      */
      field: 'procMs',
      header: MSG.SAMPLE_COL_PROC_MS,
      type: 'number',
      width: 110,
      sortable: true,
      renderer: 'duration',
      editable: false,
    },
    {
      // **스위치다 — 체크박스가 아니다**(frontend/grid.md). 값이 둘인 것은 화면 어디서나 스위치다.
      field: 'urgentYn',
      header: MSG.SAMPLE_COL_URGENT,
      type: 'ynFlag',
      width: 80,
      sortable: true,
      editor: 'switch',
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      /*
        **`editable` 함수가 `hidden` 컬럼을 근거로 읽는다**(frontend/grid.md) — 잠긴 주문은 사용
        여부를 바꿀 수 없다. `LOCK_YN` 은 그리지 않으므로 사용자는 **왜 닫혔는지**를
        거절 메시지로만 안다.
      */
      field: 'useYn',
      header: MSG.SAMPLE_COL_USE,
      type: 'ynFlag',
      width: 80,
      sortable: true,
      editor: 'switch',
      editable: (row, ctx) =>
        ctx.state === 'C' || !row.lockYn ? true : { ok: false, message: label(MSG.SAMPLE_LOCKED) },
    },
    {
      /*
        **배열 컬럼** — 저장은 자식 테이블이다(playbook/INDEX.md). 화면은 배열을 보내고 받으며,
        **행으로 펴는 것은 서버다**: `list` 는 화면의 어휘이지 저장의 어휘가 아니다(frontend/grid.md).

        항목이 객체이므로 `display` 가 무엇을 보일지 정한다.
      */
      field: 'tagList',
      header: MSG.SAMPLE_COL_TAG_LIST,
      type: 'list',
      /*
        **240 이다** — 200 에서는 `+N` 이 잘렸다(2026-09-02 실측: 내용 204px · 칸 198px).
        앞의 셋과 `+N` 을 함께 그리는 것이 이 렌더러의 요점인데(`columnDefs` 의 주석 —
        *열 개 붙은 행과 세 개 붙은 행이 같아 보인다*), 한글 태그 셋이면 그 `+N` 이 6px
        모자라 밀려 나가 **많다는 사실만 사라진다.**
      */
      width: 240,
      editor: 'listModal',
      /*
        **레지스트리 키다 — 창 제목이 아니다**(2026-09-02 에 고쳤다). 여기 메시지 키가
        들어 있었고(`sample.tag.modal.title`), 그 키로는 등록된 팝업이 없으니 팝업 호스트가
        *취소* 로 돌려주었다 — 창은 열리는데 **추가 버튼이 아무 일도 하지 않았다.**

        키 모양이 규약이라(`ns.name` — 점 하나) 등록은 애초에 이 값을 받을 수 없었지만,
        **찾는 쪽은 모양을 보지 않는다**: 없는 키는 그냥 `undefined` 다.
      */
      listModal: { key: 'sample.tag' },
      renderer: 'tags',
      display: (item) => String((item as SampleTag).tagNm ?? ''),
      editable: (row, ctx) => textEditable(row, ctx.state),
      /*
        **개수는 컬럼 층이 센다**(frontend/grid.md · playbook/INDEX.md). 배열이 셀 값이라 다른 행을 볼 필요가
        없고, 그리드 층으로 올리면 *어느 셀의 문제인가* 에 답할 자리를 잃는다.

        `listModal` 이 스스로 세지 않는 것은 frontend/grid.md 이 그은 선이다 — 개수·형식·유일성은
        전부 검증이며, 컴포넌트가 재면 *"창고가 A 면 최대 50개"* 가 올 때마다 키가 는다.
      */
      validate: tooManyTags,
    },
    {
      // **셀 위 팝업 텍스트영역**(frontend/grid.md) — 좁은 쪽이다.
      field: 'memo',
      header: MSG.SAMPLE_COL_MEMO,
      type: 'text',
      width: 180,
      editor: 'largeText',
      maxLength: 2000,
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      /*
        **같은 것을 모달로** — 넓은 쪽이다. 글자 수가 이 편집기를 고르는 기준이며, 셀 위
        팝업에 긴 글을 담으면 **쓰는 사람이 자기가 쓴 것을 못 본다**.

        **조건부 필수** — `DC_RT > 0` 이면 필수가 된다(playbook/INDEX.md). frontend/grid.md 의 *조건부 필수는
        함수다* 의 실물이다.
      */
      field: 'rmk',
      header: MSG.SAMPLE_COL_RMK,
      type: 'text',
      width: 180,
      editor: 'textModal',
      maxLength: 4000,
      required: (row) => (row.dcRt ?? 0) > 0,
      editable: (row, ctx) => textEditable(row, ctx.state),
    },
    {
      /*
        **읽기 전용인데 펼쳐 읽는다** — `viewer` 가 에디터와 다른 축인 이유다(playbook/INDEX.md).
        오류 문구는 고칠 수 있는 값이 아니지만 **셀 폭에 갇히면 읽을 수가 없다**.
      */
      field: 'errMsg',
      header: MSG.SAMPLE_COL_ERR_MSG,
      type: 'text',
      width: 180,
      viewer: 'largeText',
      editable: false,
    },
    {
      /*
        **기본 숨김** — 설정 창에서 사용자가 켠다(frontend/grid.md). `hidden` 과 갈리는 자리이며,
        저것은 **켜져서는 안 되는 컬럼**이고 이것은 **평소에 안 보일 뿐인 컬럼**이다.
      */
      field: 'srcSysCd',
      header: MSG.SAMPLE_COL_SRC_SYS,
      type: 'code',
      width: 110,
      visible: false,
      grpCd: 'SMPL_SRC_SYS',
      editable: false,
    },
    {
      /*
        **켜져서는 안 되는 컬럼** — 설정 창에도 나오지 않는다(frontend/grid.md). 위 `editable`
        함수들이 **근거로만** 읽는다.
      */
      field: 'lockYn',
      header: MSG.SAMPLE_COL_LOCK,
      type: 'ynFlag',
      hidden: true,
    },
    // 감사 넷 — `hidden` 이 **아니다**(frontend/grid.md). 시스템 컬럼이지만 사람이 읽을 값이다.
    {
      field: 'regId',
      header: MSG.SAMPLE_COL_REG_ID,
      type: 'text',
      width: 110,
      sortable: true,
      editable: false,
    },
    {
      field: 'regDtm',
      header: MSG.SAMPLE_COL_REG_DTM,
      type: 'dateTime',
      width: 160,
      sortable: true,
      editable: false,
    },
    {
      field: 'modId',
      header: MSG.SAMPLE_COL_MOD_ID,
      type: 'text',
      width: 110,
      sortable: true,
      editable: false,
    },
    {
      field: 'modDtm',
      header: MSG.SAMPLE_COL_MOD_DTM,
      type: 'dateTime',
      width: 160,
      sortable: true,
      editable: false,
    },
  ];
}

/**
 * 금액 둘을 **한 곳에서** 센다 — frontend/grid.md.
 *
 * <p>**연쇄는 한 단계에서 멈춘다.** `ordAmt` 의 `afterEdit` 를 두지 않는 것은 그것이
 * *어느 순서로 도는가* 를 숨은 규칙으로 만들기 때문이며, 서버가 저장 시 다시 센다.
 *
 * <p>세율이 상수인 것은 샘플이기 때문이다 — 일괄 재계산은 그 값을 **사람에게 묻는다**.
 */
function amounts(row: SampleOrderFull): Partial<SampleOrderFull> {
  const amount = (row.ordQty ?? 0) * (row.unitAmt ?? 0);
  return { ordAmt: amount, vatAmt: amount * VAT_RATE };
}

const VAT_RATE = 0.1;

/**
 * 팝업이 돌려준 칸 하나를 글자로 — **팝업 행에는 타입이 없다**(`PopupRow`).
 *
 * <p>레지스트리가 키 하나로 여럿을 담으므로 거기서 타입을 붙들 수 없고, **타입이 필요한
 * 자리는 `apply` 다**: 고른 행을 어느 컬럼에 어떻게 담을지 아는 것은 팝업이 아니라 그것을
 * 쓰는 컬럼이다(frontend/grid.md).
 *
 * <p>`String()` 을 그대로 쓰지 않는 것은 객체가 오면 `[object Object]` 가 **셀에 그대로
 * 저장되기** 때문이다 — 그 값은 저장 요청까지 가고, 화면에서는 정상으로 보인다.
 */
function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
