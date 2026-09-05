import type { DatePrecision } from '@/shared/grid/dateFormat';
import type { SelectOption } from '@/shared/grid/types';

/**
 * 검색 폼 필드 하나의 선언 — frontend/search-form.md.
 *
 * <p><b>어휘를 새로 만들지 않는다</b>(frontend/search-form.md) — {@code type} 은 frontend/grid.md 의 이름을 그대로 쓴다.
 * 같은 컬럼이 그리드에도 폼에도 나타나므로, 둘이 다른 이름을 쓰면 <b>화면 하나가 어휘 둘을</b>
 * 쓰게 된다.
 *
 * <p><b>구현된 것만 담는다</b> — {@code text}·{@code select}·{@code dateRange}·
 * {@code popupRef} 넷이다. 셋째는 사용 이력(screen/log/access/requirements.md)이 가져왔다(그 화면에서 <b>기간이
 * 필수 조건</b>이라 처음으로 날짜 칸이 필요해졌다). 넷째는 playbook/INDEX.md 가 가져왔다.
 *
 * <p><b>팝업은 그리드와 <i>같은 레지스트리</i>를 쓴다</b>(playbook/INDEX.md) — 두 벌을
 * 두면 같은 고객 팝업이 그리드에서는 다섯 컬럼이고 폼에서는 셋인 날이 온다.
 */

/**
 * backend/api.md 의 열둘 중 폼이 지금 낼 수 있는 것.
 *
 * <p><b>{@code in} 은 콤보에서만 난다</b> — 컨트롤이 <i>다중 선택</i> 이라야 값 여럿을
 * 받을 수 있고(frontend/search-form.md) 텍스트 칸에는 그 컨트롤이 없다. 텍스트의 {@code in} 은 태그 입력이
 * 필요하며 그것을 요구하는 화면이 아직 없다.
 *
 * <p><b>{@code between} 은 크기 계열의 첫 실물이다</b>(frontend/search-form.md 가 <i>"아직 목록에 없다"</i>
 * 고 적은 다섯 중 하나). {@code gte}·{@code lte} 가 뒤따랐고 남은 둘({@code gt}·{@code lt})은
 * 그것을 처음 요구하는 화면이 가져온다.
 */
export type SearchOp =
  | 'eq'
  | 'ne'
  | 'in'
  | 'startsWith'
  | 'contains'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull'
  | 'between'
  /**
   * 크기 계열의 <b>둘째 실물</b> — screen/batch/schedule/requirements.md 이 처음 요구했다.
   *
   * <p>*"10분 넘게 걸린 것"* 으로 좁힌 뒤 소요 정렬로 훑는 것이 배치 실행 이력의 성능
   * 진단 동선이며, 그 조건이 {@code >=} 다.
   */
  | 'gte'
  /**
   * 크기 계열의 <b>셋째 실물</b> — screen/user/requirements.md 의 기간 칸 둘이 처음 요구했다(2026-08-31).
   *
   * <p>기간 칸에서 <b>한쪽만 아는 조건</b>이 실제로 흔하다: *"이 날짜 이후로 한 번도 안
   * 들어온 계정"* 이 {@code lte} 이고 그 반대가 {@code gte} 다. 범위로 표현하려면 반대쪽
   * 끝에 <b>사람이 아무 값이나</b> 넣어야 하고, 그 값이 곧 조건이 된다.
   *
   * <p>남은 둘({@code gt}·{@code lt})이 playbook/INDEX.md 로 왔다 — 아래.
   */
  | 'lte'
  /**
   * 크기 계열의 <b>마지막 둘</b> — playbook/INDEX.md 가 가져왔다(2026-09-02).
   *
   * <p>이로써 backend/api.md 의 열셋이 <b>전부 열렸다</b>. 여는 근거는 frontend/search-form.md 그대로다 —
   * <i>쓰이지 않는 후보를 미리 열지 않는다</i> 이고, <b>쓰는 화면이 왔다</b>.
   *
   * <p><b>날짜의 우려는 남는다.</b> 위 {@code lte} 주석이 적은 <i>경계 하루</i> 문제는
   * 해결된 것이 아니라 <b>피한 것</b>이다: 샘플이 여는 자리는 숫자 칸(`ordAmt`)이며,
   * 거기서 <i>초과</i>·<i>미만</i> 은 사람이 잘못 읽을 여지가 없다. 기간 칸에 이 둘을
   * 다는 화면이 오면 그때 다시 본다 — 폼은 그리지만 <b>{@code DATE_RANGE_OPS} 기본에
   * 없다</b>(화면이 {@code ops} 로 명시해야 한다).
   */
  | 'gt'
  | 'lt';

export interface SearchField {
  field: string;
  /** 메시지 키. */
  label: string;
  type: 'text' | 'select' | 'dateRange' | 'popupRef';
  /**
   * 처음 선택된 연산자. 없으면 타입의 기본이다 — {@code text} 는 {@code contains},
   * {@code select} 는 {@code eq}(frontend/search-form.md).
   */
  op?: SearchOp;
  /**
   * 고를 수 있는 후보. <b>후보가 둘 이상일 때만 셀렉터가 나타난다</b> — 그래서 원소 하나가
   * 곧 고정이며 {@code fixed} 같은 플래그를 따로 두지 않는다(frontend/search-form.md).
   *
   * <p><b>고정은 성능이 근거일 때만 한다.</b> <i>"이 필드는 완전 일치가 자연스럽다"</i> 는
   * 근거가 아니다 — 그것은 {@code op} 기본값으로 표현한다.
   */
  ops?: SearchOp[];
  options?: SelectOption[];
  /**
   * 후보를 <b>공통코드에서</b> 받는다 — sys/code.md. `options` 를 함께 적으면 그쪽이 이긴다.
   *
   * <p>이것을 적은 칸은 <b>코드를 더하고 빼는 데 소스 변경이 따르지 않는다</b>. 반대로
   * 값에 따라 프로세스가 갈리는 코드는 소스가 값을 가져야 하며(sys/code.md 의 `ACTION_CD`),
   * 그런 칸은 `options` 에 상수를 적는다 — 둘을 가르는 것이 이 필드의 존재 이유다.
   */
  grpCd?: string;
  /**
   * 초기화는 <b>빈칸이 아니라 기본값</b>으로 되돌린다(frontend/search-form.md).
   *
   * <p><b>배열이면 다중 선택의 기본값</b>이다 — `op: 'in'` 인 콤보에서만 뜻이 있다.
   * screen/user/requirements.md 의 *계정 상태* 가 첫 실물이며 기본값이 **셋**이다(`정상`+`잠김`+`휴면` =
   * 사용중): 물리 삭제가 없어 미사용 계정이 영구 누적되므로, 전체가 기본이면 시간이
   * 갈수록 목록이 퇴사자로 채워진다. 문자열 하나를 주면 원소 하나짜리 배열이 된다.
   *
   * <p><b>`dateRange` 에서 빈 문자열은 *비워 둔다* 는 뜻이다</b>(2026-08-30 — screen/user/requirements.md).
   * 적지 않으면 시스템 기본 기간(`ui.search.range-days.default-days`)으로 채워지는데,
   * 그것은 **기간이 부하의 상한인 화면**의 규약이다([screen/log/access/requirements.md](../../../../../documents/screen/log/access/requirements.md)). 사용자 목록의
   * *최종 로그인* 은 그런 칸이 아니다 — 미리 채우면 <b>한 번도 로그인하지 않은 계정이
   * 첫 조회에서 통째로 빠진다</b>. 그 칸은 **선택 필터**이지 창이 아니다.
   */
  defaultValue?: string | string[];
  /**
   * 비우고 조회할 수 없다 — screen/log/access/requirements.md 가 처음 요구했다.
   *
   * <p><b>편의가 아니라 부하다.</b> 사용 이력에서 기간을 비우면 첫 조회가 보존 기간
   * 전량(90일)을 향하고, 그 테이블은 행마다 {@code nclob} 이 달려 있다. 그래서 서버도
   * 같은 것을 다시 본다 — <b>화면만 막으면 도구·스크립트가 그대로 지나간다</b>.
   */
  required?: boolean;
  /**
   * `dateRange` 칸이 <b>어느 단위로 묻는가</b> — frontend/grid.md 의 정밀도 셋이다.
   *
   * <p>없으면 `'second'` 다. 사용 이력·배치 이력이 그렇고, 그 화면들에서 *오늘* 이
   * 자정에서 끊기면 **방금 일어난 요청이 안 나온다**.
   *
   * <p>`'month'` 는 playbook/INDEX.md 의 납기월이 열었다. 그 컬럼은 DB 가 `VARCHAR(6)` 이고
   * (playbook/INDEX.md) 값도 **`202608` 문자열로 나간다** — ISO 시각을 보내면 서버의
   * `DLVR_YM` 비교가 언제나 빗나가고, 그 조건은 *걸었는데 0건* 이 된다.
   *
   * <p>`'day'` 는 시각을 묻지 않는 날짜 칸이다. 자정 경계 문제가 없는 컬럼
   * (`ORD_DT` 같은 `DATE`)에서 시각까지 고르게 하면 **사용자가 뜻 없는 값을 정한다**.
   */
  precision?: DatePrecision;
  /**
   * `dateRange` 의 <b>화면 층</b> — screen/log/access/requirements.md 의 두 층 중 아래.
   *
   * <p>없으면 시스템 값({@code ui.search.range-days.*})을 쓴다. <b>넓히는 쪽으로는 덮지
   * 못한다</b> — 화면이 32를 적어도 시스템이 31이면 31이다. 개인 설정 층이 없는 것은
   * 조회 기간이 <b>부하의 상한이지 취향이 아니기</b> 때문이다.
   */
  rangeDays?: { default: number; max: number };
  /**
   * <b>화면 단위 → 저장 단위</b>의 배수 — frontend/search-form.md.
   *
   * <p>`{ field: 'elapsedMs', op: 'gte', scale: 1000 }` 이면 <b>초로 받아 ms 로 보낸다</b>.
   * screen/batch/schedule/requirements.md 의 *소요 시간 이상* 이 첫 사례이며, 저장이 ms 인 것은 sys/batch.md 의 결정이다
   * (벤더별 시간 차 함수를 피한다) — 그렇다고 사람이 `600000` 을 입력하지는 않는다.
   *
   * <p><b>함수가 아니라 배수인 이유</b>: 비선형 변환이 필요해지면 그것은 단위가 아니라
   * <b>파생 조건</b>이며 서버가 갖는다(backend/api.md).
   *
   * <p><b>저장된 조건에는 화면 단위로 남는다</b> — 사용자가 입력한 값 그대로이며,
   * 곱하는 것은 <i>나가는 순간</i>이다. 저장된 값에 곱해 두면 다시 열 때 또 곱해진다.
   *
   * <p>숫자로 읽히지 않는 값에는 <b>손대지 않는다</b> — 조용히 버리면 <i>조건을 넣었는데
   * 안 걸렸다</i> 가 되고, 그 목록은 거르지 않은 것을 거른 것으로 읽힌다.
   */
  scale?: number;
  /**
   * 참조 팝업 — {@code type: 'popupRef'} 인 칸의 <b>레지스트리 키</b>다(playbook/INDEX.md).
   *
   * <p>그리드의 {@code ColumnDef.popup} 과 <b>모양이 다르다</b>. 거기는 {@code apply} 가
   * 여러 칸을 채우지만 여기서 나가는 것은 <b>조건 하나</b>이므로({@link popupValue} ·
   * {@link popupText}) 채울 칸이 없다 — 같은 객체를 쓰면 폼에서 쓸 수 없는 {@code apply}
   * 가 필수 키로 따라온다.
   */
  popup?: string;
  /**
   * 고른 행 → <b>보낼 값</b>. 없으면 조건에 담을 것이 없다.
   *
   * <p><b>키 하나뿐이다</b>(playbook/INDEX.md). 표시용 이름은 조건에 넣지 않는다 — 서버가 아는
   * 것은 키이고, 이름을 함께 보내면 <i>이름으로도 걸러 달라</i> 는 뜻이 되어 버린다.
   */
  popupValue?: (picked: Record<string, unknown>) => string;
  /**
   * 고른 행 → <b>칸에 보일 글자</b>. 없으면 값을 그대로 보인다.
   *
   * <p><b>표시값도 함께 저장된다</b>(playbook/INDEX.md · frontend/search-form.md) — 저장된 조회조건은 <i>와이어가
   * 아니라 폼 값</i> 이며, 키만 저장하면 다시 열었을 때 <b>빈 칸으로 보인다</b>: 조건은
   * 걸려 있는데 사용자는 무엇으로 걸렀는지 알 수 없다.
   */
  popupText?: (picked: Record<string, unknown>) => string;
}
