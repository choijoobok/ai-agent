import { describe, expect, it } from 'vitest';
import { cellValue } from '@/shared/grid/excel/workbook';
import type { ColumnDef } from '@/shared/grid/types';

interface Row {
  code: string;
  count: number;
  used: boolean;
  tags: string[];
  memo: string | null;
  ref: { id: string } | null;
}

/**
 * 엑셀 셀 하나의 글자 — frontend/grid.md · playbook/excel-download.md.
 *
 * <p><b>파일에는 화면에 보이는 것이 들어간다.</b> 코드값 대신 이름, 배열 대신 사람이 읽는
 * 나열이다 — *"화면의 이름이 파일에서는 코드"* 는 그 자체로 문의가 된다.
 *
 * <p>이 규칙을 판(AG Grid)의 렌더러가 아니라 여기서 만드는 이유는 <b>전체 다운로드에는
 * 판이 없기</b> 때문이다. 거기서만 다른 규칙을 쓰면 같은 컬럼이 두 파일에서 다르게 나온다.
 */
describe('엑셀 셀 값', () => {
  const row: Row = {
    code: 'NONE',
    count: 3,
    used: true,
    tags: ['a', 'b'],
    memo: null,
    ref: { id: 'x' },
  };

  const of = (column: ColumnDef<Row>) => cellValue(column, row);

  it('코드는 이름으로 나간다 — 파일에서만 코드값이면 그것이 문의가 된다', () => {
    expect(of({
      field: 'code',
      header: 'h',
      type: 'code',
      options: [{ value: 'NONE', text: '미사용' }],
    })).toBe('미사용');
  });

  it('목록에 없는 코드는 값 그대로다 — 빈 칸으로 떨어뜨리면 무엇이 있었는지 사라진다', () => {
    expect(of({ field: 'code', header: 'h', type: 'code', options: [] })).toBe('NONE');
  });

  it('숫자는 숫자로 나간다 — 문자열로 넣으면 엑셀에서 합계가 안 된다', () => {
    expect(of({ field: 'count', header: 'h', type: 'number' })).toBe(3);
  });

  it('스위치는 Y · N 이다 — true 를 그대로 넣으면 TRUE 가 찍힌다', () => {
    expect(of({ field: 'used', header: 'h', type: 'ynFlag' })).toBe('Y');
  });

  it('배열은 한 칸에 나열한다 — frontend/grid.md 의 list 컬럼', () => {
    expect(of({ field: 'tags', header: 'h', type: 'list' })).toBe('a, b');
  });

  it('없는 값은 빈 칸이다 — null 을 글자로 만들면 파일에 null 이 찍힌다', () => {
    expect(of({ field: 'memo', header: 'h', type: 'text' })).toBeNull();
  });

  it('객체도 빈 칸이다 — [object Object] 를 파일에 넣지 않는다(frontend/grid.md)', () => {
    expect(of({ field: 'ref', header: 'h', type: 'text' })).toBeNull();
  });

  it('파생 컬럼은 계산한 값이다 — 저장된 값이 아니다(frontend/grid.md)', () => {
    expect(of({
      field: 'ratio',
      header: 'h',
      type: 'text',
      derive: (data) => `${data.count}/5`,
    })).toBe('3/5');
  });
});
