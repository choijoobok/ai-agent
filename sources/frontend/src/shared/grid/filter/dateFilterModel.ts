import dayjs, { type Dayjs } from 'dayjs';
import type { DatePrecision } from '@/shared/grid/dateFormat';

/**
 * 날짜 필터의 <b>판정</b> — grid-column-contract.md §4.5 · 68 §9.8.
 *
 * <p>컴포넌트에서 갈라 둔 이유는 {@code setFilterModel} 과 같다: 판의 필터는 그리드
 * 안에서만 살아 있어 컴포넌트째로는 단위 테스트가 서지 않는데, <b>조용히 깨지는 것은
 * 판정</b>이다 — 경계가 하루 어긋나면 화면은 정상이고 <i>27일 것이 안 나온다</i> 만 남는다.
 *
 * <p><b>거르는 자리는 조회 결과 안이다</b>(grid-column-contract.md §4.1) — 서버로 보내지 않는다. 그래서 값이
 * 이미 손에 있고, 여기서 하는 일은 <b>지금 화면의 행을 좁히는 것</b>뿐이다.
 */

/**
 * 두 끝 — <b>한쪽만 채우면 단측</b>이다(68 §9.8).
 *
 * <p>둘 다 비면 모델이 아니라 {@code null} 이다({@link toDateModel}) — 걸리지 않은 필터를
 * 걸린 것으로 두면 푸터의 <i>N건 중 M건</i> 이 거짓말을 한다(grid-standard.md §2.3 · `set` 필터와 같다).
 */
export interface DateFilterModel {
  /** ISO-8601. {@code null} 이면 <b>아래쪽이 열려 있다</b>. */
  from: string | null;
  to: string | null;
}

/**
 * 정밀도 → dayjs 의 <b>버킷 단위</b>.
 *
 * <p>이 매핑 하나가 <i>경계를 어떻게 볼 것인가</i> 를 전부 정한다. 년월 컬럼에서 사용자가
 * 고르는 것은 <b>달</b>이므로 그 달의 첫날 0시부터 말일 23:59:59.999 까지가 한 칸이고,
 * 년월일 컬럼이면 하루가 한 칸이다 — <b>끝을 그냥 비교하면 마지막 칸이 통째로 빠진다</b>:
 * 8월을 고른 사람에게 8월 15일이 안 나오는 식이다.
 */
const UNIT: Record<DatePrecision, 'month' | 'day' | 'second'> = {
  month: 'month',
  day: 'day',
  second: 'second',
};

/** 읽히는 값만 시각이 된다 — 읽히지 않으면 {@code null} 이고, 그 행은 범위에 들지 않는다. */
function moment(value: unknown): Dayjs | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

/**
 * 이 셀이 <b>범위 안인가</b>.
 *
 * <p><b>값이 없는 행은 걸리지 않는다.</b> 필터는 좁히는 것이고, 날짜가 없는 행은 <i>어느
 * 날짜 범위에도 들지 않는다</i> — 통과시키면 <i>8월만 보기</i> 를 눌렀는데 날짜 없는 행이
 * 함께 남아, 그 목록이 무엇인지 말할 수 없게 된다.
 *
 * <p><b>두 끝을 각자의 칸으로 넓힌다</b>({@code startOf}·{@code endOf}). 그러지 않으면
 * 끝 날짜를 고른 사람에게 <b>그 날 하루가 통째로 빠진다</b> — 8월 27일까지로 골랐는데
 * 27일 09:12 의 행이 안 나오는 것이 그것이며, 이 종류의 어긋남은 화면에 아무 표시도
 * 남기지 않는다.
 */
export function passesDateFilter(
  value: unknown,
  model: DateFilterModel | null,
  precision: DatePrecision,
): boolean {
  if (!model || (model.from === null && model.to === null)) return true;

  const cell = moment(value);
  if (!cell) return false;

  const unit = UNIT[precision];
  const from = moment(model.from);
  const to = moment(model.to);

  if (from && cell.isBefore(from.startOf(unit))) return false;
  if (to && cell.isAfter(to.endOf(unit))) return false;
  return true;
}

/**
 * 고른 두 끝 → 모델. <b>둘 다 비면 필터가 아니다.</b>
 *
 * <p>{@code toModel}({@code set} 필터)과 같은 규칙이며 이유도 같다 — 빈 모델을 두면
 * 헤더에 필터 표시가 남고 푸터가 걸리지 않은 필터를 셈한다.
 */
export function toDateModel(from: string | null, to: string | null): DateFilterModel | null {
  if (from === null && to === null) return null;
  return { from, to };
}
