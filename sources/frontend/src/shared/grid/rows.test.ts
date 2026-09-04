import { describe, expect, it } from 'vitest';
import {
  addRow,
  changedRows,
  countChanges,
  editRow,
  hasChanges,
  toRows,
  toggleDelete,
  type GridRow,
} from '@/shared/grid/rows';

interface Row {
  id: string;
  name: string;
}

/**
 * 행 상태 넷과 전이 — grid-standard.md §3.2 · §3.3 · §3.4.
 *
 * <p><b>여기서 지키는 것은 "한 행은 상태 하나" 다.</b> 그 규칙이 깨지면 저장 페이로드가
 * 거짓을 말한다 — 서버에 없는 행을 지우라고 보내거나, 0건을 갱신하는 {@code UPDATE} 가
 * 나간다. 둘 다 서버가 판단할 문제가 아니라 <b>화면이 만들지 말아야 할 상태</b>다.
 */
describe('그리드 행 상태', () => {
  const seed = (): GridRow<Row>[] => toRows([
    { id: 'a', name: '가' },
    { id: 'b', name: '나' },
  ]);

  it('조회된 행은 무변경이고 원본을 들고 있다', () => {
    const rows = seed();
    expect(rows.map((row) => row.state)).toEqual([null, null]);
    expect(rows[0].original).toEqual(rows[0].data);
    expect(hasChanges(rows)).toBe(false);
  });

  it('새 행은 맨 위에 붙는다 — 아래에 붙이면 스크롤해야 보인다', () => {
    const rows = addRow(seed(), { id: '', name: '' });
    expect(rows[0].state).toBe('C');
    expect(rows).toHaveLength(3);
    expect(rows[1].data.id).toBe('a');
  });

  it('저장된 행을 고치면 수정이다', () => {
    const rows = seed();
    expect(editRow(rows, rows[0].id, { name: '다' })[0].state).toBe('U');
  });

  /*
    2026-08-31 실물 — 고친 값을 손으로 다시 원래대로 돌려놓아도 U 가 남았다. 그 행은 저장
    대상에 들고, 확인 모달의 *수정 N건* 이 실제보다 많으며, 서버는 같은 값을 쓰는 UPDATE 를
    한 번 낸다. 사용자에게는 "되돌렸는데 표시가 안 사라진다" 로 보인다.
  */
  it('원본과 같아지면 무변경으로 돌아간다 — 고쳤다는 사실을 따로 기억하지 않는다', () => {
    const rows = seed();
    const edited = editRow(rows, rows[0].id, { name: '다' });
    expect(edited[0].state).toBe('U');

    const back = editRow(edited, rows[0].id, { name: '가' });
    expect(back[0].state).toBeNull();
    expect(hasChanges(back)).toBe(false);
  });

  it('한 칸만 되돌리면 수정이 남는다 — 나머지가 아직 다르다', () => {
    const rows = seed();
    const edited = editRow(rows, rows[0].id, { id: 'x', name: '다' });
    const back = editRow(edited, rows[0].id, { name: '가' });

    expect(back[0].state).toBe('U');
    expect(back[0].data.id).toBe('x');
  });

  /*
    참조 비교로는 이 칸이 영영 "바뀐 것" 이 된다 — 동적 컬럼의 patch 가 맵을 새로
    만들어 쓰기 때문이다(grid-column-contract.md §2.2 의 refs). sameData 가 직렬화로 비교하는 이유다.
  */
  it('맵을 새로 만들어 쓰는 칸도 내용으로 비교한다 — 동적 컬럼(grid-column-contract.md §2.2)', () => {
    const rows = toRows([{ id: 'a', name: '가', refs: { PARENT: 'p1' } }]);
    const edited = editRow(rows, rows[0].id, { refs: { PARENT: 'p2' } });
    expect(edited[0].state).toBe('U');

    const back = editRow(edited, rows[0].id, { refs: { PARENT: 'p1' } });
    expect(back[0].state).toBeNull();
  });

  it('신규 행은 끝까지 신규다 — 고쳐도 수정으로 바뀌지 않는다', () => {
    const rows = addRow(seed(), { id: '', name: '' });
    const edited = editRow(rows, rows[0].id, { name: '라' });
    // 수정으로 바뀌면 저장 시 UPDATE 가 나가 0건이 갱신된다.
    expect(edited[0].state).toBe('C');
    expect(edited[0].data.name).toBe('라');
  });

  it('신규 행의 삭제는 즉시 제거다 — 삭제 상태로 두지 않는다', () => {
    const rows = addRow(seed(), { id: '', name: '' });
    const after = toggleDelete(rows, rows[0].id);
    // 남겨 두면 "존재한 적 없는 행을 지우라고" 보내게 된다.
    expect(after).toHaveLength(2);
    expect(after.some((row) => row.state === 'C')).toBe(false);
  });

  it('삭제 상태의 행은 셀 편집이 막힌다', () => {
    const rows = seed();
    const deleted = toggleDelete(rows, rows[0].id);
    const after = editRow(deleted, rows[0].id, { name: '마' });

    // 지울 행을 고치는 것은 의미가 없다 — 상태도 값도 그대로다.
    expect(after[0].state).toBe('D');
    expect(after[0].data.name).toBe('가');
  });

  it('삭제를 되돌리면 무변경이며 값도 함께 되돌아간다', () => {
    const rows = seed();
    const edited = editRow(rows, rows[0].id, { name: '바' });
    const deleted = toggleDelete(edited, rows[0].id);
    const restored = toggleDelete(deleted, rows[0].id);

    // 수정으로 돌아가는 것이 아니라 무변경이다 — 부분적으로 되돌리면 무엇이 남았는지
    // 화면이 설명할 수 없다(grid-standard.md §3.2).
    expect(restored[0].state).toBeNull();
    expect(restored[0].data.name).toBe('가');
  });

  it('저장에 실리는 것은 상태가 붙은 행뿐이다', () => {
    const base = seed();
    const rows = toggleDelete(editRow(base, base[0].id, { name: '사' }), base[1].id);
    expect(changedRows(rows)).toHaveLength(2);
    expect(countChanges(rows)).toEqual({ added: 0, updated: 1, removed: 1, total: 2 });
  });
});
