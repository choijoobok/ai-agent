import { useCallback, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { ColumnDef } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField, SearchOp } from '@/shared/searchform/types';
import { useShellNavigation } from '@/layouts/ShellLayout/useShellNavigation';
import { handOff } from '@/shared/routes/handoffStore';
import { hasPermission } from '@/shared/authz/permission';
import { useAuthStore } from '@/shared/stores/authStore';
import { ACCESS_LOG_ENDPOINTS } from '@/features/accesslog/api/endpoints';
import { PayloadModal } from '@/features/accesslog/components/PayloadModal';
import type { AccessLogRow } from '@/features/accesslog/types';

/**
 * `ACCESS_LOG` — 64 §3. <b>일어난 요청 전부</b>를 보여준다.
 *
 * <p>이름이 *사용 이력* 이지만 <b>성공한 요청 목록이 아니다</b>(64 §3.2.2). 2xx 도 4xx 도
 * 5xx 도 한 행이며, ADR-0010 이 감사 이력을 요청 전문 로깅으로 <b>대체</b>한 것이 그
 * 근거다 — *"이 사용자가 무엇을 했나"* 에 실패한 시도가 빠지면 감사가 되지 않는다.
 *
 * <h2>쓰기 경로가 아예 없다</h2>
 *
 * <p>`api.save` 도 `addRow` 도 `editable` 도 선언하지 않는다(64 §2.1) — 감춘 것이 아니라
 * <b>선언이 없어서</b> 저장·행 추가·상태 컬럼·삭제 컬럼이 나오지 않는다(grid-standard.md §3.5 · grid-api-contract.md §3.1).
 * 지우는 것은 파기 배치의 일이며(32 §4) 화면에 수단을 두면 <b>파기의 원본이 둘</b>이 된다.
 *
 * <h2>제약 셋이 전부 이 화면 때문에 생겼다</h2>
 *
 * <table><caption></caption>
 * <tr><td>총 건수를 세지 않는다</td><td>`COUNT` 가 처음으로 비싸다 — 푸터가
 *     `‹ 이전 · 다음 ›` 이 되고 정렬이 <b>일시 하나</b>로 좁아진다(64 §2.3)</td></tr>
 * <tr><td>기간이 필수다</td><td>비우면 첫 조회가 <b>90일 전량</b>을 향한다. 상한도
 *     31일이다 — 행마다 `nclob` 이 달려 있고 보존이 90일로 가장 짧다(64 §2.2)</td></tr>
 * <tr><td>전문을 목록에 싣지 않는다</td><td>100행 × 1MB. 셀은 값이 아니라 `[보기]` 이며
 *     누르면 그 한 행만 가져온다(64 §2.4)</td></tr>
 * </table>
 *
 * <h2>자기 참조가 생긴다</h2>
 *
 * <p>여기서 조회하면 그 조회가 `SYS_LO_ACCESS` 에 남고 <b>다음 조회에서 자기 행이 맨 위에</b>
 * 보인다. 고장이 아니다 — `메뉴` 를 `사용 이력` 으로 걸러 보면 *누가 이력을 얼마나
 * 열람했는가* 가 나오며, 감사 이력을 두지 않기로 한 이 템플릿에서 <b>열람 감사에 가장
 * 가까운 것</b>이 그 한 줄이다(64 §2.6).
 */

const MENU_CD = 'ACCESS_LOG';

/**
 * 이 화면의 조회 기간 — <b>시스템 값(7 · 92)을 덮는다</b>(64 §2.2 · §3.3).
 *
 * <p>세 이력 테이블 중 유일하게 행마다 `nclob` 이 달려 있고 보존이 90일로 가장 짧다 —
 * *"가장 큰 테이블에 가장 짧은 창"* 이 맞다. <b>서버도 같은 값을 갖는다</b>
 * (`AccessLogQueryService.MAX_RANGE_DAYS`): 화면만 막으면 도구·스크립트가 그대로 지나간다.
 */
const RANGE_DAYS = { default: 1, max: 31 };

/**
 * 쪽수 — <b>로그는 100</b>이다(grid-standard.md §2.3).
 *
 * <p>첫 조회의 크기와 콤보의 첫 후보가 같아야 한다 — 다르면 콤보에 없는 값이 골라진 채로
 * 화면이 뜬다.
 */
const PAGE_SIZE = 100;
const PAGE_SIZES = [100, 500, 1000];

/**
 * 사람·메뉴 칸 넷이 함께 쓰는 연산자 후보 — <b>같음 · 시작 · 포함 · 끝</b>(2026-09-01).
 *
 * <p>목록에 나오는 <b>순서는 폼이 정한다</b>(search-form-contract.md §3.4 — `OP_ORDER`). 여기 적는 것은
 * <i>무엇을 열었나</i> 뿐이며, 칸마다 따로 적으면 <b>한 칸만 빠뜨렸을 때 조용하다</b>.
 *
 * <p>`같지 않음`·`있음/없음` 을 열지 않는다. 이력에서 <i>"이 사람이 아닌 것"</i> 을 묻는
 * 동선이 없고(찾는 것은 언제나 <b>특정한 누구</b>다), `없음` 은 미인증 요청을 고르는
 * 조건이 되는데 그것은 <b>상태 조건이 이미 다른 축으로</b> 답한다.
 */
const TEXT_OPS: SearchOp[] = ['eq', 'startsWith', 'contains', 'endsWith'];


/** 넘겨주기의 도착지 — 64 §5.4. `ERROR_LOG` 도 같은 곳으로 간다. */
const API_CATALOG_CD = 'API_CATALOG';

export function AccessLogPage() {
  const searchForm = useRef<SearchFormHandle>(null);
  const permissions = useAuthStore((state) => state.permissions);
  const shell = useShellNavigation();
  /** 전문 모달이 열린 행 — `null` 이면 닫혀 있다(64 §2.4). */
  const [payloadOf, setPayloadOf] = useState<number | null>(null);

  const header = useSearchFormHeader();

  /*
    폼이 준 조건을 <b>손보지 않는다</b>(2026-09-01). 메뉴 칸이 콤보였을 때는 `메뉴 없음`
    보초값을 `null` 로 바꾸는 자리가 여기였는데, 텍스트 칸 둘(코드 · 이름)로 갈리면서
    <b>화면이 조건을 다시 만질 이유가 사라졌다</b>.
  */
  const collectConditions = useCallback(() => {
    // 검증 실패면 조회 자체가 일어나지 않는다 — 오류 표시는 폼의 몫이다(grid-api-contract.md §5).
    return Promise.resolve(searchForm.current?.collect() ?? null);
  }, []);

  /**
   * `요청 URI` 셀 더블 클릭 → <b>`API_CATALOG` 를 그 URL 로 조회한 상태로 연다</b>(64 §5.4).
   *
   * <p>403 의 세 갈래를 잇는 동선의 <b>첫 칸</b>이다 — 여기서 URL 을 넘기면 그 화면이
   * *등록됐나 · 어느 메뉴에 매핑됐나* 를 답하고, 거기 하단이 다시 `MENU_TREE` 로 넘긴다
   * (62 §5.5). 세 화면이 한 동선이다.
   *
   * <p><b>볼 권한이 없으면 열지 않는다</b>(main-shell.md §6). 열어 놓고 403 을 보여주는 것보다 아무 일도
   * 일어나지 않는 편이 낫다 — 더블 클릭은 눌러야만 알 수 있는 제스처라 실패가 더 혼란스럽다.
   * `ApiCatalogPage` 가 메뉴 트리로 넘길 때 한 판단과 같다.
   */
  const openApiCatalog = useCallback(
    (row: AccessLogRow) => {
      const node = shell.index.byCode.get(API_CATALOG_CD);
      if (!node || !hasPermission(permissions, API_CATALOG_CD, 'READ')) {
        return;
      }
      handOff(API_CATALOG_CD, row.requestUri);
      shell.openMenu(node);
    },
    [permissions, shell],
  );

  const columns = useMemo(() => buildColumns(setPayloadOf, openApiCatalog), [openApiCatalog]);

  // 선언이지 값이 아니다 — 매 렌더 새 객체를 만들면 컨트롤러의 콜백이 전부 새것이 된다.
  const api = useMemo(
    () => ({
      /*
        `save` 가 없다 — 저장 버튼이 나오지 않는다(grid-api-contract.md §3.1). 감춘 것이 아니라 선언이 없다.

        `emptyNotice` 를 켠다 — 마스터 그리드이므로 0건을 모달로도 알린다(grid-api-contract.md §5).
      */
      read: { url: ACCESS_LOG_ENDPOINTS.getList, emptyNotice: true },
    }),
    [],
  );

  const grid = useGridController<AccessLogRow>({
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
        // 조건과 컬럼 필터를 함께 지운다 — grid-standard.md §2.4.
        onReset={grid.clearFilters}
        onActiveCountChange={header.onActiveCountChange}
        collapsed={header.collapsed}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          title={MSG.ACCESS_LOG_GRID_TITLE}
          menuCd={MENU_CD}
          controller={grid}
          pageSizes={PAGE_SIZES}
          /*
            총 건수를 잃은 자리를 메운다 — 64 §2.3 의 푸터 왼쪽이 `N건 조회됨 · 최근 {기간}`
            이다. 무엇을 물어서 나온 N건인지가 함께 있어야 <i>"전부가 N건"</i> 으로 읽히지
            않는다.
          */
          footerNote={label(MSG.ACCESS_LOG_FOOTER_RANGE, { days: RANGE_DAYS.max })}
          /*
            보존 기간을 문구가 말한다 — 64 §3.7. <b>0건에는 언제나 이유가 있고 화면이 아는
            이유는 화면이 말한다</b>: 90일보다 오래된 기간을 물으면 조건이 좁은 것이 아니라
            <b>거기 데이터가 없는 것</b>이다.
          */
          emptyText={MSG.ACCESS_LOG_EMPTY}
        />
      </div>

      <PayloadModal accessLogSeq={payloadOf} onClose={() => setPayloadOf(null)} />
    </FillColumn>
  );
}

// ── 컬럼 (64 §3.2) ────────────────────────────────────────────────

/**
 * <b>편집 선언이 한 줄도 없다</b>(64 §2.1) — 그래서 상태 컬럼도 삭제 컬럼도 붙지 않는다.
 *
 * <p><b>정렬은 일시 하나만</b> 열린다(64 §2.3). 나머지는 인덱스가 없어 전체 정렬이 되고,
 * 무엇보다 <b>커서의 기준점이 흔들린다</b> — 끄는 것이 기능을 뺀 것으로 읽히면 안 되며,
 * *"사용자별로 모아 보고 싶다"* 는 <b>조회조건</b>이 답한다.
 */
function buildColumns(
  openPayload: (seq: number) => void,
  openApiCatalog: (row: AccessLogRow) => void,
): ColumnDef<AccessLogRow>[] {
  return [
    {
      field: 'creDtm',
      header: MSG.ACCESS_LOG_COL_CRE_DTM,
      type: 'dateTime',
      width: 170,
      pinned: 'left',
      // 유일하게 열린 정렬이다 — 커서의 기준점이므로 여기가 곧 페이지 경계다(64 §2.3).
      sortable: true,
    },
    {
      /*
        <b>전 요청을 받으므로 필요하다</b>(64 §3.2.2). 없으면 성공과 실패가 섞인다.

        배지는 색 둘이다 — `2xx` 는 칠하지 않고 `4xx` 는 주의색 · `5xx` 는 오류색이다.
        <b>정상이 압도적인 목록에서는 칠하지 않는 것이 기본</b>이고 칠한 것만 눈에 남는다
        (grid-standard.md §8.1 의 *편집 가능은 칠하지 않는다* 와 같은 규칙).
      */
      field: 'httpStat',
      header: MSG.ACCESS_LOG_COL_HTTP_STAT,
      type: 'number',
      width: 90,
      renderer: 'badge',
      /*
        <b>맵이 아니라 범위다</b>(grid-column-contract.md §5.4.1 의 축 둘). 200·201·204·400·403·404·409·500 …
        을 전부 적으면 <b>처음 보는 상태 코드가 조용히 색을 잃는다</b>.
      */
      tone: [
        { max: 399, tone: 'none' },
        { max: 499, tone: 'warn' },
        { max: 599, tone: 'err' },
      ],
    },
    {
      field: 'userId',
      header: MSG.ACCESS_LOG_COL_USER_ID,
      type: 'text',
      width: 120,
      /*
        빈칸으로 두지 않는다 — <b>*수집이 안 된 것*과 구분되지 않는다</b>(64 §2.7).
        미인증 요청은 `USER_ID` 가 `NULL` 이며 그것은 정상이다.
      */
      // `||` 다 — 오라클이 빈 문자열을 `NULL` 로 저장하므로 둘은 같은 값이다(db-portability.md §4.5).
      derive: (row) => row.userId || label(MSG.ACCESS_LOG_ANONYMOUS),
    },
    {
      /*
        <b>아이디 옆에 이름을 둔다</b>(2026-09-01) — 서버가 `SYS_USER` 를 조인해 준다.

        <b>빈칸을 채우지 않는다.</b> 바로 왼쪽 칸이 이미 `(익명)` 이라고 말하고 있어서
        여기 또 적으면 <b>같은 사실이 한 행에 두 번</b> 나온다 — 위 컬럼이 빈칸을 메우는
        규칙(64 §2.7)은 <i>그 칸이 유일한 신호일 때</i>의 것이다. 지워진 계정도 같은
        빈칸인데, 그것을 가려 말하는 화면은 로그인 이력이다(거기서는 없는 계정이
        <b>찾는 대상</b>이라 배지가 붙는다).
      */
      field: 'userNm',
      header: MSG.ACCESS_LOG_COL_USER_NM,
      type: 'text',
      width: 120,
    },
    {
      /*
        <b>메뉴명으로 그린다</b>(64 §3.2) — 코드는 사람이 읽는 이름이 아니다.
        비어 있을 수 있으며 그때는 `(메뉴 없음)` 이다: 로그인·하트비트는 셸 진입 전이라
        현재 메뉴가 존재하지 않는다(64 §3.2.1).
      */
      field: 'menuNm',
      header: MSG.ACCESS_LOG_COL_MENU,
      type: 'text',
      width: 140,
      /*
        <b>이 컬럼은 클라이언트 주장이다</b>(architecture.md §6.3 · security-design.md §4). 인가에 쓰이지 않으며
        통계·추적 외 용도로 신뢰하지 않는다 — 붙이지 않으면 이 화면의 메뉴별 집계가
        <b>감사 근거로 인용된다</b>(64 §3.2.1).
      */
      headerTooltip: MSG.ACCESS_LOG_MENU_CLIENT_CLAIM,
      // 이름이 없으면 코드라도 낸다 — `SYS_MENU` 에서 지워진 메뉴의 이력이 그렇다.
      derive: (row) => row.menuNm ?? row.menuCd ?? label(MSG.ACCESS_LOG_NO_MENU),
    },
    {
      /*
        <b>더블 클릭이 `API_CATALOG` 로 건너뛴다</b> — 64 §5.4.

        <b>링크로 그리지 않는다.</b> 이 칸의 값은 눈으로 확인하고 복사하는 대상이기도 한데,
        링크면 한 번 누르기만 해도 화면이 열려 <i>URL 을 읽으려던</i> 사람이 다른 탭에 가
        있게 된다. 전문 컬럼이 링크인 것과 갈리는 자리다 — 거기는 셀에 값이 없어서 누르는
        것 말고 할 일이 없다(§2.4).

        <b>행이 아니라 칸에 붙는다.</b> `ERROR_LOG` 가 같은 컬럼에 같은 제스처를 두는데
        (§5.4 의 <i>사용 이력에도 두나 → 둔다</i>) 그 화면은 <b>행 더블 클릭이 이미 상세
        모달</b>이다. 여기서 행으로 붙여 두면 그 화면이 서는 날 이 컬럼만 칸으로 옮겨야 하고,
        그 순간 <b>같은 컬럼이 화면마다 다르게 동작한다</b>.
      */
      field: 'requestUri',
      header: MSG.ACCESS_LOG_COL_REQUEST_URI,
      type: 'text',
      width: 260,
      onDoubleClick: openApiCatalog,
    },
    {
      /*
        <b>파생 컬럼이다</b> — 값은 참·거짓(전문이 있는가)이고 셀에 그려지는 것은 `[보기]`
        다(64 §2.4). 목록 응답에 전문이 없으므로 <b>미리보기를 두지 않는다</b>: 앞 N자만
        잘라 오는 것은 벤더 중립이 아니고(db-portability.md §4.5) 100행 × 1MB 는 실을 수 없다.

        <b>필터를 끈다</b> — 값이 화면에 없다. 정렬은 선언이 없어 애초에 닫혀 있다.
      */
      field: 'hasParameters',
      header: MSG.ACCESS_LOG_COL_PAYLOAD,
      type: 'text',
      width: 80,
      renderer: 'link',
      filter: false,
      display: (value) => (value === true ? label(MSG.ACCESS_LOG_PAYLOAD_LINK) : ''),
      onClick: (row) => openPayload(row.accessLogSeq),
    },
    { field: 'clientIp', header: MSG.ACCESS_LOG_COL_CLIENT_IP, type: 'text', width: 130 },
    {
      /*
        값 자체가 문의의 열쇠다 — frontend-stack.md §9 가 5xx 토스트에 `traceId` 를 띄우고 사용자가 그것을
        복사해 온다(64 §2.5). <b>화면 사이를 건너뛰는 버튼은 두지 않는다</b>: 복사는
        포커스된 셀의 `Ctrl+C` 가 이미 한다(grid-standard.md §4).
      */
      field: 'traceId',
      header: MSG.ACCESS_LOG_COL_TRACE_ID,
      type: 'text',
      width: 280,
    },
    {
      /*
        tie-breaker 이며 <b>기본 숨김</b>이다(64 §2.7) — `⚙` 에서 켜면 보인다.
        `hidden` 이 아닌 것은 <b>운영자가 켜서 보면 안 되는 컬럼이 이력에는 없기</b> 때문이다.
      */
      field: 'accessLogSeq',
      header: MSG.ACCESS_LOG_COL_SEQ,
      type: 'number',
      width: 100,
      visible: false,
    },
  ];
}

// ── 조회조건 (64 §3.3) ────────────────────────────────────────────

/**
 * <b>기간이 필수이고 상한이 있다</b>(64 §2.2).
 *
 * <p>연산자를 <b>완전 일치로 좁힌 칸이 셋</b>이다(상태 · IP · 추적 ID). 근거는 하나 —
 * <b>인덱스가 둘뿐</b>이다(64 §3.3): `CRE_DTM` 과 `TRACE_ID` 말고는 없다.
 *
 * <p><b>사람과 메뉴 칸 넷은 그 예외다</b>(2026-09-01 — {@link TEXT_OPS}). 이름을 완전
 * 일치로만 물을 수 있으면 조각을 든 사람이 답을 못 얻어 <b>기간을 넓혀 훑고</b>, 그것이
 * 부분 일치보다 비싸다 — 기간이 이미 창을 닫아 두었으므로(§2.2) 그 안에서는 열어도 된다.
 * IP 를 열지 않은 것과 갈리는 자리다: 대역 검색은 <b>결과만 넓어지는</b> 조건이지만
 * 부분 이름은 <b>다른 답</b>을 낸다.
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      field: 'creDtm',
      label: MSG.ACCESS_LOG_SEARCH_PERIOD,
      type: 'dateRange',
      // 비우고 조회할 수 없다 — 서버도 같은 것을 다시 본다(64 §2.2).
      required: true,
      rangeDays: RANGE_DAYS,
    },
    {
      /*
        <b>파생 조건이다</b> — `HTTP_STAT` 을 그대로 열지 않는다(64 §3.3). 운영자가 묻는 것은
        *"실패한 요청"* 이지 *"403 인 요청"* 이 아니고, 후자는 <b>컬럼 필터가 이 페이지
        안에서</b> 답한다(grid-column-contract.md §4.1).

        기본이 *전체* 다 — 이 화면은 일어난 요청 전부를 내는 화면이다(64 §3.2.2).
      */
      field: 'outcome',
      label: MSG.ACCESS_LOG_SEARCH_OUTCOME,
      type: 'select',
      ops: ['eq'],
      options: [
        { value: 'SUCCESS', text: label(MSG.ACCESS_LOG_OUTCOME_SUCCESS) },
        { value: 'FAILURE', text: label(MSG.ACCESS_LOG_OUTCOME_FAILURE) },
      ],
    },
    /*
      <b>사람 칸 둘 · 메뉴 칸 둘</b>이며 넷 다 같은 연산자 넷을 받는다(2026-09-01).

      <b>연산자를 넷으로 연 것이 기간 필수의 대가를 쓰는 자리다.</b> 완전 일치만 열어 두면
      조각을 든 사람이 <b>기간을 넓혀 훑는데</b>(그것이 이 화면에서 가장 비싼 조회다),
      기간이 이미 창을 닫아 두었으므로(§2.2) 그 창 안에서의 부분 일치는 감당할 수 있다.

      <b>기본 연산자가 갈린다.</b> 아이디·코드는 `같음` 이고 이름은 `포함` 이다 — 앞 둘은
      <b>목록에서 셀을 복사해 오는 값</b>이고 뒤 둘은 <b>사람이 기억하는 조각</b>이다.
    */
    { field: 'userId', label: MSG.ACCESS_LOG_SEARCH_USER_ID, type: 'text', op: 'eq', ops: TEXT_OPS },
    { field: 'userNm', label: MSG.ACCESS_LOG_SEARCH_USER_NM, type: 'text', ops: TEXT_OPS },
    {
      /*
        <b>후보에 메뉴 목록이 없다.</b> 셸이 들고 있는 것은 <i>내 트리</i> 인데, 이력에는
        지금 권한이 없는 메뉴의 행도 남는다 — 그것으로 후보를 만들면 <b>고를 수 없는 메뉴의
        이력</b>이 생긴다. 그래서 콤보가 아니라 <b>코드를 직접 치는 칸</b>이다.

        <b>`메뉴 없음` 항목이 사라졌다</b>(2026-09-01). 콤보였을 때는 `in` 배열의 `null` 이
        `IS NULL` 로 펴졌는데(64 §3.2.1) 텍스트 칸에는 그것을 담을 자리가 없다 — 그 물음은
        이제 <b>메뉴 컬럼의 필터</b>가 답한다(grid-column-contract.md §4.1).
      */
      field: 'menuCd',
      label: MSG.ACCESS_LOG_SEARCH_MENU_CD,
      type: 'text',
      op: 'eq',
      ops: TEXT_OPS,
    },
    {
      /*
        <b>이름은 두 테이블 건너에 있다</b> — `SYS_MENU.MENU_NM` 이 담은 것은 메시지 키이고
        이름은 `SYS_MESSAGE` 의 값이라(43 §3) 서버가 `EXISTS` 로 푼다(`LogMenuName`).
        <b>어느 언어든 걸린다</b> — 사람은 화면에 보이는 그 이름을 들고 온다(63 §3.7).
      */
      field: 'menuNm',
      label: MSG.ACCESS_LOG_SEARCH_MENU_NM,
      type: 'text',
      ops: TEXT_OPS,
    },
    {
      /*
        <b>앞 일치만</b> 연다 — URI 는 `/api/service/…` 로 시작해 접두가 거의 같은데,
        부분 일치를 열면 인덱스도 없는 컬럼에 앞뒤 와일드카드가 붙어 전체 스캔이 된다.
      */
      field: 'requestUri',
      label: MSG.ACCESS_LOG_SEARCH_REQUEST_URI,
      type: 'text',
      ops: ['startsWith'],
    },
    { field: 'clientIp', label: MSG.ACCESS_LOG_SEARCH_CLIENT_IP, type: 'text', ops: ['eq'] },
    {
      /*
        <b>넣으면 기간이 선택이 된다</b>(64 §2.2) — `TRACE_ID` 에 별도 인덱스가 있어 기간
        없이도 인덱스를 탄다. 판정은 서버가 한다: 조건 하나가 다른 조건의 필수 여부를
        바꾸는 첫 사례이며, 폼은 아직 그 규칙을 알지 못한다.
      */
      field: 'traceId',
      label: MSG.ACCESS_LOG_SEARCH_TRACE_ID,
      type: 'text',
      ops: ['eq'],
    },
  ];
}


