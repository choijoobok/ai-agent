import { describe, expect, it } from 'vitest';
import {
  applyPref,
  settableColumns,
  signatureOf,
  toPrefValue,
  parsePref,
} from '@/shared/grid/pref/gridPref';
import type { ColumnDef } from '@/shared/grid/types';

interface Row {
  a: string;
  b: string;
  c: string;
}

/**
 * 그리드 개인화의 값 — UX-06 · UX-13 · grid-standard.md §5.
 *
 * <p>지키는 것 셋이다 — ① <b>시그니처는 선언에서만</b> 만든다, ② <b>목록에 없는 컬럼</b>이
 * 무엇인지, ③ <b>모르는 필드를 만나도 화면이 그려진다.</b>
 *
 * <p>①이 조용히 깨지는 종류다. 사용자가 바꾼 순서를 시그니처에 넣으면 <b>순서를 바꿀 때마다
 * 자기 설정이 자기를 폐기하고</b>, 사용자가 겪는 것은 *"설정이 저장되지 않는다"* 인데
 * 원인을 짐작할 수 없다.
 */
describe('그리드 개인화', () => {
  const columns: ColumnDef<Row>[] = [
    { field: 'a', header: 'A', type: 'text' },
    { field: 'b', header: 'B', type: 'text', visible: false },
    { field: 'c', header: 'C', type: 'text', hidden: true },
  ];

  it('목록에 hidden 은 없다 — 처음부터 없는 컬럼이다(grid-column-contract.md §2.1)', () => {
    expect(settableColumns(columns).map((column) => column.field)).toEqual(['a', 'b']);
  });

  it('visible: false 는 목록에 있다 — 켜는 유일한 자리가 여기다', () => {
    expect(settableColumns(columns).some((column) => column.field === 'b')).toBe(true);
  });

  /**
   * 동적 컬럼 — grid-column-contract.md §2.2 · ADR-0025.
   *
   * <p><b>시그니처가 특히 중요하다.</b> 그 집합은 *고른 그룹* 을 따라 바뀌므로, 넣으면
   * 그룹을 옮길 때마다 시그니처가 달라져 <b>자기 설정이 자기를 폐기한다</b> — 사용자가
   * 겪는 것은 *"설정이 저장되지 않는다"* 이고 원인을 짐작할 수 없다.
   */
  describe('동적 컬럼', () => {
    const withDynamic: ColumnDef<Row>[] = [
      ...columns,
      { field: 'ref.PARENT', header: '상위 창고', type: 'text', dynamic: true },
    ];

    it('설정 창 목록에 없다 — 끄거나 옮겨도 저장할 곳이 없다', () => {
      expect(settableColumns(withDynamic).map((column) => column.field)).toEqual(['a', 'b']);
    });

    it('시그니처를 바꾸지 않는다 — 그룹을 옮길 때마다 설정이 버려지면 안 된다', () => {
      expect(signatureOf(withDynamic)).toBe(signatureOf(columns));
    });

    it('저장 값에도 실리지 않는다 — 다음 그룹에서는 없는 컬럼이다', () => {
      expect(toPrefValue(withDynamic).columns.map((entry) => entry.field)).toEqual(['a', 'b']);
    });
  });

  describe('시그니처', () => {
    it('컬럼이 늘거나 줄면 달라진다 — 그때 저장된 설정을 폐기한다(UX-13)', () => {
      const more: ColumnDef<Row>[] = [...columns, { field: 'd', header: 'D', type: 'text' }];

      expect(signatureOf(more)).not.toBe(signatureOf(columns));
    });

    it('사용자가 순서를 바꿔도 같다 — 아니면 자기 설정이 자기를 폐기한다', () => {
      const reordered = [columns[1], columns[0], columns[2]];

      // 시그니처는 **선언**의 것이다. 여기 순서를 넣으면 저장이 성립하지 않는다.
      expect(signatureOf(reordered)).toBe(signatureOf(columns));
    });

    it('표시 여부를 꺼도 같다 — 목록이 바뀐 것이 아니다', () => {
      const off = columns.map((column) => ({ ...column, visible: false }));

      expect(signatureOf(off)).toBe(signatureOf(columns));
    });

    it('hidden 을 켜면 달라진다 — 목록이 바뀐다(grid-standard.md §5)', () => {
      const shown = columns.map((column) =>
        column.field === 'c' ? { ...column, hidden: false } : column);

      expect(signatureOf(shown)).not.toBe(signatureOf(columns));
    });
  });

  describe('입히기', () => {
    it('저장된 순서·표시·고정이 선언을 덮는다', () => {
      const applied = applyPref(columns, {
        columns: [
          { field: 'b', visible: true, pinned: 'left' },
          { field: 'a', visible: false, pinned: null },
        ],
      });

      expect(applied.map((column) => column.field)).toEqual(['b', 'a', 'c']);
      expect(applied[0].pinned).toBe('left');
      expect(applied[1].visible).toBe(false);
    });

    it('hidden 은 뒤에 남는다 — 목록에 없었으므로 순서에도 없다', () => {
      const applied = applyPref(columns, {
        columns: [{ field: 'a', visible: true, pinned: null }],
      });

      expect(applied.map((column) => column.field)).toEqual(['a', 'b', 'c']);
    });

    it('모르는 필드는 버린다 — 시그니처가 막지만 화면은 그려져야 한다', () => {
      const applied = applyPref(columns, {
        columns: [{ field: 'gone', visible: true, pinned: 'left' }],
      });

      expect(applied.map((column) => column.field)).toEqual(['a', 'b', 'c']);
    });

    it('저장된 것이 없으면 선언 그대로다', () => {
      expect(applyPref(columns, null)).toBe(columns);
    });
  });

  it('저장하는 값에 hidden 은 없다 — 서버가 들고 있어도 쓸 데가 없다', () => {
    expect(toPrefValue(columns).columns.map((entry) => entry.field)).toEqual(['a', 'b']);
  });

  it('깨진 JSON 은 없는 것으로 친다 — 배포마다 뜨는 경고는 고칠 수 없다', () => {
    expect(parsePref('{{{')).toBeNull();
    expect(parsePref('[]')).toBeNull();
  });
});
