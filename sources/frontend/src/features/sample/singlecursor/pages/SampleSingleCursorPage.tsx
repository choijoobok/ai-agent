import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App } from 'antd';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { ColumnDef, GridControl } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField } from '@/shared/searchform/types';
import { SAMPLE_CURSOR_ENDPOINTS } from '@/features/sample/singlecursor/api/endpoints';
import type { SampleOrderCursor } from '@/features/sample/types';

/**
 * `SMPL_SINGLE_CURSOR` — playbook/INDEX.md. **커서형 페이징의 유일한 실물이다.**
 *
 * <p>①과 **같은 `SMPL_ORDER`** 를 읽는다. 테이블을 하나 더 만들지 않은 것이 playbook/INDEX.md 의
 * 결정이며, 만들었다면 **모드가 데이터의 성질처럼** 읽힌다 — 모드는 **엔드포인트가
 * 정한다**(backend/api.md). 같은 테이블에 모드가 다른 엔드포인트 둘을 두는 것이 그 사실의 가장
 * 정직한 시연이다.
 *
 * <h2>①과 갈리는 것 넷</h2>
 *
 * <p>**총 건수가 없다.** `COUNT` 를 돌지 않는 것이 이 모드의 값이며, 푸터의 그 자리를
 * `footerNote` 가 *최근 N일* 로 메운다(playbook/INDEX.md). 무엇을 물어서 나온 N건인지가 함께 있어야
 * *전부가 N건* 으로 읽히지 않는다.
 *
 * <p>**네비가 `‹ 이전 · 다음 ›` 이다.** 페이지 번호가 만들어지지 않는다 — 총 건수가
 * 없으므로 몇 장인지 셀 수가 없고, 마지막 장에서도 **마지막이라는 말을 쓰지 않는다**.
 *
 * <p>**정렬이 한 컬럼만이다.** 둘 이상이면 서버가 400 이다 — 기준점이 성립하려면 정렬 키가
 * 고정이어야 한다. 정렬을 바꾸면 커서를 버리고 첫 장으로 가는 것도 선택이 아니라 필수다.
 *
 * <p>**기간이 필수다.** screen/log/access/requirements.md 가 `ACCESS_LOG` 로 세운 규약을 **업무 테이블에서**
 * 되풀이한다 — 이 화면은 *대용량 이력의 대리* 다(playbook/INDEX.md).
 *
 * <h2>저장이 없다</h2>
 *
 * <p>액션이 `R` 과 `E` 뿐이라 저장 버튼도 행 추가도 없고, 편집용 컬럼이 자리를 차지할
 * 이유도 없다 — 읽기 열둘만 낸다(playbook/INDEX.md).
 */

const MENU_CD = 'SMPL_SINGLE_CURSOR';

/**
 * **화면 층이 시스템 값을 좁힌다**(frontend/search-form.md). 넓히는 쪽으로는 못 간다 — 화면이 32를 적어도
 * 시스템이 31이면 31이다.
 */
const RANGE_DAYS = { default: 1, max: 31 };

/** 커서형은 한 장이 크다 — 번호 없는 이동이라 장을 자주 넘기는 동선이 아니다. */
const PAGE_SIZES = [100, 500, 1000];

/** 자동 새로고침의 주기. **초 단위로 두지 않는다** — 이 화면은 실시간 감시가 아니다. */
const REFRESH_MS = 30_000;

export function SampleSingleCursorPage() {
  const { modal } = App.useApp();
  const searchForm = useRef<SearchFormHandle>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const header = useSearchFormHeader();

  const collectConditions = useCallback(
    () => Promise.resolve(searchForm.current?.collect() ?? []),
    [],
  );

  const columns = useMemo(() => buildColumns(), []);
  const searchFields = useMemo(() => buildSearchFields(), []);

  const api = useMemo(
    () => ({
      // **저장이 없다** — 액션이 `R` 과 `E` 뿐이다(playbook/INDEX.md).
      read: { url: SAMPLE_CURSOR_ENDPOINTS.getOrderCursorList, emptyNotice: true },
    }),
    [],
  );

  const controller = useGridController<SampleOrderCursor>({
    menuCd: MENU_CD,
    columns,
    api,
    params: collectConditions,
  });

  /**
   * 자동 새로고침 — `controls` 좌의 토글이 켜면 돈다(playbook/INDEX.md).
   *
   * <p>**첫 장으로 돌아간다.** `read()` 는 커서를 버리고 다시 묻는데, 그것이 옳다: 커서는
   * *직전 장의 마지막 행* 을 기준점으로 잡으므로 새 데이터가 앞에 쌓이는 화면에서
   * 그 자리를 유지하면 **새로 들어온 것을 영영 보지 못한다**.
   *
   * <p>**미저장 편집을 버릴 걱정이 없다** — 이 화면은 저장이 없다. 편집이 있는 그리드에서
   * 같은 토글을 두려면 그 사실을 먼저 물어야 한다(frontend/grid.md).
   */
  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }
    const timer = window.setInterval(() => void controller.read(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, controller]);

  const controls = useMemo<GridControl[]>(
    () => [
      {
        /*
          **값이 둘인 것은 스위치다**(frontend/grid.md · playbook/INDEX.md). 셀렉트로 그리면 *켜짐/꺼짐* 두
          줄짜리 드롭다운이 되어 한 번 볼 것을 두 번 누르게 된다.

          **스스로 재조회하지 않는다** — `onChange` 가 상태를 바꾸고 위 `useEffect` 가
          그 상태를 읽는다. 컨트롤이 컨트롤러를 직접 부르면 토글 하나가 그리드의 상태를
          말없이 갈아 치울 수 있게 된다(frontend/grid.md).
        */
        key: 'autoRefresh',
        slot: 'beforeRead',
        type: 'toggle',
        label: MSG.SAMPLE_CURSOR_AUTO_REFRESH,
        value: autoRefresh,
        onChange: setAutoRefresh,
      },
      {
        key: 'help',
        slot: 'beforeTools',
        type: 'button',
        label: MSG.SAMPLE_CONTROL_HELP,
        onClick: () => {
          modal.info({
            title: label(MSG.SAMPLE_CONTROL_HELP),
            content: label(MSG.SAMPLE_CURSOR_HELP_BODY),
          });
        },
      },
    ],
    [autoRefresh, modal],
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
        <DataGrid<SampleOrderCursor>
          title={MSG.SAMPLE_CURSOR_GRID_TITLE}
          menuCd={MENU_CD}
          controller={controller}
          controls={controls}
          pageSizes={PAGE_SIZES}
          /*
            **총 건수를 잃은 자리를 메운다** — playbook/INDEX.md 의 푸터 왼쪽이 `N건 조회됨 · 최근
            {기간}` 이다. 무엇을 물어서 나온 N건인지가 함께 있어야 *전부가 N건* 으로
            읽히지 않는다.
          */
          footerNote={label(MSG.SAMPLE_CURSOR_FOOTER_RANGE, { days: RANGE_DAYS.max })}
          emptyText={MSG.SAMPLE_CURSOR_EMPTY}
        />
      </div>
    </FillColumn>
  );
}

/**
 * 조회조건 **셋** — playbook/INDEX.md.
 *
 * <p>①의 열둘과 갈리는 것이 요점이다. 저기는 *어휘를 전부 낸다* 가 목적이고 여기는
 * **기간이 부하의 상한**인 화면이라, 조건이 적은 것이 이 화면의 성격이다.
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      /*
        **필수다** — screen/log/access/requirements.md 와 같은 이유(부하 상한). 비우고 조회할 수 있으면 첫 조회가
        테이블 전량을 향한다.

        **`second` 정밀도다.** 날짜만 고르게 두면 *오늘* 이 자정에서 끊겨 **방금 들어온
        주문이 안 나온다** — 이 화면에서 가장 흔한 조회가 *조금 전 그것* 이라 그 자체가
        고장으로 읽힌다.
      */
      field: 'ordDtm',
      label: MSG.SAMPLE_CURSOR_COND_ORD_DTM,
      type: 'dateRange',
      op: 'between',
      ops: ['between'],
      required: true,
      rangeDays: RANGE_DAYS,
    },
    {
      field: 'ordNo',
      label: MSG.SAMPLE_COND_ORD_NO,
      type: 'text',
      op: 'contains',
      ops: ['contains', 'eq', 'startsWith'],
    },
    {
      field: 'ordStatCd',
      label: MSG.SAMPLE_COND_ORD_STAT,
      type: 'select',
      op: 'in',
      ops: ['in', 'eq'],
      grpCd: 'SMPL_ORD_STAT',
    },
  ];
}

/**
 * 읽기 **열둘** — playbook/INDEX.md.
 *
 * <p>**편집 선언이 하나도 없다.** 저장이 없는 그리드라 `editor`·`required`·`afterEdit` 가
 * 자리를 차지할 이유가 없고, 적어 두면 **열리지 않는 편집기**가 선언에 남아 다음 사람이
 * 왜 안 열리는지를 찾게 된다.
 *
 * <p>**렌더러는 그대로 나온다.** 배지 둘 · 막대 · 소요시간 · 펼쳐 읽기가 여기 있으며,
 * 그것들은 편집과 무관한 축이다 — playbook/INDEX.md 의 커버리지 표에서 이 화면이 `viewer` 를 ①과
 * 함께 갖는 이유다.
 */
function buildColumns(): ColumnDef<SampleOrderCursor>[] {
  return [
    {
      field: 'ordNo',
      header: MSG.SAMPLE_COL_ORD_NO,
      type: 'text',
      width: 160,
      pinned: 'left',
      /*
        **정렬 가능한 컬럼이 하나뿐이 아니다.** 커서형이 제한하는 것은 *동시에 몇 개인가*
        이지 *어느 것이 되는가* 가 아니다 — 다른 컬럼으로 바꾸면 커서를 버리고 첫 장으로
        간다(playbook/INDEX.md).
      */
      sortable: true,
    },
    {
      field: 'ordNm',
      header: MSG.SAMPLE_COL_ORD_NM,
      type: 'text',
      width: 200,
      sortable: true,
    },
    {
      field: 'custNm',
      header: MSG.SAMPLE_COL_CUST_NM,
      type: 'text',
      width: 160,
      sortable: true,
    },
    {
      // tone 맵 — ①과 같은 색이다. 갈리면 같은 값이 화면마다 다른 것으로 읽힌다.
      field: 'custGrdCd',
      header: MSG.SAMPLE_COL_CUST_GRD,
      type: 'code',
      width: 100,
      grpCd: 'SMPL_CUST_GRD',
      renderer: 'badge',
      tone: { VIP: 'ok', GOLD: 'warn', SILVER: 'none', BRONZE: 'muted' },
    },
    {
      field: 'ordStatCd',
      header: MSG.SAMPLE_COL_ORD_STAT,
      type: 'code',
      width: 110,
      sortable: true,
      grpCd: 'SMPL_ORD_STAT',
      renderer: 'badge',
      tone: { RCV: 'none', CFM: 'ok', SHP: 'warn', DON: 'muted' },
    },
    {
      field: 'ordDt',
      header: MSG.SAMPLE_COL_ORD_DT,
      type: 'date',
      width: 120,
      sortable: true,
      precision: 'day',
    },
    {
      /*
        **기본 정렬 키다.** 커서가 `(ORD_DTM, ORD_ID)` 튜플 비교이고(backend/api.md) 그 튜플에
        인덱스가 있다(`IX_SMPL_ORDER_DTM` · playbook/INDEX.md) — 없으면 매 장이 풀스캔이라
        **오프셋보다 느려진다**.
      */
      field: 'ordDtm',
      header: MSG.SAMPLE_COL_ORD_DTM,
      type: 'dateTime',
      width: 160,
      sortable: true,
      precision: 'second',
    },
    {
      field: 'ordQty',
      header: MSG.SAMPLE_COL_ORD_QTY,
      type: 'number',
      width: 100,
      sortable: true,
    },
    {
      field: 'ordAmt',
      header: MSG.SAMPLE_COL_ORD_AMT,
      type: 'number',
      width: 130,
      sortable: true,
    },
    {
      // tone 범위 — 값이 **어디에 드는가**로 고른다(frontend/grid.md). ①과 같은 구간이다.
      field: 'dcRt',
      header: MSG.SAMPLE_COL_DC_RT,
      type: 'number',
      width: 110,
      sortable: true,
      renderer: 'progress',
      tone: [
        { max: 5, tone: 'none' },
        { max: 15, tone: 'warn' },
        { max: 100, tone: 'err' },
      ],
    },
    {
      // 값은 ms 그대로다 — 정렬·필터·엑셀이 전부 같은 값을 본다(frontend/grid.md).
      field: 'procMs',
      header: MSG.SAMPLE_COL_PROC_MS,
      type: 'number',
      width: 110,
      sortable: true,
      renderer: 'duration',
    },
    {
      /*
        **읽기 전용인데 펼쳐 읽는다** — `viewer` 가 에디터와 다른 축인 이유다. 이 화면에
        편집기가 하나도 없는데 이것이 있는 것이 그 축의 증명이다.
      */
      field: 'errMsg',
      header: MSG.SAMPLE_COL_ERR_MSG,
      type: 'text',
      width: 200,
      viewer: 'largeText',
    },
  ];
}
