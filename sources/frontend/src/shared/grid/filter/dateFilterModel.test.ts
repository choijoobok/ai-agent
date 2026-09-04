import { describe, expect, it } from 'vitest';
import {
  passesDateFilter,
  toDateModel,
  type DateFilterModel,
} from '@/shared/grid/filter/dateFilterModel';

/**
 * 날짜 필터의 판정 — frontend/grid.md · playbook/INDEX.md.
 *
 * <p><b>날짜 문자열에 오프셋을 적지 않는다.</b> 적으면 {@code startOf('day')} 가 <b>러너의
 * 시간대</b>에서 잘리므로 같은 테스트가 서울에서는 통과하고 UTC CI 에서는 죽는다 —
 * 그리고 그 실패는 <i>필터가 고장났다</i> 로 읽힌다. 오프셋이 없으면 값도 경계도 로컬이라
 * 어디서 돌려도 같은 답이 나오고, 검사하려는 사실(<b>경계를 칸으로 넓힌다</b>)은 그대로다.
 *
 * <p><b>여기서 깨지는 것은 전부 소리 없이 깨진다.</b> 경계가 한 칸 어긋나도 화면은 정상이고
 * 목록도 그럴듯하다 — 남는 것은 <i>분명히 있는데 안 나온다</i> 하나이며, 사용자는 그것을
 * 데이터가 없는 것으로 읽는다.
 *
 * <p>그래서 이 파일이 컴포넌트에서 갈라져 있다. 판의 필터는 그리드 안에서만 살아 있어
 * 컴포넌트째로는 이 경계들을 잴 수가 없다.
 */
describe('날짜 필터 판정', () => {
  const model = (from: string | null, to: string | null): DateFilterModel | null =>
    toDateModel(from, to);

  describe('끝 날짜의 하루', () => {
    /*
      <b>가장 흔한 어긋남이다.</b> 끝을 그냥 비교하면 27일까지로 고른 사람에게 27일
      09:12 의 행이 빠진다 — 그 날 자정만 걸리기 때문이며, 목록에는 아무 표시도 없다.
    */
    it('끝 날짜 당일의 시각도 걸린다 — endOf 로 넓히지 않으면 그 날이 통째로 빠진다', () => {
      const filter = model(null, '2026-08-27T00:00:00');

      expect(passesDateFilter('2026-08-27T09:12:00', filter, 'day')).toBe(true);
      expect(passesDateFilter('2026-08-28T00:00:00', filter, 'day')).toBe(false);
    });

    it('시작 날짜 당일의 이른 시각도 걸린다 — startOf 로 내리지 않으면 첫 날이 빠진다', () => {
      const filter = model('2026-08-27T23:00:00', null);

      expect(passesDateFilter('2026-08-27T00:30:00', filter, 'day')).toBe(true);
      expect(passesDateFilter('2026-08-26T23:59:00', filter, 'day')).toBe(false);
    });
  });

  describe('정밀도가 칸의 크기를 정한다', () => {
    it('년월이면 그 달 전체가 한 칸이다 — 8월을 골랐는데 8월 15일이 빠지면 안 된다', () => {
      const filter = model('2026-08-01T00:00:00', '2026-08-01T00:00:00');

      expect(passesDateFilter('2026-08-15T12:00:00', filter, 'month')).toBe(true);
      expect(passesDateFilter('2026-08-31T23:59:00', filter, 'month')).toBe(true);
      expect(passesDateFilter('2026-09-01T00:00:00', filter, 'month')).toBe(false);
    });

    it('같은 값이라도 정밀도가 일이면 그 하루뿐이다 — 축이 다르다', () => {
      const filter = model('2026-08-01T00:00:00', '2026-08-01T00:00:00');

      expect(passesDateFilter('2026-08-15T12:00:00', filter, 'day')).toBe(false);
      expect(passesDateFilter('2026-08-01T18:00:00', filter, 'day')).toBe(true);
    });

    it('초 정밀도는 그 초 안이다 — 밀리초까지 넓힌다', () => {
      const filter = model('2026-08-27T09:12:30', '2026-08-27T09:12:30');

      expect(passesDateFilter('2026-08-27T09:12:30.900', filter, 'second')).toBe(true);
      expect(passesDateFilter('2026-08-27T09:12:31.000', filter, 'second')).toBe(false);
    });
  });

  describe('단측 · 없음', () => {
    it('한쪽만 채우면 반대쪽은 열려 있다', () => {
      expect(passesDateFilter('2099-01-01T00:00:00', model('2026-08-01T00:00:00', null), 'day')).toBe(true);
      expect(passesDateFilter('1999-01-01T00:00:00', model(null, '2026-08-01T00:00:00'), 'day')).toBe(true);
    });

    it('둘 다 비면 필터가 아니다 — 걸리지 않은 필터를 푸터가 셈하면 안 된다', () => {
      expect(toDateModel(null, null)).toBeNull();
      expect(passesDateFilter('2026-08-27T00:00:00', null, 'day')).toBe(true);
    });
  });

  describe('값이 없거나 읽히지 않는 행', () => {
    /*
      <b>통과시키지 않는다.</b> 필터는 좁히는 것이고 날짜 없는 행은 어느 범위에도 들지
      않는다 — 남겨 두면 <i>8월만 보기</i> 를 누른 목록이 무엇인지 말할 수 없게 된다.
    */
    it('빈 값은 걸리지 않는다', () => {
      const filter = model('2026-08-01T00:00:00', null);

      expect(passesDateFilter(null, filter, 'day')).toBe(false);
      expect(passesDateFilter('', filter, 'day')).toBe(false);
      expect(passesDateFilter({}, filter, 'day')).toBe(false);
    });

    it('필터가 없으면 빈 값도 남는다 — 거르지 않는 것이 거르지 않는 것이다', () => {
      expect(passesDateFilter(null, null, 'day')).toBe(true);
    });
  });
});
