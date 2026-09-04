import { useCallback, useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { SearchOutlined, UndoOutlined } from '@ant-design/icons';
import { Button, DatePicker, Dropdown, Input, Select, Space, Tooltip, Typography, theme } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTabIdentity } from '@/layouts/ShellLayout/tabContext';
import { useAuthStore } from '@/shared/stores/authStore';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { datePattern } from '@/shared/grid/dateFormat';
import type { SearchCondition, SelectOption } from '@/shared/grid/types';
import { useCodeOptions } from '@/shared/code/useCodeOptions';
import { SEARCH_OP_WIDTH, SEARCH_VALUE_WIDTH } from '@/shared/searchform/fieldWidth';
import { usePopup } from '@/shared/popup/popupContext';
import { SavedCondControl } from '@/shared/searchform/SavedCondControl';
import type { SavedCondValue, SavedCondValues } from '@/shared/searchform/savedCond';
import type { SearchField, SearchOp } from '@/shared/searchform/types';

/**
 * 조회조건 폼 — 57 · frontend/grid.md. <b>화면에 남는 유일한 폼이다</b>(frontend/grid.md).
 *
 * <p><b>라벨이 칸 위에 있고 칸의 폭이 고정이다</b>(frontend/search-form.md). 라벨을 왼쪽에 두면 라벨 길이가
 * 제각각인 다국어에서 <b>칸의 시작점이 줄마다 달라진다</b> — 위로 올리면 라벨이 아무리 길어도
 * 칸은 언제나 같은 자리에서 시작한다. 폭이 {@code span} 이 아니라 <b>고정 픽셀</b>인 것도
 * 같은 이유다: 24칸 격자는 <i>화면 폭에 따라</i> 칸의 폭이 변해 두 줄이 되면 어긋난다.
 *
 * <p><b>넘치면 다음 줄로 내려간다.</b> 가로 스크롤을 만들지 않는다 — 조회조건은 <b>전부
 * 보여야</b> 하고, 스크롤 뒤에 숨은 칸은 접힌 칸보다 나쁘다(접힘은 최소한 표시가 붙는다).
 *
 * <p><b>영역이 좌우로 갈린다</b> — 왼쪽이 칸, 오른쪽이 버튼이다. 버튼을 <b>위에 한 줄로</b>
 * 두면 칸 전체가 그만큼 내려앉는다. 나란히 두면 칸이 맨 위에서 시작한다.
 *
 * <p><b>그 버튼은 오른쪽 아래다</b>(2026-09-01 — frontend/tabs.md). 처음에는 오른쪽 <b>위</b>였고
 * 근거는 <i>"칸이 두 줄 세 줄로 늘어나도 자리가 같아 손이 기억한다"</i> 였다. 칸이 두 줄이
 * 되는 화면에서 갈렸다 — 손이 마지막으로 머무는 곳은 <b>마지막 줄</b>인데 버튼만 첫 줄에
 * 남아, 자리를 기억하는 대가로 <b>눈이 폼을 거슬러 올라가야</b> 했다. 자리가 고정인 것은
 * 그대로다: 폼 영역의 오른쪽 아래이며 칸의 <b>마지막 줄과 한 줄</b>에 놓인다.
 *
 * <p>버튼 둘의 순서는 <b>초기화 → 저장/불러오기</b>다: 왼쪽이 지금 폼을 되돌리는 것,
 * 오른쪽이 다른 폼을 불러오는 것이라 <i>가까운 일에서 먼 일로</i> 간다.
 *
 * <p><b>조회 버튼은 없다</b>(frontend/search-form.md) — 그리드 ①이 이미 갖는다. 다만 <b>{@code Enter} 는
 * 남는다</b>: 버튼을 없앤 것이지 제스처를 없앤 것이 아니다.
 *
 * <p><b>빈 칸은 보내지 않는다</b>(frontend/search-form.md · backend/api.md) — {@code value: null} 을 보내면
 * <i>"NULL 인 것을 찾아라"</i> 와 섞인다. 예외는 {@code isNull}·{@code isNotNull} 둘뿐이며
 * 그 둘은 <b>값이 없는 것이 정상</b>이다.
 *
 * <p><b>정렬 필드가 없다</b>(frontend/search-form.md) — 정렬 기준은 언제나 컬럼이므로 컬럼 위가 맞는 자리다.
 */

/*
  폭 둘은 <b>다른 파일</b>에 있다 — 트리의 ①에 선 검색 칸이 같은 값을 읽는다(screen/menu/requirements.md).
  컴포넌트 파일에서 내보내면 Fast Refresh 가 깨지므로 `fieldWidth` 로 갈랐다.
*/
/**
 * 년월의 와이어 형식 — DB 가 `VARCHAR(6)` 이라 값도 그 모양이다(playbook/INDEX.md).
 *
 * <p>문자열 정렬이 곧 시간 순서이므로 서버의 범위 비교가 그대로 성립한다.
 */
const MONTH_WIRE = 'YYYYMM';

/**
 * 날짜의 와이어 형식 — `DATE` 컬럼은 `LocalDate` 라 시각을 받지 않는다.
 *
 * <p>**실기동에서 드러났다**(2026-09-02). 이 칸은 정밀도가 생기기 전부터 ISO 시각을
 * 보내고 있었고, `LocalDate.parse` 가 그것을 거절해 **주문일로 거르면 언제나 0건**이었다 —
 * 조회가 400 이므로 화면은 빈 목록을 그렸고, 사용자에게는 *그런 주문이 없다* 로 보였다.
 */
const DAY_WIRE = 'YYYY-MM-DD';

const VALUE_WIDTH = SEARCH_VALUE_WIDTH;
const OP_WIDTH = SEARCH_OP_WIDTH;


/** 후보를 적지 않으면 타입이 준다 — frontend/search-form.md 의 표. */
const TEXT_OPS: SearchOp[] = ['eq', 'ne', 'startsWith', 'contains', 'endsWith', 'isNull', 'isNotNull'];
const SELECT_OPS: SearchOp[] = ['eq', 'ne', 'in'];
/**
 * 팝업 칸의 후보 — <b>같음과 같지 않음</b>뿐이다(playbook/INDEX.md).
 *
 * <p>값이 <b>고른 키</b>라 조각 일치({@code contains})가 뜻이 없다 — 사용자는 키를 치는
 * 것이 아니라 목록에서 고르며, 고른 키의 <i>일부를 포함하는</i> 행이라는 질문은 아무도
 * 하지 않는다. <b>{@code isNull} 둘은 연다</b>: <i>고객이 지정되지 않은 주문</i> 은
 * 실제로 묻는 질문이고, 팝업으로는 표현할 방법이 없다.
 */
const POPUP_OPS: SearchOp[] = ['eq', 'ne', 'isNull', 'isNotNull'];
/**
 * <b>기본은 하나뿐이다</b> — screen/log/access/requirements.md 의 연산자 칸이 {@code BETWEEN} 하나다.
 *
 * <p>{@code gte}·{@code lte} 를 <b>기본으로 열지 않는다.</b> 한쪽이 열린 범위는 <b>기간
 * 상한 검사를 그대로 통과하는 무제한 조회</b>이고(그 검사는 두 끝의 차를 본다 —
 * {@link issueOf}), 기간이 <b>부하의 상한인 화면</b>에서 그것은 문을 열어 두는 것이다.
 *
 * <p><b>선택 필터인 칸은 화면이 열 수 있다</b>(2026-08-31 · screen/user/requirements.md). 사용자 목록의 *최종
 * 로그인* 처럼 기간이 창이 아니라 거르개인 칸에서는 <i>이 날짜 이후로 한 번도 안 들어온
 * 계정</i> 을 물을 방법이 필요하며, 범위로 표현하려면 반대쪽 끝에 <b>사람이 아무 값이나</b>
 * 넣어야 한다 — 그 값이 곧 조건이 되어 <b>묻지 않은 것을 거른다</b>.
 *
 * <p>그래서 <b>여는 것이 선언</b>이다({@code ops}). 기본이 닫는 쪽이면 새 이력 화면이
 * 빠뜨렸을 때 <b>덜 위험한 쪽</b>으로 떨어진다(backend/security.md 와 같은 방향).
 */
const DATE_RANGE_OPS: SearchOp[] = ['between'];

/**
 * 기간 칸이 <b>달력 하나</b>로 바뀌는 연산자 — 2026-08-31 · screen/user/requirements.md.
 *
 * <p>범위 칸을 그대로 두고 한쪽을 비우게 하면 <i>비운 것</i>과 <i>아직 안 고른 것</i>이
 * 같은 모양이 되어, 조회가 되는지를 눌러 봐야 안다.
 *
 * <p><b>{@code gt}·{@code lt} 도 여기 있다</b>(playbook/INDEX.md) — 그 둘을 {@link DATE_RANGE_OPS}
 * 기본에 넣지 않은 것과 <b>다른 축</b>이다: 저것은 <i>후보로 나오는가</i> 이고 이것은
 * <b>나왔을 때 무엇으로 그리는가</b> 다. 화면이 {@code ops} 로 명시해서 열었는데 여기
 * 없으면 그 칸은 <b>날짜를 손으로 치는 텍스트 칸</b>이 된다.
 */
const SINGLE_DATE_OPS: SearchOp[] = ['gte', 'lte', 'gt', 'lt'];

/** 값 칸이 날짜 둘을 담는다 — {@code [from, to]} 이며 ISO-8601(오프셋 포함)이다(backend/packages.md). */
const RANGE_ARITY = 2;

/**
 * 드롭다운에 나오는 <b>순서</b> — 화면이 적은 순서가 아니다(frontend/search-form.md).
 *
 * <p><b>화면마다 다르면 같은 목록을 매번 다시 읽는다.</b> 조회조건 둘이 나란히 있는데
 * 한쪽은 <i>포함</i> 이 첫째고 다른 쪽은 셋째면, 손이 자리를 기억하지 못한다
 * (2026-08-30 실물에서 갈렸다).
 *
 * <p>묶음이 넷이다 — <b>같음 계열 → 문자열 계열 → 있음/없음 → 크기 계열</b>. 자주 쓰는
 * 것에서 드문 것으로 가고, 같은 묶음 안에서는 <i>넓은 것에서 좁은 것</i> 이다.
 *
 * <p><b>크기 계열은 셋까지 왔다</b>({@code between} · {@code gte} · {@code lte}). 남은 둘
 * ({@code gt} · {@code lt})은 그것을 처음 요구하는 화면이 <b>이 순서로</b> 뒤에 붙인다.
 * 목록에 없는 연산자는 아래에서 <b>맨 뒤</b>로 간다 — 앞으로 튀어나오지 않는다.
 */
const OP_ORDER: SearchOp[] = [
  'eq',
  'ne',
  'in',
  'startsWith',
  'contains',
  'endsWith',
  'isNotNull',
  'isNull',
  // 크기 계열의 첫 실물 — 나머지 넷은 그것을 요구하는 화면이 이 뒤에 붙인다(frontend/search-form.md).
  'between',
  // 둘째 — screen/batch/schedule/requirements.md 의 *소요 시간 이상*. 위 주석이 정한 순서(gte · gt · lte · lt)의 첫 칸이다.
  'gte',
  // 크기 계열의 넷째·다섯째 — playbook/INDEX.md(2026-09-02). 위 주석이 정한 순서(gte · gt ·
  // lte · lt)의 남은 두 칸이며, 이로써 backend/api.md 의 열셋이 전부 열렸다.
  'gt',
  // 셋째 — screen/user/requirements.md 의 기간 칸 둘. 그 순서의 셋째 자리다.
  'lte',
  'lt',
];

/**
 * 타입의 <b>기본 연산자</b> — frontend/search-form.md 의 표.
 *
 * <p>{@link OP_ORDER} 와 다른 축이다. 순서는 <i>목록에서 어디에 있나</i> 이고 이것은
 * <i>처음 골라져 있는 것</i> 이다 — 순서의 첫째를 기본으로 삼으면 <b>텍스트 칸의 기본이
 * 완전 일치</b>가 되는데, 사람이 검색창에 치는 것은 대개 조각이다.
 */
const TYPE_DEFAULT_OP: Record<SearchField['type'], SearchOp> = {
  text: 'contains',
  select: 'eq',
  dateRange: 'between',
  // 골라서 채우는 칸이다 — 조각 일치가 뜻이 없다(값이 키다).
  popupRef: 'eq',
};

const OP_LABEL: Record<SearchOp, string> = {
  eq: MSG.SEARCH_OP_EQ,
  ne: MSG.SEARCH_OP_NE,
  in: MSG.SEARCH_OP_IN,
  startsWith: MSG.SEARCH_OP_STARTS_WITH,
  contains: MSG.SEARCH_OP_CONTAINS,
  endsWith: MSG.SEARCH_OP_ENDS_WITH,
  isNull: MSG.SEARCH_OP_IS_NULL,
  isNotNull: MSG.SEARCH_OP_IS_NOT_NULL,
  between: MSG.SEARCH_OP_BETWEEN,
  gte: MSG.SEARCH_OP_GTE,
  lte: MSG.SEARCH_OP_LTE,
  gt: MSG.SEARCH_OP_GT,
  lt: MSG.SEARCH_OP_LT,
};

/**
 * 연산자의 <b>기호</b> — 아이콘 자리에 그린다.
 *
 * <p>그림 아이콘을 쓰지 않았다. {@code =}·{@code ≠}·{@code ∈} 는 <b>이미 만국 공통</b>이고
 * {@code a*}·{@code *a*} 는 와일드카드 관례를 그대로 읽는다 — 여기에 돋보기나 화살표 같은
 * 그림을 얹으면 <b>기호를 그림으로 번역했다가 사용자가 다시 되번역</b>해야 한다.
 *
 * <p>이름은 드롭다운이 낸다 — frontend/search-form.md 의 미결 <i>"연산자 셀렉터의 모양"</i> 을 이 형태로 닫는다.
 * 기호만 두면 뜻을 모르는 사용자가 있고, 이름을 칸 안에 두면 <b>다국어에서 잘린다</b>:
 * 값 칸이 300px 고정이라 남는 폭이 없다.
 */
const OP_GLYPH: Record<SearchOp, string> = {
  eq: '=',
  ne: '≠',
  in: '∈',
  startsWith: 'a*',
  contains: '*a*',
  endsWith: '*a',
  isNull: '∅',
  isNotNull: '≠∅',
  // 두 끝 사이 — 화살표나 달력 그림을 얹지 않는다(기호를 그림으로 번역했다 되번역한다).
  between: '↔',
  // 이상 — `>=` 가 아니라 `≥` 다. 수학 기호가 만국 공통이고 한 글자라 칸을 덜 먹는다.
  gte: '≥',
  lte: '≤',
  // 초과·미만 — 기호 하나로 끝나고 이상·이하와 <b>밑줄 하나 차이</b>로 갈린다.
  gt: '>',
  lt: '<',
};

/** 타입이 주는 후보 — 화면이 {@code ops} 를 적으면 그쪽이 이긴다(frontend/search-form.md). */
const TYPE_OPS: Record<SearchField['type'], SearchOp[]> = {
  text: TEXT_OPS,
  select: SELECT_OPS,
  dateRange: DATE_RANGE_OPS,
  popupRef: POPUP_OPS,
};


const GLYPH_FONT = 'ui-monospace, SFMono-Regular, Consolas, monospace';

/** 칸 하나의 값 — {@code in} 이면 배열이다(frontend/search-form.md). */
type FieldValue = string | string[];

export interface SearchFormHandle {
  /** 그리드가 <i>"값을 달라"</i> 고 부른다 — frontend/grid.md. 검증 실패면 {@code null} 이다. */
  collect: () => SearchCondition[] | null;
  /**
   * <b>다른 화면이 건넨 값으로 폼을 채운다</b> — 넘겨주기(screen/log/access/requirements.md · screen/menu/requirements.md).
   *
   * <p>선언({@code defaultValue})으로는 안 되는 자리다. 폼의 상태는 <b>첫 렌더에 한 번</b>
   * 만들어지므로 {@code fields} 를 바꿔도 이미 마운트된 폼은 움직이지 않는다 — 그런데
   * 넘겨주기가 오는 흔한 경우가 <b>그 화면이 이미 열려 있을 때</b>다(frontend/tabs.md).
   *
   * <p><b>적지 않은 칸은 기본값으로 돌아간다.</b> 건네받았다는 것은 <i>다른 질문을 하러
   * 왔다</i> 는 뜻이라, 앞서 걸어 둔 조건이 남아 있으면 <b>건넨 값이 그 조건에 갇힌다</b> —
   * URL 을 받아 왔는데 이전 화면에서 걸어 둔 액션 조건 때문에 0건이 되는 식이다.
   *
   * <p>타입을 {@link SavedCondValues} 와 공유한다. 저장된 조건을 되돌리는 것과 <b>하는
   * 일이 같기</b> 때문이며(폼 값 묶음을 통째로 얹는다), 모양을 하나 더 만들면 복원 규칙
   * (§5.3 의 <i>맞지 않는 것은 조용히 버린다</i>)도 두 벌이 된다.
   */
  apply: (values: SavedCondValues) => void;
}

interface SearchFormProps {
  fields: SearchField[];
  /** `Enter` 와 초기화가 부른다 — 초기화는 컬럼 필터도 함께 지운다(frontend/grid.md). */
  onSubmit: () => void;
  onReset?: () => void;
  handleRef?: Ref<SearchFormHandle>;
  /**
   * 지금 걸린 조건 수 — <b>접힌 채로 조건이 있으면 브레드크럼 줄이 그것을 표시한다</b>
   * (frontend/tabs.md). 알리지 않으면 접힌 사용자는 *"왜 데이터가 이것뿐이지"* 의 원인을 못 찾는다.
   */
  onActiveCountChange?: (count: number) => void;
  /** 접힘은 <b>표시</b>일 뿐이다 — 언마운트하지 않으므로 조건이 살아 있다(frontend/tabs.md). */
  collapsed?: boolean;
  /**
   * 저장된 조회조건을 <b>쓰지 않는다</b> — 참조 팝업 안의 폼이 그 자리다(playbook/INDEX.md).
   *
   * <p>기본은 켜짐이고 끄는 것이 예외다. 끄는 이유가 하나뿐이라 이름도 그것을 말한다 —
   * <b>조건이 메뉴에 매인다</b>(frontend/search-form.md). 팝업은 자기 메뉴가 없어 <b>부른 화면의 메뉴</b>로
   * 저장되는데, 그러면 화면의 조건과 팝업의 조건이 <b>한 목록에 섞이고</b> 이름이 겹치면
   * 서로를 덮는다 — 사용자가 보기에는 <i>저장한 조건이 다른 것으로 바뀌어 있다</i> 다.
   */
  savedConditions?: boolean;
}

interface FieldState {
  op: SearchOp;
  value: FieldValue;
  /**
   * 팝업 칸이 <b>보여 주는 글자</b> — playbook/INDEX.md. 나가는 조건에는 담기지 않는다.
   *
   * <p>{@link FieldState.value} 와 <b>축이 다르다</b>: 저것은 서버가 아는 키이고 이것은
   * 사람이 읽는 이름이다. 하나로 합치면 둘 중 하나를 잃는다 — 이름을 보내면 <i>이름으로도
   * 걸러 달라</i> 가 되고, 키만 들면 칸에 코드가 보인다.
   */
  text?: string;
}

/** 조회 기간의 시스템 층 — `SYS_CONFIG` 의 `ui.search.range-days.*`(sys/code.md). */
type SystemRange = { defaultDays: number; maxDays: number };

export function SearchForm(props: SearchFormProps) {
  const { token } = theme.useToken();
  const identity = useTabIdentity();

  /*
    조회 기간의 <b>시스템 층</b> — sys/code.md · screen/log/access/requirements.md. 로그인 응답이 나른다.
    프론트에 7 · 92 를 박아 두면 {@code SYS_CONFIG} 와 어긋나고, 그 어긋남은 <b>폼이
    통과시킨 조회를 서버가 400 으로 거부하는 것</b>으로만 드러난다.

    <b>기본값도 여기서 온다</b>(2026-08-30). 상한만 시스템 층을 보고 기본값은 하루로
    떨어뜨렸더니, `rangeDays` 를 적지 않은 화면이 <i>최근 7일</i> 이어야 할 자리에서
    <b>최근 하루</b>로 열렸다 — 로그인 이력이 그 첫 사례다(screen/log/access/requirements.md).
  */
  const systemRange = useAuthStore((session) => session.searchRange);
  const initial = useMemo(() => defaults(props.fields, systemRange), [props.fields, systemRange]);
  const [state, setState] = useState<Record<string, FieldState>>(initial);
  /** 칸 아래에 붙는 오류 문구 — <b>조회를 누른 뒤에만</b> 채워진다. */
  const [errors, setErrors] = useState<Record<string, string>>({});

  /*
    공통코드에서 후보를 받는 칸 — sys/code.md. 화면은 <b>그룹코드만</b> 적고 목록·캐시·이름은
    여기 아래가 맡는다. 하나도 없으면 훅이 빈 객체를 내고 요청도 나가지 않는다.
  */
  const codeOptions = useCodeOptions(
    props.fields.map((field) => field.grpCd).filter((grpCd) => grpCd !== undefined),
  );

  /**
   * 걸린 조건 — <b>검증하지 않는다</b>.
   *
   * <p>조건 수 표시(frontend/tabs.md)가 매 렌더 이것을 부르므로, 여기서 오류 상태를 세우면
   * <b>아직 조회를 누르지도 않았는데 빨간 글씨</b>가 뜬다.
   */
  const build = useCallback((): SearchCondition[] => {
    const conditions: SearchCondition[] = [];
    for (const field of props.fields) {
      const current = state[field.field];
      if (!current) continue;
      if (!takesValue(current.op)) {
        conditions.push({ field: field.field, op: current.op });
        continue;
      }
      if (Array.isArray(current.value)) {
        // 빈 배열은 *묻지 않음* 이다 — `IN ()` 은 문법도 되지 않는다.
        if (current.value.length === 0) continue;
        conditions.push({ field: field.field, op: current.op, value: current.value });
        continue;
      }
      if (current.value.trim() === '') continue;
      conditions.push({ field: field.field, op: current.op, value: scaled(field, current.value) });
    }
    return conditions;
  }, [props.fields, state]);

  /**
   * 조회를 누른 순간의 검증 — frontend/grid.md. <b>실패하면 조회가 일어나지 않는다.</b>
   *
   * <p>둘뿐이다: <b>필수인데 비었다</b> 와 <b>기간이 상한을 넘었다</b>. 서버도 같은 것을
   * 다시 보므로(screen/log/access/requirements.md) 여기서 막는 것은 <i>왕복 하나를 아끼는 것</i> 이지 유일한 방어가
   * 아니다 — 그래서 규칙을 여기 더 복잡하게 적지 않는다.
   */
  const collect = useCallback((): SearchCondition[] | null => {
    const found: Record<string, string> = {};
    for (const field of props.fields) {
      const current = state[field.field];
      if (!current) continue;
      const message = issueOf(field, current, systemRange);
      if (message) found[field.field] = message;
    }
    setErrors(found);
    return Object.keys(found).length > 0 ? null : build();
  }, [build, props.fields, state, systemRange]);

  const { onActiveCountChange } = props;
  useEffect(() => {
    onActiveCountChange?.(build().length);
  }, [build, onActiveCountChange]);

  const change = (field: string, patch: Partial<FieldState>) =>
    setState((current) => ({ ...current, [field]: { ...current[field], ...patch } }));

  /**
   * 저장할 값 — <b>기본값과 같은 칸은 담지 않는다</b>(frontend/search-form.md).
   *
   * <p>그래서 <i>최근 7일</i> 로 저장한 조건이 열 때마다 최근 7일이다. 절대값으로 굳으면
   * <b>내일 열었을 때 어제 것</b>이 나오고, 그것이 저장된 조건의 가장 흔한 배신이다.
   */
  const readValues = useCallback((): SavedCondValues => {
    const base = defaults(props.fields, systemRange);
    const result: SavedCondValues = {};
    for (const field of props.fields) {
      const current = state[field.field];
      const initial = base[field.field];
      if (!current || !initial) continue;

      const entry: SavedCondValue = {};
      // `op` 만 예외로 함께 담는다 — 다른 셋은 선언이 정하지만 이것은 사용자가 골랐다.
      if (current.op !== initial.op) entry.op = current.op;
      if (!sameValue(current.value, initial.value)) entry.value = current.value;
      /*
        <b>표시값은 선언에서 되만들 수 없다</b>(playbook/INDEX.md) — 고른 행에서 나온 글자라,
        저장하지 않으면 다시 열었을 때 <b>빈 칸</b>이 된다: 조건은 걸려 있는데 무엇으로
        걸렀는지가 화면 어디에도 없다.
      */
      if (current.text !== undefined) entry.text = current.text;

      if (entry.op === undefined && entry.value === undefined) continue;
      result[field.field] = entry;
    }
    return result;
  }, [props.fields, state, systemRange]);

  const applyValues = useCallback(
    (values: SavedCondValues) => setState(restore(props.fields, values, systemRange)),
    [props.fields, systemRange],
  );

  /*
    <b>{@code applyValues} 아래여야 한다.</b> 의존 배열이 렌더 중에 평가되므로 위에 두면
    아직 선언되지 않은 이름을 읽어 TDZ 로 죽는다 — 화면이 통째로 안 뜬다.
  */
  useImperativeHandle(
    props.handleRef,
    () => ({ collect, apply: applyValues }),
    [collect, applyValues],
  );

  /*
    라벨과 칸 사이 — <b>판의 세로 폼과 같은 값</b>이다. antd 의 `verticalLabelPadding` 이
    `0 0 {paddingXS}px` 이며 그것이 프로필·설정 모달의 폼이 쓰는 간격이다. 처음에는
    2px 이었는데 <b>같은 앱 안에서 라벨이 두 가지 간격</b>으로 붙어 조회조건만 답답해
    보였다(2026-08-30 실물). 토큰에서 받으므로 콤팩트 모드에서도 폼과 함께 좁아진다.
  */
  const labelGap = token.paddingXS;

  return (
    <div
      style={{
        // 접어도 언마운트하지 않는다 — 조건이 살아 있어야 접힌 채로 조회할 수 있다.
        display: props.collapsed ? 'none' : undefined,
        padding: 8,
        marginBottom: 4,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        background: token.colorBgContainer,
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') props.onSubmit();
      }}
    >
      {/*
        좌우로 가른다 — 왼쪽이 칸, 오른쪽이 버튼이다. 버튼을 위에 한 줄로 두면
        칸 전체가 그 높이만큼 내려앉는다.

        <p><b>아래로 맞춘다</b>(2026-09-01 실물). 칸이 한 줄일 때는 위와 아래가 같은 자리라
        드러나지 않았는데, 두 줄이 되면 버튼만 <b>첫 줄에 남아</b> 폼의 오른쪽 아래가 비었다 —
        손이 마지막으로 머무는 곳은 마지막 줄이므로 버튼도 그 줄에 있어야 한다.

        <p><b>{@code flex-end} 하나로 된다.</b> 예전에는 {@code flex-start} 에 라벨 높이만큼
        {@code marginTop} 을 줘서 <i>첫 줄 칸</i>에 맞췄는데, 그 방식으로 아래에 맞추려면
        <b>칸이 몇 줄인지 알아야 한다</b> — CSS 로는 알 수 없다. 아래로 맞추면 칸의 마지막 줄
        바닥이 곧 버튼의 바닥이고, 버튼과 칸의 높이가 같으므로(둘 다 판의 기본 높이다)
        <b>한 줄일 때의 결과가 예전과 같다</b> — 라벨 높이를 더해 얻던 자리가 곧 그 바닥이다.

        <p><b>마지막 줄에 오류 문구가 붙으면 버튼이 그만큼 내려간다.</b> 문구가 칸 아래에
        있고(아래) 그것이 그 줄의 높이이기 때문이다. 조회가 실패한 동안만이며 그때도 버튼은
        여전히 폼의 오른쪽 아래다 — 자리를 미리 비워 두면 <b>조건이 맞을 때 늘</b> 그만큼
        비어 있게 된다.
      */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {props.fields.map((field) => (
            <div key={field.field} style={{ width: OP_WIDTH + VALUE_WIDTH }}>
              {/*
                라벨을 흐리게 두지 않는다 — 지금 무엇으로 찾고 있는지가 이 줄에만 적혀
                있으므로, 못 읽으면 <b>조건을 잘못 넣고도 모른다</b>. 본문 크기 · 본문
                색이며 굵기만 반 단계 올린다(2026-08-30 실물).
              */}
              <div style={{ marginBottom: labelGap }}>
                <Typography.Text style={{ fontWeight: 500 }}>{label(field.label)}</Typography.Text>
              </div>
              <Space.Compact style={{ width: '100%' }}>
                {/*
                  둘이 <b>Space.Compact 의 직속 자식</b>이어야 한다. 조각(fragment)을 내는
                  컴포넌트 하나로 감싸면 Compact 는 자식을 <b>하나</b>로 보고, 맞닿는
                  모서리를 깎는 클래스가 어디에도 붙지 않아 <b>둥근 것 둘이 겹쳐</b>
                  보인다(2026-08-30 실물).
                */}
                <OperatorPicker
                  candidates={opsOf(field)}
                  value={state[field.field].op}
                  onChange={(op) =>
                    change(field.field, { op, value: moveValue(state[field.field].value, op) })}
                />
                <ValueControl
                  field={field}
                  // 선언이 적은 후보가 이긴다 — 소스가 값을 갖는 코드가 그쪽이다(sys/code.md).
                  options={field.options ?? (field.grpCd ? codeOptions[field.grpCd] : undefined)}
                  state={state[field.field]}
                  onChange={(patch) => change(field.field, patch)}
                  onSubmit={props.onSubmit}
                />
              </Space.Compact>
              {/*
                문구를 칸 <b>아래</b>에 둔다 — 옆에 두면 300px 고정 폭이 밀려 그 줄만
                어긋나고, 툴팁으로 두면 <b>왜 조회가 안 됐는지</b> 를 찾아 마우스를
                올려야 한다.
              */}
              {errors[field.field] ? (
                <Typography.Text type="danger" style={{ fontSize: token.fontSizeSM }}>
                  {errors[field.field]}
                </Typography.Text>
              ) : null}
            </div>
          ))}
        </div>

        {/*
          칸 <b>바깥</b>의 오른쪽이다 — 마지막 칸 뒤에 그냥 붙이면 칸이 줄을 옮길 때마다
          버튼이 함께 옮겨 다니고, 줄이 꽉 차면 버튼만 다음 줄로 떨어져 폼이 한 줄 높아진다.
        */}
        <Space size={8}>
          <Button
            icon={<UndoOutlined />}
            onClick={() => {
              setState(defaults(props.fields, systemRange));
              // 오류도 함께 지운다 — 되돌린 칸 아래에 옛 문구가 남으면 고친 것이 안 보인다.
              setErrors({});
              props.onReset?.();
            }}
          >
            {label(MSG.SEARCH_RESET)}
          </Button>
          {/* 셸 밖(로그인 화면 등)에는 메뉴가 없다 — 조건이 매이는 자리가 그것이다(frontend/search-form.md). */}
          {identity && props.savedConditions !== false && (
            <SavedCondControl menuCd={identity.menuCd} read={readValues} apply={applyValues} />
          )}
        </Space>
      </div>
    </div>
  );
}

function ValueControl(props: {
  field: SearchField;
  /** 이미 <b>이름이 붙은</b> 후보다 — 선언의 것이거나 공통코드에서 온 것이다. */
  options: SelectOption[] | undefined;
  state: FieldState;
  onChange: (patch: Partial<FieldState>) => void;
  onSubmit: () => void;
}) {
  const { field, options, state, onChange, onSubmit } = props;
  const multiple = state.op === 'in';

  /*
    값을 받지 않는 연산자에는 <b>잠긴 칸</b>이 남는다 — backend/api.md 이 칸을 없애라고 한 뜻은
    *"값을 넣었는데 안 걸린다"* 를 막으라는 것이고 잠긴 칸이 그것을 막는다. 통째로 지우면
    그 칸만 폭이 줄어 아래윗줄의 정렬이 깨진다(frontend/search-form.md).
  */
  if (!takesValue(state.op)) {
    return <Input disabled value="" style={{ width: VALUE_WIDTH }} />;
  }

  /*
    기간 — screen/log/access/requirements.md. <b>시각까지 고른다.</b>

    날짜만 고르게 두면 <i>오늘</i> 이 자정에서 끊겨 <b>방금 일어난 요청이 안 나온다</b> —
    사용 이력에서 가장 흔한 조회가 <i>조금 전 그 요청</i> 이라 그것이 곧 고장으로 읽힌다.

    값은 <b>오프셋을 포함한 ISO-8601</b> 이다(backend/packages.md). {@code dayjs.toISOString()} 이
    {@code Z} 로 내는데 서버는 {@code OffsetDateTime} 으로 읽으므로 둘이 맞는다.
  */
  if (field.type === 'dateRange') {
    /*
      <b>정밀도가 셋이다</b>(frontend/grid.md · playbook/INDEX.md). 기본은 `second` 이고, 그것이 사용 이력의
      규약이다 — 날짜만 고르게 두면 <i>오늘</i> 이 자정에서 끊긴다.

      `month` 는 년월 달력이며 값도 <b>`202608` 문자열</b>로 나간다. 그 컬럼은 DB 가
      VARCHAR(6) 이고(playbook/INDEX.md) ISO 시각을 보내면 비교가 언제나 빗나가, 조건은 걸렸는데
      0건인 목록이 된다 — 사용자에게 그것은 <i>그런 주문이 없다</i> 로 보인다.
    */
    const precision = field.precision ?? 'second';
    const picker = precision === 'month' ? 'month' : undefined;
    const withTime = precision === 'second';
    const format = datePattern(precision);
    /*
      **와이어 형식이 정밀도마다 다르다.** 서버의 컬럼 타입이 그것을 요구한다 —
      `DATE` 는 `LocalDate` 이고 `LocalDate.parse` 는 ISO 시각에서 죽는다(`ValueCoercion`).
      그 실패는 조회 400 이며 화면에는 *조회 조건의 값이 올바르지 않습니다* 로만 나온다.

      `second` 만 오프셋을 포함한 ISO-8601 이다(backend/packages.md) — 그 칸의 컬럼이
      `OffsetDateTime`·`Instant` 라서다.
    */
    const wireFormat = precision === 'month' ? MONTH_WIRE : DAY_WIRE;
    const toWire = (value: Dayjs) =>
      precision === 'second' ? value.toISOString() : value.format(wireFormat);
    const fromWire = (value: string) =>
      precision === 'second' ? dayjs(value) : dayjs(value, wireFormat);

    /*
      <b>한쪽만 아는 조건은 달력 하나다</b>(2026-08-31 · screen/user/requirements.md). 범위 칸을 그대로 두고
      한쪽을 비우게 하면 <i>비운 것</i>과 <i>아직 안 고른 것</i>이 같은 모양이 되어,
      조회가 되는지 안 되는지를 눌러 봐야 안다.
    */
    if (SINGLE_DATE_OPS.includes(state.op)) {
      const single = typeof state.value === 'string' ? state.value : '';
      return (
        <DatePicker
          showTime={withTime}
          picker={picker}
          allowClear
          style={{ width: VALUE_WIDTH }}
          // 표시 형식은 시스템 설정이 정한다 — 그리드의 시각 컬럼과 같은 값이다(frontend/grid.md).
          format={format}
          value={single === '' ? null : fromWire(single)}
          onChange={(picked) => onChange({ value: picked ? toWire(picked) : '' })}
        />
      );
    }

    const pair = Array.isArray(state.value) ? state.value : [];
    return (
      <DatePicker.RangePicker
        showTime={withTime}
        picker={picker}
        allowClear
        style={{ width: VALUE_WIDTH }}
        format={format}
        value={
          pair.length === RANGE_ARITY ? [fromWire(pair[0]), fromWire(pair[1])] : null
        }
        onChange={(range) =>
          onChange({
            value:
              range && range[0] && range[1]
                ? [toWire(range[0]), toWire(range[1])]
                : [],
          })
        }
      />
    );
  }

  /*
    참조 팝업 — playbook/INDEX.md. <b>표시 칸(읽기 전용) + 찾기 + 지우기</b>다.

    <b>칸에 직접 칠 수 없다.</b> 칠 수 있으면 목록에 없는 키가 만들어지고, 그 조건은
    <i>걸렸는데 0건</i> 이 되어 사용자가 자기 오타를 의심할 근거가 없다 —
    {@code richSelect} 의 <i>타이핑은 필터이지 입력이 아니다</i>(playbook/INDEX.md)와 같은 규칙이다.

    <b>보내는 것은 키 하나뿐이다.</b> 칸에 보이는 이름은 조건에 들어가지 않는다 —
    이름까지 보내면 <i>이름으로도 걸러 달라</i> 는 뜻이 되어 버린다.
  */
  if (field.type === 'popupRef') {
    return (
      <PopupField field={field} state={state} onChange={onChange} />
    );
  }

  if (field.type === 'select') {
    return (
      <Select
        mode={multiple ? 'multiple' : undefined}
        allowClear={multiple}
        /*
          다중 선택에서 {@code Enter} 는 <b>고르는 키가 아니라 조회하는 키</b>다.

          단일 선택은 고르는 순간 목록이 접히므로 그 뒤의 Enter 는 폼으로 곧장 간다 —
          목록이 열려 있을 때 Enter 로 고르는 것도 그 자리에서 닫히니 앞뒤가 맞는다.
          다중은 골라도 <b>목록이 남는다</b>: 그 상태의 Enter 가 rc-select 에 닿으면
          커서가 앉은 항목을 한 번 더 토글해 <i>방금 고른 마지막 항목이 풀린 채로</i>
          조회된다. 마우스만 올려 둔 항목이 선택돼 버리는 것도 같은 경로다
          (2026-08-30 실물).

          그래서 <b>입력칸에서 가로챈다</b> — rc-select 의 선택 처리는 이 이벤트가
          바깥 div 로 올라가야 돌아가므로, 전파를 끊으면 고르지도 풀지도 않는다.
          대신 폼의 Enter 를 여기서 직접 부른다: 제스처는 그대로 남는다.
        */
        onInputKeyDown={(event) => {
          if (!multiple || event.key !== 'Enter') return;
          event.stopPropagation();
          onSubmit();
        }}
        maxTagCount="responsive"
        style={{ width: VALUE_WIDTH }}
        placeholder={label(MSG.SEARCH_ALL)}
        value={state.value}
        onChange={(value: FieldValue | null) => onChange({ value: value ?? (multiple ? [] : '') })}
        options={[
          // 단일 선택에만 `전체` 항목이 있다 — 다중에서는 <b>고르지 않은 것</b>이 곧 전체다.
          ...(multiple ? [] : [{ value: '', label: label(MSG.SEARCH_ALL) }]),
          ...(options ?? []).map((option) => ({ value: option.value, label: option.text })),
        ]}
      />
    );
  }

  /*
    태그 입력 — playbook/INDEX.md. <b>텍스트 칸의 {@code in}</b> 이다.

    콤보의 {@code in}(위 가지)과 <b>값의 모양이 같고 고르는 방법이 다르다</b>: 저기는
    닫힌 후보에서 고르고 여기는 <b>사람이 친다</b>. 그래서 {@code mode="tags"} 이고
    후보 목록이 없다 — 빈 드롭다운을 띄우면 <i>고를 것이 없다</i> 로 읽힌다.

    <b>{@code null} 항목은 없다.</b> 텍스트의 <i>(없음)</i> 은 {@code isNull} 이 표현하며
    (backend/api.md), 칩으로 빈 문자열을 만들 수 있게 두면 <b>같은 질문을 두 방법으로</b> 묻게
    된다 — 서버의 {@code IN} 절에 {@code NULL} 이 섞이면 그 절은 어떤 행도 맞히지 못한다.

    <b>{@code Enter} 를 가로채지 않는다</b> — 콤보의 다중 선택과 갈리는 자리다. 거기서
    {@code Enter} 는 <i>커서가 앉은 후보를 토글</i>해 방금 고른 것을 풀어 버렸지만,
    여기서 {@code Enter} 는 <b>치던 글자를 칩으로 굳히는</b> 유일한 제스처다. 조회는
    칩이 굳은 뒤 한 번 더 누르면 나간다.
  */
  if (multiple) {
    return (
      <Select
        mode="tags"
        allowClear
        // 후보가 없으므로 열 것도 없다 — 빈 패널이 뜨면 <i>고장</i> 으로 읽힌다.
        open={false}
        suffixIcon={null}
        maxTagCount="responsive"
        style={{ width: VALUE_WIDTH }}
        value={asList(state.value)}
        // 앞뒤 공백은 <b>사람이 붙인 것이 아니다</b> — 붙여넣기에서 딸려 오고,
        // 서버의 완전 일치에서는 그것이 곧 <i>안 걸린다</i> 가 된다.
        onChange={(next: string[]) =>
          onChange({ value: next.map((item) => item.trim()).filter((item) => item !== '') })
        }
      />
    );
  }

  return (
    <Input
      value={typeof state.value === 'string' ? state.value : ''}
      allowClear
      style={{ width: VALUE_WIDTH }}
      onChange={(event) => onChange({ value: event.target.value })}
    />
  );
}

/**
 * 참조 팝업 칸 — playbook/INDEX.md · frontend/grid.md.
 *
 * <p><b>그리드와 같은 레지스트리를 쓴다</b>(playbook/INDEX.md) — 두 벌을 두면 같은 고객 팝업이
 * 그리드에서는 다섯 컬럼이고 폼에서는 셋인 날이 온다.
 *
 * <p><b>표시 칸은 잠겨 있다.</b> 값이 <i>고른 키</i> 라 손으로 친 글자는 키가 아니며,
 * 그렇게 만들어진 조건은 <b>걸렸는데 0건</b>이 되어 사용자가 자기 오타를 의심할 근거가
 * 없다. 지우는 것은 따로 있다 — 취소와 갈라야 하는 이유는 {@code PopupOutcome} 에 있다.
 */
function PopupField(props: {
  field: SearchField;
  state: FieldState;
  onChange: (patch: Partial<FieldState>) => void;
}) {
  const { field, state, onChange } = props;
  const open = usePopup();

  const pick = async () => {
    if (!field.popup) return;
    const outcome = await open(field.popup, { clearable: state.value !== '' });
    if (outcome.kind === 'picked') {
      onChange({
        value: field.popupValue ? field.popupValue(outcome.row) : '',
        text: field.popupText ? field.popupText(outcome.row) : undefined,
      });
      return;
    }
    // 취소는 아무 일도 없다 — 값이 그대로 남는다.
    if (outcome.kind === 'cleared') onChange({ value: '', text: undefined });
  };

  const value = typeof state.value === 'string' ? state.value : '';

  return (
    <Space.Compact style={{ width: VALUE_WIDTH }}>
      <Input
        readOnly
        // 잠긴 칸이라 무엇을 눌러야 하는지 스스로 말한다 — 빈 칸은 고장으로도 읽힌다.
        placeholder={label(MSG.POPUP_PICK)}
        value={state.text ?? value}
        onClick={() => void pick()}
        style={{ cursor: 'pointer' }}
      />
      <Button icon={<SearchOutlined />} onClick={() => void pick()} />
    </Space.Compact>
  );
}

/**
 * 연산자 — <b>기호 하나짜리 버튼</b>이고 이름은 드롭다운이 낸다(frontend/search-form.md).
 *
 * <p><b>후보가 하나여도 자리가 남는다.</b> frontend/search-form.md 는 <i>셀렉터</i> 가 사라진다고 했고 그것은
 * 지킨다 — 누를 수 없는 표시로 바뀔 뿐이다. 통째로 없애면 그 칸의 값 입력만 44px 왼쪽에서
 * 시작해 <b>줄이 어긋난다</b>. 고정 연산자를 보여 주는 것 자체도 값을 한다: 요청 URI 가
 * 앞 일치인 것을 사용자가 알 방법이 그 표시밖에 없다.
 */
function OperatorPicker(props: {
  candidates: SearchOp[];
  value: SearchOp;
  onChange: (op: SearchOp) => void;
}) {
  const { token } = theme.useToken();
  const glyph = (op: SearchOp) => (
    <span style={{ fontFamily: GLYPH_FONT, fontSize: token.fontSizeSM }}>{OP_GLYPH[op]}</span>
  );
  const name = label(OP_LABEL[props.value]);

  if (props.candidates.length < 2) {
    return (
      // 브라우저 기본 툴팁을 쓰지 않는다 — 셸의 다른 툴팁과 모양이 달랐다(2026-08-30).
      // 잠긴 버튼은 마우스 이벤트를 내지 않으므로 감싸는 요소가 하나 필요하다.
      <Tooltip title={name}>
        <span style={{ display: 'inline-flex' }}>
          <Button disabled aria-label={name} style={{ width: OP_WIDTH, paddingInline: 0 }}>
            {glyph(props.value)}
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        selectable: true,
        selectedKeys: [props.value],
        // 이름이 잘리지 않는다 — 메뉴는 제 내용만큼 넓어진다. 값 칸 안에 두면 잘린다.
        items: props.candidates.map((op) => ({
          key: op,
          label: (
            <Space size={10}>
              <span style={{ display: 'inline-block', width: 28, textAlign: 'center' }}>
                {glyph(op)}
              </span>
              {label(OP_LABEL[op])}
            </Space>
          ),
        })),
        onClick: (info) => props.onChange(info.key as SearchOp),
      }}
    >
      <Button aria-label={name} style={{ width: OP_WIDTH, paddingInline: 0 }}>
        {glyph(props.value)}
      </Button>
    </Dropdown>
  );
}

/** 후보를 <b>언제나 같은 순서</b>로 낸다 — 화면이 적은 순서를 쓰지 않는다. */
function opsOf(field: SearchField): SearchOp[] {
  const candidates = field.ops ?? TYPE_OPS[field.type];
  const rank = (op: SearchOp) => {
    const index = OP_ORDER.indexOf(op);
    return index < 0 ? OP_ORDER.length : index;
  };
  return [...candidates].sort((left, right) => rank(left) - rank(right));
}

/**
 * 처음 골라져 있는 연산자.
 *
 * <p>화면이 {@code op} 를 적었으면 그것이고, 아니면 <b>타입의 기본</b>이다. 다만 화면이
 * {@code ops} 로 후보를 좁혀 그 기본이 빠졌다면 <b>남은 것 중 첫째</b>로 간다 — 고를 수
 * 없는 연산자가 골라져 있는 상태를 만들지 않는다.
 */
function defaultOpOf(field: SearchField): SearchOp {
  if (field.op) return field.op;

  const candidates = opsOf(field);
  const typeDefault = TYPE_DEFAULT_OP[field.type];
  return candidates.includes(typeDefault) ? typeDefault : candidates[0];
}

/**
 * 화면 단위 → 저장 단위 — frontend/search-form.md 의 {@code scale}.
 *
 * <p><b>나가는 순간에만 곱한다.</b> 폼의 상태에는 사람이 입력한 값 그대로 남아야
 * 저장된 조건이 화면 단위로 남고(§5.2), 다시 열었을 때 <b>또 곱해지지 않는다</b>.
 *
 * <p><b>숫자로 읽히지 않으면 그대로 보낸다.</b> 서버의 화이트리스트가 타입을 강제하므로
 * ({@code ValueCoercion}) 여기서 조용히 버리면 <i>조건을 넣었는데 안 걸렸다</i> 가 되고,
 * 그 목록은 <b>거르지 않은 것을 거른 것으로</b> 읽힌다.
 *
 * <p>배열(<code>in</code>)에는 걸리지 않는다 — 단위가 갈리는 칸은 크기 비교이지 목록
 * 고르기가 아니다. 필요해지는 화면이 나오면 그때 연다.
 */
function scaled(field: SearchField, value: string): string | number {
  if (!field.scale) return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric * field.scale : value;
}

function takesValue(op: SearchOp): boolean {
  return op !== 'isNull' && op !== 'isNotNull';
}

/**
 * 연산자를 바꾸면 값이 따라간다 — frontend/search-form.md.
 *
 * <p><b>다중에서 단일로 돌아오면 비운다.</b> 문서는 <i>"첫 원소만 남긴다"</i> 였는데
 * 콤보에서는 그러면 안 된다 — 거기서 빈 값은 <b>*전체* 이고 그것은 값이 아니라 *묻지 않음*</b>
 * 이다. 첫 원소를 남기면 <b>사용자가 고른 적 없는 조건 하나가 조용히 걸린 채</b>로 조회가
 * 돈다. 텍스트 칸에는 *전체* 가 없어 이 문제가 없지만, 규칙이 둘이면 읽을 것도 둘이다.
 */
function moveValue(value: FieldValue, next: SearchOp): FieldValue {
  if (!takesValue(next)) return '';
  /*
    기간의 값은 <b>원소 둘</b>이다. 범위에서 이상·이하로 옮기면 아래 마지막 줄이 배열을
    빈 문자열로 바꾼다 — <b>첫 끝을 남기지 않는다</b>: 사용자가 고른 것은 <i>두 끝 사이</i>
    였고, 그중 하나만 남기면 <b>고른 적 없는 조건</b>이 조용히 걸린 채 조회가 돈다
    (콤보의 다중 → 단일 전환과 같은 규칙이다).
  */
  if (next === 'between') return Array.isArray(value) && value.length === RANGE_ARITY ? value : [];
  if (next === 'in') {
    const single = Array.isArray(value) ? (value[0] ?? '') : value;
    return single === '' ? [] : [single];
  }
  return Array.isArray(value) ? '' : value;
}

/** 다중 선택의 기본값 — <b>배열이면 그대로</b>다(screen/user/requirements.md 의 계정 상태가 셋을 준다). */
function asList(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  return value === '' ? [] : [value];
}

/** 단일 칸에 배열이 오면 <b>첫 원소</b>다 — 선언 실수이며 조용히 문자열로 접는다. */
function asSingle(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function defaults(fields: SearchField[], systemRange: SystemRange): Record<string, FieldState> {
  const state: Record<string, FieldState> = {};
  for (const field of fields) {
    const op = defaultOpOf(field);
    if (op === 'between') {
      /*
        <b>빈 문자열이 *비워 둔다* 다</b>(2026-08-30 — screen/user/requirements.md). 기간을 미리 채우는 것은
        <b>기간이 부하의 상한인 화면</b>의 규약이고(screen/log/access/requirements.md), 사용자 목록의 *최종 로그인*
        처럼 <b>선택 필터</b>인 칸에서는 그것이 <i>한 번도 로그인하지 않은 계정을 첫
        조회에서 통째로 빼는</i> 일이 된다.
      */
      const empty = field.defaultValue === '';
      state[field.field] = { op, value: empty ? [] : recentRange(field, systemRange) };
      continue;
    }
    const value = field.defaultValue ?? '';
    state[field.field] = { op, value: op === 'in' ? asList(value) : asSingle(value) };
  }
  return state;
}

/**
 * <b>최근 N일</b> — 절대값이 아니라 <i>지금부터</i> 다(frontend/search-form.md).
 *
 * <p>{@code defaults} 가 폼을 열 때와 초기화할 때 다시 부르므로, 저장된 조건도
 * <b>열 때마다 최근 N일</b>이 된다 — 절대값으로 굳으면 <i>내일 열었을 때 어제 것</i> 이
 * 나오고 그것이 저장된 조건의 가장 흔한 배신이다.
 *
 * <p><b>화면이 {@code rangeDays} 를 적지 않으면 시스템 층이다</b>({@code ui.search.range-days
 * .default-days}). 여기에 상수를 두면 <i>시스템 기본값</i> 이라고 문서가 적은 화면이
 * 그것과 다른 기간으로 열린다 — 상한이 이미 시스템 층을 보고 있고(그 아래 {@code issueOf}),
 * 기본값만 다른 층에서 오면 <b>같은 설정의 두 반쪽이 서로 다른 원본</b>을 갖는다.
 */
function recentRange(field: SearchField, systemRange: SystemRange): string[] {
  const days = field.rangeDays?.default ?? systemRange.defaultDays;
  const now = dayjs();
  /*
    **기본값도 정밀도를 따른다**(2026-09-02 — 실기동에서 드러났다). 이 함수가 만드는 값이
    곧 **첫 조회의 조건**이라, 그리는 쪽만 고치고 여기를 두면 화면은 날짜만 보이는데
    **보내는 것은 시각**이다 — `DATE` 컬럼이 그 값을 못 읽어 첫 조회가 400 이고, 화면에는
    빈 목록으로만 나타난다.
  */
  return [wire(now.subtract(days, 'day'), field), wire(now, field)];
}

/** 정밀도가 정하는 와이어 형식 — 그리는 쪽({@code toWire})과 같은 규칙이다. */
function wire(value: Dayjs, field: SearchField): string {
  const precision = field.precision ?? 'second';
  if (precision === 'second') {
    return value.toISOString();
  }
  return value.format(precision === 'month' ? MONTH_WIRE : DAY_WIRE);
}

/**
 * 조회를 막는 것 둘 — screen/log/access/requirements.md.
 *
 * <p><b>기간의 상한은 두 층 중 좁은 쪽</b>이다. 화면이 32를 적어도 시스템이 31이면 31이며,
 * 화면 층은 <i>더 좁게</i> 만 갈 수 있다 — 넓히는 쪽으로 덮을 수 있으면 화면 하나가
 * 시스템 상한을 무력화한다.
 */
function issueOf(
  field: SearchField,
  current: FieldState,
  systemRange: SystemRange,
): string | null {
  const empty = Array.isArray(current.value)
    ? current.value.length === 0
    : current.value.trim() === '';

  if (field.required && takesValue(current.op) && empty) {
    return label(MSG.SEARCH_REQUIRED);
  }
  if (current.op !== 'between' || empty) return null;

  const pair = Array.isArray(current.value) ? current.value : [];
  if (pair.length !== RANGE_ARITY) return label(MSG.SEARCH_REQUIRED);

  const maxDays = Math.min(field.rangeDays?.max ?? systemRange.maxDays, systemRange.maxDays);
  return dayjs(pair[1]).diff(dayjs(pair[0]), 'day') > maxDays
    ? label(MSG.SEARCH_RANGE_TOO_WIDE, { days: maxDays })
    : null;
}

/**
 * 저장된 값을 폼에 되돌린다 — frontend/search-form.md. <b>맞지 않는 것은 조용히 버린다.</b>
 *
 * <p>여기는 sys/INDEX.md 의 <i>실패가 시끄러운 쪽을 택한다</i> 와 방향이 다르다. <b>개인 편의
 * 기능</b>이며, 배포마다 <i>"저장한 조건 3개가 무효입니다"</i> 를 띄우면 사용자가 고칠 수
 * 없는 경고가 반복된다.
 */
function restore(
  fields: SearchField[],
  values: SavedCondValues,
  systemRange: SystemRange,
): Record<string, FieldState> {
  const state = defaults(fields, systemRange);

  for (const field of fields) {
    // 저장된 뒤 <b>새로 생긴 칸</b>은 여기에 없다 — 기본값이 들어간다(§5.2 의 뒷면이다).
    const saved = values[field.field];
    if (!saved) continue;

    const base = state[field.field];
    // 저장된 연산자가 후보에서 빠졌으면 기본으로 되돌린다 — 값은 아래 이동 규칙을 탄다.
    const op = saved.op && opsOf(field).includes(saved.op) ? saved.op : base.op;
    const value = saved.value === undefined ? base.value : saved.value;

    /*
      `type` 이나 `op` 가 바뀌면 모양이 어긋난다 — <b>배열인 것은 `in` 과 `between` 둘</b>
      이고 나머지는 문자열이다.

      {@code between} 을 빠뜨리고 있었다(2026-08-31). 저장된 기간은 배열인데 문자열만
      맞는 것으로 봐서 <b>조용히 버려졌고</b>, 저장한 조건을 다시 열면 그 칸만 비어 있었다 —
      *"맞지 않는 것은 조용히 버린다"* 는 규칙(§5.3)이 <b>맞는 것까지</b> 버리고 있었다.
    */
    const wantsList = op === 'in' || op === 'between';
    const fits = wantsList ? Array.isArray(value) : typeof value === 'string';
    const restored = fits ? value : moveValue('', op);
    /*
      <b>값이 버려졌으면 표시값도 함께 버린다.</b> 남기면 칸에 이름이 보이는데 조건에는
      아무것도 실리지 않아, 사용자는 <i>걸어 둔 조건이 안 먹는다</i> 를 겪는다.
    */
    state[field.field] = {
      op,
      value: restored,
      text: restored === value ? saved.text : undefined,
    };
  }

  return state;
}

function sameValue(left: FieldValue, right: FieldValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => item === right[index]);
  }
  return left === right;
}
