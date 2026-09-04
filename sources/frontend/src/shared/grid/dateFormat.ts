import dayjs from 'dayjs';
import { useAuthStore } from '@/shared/stores/authStore';

/**
 * 날짜 계열의 <b>정밀도와 표시 형식</b> — frontend/grid.md.
 *
 * <p><b>타입은 값의 형태이고 정밀도는 자릿수다.</b> 타입 이름이 이미 둘을 섞고 있어
 * (`date` vs `dateTime`) 년월만 자리가 없었다 — {@link DatePrecision} 이 그 축을 밖으로 뺀다.
 *
 * <h2>형식 문자열은 시스템 설정이 정한다</h2>
 *
 * <p>기본은 <b>ISO</b>({@link ISO_DATE_FORMAT})이고 시스템 설정({@code ui.date-format.*})이
 * 덮는다 — 년월일 구분자를 {@code .}·{@code /} 로 쓰는 조직이 있고, 그것을 <b>화면마다
 * 고치게 두면</b> 같은 앱 안에서 날짜가 두 모양으로 보인다.
 *
 * <p><b>시간대는 설정이 아니다.</b> 서버가 주는 것은 오프셋을 포함한 ISO-8601 이고
 * (backend/packages.md) {@code dayjs} 가 <b>브라우저의 시간대</b>로 옮긴다 — 읽는 사람이 기대하는 것은
 * 자기 시각이며, 그것을 설정으로 두면 <i>같은 화면을 서울과 하노이에서 볼 때</i> 둘 중
 * 하나가 틀린다.
 *
 * <p><b>값은 바꾸지 않는다</b>(frontend/grid.md) — 바뀌는 것은 표시뿐이고 엑셀과 조건은 원본을 쓴다.
 */

/** frontend/grid.md 의 표 — 셋이다. */
export type DatePrecision = 'month' | 'day' | 'second';

/**
 * 형식의 기본값 — <b>ISO 를 따른다</b>.
 *
 * <p>시스템 설정이 값을 주지 못했을 때(옛 서버 · 세션 복원 전)의 자리다. 여기에 조직의
 * 관례를 적으면 <b>설정을 비운 배포가 그 관례를 물려받는다</b>.
 */
export const ISO_DATE_FORMAT: Record<DatePrecision, string> = {
  month: 'YYYY-MM',
  day: 'YYYY-MM-DD',
  second: 'YYYY-MM-DD HH:mm:ss',
};

/**
 * 지금 쓸 형식 문자열.
 *
 * <p><b>훅이 아니다.</b> 부르는 자리가 컬럼 어댑터(`columnDefs`)라 렌더 밖이며, 값은
 * 로그인 응답이 나른 뒤 세션 내내 바뀌지 않는다 — `label()` 이 메시지 스토어를 읽는 것과
 * 같은 자리다.
 */
export function datePattern(precision: DatePrecision): string {
  const configured = useAuthStore.getState().dateFormat[precision];
  // 빈 문자열은 <b>설정하지 않은 것</b>이다 — 그것으로 포맷하면 셀이 통째로 빈다.
  return configured === '' ? ISO_DATE_FORMAT[precision] : configured;
}

/**
 * 컬럼이 쓸 정밀도 — 선언이 없으면 <b>타입의 기본</b>이다(frontend/grid.md).
 *
 * <p>{@code date} 는 일, {@code dateTime} 은 초다. 년월은 타입으로 표현되지 않으므로
 * <b>선언해야</b> 나온다.
 */
export function precisionOf(
  type: 'date' | 'dateTime',
  declared: DatePrecision | undefined,
): DatePrecision {
  return declared ?? (type === 'date' ? 'day' : 'second');
}

/**
 * 값 → <b>보이는 글자</b>.
 *
 * <p><b>읽히지 않으면 원본을 낸다</b> — 화면이 값을 삼키는 것이 가장 나쁘다. 값이 없으면
 * 빈 칸이며 {@code 1970-01-01} 을 그리지 않는다.
 */
export function dateText(value: unknown, precision: DatePrecision): string {
  if (value === null || value === undefined || value === '') return '';
  const moment = dayjs(value as string);
  if (moment.isValid()) return moment.format(datePattern(precision));
  /*
    <b>원본을 낸다 — 스칼라일 때만.</b> 객체를 그대로 이으면 셀에 `[object Object]` 가
    박히는데, 그것은 값을 삼키는 것보다 나쁘다(고장을 값으로 보이게 한다).
  */
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
