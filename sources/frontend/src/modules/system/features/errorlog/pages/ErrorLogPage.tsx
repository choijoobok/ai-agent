// @feat FEAT-507
import { useCallback, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { ColumnDef, SearchCondition } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField, SearchOp } from '@/shared/searchform/types';
import { useShellNavigation } from '@/layouts/ShellLayout/useShellNavigation';
import { handOff } from '@/shared/routes/handoffStore';
import { hasPermission } from '@/shared/authz/permission';
import { useAuthStore } from '@/shared/stores/authStore';
import { ERROR_LOG_ENDPOINTS } from '@/modules/system/features/errorlog/api/endpoints';
import { ErrorDetailModal } from '@/modules/system/features/errorlog/components/ErrorDetailModal';
import type { ErrorLogRow } from '@/modules/system/features/errorlog/types';

/**
 * `ERROR_LOG` — screen/log/error/requirements.md. <b>셋 중 유일하게 사람이 먼저 찾아오는 화면</b>이다.
 *
 * <p>사용 이력과 로그인 이력은 *"뒤져 본다"* 이지만 여기는 <b>사용자가 들고 온 `traceId` 나
 * URL 로 들어온다</b> — 5xx 토스트가 띄운 값을 복사해 오는 것이 가장 흔한 동선이고,
 * 그래서 <b>추적 ID 를 넣으면 기간이 선택이 된다</b>.
 *
 * <h2>이 화면이 답하는 물음 셋</h2>
 *
 * <table><caption></caption>
 * <tr><td>*"이 오류가 왜 났나"*</td><td>`오류 코드` + `메시지` + 상세의 <b>스택 탭</b>.
 *     셋 다 자기 테이블에 있어 <b>진단이 자립한다</b></td></tr>
 * <tr><td>*"그때 무엇을 보냈나"*</td><td>상세의 <b>전문 탭</b> — `TRACE_ID` 로 사용 이력에서
 *     온다. 배타를 없앤 §1.4 가 성립시킨 것이며, 배타였을 때 이 물음은 <b>언제나 0건</b>
 *     이었다</td></tr>
 * <tr><td>*"왜 403 인가"*</td><td>`오류 코드` 가 세 갈래를 나르고, `요청 URI` 더블
 *     클릭이 `API_CATALOG` 로 넘긴다. <b>세 화면이 한 동선</b>이다</td></tr>
 * </table>
 *
 * <h2>기본이 <i>전체</i> 인 것이 판단이다</h2>
 *
 * <p>*5xx 만* 이 이 화면의 가장 흔한 조회지만 기본으로 두지 않는다. 403 을 진단하러
 * 온 사람이 <b>빈 화면을 먼저 보게 되고</b>, 그 빈 화면은 *"기록이 없다"* 로 읽힌다 —
 * 사용 이력이 *일어난 요청 전부* 를 기본으로 두는 것과 같은 이유다.
 *
 * <h2>쓰기 경로가 아예 없다</h2>
 *
 * <p>`api.save` 도 `addRow` 도 `editable` 도 선언하지 않는다 — 감춘 것이 아니라
 * <b>선언이 없어서</b> 저장·행 추가·상태 컬럼·삭제 컬럼이 나오지 않는다(frontend/grid.md).
 */

const MENU_CD = 'ERROR_LOG';

/**
 * 쪽수 — <b>로그는 100</b>이다(frontend/grid.md).
 *
 * <p>첫 조회의 크기와 콤보의 첫 후보가 같아야 한다 — 다르면 콤보에 없는 값이 골라진 채로
 * 화면이 뜬다.
 */
const PAGE_SIZE = 100;
const PAGE_SIZES = [100, 500, 1000];

/**
 * 사람·메뉴 칸 넷이 함께 쓰는 연산자 후보 — <b>같음 · 시작 · 포함 · 끝</b>(2026-09-01).
 *
 * <p>`AccessLogPage` 와 <b>같은 넷</b>이다. 이력 셋의 같은 칸이 화면마다 다른 연산자를
 * 받으면 <b>손이 자리를 기억하지 못한다</b>(frontend/search-form.md 가 목록 순서를 폼에 고정한 것과 같은
 * 근거다). 상수를 공유하지 않는 것은 화면마다 <b>다르게 정할 수 있어야</b> 하기 때문이며,
 * 지금은 같은 값을 각자 선언한다.
 */
const TEXT_OPS: SearchOp[] = ['eq', 'startsWith', 'contains', 'endsWith'];

/** 상태 묶음의 값 — 서버의 `statusGroup` 파생 조건이 범위로 번역한다(screen/log/error/requirements.md). */
const GROUP_SERVER = '5XX';
const GROUP_CLIENT = '4XX';

/** 넘겨주기의 도착지 — screen/log/error/requirements.md. 사용 이력도 같은 곳으로 간다. */
const API_CATALOG_CD = 'API_CATALOG';

export function ErrorLogPage() {
  const searchForm = useRef<SearchFormHandle>(null);
  const permissions = useAuthStore((state) => state.permissions);
  /**
   * 조회 기간의 시스템 값 — 이 화면은 <b>덮지 않는다</b>(screen/log/error/requirements.md).
   *
   * <p>사용 이력이 1 · 31 로 좁힌 것과 갈린다. 저 테이블은 행마다 `nclob` 이 달려 있지만
   * 여기는 <b>스택이 목록에 실리지 않아</b> 행이 가볍다. 기본 7일도 그대로 쓴다 — 오류는
   * 드물게 나는 것이라 하루로 자르면 대개 <b>빈 화면</b>이 된다.
   */
  const searchRange = useAuthStore((state) => state.searchRange);
  const shell = useShellNavigation();
  /** 상세 모달이 열린 행 — `null` 이면 닫혀 있다(screen/log/error/requirements.md). */
  const [detailOf, setDetailOf] = useState<number | null>(null);
  /**
   * 0건 문구가 <b>조건에 따라 셋으로 갈린다</b> — screen/log/error/requirements.md.
   *
   * <p>이 화면의 0건은 대개 <b>답이지 빈 결과가 아니다</b>. *5xx 만* 으로 물어 0건이면
   * *"이 기간에 서버 오류가 없다"* 이고, `traceId` 로 물어 0건이면 *"그 요청은 오류가
   * 아니었다"* 이며 <b>사용 이력에는 반드시 있다</b>. 한 문구로 뭉치면 셋 다
   * *"조회 결과가 없습니다"* 가 되어 <b>진단이 사라진다</b>.
   */
  const [emptyText, setEmptyText] = useState<string>(MSG.ERROR_LOG_EMPTY);

  const header = useSearchFormHeader();

  /*
    조회 직전에 <b>0건 문구를 정한다</b>. 조회가 끝난 뒤가 아니라 여기서 정하는 것은,
    응답이 0건인지 알았을 때는 이미 <i>무엇을 물었는지</i> 가 폼에만 남아 있기 때문이다 —
    그 사이 사용자가 조건을 고쳐 놓으면 문구가 <b>묻지 않은 것</b>을 말한다.

    <b>조건 자체는 손보지 않는다</b>(2026-09-01). 메뉴 칸이 콤보였을 때는 `메뉴 없음`
    보초값을 `null` 로 바꾸는 자리가 함께 여기였는데, 텍스트 칸 둘로 갈리면서 사라졌다.
  */
  const collectConditions = useCallback(() => {
    const conditions = searchForm.current?.collect() ?? null;
    if (conditions === null) {
      // 검증 실패면 조회 자체가 일어나지 않는다 — 오류 표시는 폼의 몫이다(frontend/grid.md).
      return Promise.resolve(null);
    }
    setEmptyText(emptyTextFor(conditions));
    return Promise.resolve(conditions);
  }, []);

  /**
   * `요청 URI` 셀 더블 클릭 → <b>`API_CATALOG` 를 그 URL 로 조회한 상태로 연다</b>(screen/log/error/requirements.md).
   *
   * <p>403 의 세 갈래를 잇는 동선의 <b>가운데 칸</b>이다 — 이 화면이 `오류 코드` 로
   * *어느 갈래인지* 말하고, 더블 클릭이 `API_CATALOG` 로 넘기고, 거기 하단 pane 이 다시
   * `MENU_TREE` 로 넘긴다(screen/menu/requirements.md).
   *
   * <p><b>행이 아니라 칸이다.</b> 이 화면은 <b>행 더블 클릭이 이미 상세 모달</b>이므로
   * 축이 다르면 자리도 달라야 한다. 사용 이력이 같은 컬럼에 같은 제스처를 둔 것도
   * 이 화면 때문이었다 — <b>같은 컬럼이 화면마다 다르게 동작하면</b> 그것이 더 나쁘다.
   *
   * <p><b>볼 권한이 없으면 열지 않는다</b>(frontend/tabs.md). 열어 놓고 403 을 보여주는 것보다 아무 일도
   * 일어나지 않는 편이 낫다 — 더블 클릭은 눌러야만 알 수 있는 제스처라 실패가 더 혼란스럽다.
   */
  const openApiCatalog = useCallback(
    (row: ErrorLogRow) => {
      const node = shell.index.byCode.get(API_CATALOG_CD);
      if (!node || !hasPermission(permissions, API_CATALOG_CD, 'READ')) {
        return;
      }
      handOff(API_CATALOG_CD, row.requestUri);
      shell.openMenu(node);
    },
    [permissions, shell],
  );

  const openDetail = useCallback((row: ErrorLogRow) => setDetailOf(row.exceptionLogSeq), []);

  const columns = useMemo(
    () => buildColumns(openDetail, openApiCatalog),
    [openDetail, openApiCatalog],
  );

  // 선언이지 값이 아니다 — 매 렌더 새 객체를 만들면 컨트롤러의 콜백이 전부 새것이 된다.
  const api = useMemo(
    () => ({
      // `save` 가 없다 — 저장 버튼이 나오지 않는다(frontend/grid.md). 감춘 것이 아니라 선언이 없다.
      read: { url: ERROR_LOG_ENDPOINTS.getList, emptyNotice: true },
    }),
    [],
  );

  const grid = useGridController<ErrorLogRow>({
    menuCd: MENU_CD,
    columns,
    api,
    pageSize: PAGE_SIZE,
    params: collectConditions,
  });

  const searchFields = useMemo(() => buildSearchFields(), []);

  return (
    <FillColumn>
      <SearchForm
        handleRef={searchForm}
        fields={searchFields}
        onSubmit={() => void grid.read()}
        // 조건과 컬럼 필터를 함께 지운다 — frontend/grid.md.
        onReset={grid.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          title={MSG.ERROR_LOG_GRID_TITLE}
          menuCd={MENU_CD}
          controller={grid}
          pageSizes={PAGE_SIZES}
          /*
            총 건수를 잃은 자리를 메운다 — screen/log/error/requirements.md 의 푸터 왼쪽이 `N건 조회됨 · 최근 {기간}`
            이다. 무엇을 물어서 나온 N건인지가 함께 있어야 <i>"전부가 N건"</i> 으로 읽히지
            않는다.
          */
          footerNote={label(MSG.ERROR_LOG_FOOTER_RANGE, { days: searchRange.maxDays })}
          emptyText={emptyText}
          /*
            <b>행 더블 클릭이 상세 모달이다</b>(screen/log/error/requirements.md). `[보기]` 와 제스처가 둘인 것은
            같은 일에 경로가 둘인 것이 아니라 <b>같은 문 앞의 손잡이가 둘</b>인 것이다 —
            목록을 훑는 사람은 행을, 칸을 겨냥한 사람은 링크를 쓴다.

            <b>`요청 URI` 는 여기로 오지 않는다</b> — 컬럼이 자기 더블 클릭을 선언했으면
            그것이 이긴다(`DataGrid`). 축이 좁은 쪽이 사람이 실제로 겨눈 것이다.
          */
          onRowDoubleClick={(row) => openDetail(row.data)}
        />
      </div>

      <ErrorDetailModal exceptionLogSeq={detailOf} onClose={() => setDetailOf(null)} />
    </FillColumn>
  );
}

// ── 컬럼 (screen/log/error/requirements.md) ────────────────────────────────────────────────

/**
 * <b>편집 선언이 한 줄도 없다</b>(screen/log/error/requirements.md) — 그래서 상태 컬럼도 삭제 컬럼도 붙지 않는다.
 *
 * <p><b>정렬은 일시 하나만</b> 열린다(screen/log/error/requirements.md). 나머지는 인덱스가 없어 전체 정렬이 되고,
 * 무엇보다 <b>커서의 기준점이 흔들린다</b>.
 */
function buildColumns(
  openDetail: (row: ErrorLogRow) => void,
  openApiCatalog: (row: ErrorLogRow) => void,
): ColumnDef<ErrorLogRow>[] {
  return [
    {
      field: 'creDtm',
      header: MSG.ERROR_LOG_COL_CRE_DTM,
      type: 'dateTime',
      width: 170,
      pinned: 'left',
      // 유일하게 열린 정렬이다 — 커서의 기준점이므로 여기가 곧 페이지 경계다(screen/log/error/requirements.md).
      sortable: true,
    },
    {
      /*
        <b>여기서는 4xx 와 5xx 를 가른다</b>(screen/log/error/requirements.md) — 사용 이력의 같은 컬럼이 성공과
        실패를 갈랐던 것과 축이 다르다. 이 테이블에 2xx 는 오지 않으므로 <b>칠하지 않는
        구간이 없다</b>: 4xx 는 주의색, 5xx 는 오류색이다.

        <b>맵이 아니라 범위다</b>(frontend/grid.md) — 400·403·404·409·500·502 를 전부 적으면
        처음 보는 상태 코드가 조용히 색을 잃는다.
      */
      field: 'httpStat',
      header: MSG.ERROR_LOG_COL_HTTP_STAT,
      type: 'number',
      width: 90,
      renderer: 'badge',
      tone: [
        { max: 499, tone: 'warn' },
        { max: 599, tone: 'err' },
      ],
    },
    {
      /*
        <b>이 컬럼이 이 화면의 요점이다</b>(screen/log/error/requirements.md). *"같은 오류가 몇 건인가"* 를 묻는
        축이며, 문자열 상수라 흔들리지 않는다(backend/packages.md) — 그래서 <b>컬럼 필터가 이
        페이지 안에서</b> 묶어 세고, 조회조건이 완전 일치로 다시 좁힌다.

        403 의 세 갈래도 이 값이 나른다 — 사용자에게는 같은 403 이지만 <b>고치는 곳이
        다르다</b>: 미등록은 시드, 미매핑은 `endpoints.ts`, 권한 없음은 역할 권한이다.
      */
      field: 'errCd',
      header: MSG.ERROR_LOG_COL_ERR_CD,
      type: 'text',
      width: 200,
    },
    {
      /*
        <b>서버가 완성한 문장</b>이다 — 사용자가 그때 본 그 글이며(backend/packages.md) 문의를 받은
        사람이 <i>"이 말이 맞나"</i> 를 대조하는 값이다.

        <b>셀 툴팁을 켠다</b>(frontend/grid.md · screen/admin/system/log/access/requirements.md). 1000자까지 오는데 셀은 한 줄이라 대개
        잘려 보이고, 잘린 문장은 <b>다른 오류처럼</b> 읽힌다. `nclob` 이 아니라 값이 손에
        있으므로 툴팁이 성립한다 — 스택이 `[보기]` 인 것과 갈리는 자리다.
      */
      field: 'errMsg',
      header: MSG.ERROR_LOG_COL_ERR_MSG,
      type: 'text',
      width: 280,
      cellTooltip: true,
    },
    {
      field: 'userId',
      header: MSG.ERROR_LOG_COL_USER_ID,
      type: 'text',
      width: 120,
      // `||` 다 — 오라클이 빈 문자열을 `NULL` 로 저장하므로 둘은 같은 값이다(backend/persistence.md).
      derive: (row) => row.userId || label(MSG.ERROR_LOG_ANONYMOUS),
    },
    {
      /*
        <b>아이디 옆에 이름을 둔다</b>(2026-09-01) — 서버가 `SYS_USER` 를 조인해 준다.
        <b>빈칸을 채우지 않는다</b>: 왼쪽 칸이 이미 `(익명)` 이라고 말하므로 여기 또 적으면
        같은 사실이 한 행에 두 번 나온다(사용 이력과 같은 규칙이다).
      */
      field: 'userNm',
      header: MSG.ERROR_LOG_COL_USER_NM,
      type: 'text',
      width: 120,
    },
    {
      /*
        <b>요청 URI 앞에 선다</b>(2026-09-01). 기본 숨김이었고 맨 뒤에 있었는데(screen/log/error/requirements.md),
        <i>어느 화면에서 난 오류인가</i> 가 <b>URI 를 읽기 전에</b> 먼저 오는 물음이다 —
        사용 이력이 이 컬럼을 같은 자리에 <b>보이게</b> 둔 것과 이제 같다. URI 로
        화면을 알아내는 것은 개발자만 할 수 있는 일이고, 그 URI 는 <b>바로 옆에 그대로</b>
        있다.

        메뉴명으로 그리며 <b>비어 있을 수 있다</b> — 로그인·하트비트는 셸 진입 전이라
        현재 메뉴가 존재하지 않는다(screen/log/error/requirements.md).
      */
      field: 'menuNm',
      header: MSG.ERROR_LOG_COL_MENU,
      type: 'text',
      width: 140,
      // 붙이지 않으면 이 화면의 메뉴별 집계가 <b>감사 근거로 인용된다</b>(screen/log/error/requirements.md).
      headerTooltip: MSG.ERROR_LOG_MENU_CLIENT_CLAIM,
      // 이름이 없으면 코드라도 낸다 — `SYS_MENU` 에서 지워진 메뉴의 이력이 그렇다.
      derive: (row) => row.menuNm ?? row.menuCd ?? label(MSG.ERROR_LOG_NO_MENU),
    },
    {
      /*
        <b>더블 클릭이 `API_CATALOG` 로 건너뛴다</b> — screen/log/error/requirements.md. 링크로 그리지 않는 이유는
        사용 이력과 같다: 이 칸의 값은 눈으로 확인하고 복사하는 대상이기도 한데, 링크면
        한 번 누르기만 해도 다른 탭이 열린다.
      */
      field: 'requestUri',
      header: MSG.ERROR_LOG_COL_REQUEST_URI,
      type: 'text',
      width: 260,
      onDoubleClick: openApiCatalog,
    },
    {
      /*
        <b>파생 컬럼이다</b> — 셀에 그려지는 것은 `[보기]` 이고 원본 값은 <b>스택 유무</b>다
        (screen/log/error/requirements.md). 사용 이력이 `hasParameters` 를 그대로 쓴 것과 같은 모양인데, 여기는
        모달에 탭이 둘이라 <b>둘 중 하나만</b>이 값이 된다: 전문은 다른 테이블에 있어
        목록이 알지 못한다.

        그래서 <b>링크는 언제나 켜져 있다</b>. 스택이 없어도 전문 탭이 열릴 수 있고,
        둘 다 비어도 <b>왜 비었는지</b> 를 모달이 말해야 한다 — 링크를 끄면 그 말을 할
        자리가 사라진다.

        <b>필터를 끈다</b> — 셀에 보이는 글자와 값이 다르다.
      */
      field: 'hasStack',
      header: MSG.ERROR_LOG_COL_DETAIL,
      type: 'text',
      width: 80,
      renderer: 'link',
      filter: false,
      display: () => label(MSG.ERROR_LOG_DETAIL_LINK),
      onClick: openDetail,
    },
    {
      /*
        값 자체가 문의의 열쇠다 — <b>셋 중 이 화면에서 가장 그렇다</b>. frontend/packages.md 가 5xx
        토스트에 이 값을 띄우고 사용자가 복사해 온다(screen/log/error/requirements.md).
      */
      field: 'traceId',
      header: MSG.ERROR_LOG_COL_TRACE_ID,
      type: 'text',
      width: 280,
    },

    {
      field: 'clientIp',
      header: MSG.ERROR_LOG_COL_CLIENT_IP,
      type: 'text',
      width: 130,
      visible: false,
    },
    {
      /*
        tie-breaker 이며 <b>기본 숨김</b>이다(screen/log/error/requirements.md) — `⚙` 에서 켜면 보인다.
        `hidden` 이 아닌 것은 <b>운영자가 켜서 보면 안 되는 컬럼이 이력에는 없기</b> 때문이다.
      */
      field: 'exceptionLogSeq',
      header: MSG.ERROR_LOG_COL_SEQ,
      type: 'number',
      width: 100,
      visible: false,
    },
  ];
}

// ── 조회조건 (screen/log/error/requirements.md) ────────────────────────────────────────────

/**
 * <b>기간이 필수이고 상한이 있다</b>(screen/log/error/requirements.md).
 *
 * <p>연산자를 <b>완전 일치로 좁힌 칸이 셋</b>이다(상태 · 오류 코드 · 추적 ID). 근거는 사용
 * 이력과 같다 — <b>인덱스가 둘뿐</b>이다(`CRE_DTM` · `TRACE_ID`).
 *
 * <p><b>사람과 메뉴 칸 넷은 그 예외다</b>(2026-09-01 — {@link TEXT_OPS}). 오류 코드를 열지
 * 않는 것과 갈리는 자리다: 그것은 <b>문자열 상수</b>라 조각으로 기억할 것이 없고 앞 일치를
 * 열면 `err.` 하나로 전건이 나오지만, 사람 이름과 화면 이름은 <b>조각으로 기억된다</b>.
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      // 비우고 조회할 수 없다 — 서버도 같은 것을 다시 본다(screen/log/error/requirements.md).
      field: 'creDtm',
      label: MSG.ERROR_LOG_SEARCH_PERIOD,
      type: 'dateRange',
      required: true,
      // `rangeDays` 를 두지 않는다 — 이 화면은 시스템 값(7 · 92)을 덮지 않는다(screen/log/error/requirements.md).
    },
    {
      /*
        <b>파생 조건이며 셋째 사례다</b>(사용 이력의 `outcome` · 로그인 이력의 `rsltGroup`
        다음). `HTTP_STAT` 을 범위로 열지 않는 이유가 이 조건의 전부다 — `400~499` 를
        사람이 입력하게 하면 <b>경계를 틀린다</b>. 묶음 둘이면 틀릴 자리가 없다(screen/log/error/requirements.md).

        <b>기본이 전체다.</b> *5xx 만* 이 가장 흔한 조회지만 기본으로 두면 403 을 진단하러
        온 사람이 빈 화면을 먼저 본다.
      */
      field: 'statusGroup',
      label: MSG.ERROR_LOG_SEARCH_STATUS,
      type: 'select',
      ops: ['eq'],
      options: [
        { value: GROUP_SERVER, text: label(MSG.ERROR_LOG_STATUS_SERVER) },
        { value: GROUP_CLIENT, text: label(MSG.ERROR_LOG_STATUS_CLIENT) },
      ],
    },
    {
      /*
        <b>완전 일치다</b> — 값이 문자열 상수라 흔들리지 않고(backend/packages.md), <b>목록에서 셀을
        복사해 넣는 동선</b>이다(screen/log/error/requirements.md). 앞 일치를 열면 `err.` 하나로 전건이 나온다.
      */
      field: 'errCd',
      label: MSG.ERROR_LOG_SEARCH_ERR_CD,
      type: 'text',
      ops: ['eq'],
    },
    /*
      <b>사람 칸 둘 · 메뉴 칸 둘</b>이며 넷 다 같은 연산자 넷을 받는다(2026-09-01 —
      {@link TEXT_OPS}). 기본 연산자가 갈리는 것도 사용 이력과 같다: 아이디·코드는
      <b>목록에서 셀을 복사해 오는 값</b>이라 `같음` 이고, 이름은 <b>사람이 기억하는
      조각</b>이라 `포함` 이다.
    */
    { field: 'userId', label: MSG.ERROR_LOG_SEARCH_USER_ID, type: 'text', op: 'eq', ops: TEXT_OPS },
    { field: 'userNm', label: MSG.ERROR_LOG_SEARCH_USER_NM, type: 'text', ops: TEXT_OPS },
    {
      /*
        <b>§5.4 가 요구한 칸이다</b> — *문의 전화* 로 들어오는 사람이 들고 오는 것이
        <i>시각 + 화면 이름</i> 이고, 그 둘을 받는 자리가 `일시` 와 <b>아래 이름 칸</b>이다.
        이 칸은 <b>코드를 아는 사람</b>(대개 개발자)의 것이다.

        `메뉴 없음` 항목이 사라진 것은 사용 이력과 같다(2026-09-01) — 텍스트 칸에는 `null`
        을 담을 자리가 없고, 그 물음은 메뉴 컬럼의 필터가 답한다(frontend/grid.md).
      */
      field: 'menuCd',
      label: MSG.ERROR_LOG_SEARCH_MENU_CD,
      type: 'text',
      op: 'eq',
      ops: TEXT_OPS,
    },
    {
      /*
        <b>문의 전화가 주는 그 이름을 그대로 받는 칸</b>이다 — *"사용 이력 화면에서요"* 는
        코드가 아니라 이름이다. 이름은 `SYS_MENU` → `SYS_MESSAGE` 두 테이블 건너에 있어
        서버가 `EXISTS` 로 풀고(`LogMenuName`), <b>어느 언어든 걸린다</b>(screen/admin/system/code/requirements.md).
      */
      field: 'menuNm',
      label: MSG.ERROR_LOG_SEARCH_MENU_NM,
      type: 'text',
      ops: TEXT_OPS,
    },
    {
      // 앞 일치만 연다 — 인덱스가 없는 컬럼에 앞뒤 와일드카드가 붙으면 전체 스캔이 된다.
      field: 'requestUri',
      label: MSG.ERROR_LOG_SEARCH_REQUEST_URI,
      type: 'text',
      ops: ['startsWith'],
    },
    {
      /*
        <b>넣으면 기간이 선택이 된다</b>(screen/log/error/requirements.md) — 이 화면에서 그것은 예외가 아니라
        <b>주된 동선</b>이다. 판정은 서버가 한다: 폼은 아직 그 규칙을 알지 못한다.
      */
      field: 'traceId',
      label: MSG.ERROR_LOG_SEARCH_TRACE_ID,
      type: 'text',
      ops: ['eq'],
    },
  ];
}

// ── 0건 문구 (screen/log/error/requirements.md) ────────────────────────────────────────────

/**
 * 0건에 무엇이라 말할까 — <b>물은 것에 따라 다르다</b>.
 *
 * <p><b>추적 ID 가 가장 먼저다.</b> 그것으로 물은 0건은 유실이 아니라 <i>"그 요청은 오류가
 * 아니었다"</i> 이며(§1.4 이후 모든 요청은 사용 이력에 있다), 그 문구가 사용자를
 * <b>사용 이력으로 보낸다</b>. 이 말이 없으면 `traceId` 를 들고 온 사람이 <b>로그 유실로
 * 읽는다</b>(screen/log/error/requirements.md).
 *
 * <p>`5xx 만` 과 겹치면 추적 ID 가 이긴다 — 둘 다 물었다면 찾고 있는 것은 <b>그 한 요청</b>
 * 이지 기간의 통계가 아니다.
 */
function emptyTextFor(conditions: SearchCondition[]): string {
  if (conditions.some((condition) => condition.field === 'traceId')) {
    return MSG.ERROR_LOG_EMPTY_TRACE;
  }
  if (
    conditions.some(
      (condition) => condition.field === 'statusGroup' && condition.value === GROUP_SERVER,
    )
  ) {
    return MSG.ERROR_LOG_EMPTY_SERVER;
  }
  return MSG.ERROR_LOG_EMPTY;
}
