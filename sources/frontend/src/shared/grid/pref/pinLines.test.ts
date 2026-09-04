import { describe, expect, it } from 'vitest';
import {
  LEFT_LINE,
  RIGHT_LINE,
  linesOf,
  normalize,
  parseSequence,
  pinnedAt,
  sequenceOf,
} from '@/shared/grid/pref/pinLines';
import type { ColumnDef } from '@/shared/grid/types';

interface Row {
  a: string;
}

const col = (field: string, pinned?: 'left' | 'right'): ColumnDef<Row> => ({
  field,
  header: field,
  type: 'text',
  pinned,
});

/**
 * 틀고정 경계선 — frontend/grid.md.
 *
 * <p><b>고정은 컬럼의 속성이 아니라 자리의 결과다.</b> 그 뒤집힘이 이 파일의 전부이며,
 * 잘못되면 <b>고정 아닌 컬럼이 고정 구역에 섞인다</b> — 화면은 그려지고 저장도 되므로
 * 스크롤해 보기 전에는 드러나지 않는다.
 */
describe('틀고정 경계선', () => {
  it('고정된 컬럼을 양끝으로 모은다 — 가운데에 고정이 붙은 자리는 그리드에 없다', () => {
    const columns = [col('a'), col('b', 'left'), col('c', 'right'), col('d')];

    expect(normalize(columns).map((column) => column.field)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('아무것도 고정이 아니면 위 선은 맨 위, 아래 선은 맨 아래다', () => {
    const rows = [col('a'), col('b')];

    expect(linesOf(rows)).toEqual({ left: 0, right: 2 });
    expect(sequenceOf(['a', 'b'], 0, 2)).toEqual([LEFT_LINE, 'a', 'b', RIGHT_LINE]);
  });

  it('선 자리가 곧 고정이다 — 위 선 위가 왼쪽, 아래 선 아래가 오른쪽', () => {
    expect(pinnedAt(0, 1, 2)).toBe('left');
    expect(pinnedAt(1, 1, 2)).toBeUndefined();
    expect(pinnedAt(2, 1, 2)).toBe('right');
  });

  it('둘이 같은 자리에 있으면 위 선이 먼저다 — 순서가 뒤집히면 뜻이 뒤집힌다', () => {
    expect(sequenceOf(['a'], 1, 1)).toEqual(['a', LEFT_LINE, RIGHT_LINE]);
  });

  describe('위 선이 아래 선을 넘지 못한다', () => {
    it('위 선을 아래로 끌면 아래 선에서 멈춘다', () => {
      // ['a', LEFT, 'b', RIGHT] — 위 선이 아래 선 뒤로 갔다.
      const moved = ['a', 'b', RIGHT_LINE, LEFT_LINE];

      expect(parseSequence(moved, LEFT_LINE)).toEqual({ fields: ['a', 'b'], left: 2, right: 2 });
    });

    it('아래 선을 위로 끌면 위 선에서 멈춘다', () => {
      const moved = [RIGHT_LINE, 'a', LEFT_LINE, 'b'];

      expect(parseSequence(moved, RIGHT_LINE)).toEqual({ fields: ['a', 'b'], left: 1, right: 1 });
    });

    it('멈추는 것은 <b>끌던 쪽</b>이다 — 반대로 하면 건드리지 않은 선이 따라 움직인다', () => {
      const moved = [RIGHT_LINE, 'a', LEFT_LINE, 'b'];

      // 같은 배열인데 끌던 것이 다르면 답도 다르다.
      expect(parseSequence(moved, LEFT_LINE).left).toBe(0);
      expect(parseSequence(moved, RIGHT_LINE).right).toBe(1);
    });
  });

  it('컬럼을 선 위로 끌면 그 컬럼이 고정된다 — 자리가 곧 결정이다', () => {
    const moved = ['b', LEFT_LINE, 'a', RIGHT_LINE];
    const parsed = parseSequence(moved, 'b');

    expect(parsed).toEqual({ fields: ['b', 'a'], left: 1, right: 2 });
    expect(pinnedAt(0, parsed.left, parsed.right)).toBe('left');
  });
});
