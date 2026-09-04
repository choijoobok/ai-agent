import { describe, expect, it } from 'vitest';
import { keyOf, toModel } from '@/shared/grid/filter/setFilterModel';

/**
 * `set` 필터의 판정 둘 — frontend/grid.md.
 *
 * <p><b>키 만들기</b>와 <b>전부 고른 상태</b>다. 둘 다 조용히 깨진다 — 키가 어긋나면
 * 체크는 되는데 아무것도 안 걸리고, 전부 고른 것을 필터로 두면 화면은 정상인데
 * 푸터가 <i>N건 중 M건</i> 을 계속 말한다.
 */
describe('set 필터', () => {
  describe('고르는 키', () => {
    it('스위치는 Y · N 이다 — 셀에 글자가 없어도 고를 이름은 있어야 한다', () => {
      expect(keyOf(true)).toBe('Y');
      expect(keyOf(false)).toBe('N');
    });

    it('없는 값도 키를 갖는다 — 빈 칸을 골라야 거를 수 있다', () => {
      expect(keyOf(null)).toBe('');
      expect(keyOf(undefined)).toBe('');
    });

    it('숫자는 글자로 — 코드값이 숫자인 목록이 있다', () => {
      expect(keyOf(3)).toBe('3');
    });

    it('객체는 빈 키다 — [object Object] 라는 항목을 목록에 만들지 않는다', () => {
      expect(keyOf({ id: 'x' })).toBe('');
    });
  });

  describe('전부 고른 상태', () => {
    it('전부 고르면 필터가 아니다 — 모델이 null 이다', () => {
      expect(toModel(['a', 'b'], 2)).toBeNull();
    });

    it('하나라도 빠지면 필터다', () => {
      expect(toModel(['a'], 2)).toEqual({ values: ['a'] });
    });

    it('아무것도 안 고른 것은 필터다 — 0건을 보겠다는 뜻이며 전체와 다르다', () => {
      // 여기서 null 로 접으면 *전부 해제* 가 *전체* 로 뒤집혀 되돌릴 방법이 없어진다.
      expect(toModel([], 2)).toEqual({ values: [] });
    });
  });
});
