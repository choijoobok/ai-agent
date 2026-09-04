import { describe, expect, it } from 'vitest';
import { auditColumns } from '@/shared/grid/auditColumns';

/**
 * 감사 넷 — 40 §4.2 · grid-column-contract.md §2.1.
 *
 * <p>열두 화면이 각자 적던 것을 한 자리로 모은 뒤(2026-09-02), <b>모으기 전에 벌어져 있던
 * 축 셋</b>을 여기서 고정한다 — 순서 · 켤 수 있는 숨김인지 · 정렬이 어느 칸에 붙는지.
 */
describe('감사 넷', () => {
  it('넷의 순서가 고정이다 — 화면마다 다르면 같은 컬럼이 다른 자리에 뜬다', () => {
    expect(auditColumns().map((column) => column.field)).toEqual([
      'regId',
      'regDtm',
      'modId',
      'modDtm',
    ]);
  });

  it('기본은 켤 수 있는 숨김이다 — `hidden` 이 아니다', () => {
    for (const column of auditColumns()) {
      expect(column.visible).toBe(false);
      expect(column.hidden).toBeUndefined();
    }
  });

  it('`hidden` 을 주면 설정 창 목록에서도 빠진다 — `visible` 을 싣지 않는다', () => {
    for (const column of auditColumns({ hidden: true })) {
      expect(column.hidden).toBe(true);
      expect(column.visible).toBeUndefined();
    }
  });

  it('정렬은 일시 두 칸에만 붙는다 — 아이디로 정렬할 일이 없다', () => {
    const sortable = auditColumns({ sortable: true })
      .filter((column) => column.sortable)
      .map((column) => column.field);
    expect(sortable).toEqual(['regDtm', 'modDtm']);
  });

  it('폭이 언제나 실린다 — 없으면 켠 순간 화면마다 다른 폭이 된다', () => {
    expect(auditColumns().map((column) => column.width)).toEqual([120, 160, 120, 160]);
  });
});
