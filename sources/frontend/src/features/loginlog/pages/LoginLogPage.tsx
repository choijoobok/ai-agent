import { useCallback, useMemo, useRef, useState } from 'react';
import { FillColumn } from '@/shared/components/FillColumn';
import { label } from '@/shared/i18n/label';
import { codeLabel } from '@/shared/i18n/codeLabel';
import { MSG } from '@/shared/i18n/messageKeys';
import { DataGrid } from '@/shared/grid/DataGrid';
import { useGridController } from '@/shared/grid/useGridController';
import type { ColumnDef, SearchCondition, Tone } from '@/shared/grid/types';
import { SearchForm, type SearchFormHandle } from '@/shared/searchform/SearchForm';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import type { SearchField, SearchOp } from '@/shared/searchform/types';
import { useAuthStore } from '@/shared/stores/authStore';
import { LOGIN_LOG_ENDPOINTS } from '@/features/loginlog/api/endpoints';
import type { LoginLogRow } from '@/features/loginlog/types';

/**
 * `LOGIN_LOG` — screen/log/access/requirements.md. 이름보다 <b>담는 것이 넓다</b>.
 *
 * <p>`SYS_LO_LOGIN` 은 로그아웃·강제 종료·밀려남까지 담으므로(sys/logs.md) 실제로는 **세션
 * 이력**이다. 이름을 바꾸지 않는 것은 **로그인 실패를 찾는 사람이 메뉴에서 그것을 찾기**
 * 때문이다 — 담는 것이 넓은 것보다 찾는 이름으로 있는 편이 낫다(screen/log/access/requirements.md 끝).
 *
 * <h2>이 화면이 이력 셋 중 가장 단순하다</h2>
 *
 * <table><caption></caption>
 * <tr><td>모달이 없다</td><td>`nclob` 컬럼이 <b>하나도 없는 유일한 화면</b>이다(screen/log/access/requirements.md) —
 *     목록이 곧 전부이고 `getDetail` 이 아예 없다</td></tr>
 * <tr><td>메뉴 컬럼이 없다</td><td>테이블에 없다(sys/logs.md). 로그인은 메뉴 문맥이 없으므로
 * (sys/menu.md) 담을 것이 <b>애초에 없었다</b></td></tr>
 * <tr><td>이름은 조인 하나로 온다</td><td>`SYS_USER` 를 **`leftJoin`** 한다 — 두 번째
 *     쿼리가 없다(메뉴명이 그런 것과 갈리는 자리다: 이름이 컬럼 그대로라 번역이 없다)</td></tr>
 * </table>
 *
 * <h2>없는 계정의 시도가 여기 있다</h2>
 *
 * <p>sys/logs.md 가 FK 를 걸지 않은 이유가 *"존재하지 않는 주체의 기록도 남아야 한다"* 였고
 * **이 화면이 그 대표 사례**다.
 *
 * <p><b>그래서 이름 칸의 빈칸이 문제였다</b>(screen/log/access/requirements.md — 조인하면 없는 ID 행에서 이름이 비고
 * 그 빈칸이 *"조회가 덜 됐다"* 로 읽힌다). **2026-09-01 에 그 답을 바꿨다**: 이름을 안
 * 붙이는 것이 아니라 **빈칸에 `없는 계정` 배지를 그린다** — 글자와 색을 결과 컬럼의
 * `FAIL_NO_USER` 와 **같은 공통코드 행**에서 가져오므로 한 행의 두 칸이 같은 말을 한다.
 * 헤더도 이력 셋과 같은 `사용자 아이디`·`사용자명` 이 됐다: *시도 ID* 라는 이름으로
 * 걱정을 표현하는 것보다 **칸이 스스로 말하는 편**이 낫다.
 *
 * <p><b>침입 시도 탐지가 두 번째 용도다.</b> 없는 ID 로의 연속 시도가 그 근거인데
 * `FAIL_NO_USER` 로 걸러 IP 별로 보는 것이 그 조회이며, 그래서 IP 가 **완전 일치**다 —
 * 실패 행에서 IP 를 복사해 그 IP 로 다시 조회한다(screen/log/access/requirements.md).
 */

const MENU_CD = 'LOGIN_LOG';

/**
 * 쪽수 — <b>로그는 100</b>이다(frontend/grid.md). 첫 조회의 크기와 콤보의 첫 후보가 같아야 한다.
 */
const PAGE_SIZE = 100;
const PAGE_SIZES = [100, 500, 1000];

/**
 * 사람 칸 둘이 함께 쓰는 연산자 후보 — <b>같음 · 시작 · 포함 · 끝</b>(2026-09-01).
 *
 * <p>이력 셋이 <b>같은 넷</b>을 쓴다. IP 와 추적 ID 를 완전 일치로 남겨 둔 것과 갈리는
 * 자리이며(§4.6), 근거는 <b>부분 이름이 다른 답을 낸다</b>는 것 하나다 — 대역 검색은
 * 결과만 넓어지지만 `admin` 으로 <b>끝나는</b> 아이디로의 시도는 그 자체가 물음이다.
 */
const TEXT_OPS: SearchOp[] = ['eq', 'startsWith', 'contains', 'endsWith'];

/** 결과 코드의 공통코드 그룹 — sys/logs.md · sys/code.md. 이름도 콤보 후보도 여기서 온다. */
const RESULT_GRP_CD = 'LOGIN_RSLT_CD';

/**
 * 없는 계정 — <b>글자와 색이 결과 컬럼의 그 코드에서 온다</b>(2026-09-01).
 *
 * <p>사용자명 칸의 배지가 이 코드의 공통코드 이름(`없는 계정`)을 그대로 쓴다. 문구를
 * 따로 두지 않는 이유가 하나다 — <b>한 행의 두 칸이 같은 사실을 두 글자로 말하면 사람이
 * 둘을 다른 사실로 읽는다</b>. 이름을 관리 화면에서 고치면 <b>두 칸이 함께</b> 바뀐다.
 */
const NO_USER = 'FAIL_NO_USER';

/**
 * <b>색은 셋이고 글자는 열다섯이다</b> — screen/log/access/requirements.md.
 *
 * <p>14색을 쓰지 않는다: 운영자가 색 열다섯을 외우지 않는다. 배지 안의 라벨은 코드마다
 * 다르므로(sys/code.md — 공통코드의 이름) <b>구분은 잃지 않고 훑기만 빨라진다</b>. screen/user/requirements.md 이
 * 계정 상태 넷을 파생 컬럼 하나로 접은 것과 같은 방향·다른 수단이다 — 거기는 값을 접었고
 * 여기는 <b>색만</b> 접는다.
 *
 * <p><b>종료 넷이 회색인 것이 의도다.</b> 만료도 밀려남도 사용자에게는 *"갑자기
 * 로그아웃됨"* 이지만 시스템으로서는 정상 동작이며(backend/security.md), 빨강에 두면 문의를 받은
 * 운영자가 장애로 읽는다.
 *
 * <p>서버의 `LoginLogSpec` 이 같은 셋을 <b>조건</b>으로 갖는다. 두 곳에 있는 것은 축이
 * 같아서이며(§4.6 의 *결과 묶음* 이 §4.3 의 배지와 한 축이다) 여기 것은 <b>색</b>, 저기
 * 것은 <b>거르기</b>다.
 */
const FAILED = [
  NO_USER,
  'FAIL_PWD',
  'FAIL_DISABLED',
  'FAIL_EXPIRED',
  'FAIL_LOCKED',
  'FAIL_DORMANT',
  'FAIL_IP',
  'FAIL_NO_AUTHORITY',
  'FAIL_TEMP_EXPIRED',
  'FAIL_CONCURRENT',
];
const CLOSED = ['LOGOUT', 'SESSION_TIMEOUT', 'FORCED_LOGOUT', 'SESSION_EVICTED'];

const RESULT_TONE: Record<string, Tone> = {
  SUCCESS: 'ok',
  ...Object.fromEntries(FAILED.map((code) => [code, 'err'])),
  ...Object.fromEntries(CLOSED.map((code) => [code, 'muted'])),
};

/** 결과 묶음의 값 — 서버의 `rsltGroup` 파생 조건이 코드 집합으로 번역한다(screen/log/access/requirements.md). */
const GROUP_FAILED = 'FAILED';
const GROUP_CLOSED = 'CLOSED';

export function LoginLogPage() {
  const searchForm = useRef<SearchFormHandle>(null);
  /**
   * 조회 기간의 시스템 값 — 이 화면은 <b>덮지 않는다</b>(screen/log/access/requirements.md).
   *
   * <p>사용 이력이 1 · 31 로 좁힌 것과 갈리는 자리다. 저 테이블은 행마다 `nclob` 이
   * 달려 있고 보존이 90일이지만, 여기는 행이 가볍고 보존이 <b>1년</b>이다 — 상한 92일은
   * *보존보다 창이 짧은 유일한 화면* 을 만들지만(§4.6) 1년치가 필요하면 엑셀을 네 번 내린다.
   */
  const searchRange = useAuthStore((state) => state.searchRange);
  /**
   * 0건 문구가 <b>조건에 따라 갈린다</b> — screen/log/access/requirements.md.
   *
   * <p>*실패만* 으로 물어 0건이면 그것은 빈 결과가 아니라 <b>진단</b>이다. 같은 문구를
   * 쓰면 *"이 기간에 로그인 실패가 없다"* 라는 답이 *"조회 결과가 없다"* 로 읽힌다.
   */
  const [emptyText, setEmptyText] = useState<string>(MSG.LOGIN_LOG_EMPTY);

  const header = useSearchFormHeader();

  /*
    조회 직전에 <b>0건 문구를 정한다</b>. 조회가 끝난 뒤가 아니라 여기서 정하는 것은,
    응답이 0건인지 알았을 때는 이미 <i>무엇을 물었는지</i> 가 폼에만 남아 있기 때문이다 —
    그 사이 사용자가 조건을 고쳐 놓으면 문구가 <b>묻지 않은 것</b>을 말한다.
  */
  const collectConditions = useCallback(() => {
    const conditions = searchForm.current?.collect() ?? null;
    if (conditions !== null) {
      setEmptyText(failedOnly(conditions) ? MSG.LOGIN_LOG_EMPTY_FAILED : MSG.LOGIN_LOG_EMPTY);
    }
    // 검증 실패면 조회 자체가 일어나지 않는다 — 오류 표시는 폼의 몫이다(frontend/grid.md).
    return Promise.resolve(conditions);
  }, []);

  const columns = useMemo(() => buildColumns(), []);

  // 선언이지 값이 아니다 — 매 렌더 새 객체를 만들면 컨트롤러의 콜백이 전부 새것이 된다.
  const api = useMemo(
    () => ({
      // `save` 가 없다 — 저장 버튼이 나오지 않는다(frontend/grid.md). 감춘 것이 아니라 선언이 없다.
      read: { url: LOGIN_LOG_ENDPOINTS.getList, emptyNotice: true },
    }),
    [],
  );

  const grid = useGridController<LoginLogRow>({
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
          title={MSG.LOGIN_LOG_GRID_TITLE}
          menuCd={MENU_CD}
          controller={grid}
          pageSizes={PAGE_SIZES}
          /*
            총 건수를 잃은 자리를 메운다 — screen/log/access/requirements.md. 무엇을 물어서 나온 N건인지가 함께
            있어야 <i>"전부가 N건"</i> 으로 읽히지 않는다.
          */
          footerNote={label(MSG.LOGIN_LOG_FOOTER_RANGE, { days: searchRange.maxDays })}
          emptyText={emptyText}
        />
      </div>
    </FillColumn>
  );
}

// ── 컬럼 (screen/log/access/requirements.md) ────────────────────────────────────────────────

/**
 * <b>편집 선언이 한 줄도 없다</b>(screen/log/access/requirements.md) — 상태 컬럼도 삭제 컬럼도 붙지 않는다.
 *
 * <p><b>정렬은 일시 하나만</b> 열린다(screen/log/access/requirements.md). 커서의 기준점이 흔들리기 때문이며,
 * *"사용자별로 모아 보고 싶다"* 는 <b>조회조건</b>이 답한다.
 */
function buildColumns(): ColumnDef<LoginLogRow>[] {
  return [
    {
      field: 'creDtm',
      header: MSG.LOGIN_LOG_COL_CRE_DTM,
      type: 'dateTime',
      width: 170,
      pinned: 'left',
      // 유일하게 열린 정렬이다 — 커서의 기준점이므로 여기가 곧 페이지 경계다(screen/log/access/requirements.md).
      sortable: true,
    },
    {
      /*
        <b>헤더는 이력 셋과 같은 `사용자 아이디` 다</b>(2026-09-01). 값은 여전히 <b>시도한
        ID</b> 이며 `SYS_USER` 에 없는 값이 들어온다 — 그것이 이 화면의 두 번째 용도(침입
        시도 탐지)의 재료다(screen/log/access/requirements.md). 그 사실은 <b>헤더 툴팁과 옆 칸의 배지</b>가 말한다.
      */
      field: 'userId',
      header: MSG.LOGIN_LOG_COL_USER_ID,
      type: 'text',
      width: 140,
      headerTooltip: MSG.LOGIN_LOG_USER_ID_ATTEMPTED,
      /*
        빈칸으로 두지 않는다 — <b>*수집이 안 된 것*과 구분되지 않는다</b>(screen/log/access/requirements.md).

        `??` 가 아니라 `||` 인 것에 이유가 있다. <b>빈 문자열과 `null` 이 여기서 같은
        뜻</b>이며(둘 다 *ID 가 없다*), 무엇보다 <b>벤더가 둘을 구분하지 않는다</b> —
        오라클은 빈 문자열을 `NULL` 로 저장한다(backend/persistence.md). `??` 로 두면 <i>같은 행이
        PostgreSQL 에서는 빈칸, 오라클에서는 `(입력 없음)`</i> 이 된다.
      */
      derive: (row) => row.userId || label(MSG.LOGIN_LOG_NO_USER_ID),
    },
    {
      /*
        <b>없는 계정이면 배지다</b> — 2026-09-01.

        이 칸이 비는 것은 이 테이블에서 <b>예외가 아니라 흔한 일</b>이라(sys/logs.md) 빈칸으로
        두면 *"조회가 덜 됐다"* 로 읽힌다 — screen/log/access/requirements.md 가 <b>이름을 안 붙이는 근거</b>로 든
        그 빈칸이며, 여기서는 <b>빈칸을 없애는 쪽</b>으로 답한다.

        <b>`renderer: 'badge'` 가 아니라 `badge` 다</b>(frontend/grid.md · screen/code/requirements.md). 저것은 값
        <i>대신</i> 배지를 그리므로 <b>이름이 있는 행에서 이름이 사라진다</b>. 여기 배지는
        값이 없을 때만 붙는 <b>그 값의 내력</b>이다.

        <b>글자와 색이 결과 컬럼에서 온다</b>({@link NO_USER}) — `codeLabel` 이 같은
        공통코드 행을 읽고 색도 `RESULT_TONE` 의 그 코드와 같은 `err` 다. 문구를 따로 두면
        관리 화면에서 이름을 고쳤을 때 <b>한 행의 두 칸이 갈린다</b>.

        <b>아이디가 없는 행에는 붙이지 않는다.</b> 입력조차 없었으면 없는 계정이 아니라
        <i>계정을 말하지 않은 것</i>이고, 왼쪽 칸이 이미 `(입력 없음)` 이라고 말한다.
      */
      field: 'userNm',
      header: MSG.LOGIN_LOG_COL_USER_NM,
      type: 'text',
      width: 140,
      derive: (row) => row.userNm ?? '',
      badge: (row) =>
        row.userId && !row.userNm
          ? { text: codeLabel(RESULT_GRP_CD, NO_USER), tone: 'err' }
          : null,
    },
    {
      /*
        <b>공통코드다</b> — 후보도 이름도 `LOGIN_RSLT_CD` 에서 온다(sys/code.md).
        `grpCd` 만 적으면 판이 캐시에서 받아 셀의 글자와 `set` 필터의 항목을 함께 채운다.

        코드를 소스가 열거형으로 갖는데도(`LoginResultCode`) 이름을 공통코드에 두는 것은
        <b>값과 이름의 소유가 다르기</b> 때문이다 — 갈래는 소스가 정하고 글자는 데이터가
        정한다. 여기 `options` 를 상수로 적으면 언어를 늘릴 때 이 파일이 함께 는다.
      */
      field: 'loginRsltCd',
      header: MSG.LOGIN_LOG_COL_RESULT,
      type: 'code',
      grpCd: RESULT_GRP_CD,
      width: 150,
      renderer: 'badge',
      // 맵이다 — 값 집합이 닫혀 있다(열거형). 범위 축은 숫자 컬럼의 것이다(frontend/grid.md).
      tone: RESULT_TONE,
    },
    { field: 'clientIp', header: MSG.LOGIN_LOG_COL_CLIENT_IP, type: 'text', width: 130 },
    {
      /*
        값 자체가 문의의 열쇠다 — frontend/packages.md 가 5xx 토스트에 `traceId` 를 띄우고 사용자가
        그것을 복사해 온다(screen/log/access/requirements.md). 복사는 포커스된 셀의 `Ctrl+C` 가 이미 한다(frontend/grid.md).
      */
      field: 'traceId',
      header: MSG.LOGIN_LOG_COL_TRACE_ID,
      type: 'text',
      width: 280,
    },
    {
      /*
        <b>기본 숨김이다</b>(screen/log/access/requirements.md) — 한 줄이 200자를 넘어 켜는 순간 다른 컬럼이 전부
        밀린다. 기기를 확인해야 하는 사람만 `⚙` 에서 켠다(frontend/grid.md).

        <b>`[보기]` 를 쓰지 않는다.</b> `nclob` 이 아니라 `VARCHAR(500)` 이라 값이 이미
        목록에 실려 있다 — 눌러서 가져올 것이 없으므로 툴팁이 맞는 도구다(§2.4 의 반대).

        <b>파싱하지 않는다.</b> *Chrome 131 / Windows* 로 접어 보여주려면 UA 파싱
        라이브러리가 들어오고 그것은 매달 갱신되는 의존성이다(stack.md).
      */
      field: 'userAgent',
      header: MSG.LOGIN_LOG_COL_USER_AGENT,
      type: 'text',
      width: 320,
      visible: false,
      cellTooltip: true,
      fill: true,
    },
    {
      // tie-breaker 이며 기본 숨김이다(screen/log/access/requirements.md) — `⚙` 에서 켜면 보인다.
      field: 'loginLogSeq',
      header: MSG.LOGIN_LOG_COL_SEQ,
      type: 'number',
      width: 100,
      visible: false,
    },
  ];
}

// ── 조회조건 (screen/log/access/requirements.md) ────────────────────────────────────────────

/**
 * <b>*실패만 보기* 가 이 화면의 기본 동선이다</b>(screen/log/access/requirements.md).
 *
 * <p>기간은 필수이고 상한은 <b>시스템 값(92일)</b> 그대로다 — 화면 층으로 덮지 않는
 * 유일한 이력 화면이며, 행이 가벼워 좁힐 이유가 없다.
 *
 * <p>IP 와 추적 ID 가 <b>완전 일치</b>인 것은 인덱스가 `CRE_DTM` · `TRACE_ID` 둘뿐이기
 * 때문이다(sys/logs.md). 대역 검색(`LIKE '203.0.113.%'`)을 두지 않는 것도 같다 — 인덱스가 없어
 * 기간으로만 좁혀지므로 <b>완전 일치와 비용이 같은데 결과만 넓어진다</b>.
 *
 * <p><b>사람 칸 둘은 그 예외다</b>(2026-09-01 — {@link TEXT_OPS}). 아이디와 이름은 부분
 * 일치가 <b>다른 답</b>을 낸다: `admin` 으로 끝나는 아이디로의 시도를 모아 보는 것이
 * 침입 시도 탐지의 조회이고, 이름은 애초에 조각으로 기억된다.
 */
function buildSearchFields(): SearchField[] {
  return [
    {
      field: 'creDtm',
      label: MSG.LOGIN_LOG_SEARCH_PERIOD,
      type: 'dateRange',
      // 비우고 조회할 수 없다 — 서버도 같은 것을 다시 본다(screen/log/access/requirements.md).
      required: true,
    },
    /*
      <b>사람 칸이 둘</b>이다(2026-09-01 — {@link TEXT_OPS}). 아이디는 <b>목록에서 셀을
      복사해 오는 값</b>이라 기본이 `같음` 이고, 이름은 <b>사람이 기억하는 조각</b>이라
      `포함` 이다.

      <b>이름으로 물으면 없는 계정의 시도가 빠진다</b> — 그 행에는 이름이 없다. 그것이
      맞다: <i>"홍길동의 로그인 실패"</i> 를 묻는 사람이 찾는 것은 <b>그 사람의 행</b>이고,
      없는 계정의 시도는 아이디나 결과 코드로 찾는다(§4.6 의 첫 동선).
    */
    { field: 'userId', label: MSG.LOGIN_LOG_SEARCH_USER_ID, type: 'text', op: 'eq', ops: TEXT_OPS },
    { field: 'userNm', label: MSG.LOGIN_LOG_SEARCH_USER_NM, type: 'text', ops: TEXT_OPS },
    {
      /*
        <b>코드 다중 선택</b> — 후보를 공통코드에서 받는다(sys/code.md). 열다섯을 상수로 적으면
        코드를 더할 때 시드와 이 파일 <b>둘</b>을 고쳐야 한다.
      */
      field: 'loginRsltCd',
      label: MSG.LOGIN_LOG_SEARCH_RESULT,
      type: 'select',
      op: 'in',
      ops: ['in'],
      grpCd: RESULT_GRP_CD,
    },
    {
      /*
        <b>파생 조건이다</b> — 서버가 코드 집합으로 번역한다(screen/log/access/requirements.md). 배지의 색 셋과
        같은 축이며(§4.3), 코드 열다섯을 하나씩 고르게 하면 *"실패 전부"* 를 고르는 데 열
        번을 누른다.

        <b>위의 결과 콤보와 함께 채우면 교집합이다</b> — *실패만* + `FAIL_PWD` =
        `FAIL_PWD`. 하나로 합치지 않는 것은 묶음이 <b>훑기</b>이고 코드가 <b>좁히기</b>라,
        한 콤보에 15 + 2 를 섞으면 목록에서 무엇이 묶음인지 알 수 없기 때문이다.

        <b>*성공만* 이 없다.</b> 성공은 코드 하나라 접을 것이 없고 그 질문에는 위 콤보가
        한 번의 선택으로 이미 답한다 — 두면 같은 조회를 내는 길이 둘이 된다.

        `options` 를 상수로 적는 것이 여기서는 맞다(frontend/search-form.md). 값에 따라 <b>서버의 갈래가
        갈리므로</b> 소스가 값을 가져야 한다 — `grpCd` 로 열면 관리 화면에서 항목을 더할
        수 있는데 서버에는 그 묶음이 없다.
      */
      field: 'rsltGroup',
      label: MSG.LOGIN_LOG_SEARCH_RSLT_GROUP,
      type: 'select',
      ops: ['eq'],
      options: [
        { value: GROUP_FAILED, text: label(MSG.LOGIN_LOG_RSLT_GROUP_FAILED) },
        { value: GROUP_CLOSED, text: label(MSG.LOGIN_LOG_RSLT_GROUP_CLOSED) },
      ],
    },
    { field: 'clientIp', label: MSG.LOGIN_LOG_SEARCH_CLIENT_IP, type: 'text', ops: ['eq'] },
    {
      /*
        <b>넣으면 기간이 선택이 된다</b>(screen/log/access/requirements.md) — `TRACE_ID` 에 별도 인덱스가 있어 기간
        없이도 인덱스를 탄다. 판정은 서버가 한다: 폼은 아직 그 규칙을 알지 못한다.
      */
      field: 'traceId',
      label: MSG.LOGIN_LOG_SEARCH_TRACE_ID,
      type: 'text',
      ops: ['eq'],
    },
  ];
}

/**
 * *실패만* 으로 물었는가 — 0건 문구를 가르는 유일한 조건이다(screen/log/access/requirements.md).
 *
 * <p>결과 코드로 실패 코드만 골라도 <b>실패만 물은 것</b>이지만 그것까지 보지 않는다.
 * 사용자가 `FAIL_PWD` 하나를 고른 것은 *"비밀번호 실패를 찾는다"* 이지 *"실패가 있나"* 가
 * 아니며, 그 0건에 <i>실패가 없다</i> 고 답하면 <b>묻지 않은 것</b>을 말하는 셈이다.
 */
function failedOnly(conditions: SearchCondition[]): boolean {
  return conditions.some(
    (condition) => condition.field === 'rsltGroup' && condition.value === GROUP_FAILED,
  );
}
