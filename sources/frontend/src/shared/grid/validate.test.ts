import { describe, expect, it } from 'vitest';
import { toRows, toggleDelete, type GridRow } from '@/shared/grid/rows';
import type { ColumnDef } from '@/shared/grid/types';
import { validateAll, validateCell } from '@/shared/grid/validate';

interface Row {
  code: string;
  name: string;
  memo: string;
}

/**
 * 두 시점, 세 층 — grid-edit-validation.md §3.
 *
 * <p>여기서 지키는 것은 <b>층이 실제로 갈려 있는가</b>다. 셋을 뭉치면 입력 시점에 저장
 * 규칙이 돌고, 그러면 사용자가 저장을 누르지도 않았는데 <i>"승인에 필요한 사유"</i> 를
 * 채우라는 말을 듣는다.
 */
describe('그리드 검증', () => {
  const columns: ColumnDef<Row>[] = [
    { field: 'code', header: 'x', editable: true, required: true },
    {
      field: 'name',
      header: 'x',
      editable: true,
      validate: (value) => (String(value).length > 3 ? '너무 깁니다' : null),
    },
    { field: 'memo', header: 'x' },
  ];

  const rowsOf = (...data: Row[]): GridRow<Row>[] => toRows(data);
  const row = (code: string, name = '가', memo = ''): Row => ({ code, name, memo });

  describe('1층 — 컬럼 공통', () => {
    it('필수 검사가 먼저다 — 값이 비면 validate 를 부르지 않는다', () => {
      let called = false;
      const column: ColumnDef<Row> = {
        field: 'code',
        header: 'x',
        editable: true,
        required: true,
        validate: () => {
          called = true;
          return null;
        },
      };
      expect(validateCell(column, '', row(''), { state: 'C' })).not.toBeNull();
      expect(called).toBe(false);
    });

    it('편집할 수 없는 칸은 필수가 아니다 — 채울 방법이 없다', () => {
      const locked: ColumnDef<Row> = { field: 'code', header: 'x', required: true };
      expect(validateCell(locked, '', row(''), { state: null })).toBeNull();
    });

    it('행마다 편집 가능이 갈리면 필수도 갈린다 — grid-edit-validation.md §2.1 의 ctx', () => {
      const pkOnNew: ColumnDef<Row> = {
        field: 'code',
        header: 'x',
        required: true,
        editable: (_data, ctx) => ctx.state === 'C',
      };
      expect(validateCell(pkOnNew, '', row(''), { state: 'C' })).not.toBeNull();
      // 저장된 행에서는 잠겨 있으므로 필수를 묻지 않는다.
      expect(validateCell(pkOnNew, '', row(''), { state: null })).toBeNull();
    });
  });

  describe('API 호출 전 — 세 층 전부', () => {
    it('컬럼 검증이 행마다 돈다', () => {
      const issues = validateAll(rowsOf(row('A', '가나다라')), columns);
      expect(issues).toHaveLength(1);
      expect(issues[0].field).toBe('name');
    });

    it('삭제 상태 행은 컬럼 검증에서 뺀다 — 지울 행의 값은 저장되지 않는다', () => {
      const rows = rowsOf(row('', '가나다라'));
      expect(validateAll(rows, columns)).not.toHaveLength(0);
      expect(validateAll(toggleDelete(rows, rows[0].id), columns)).toHaveLength(0);
    });

    it('hidden 컬럼은 검증 대상이 아니다 — 포커스를 줄 수 없다', () => {
      const hidden: ColumnDef<Row>[] = [
        { field: 'memo', header: 'x', hidden: true, editable: true, required: true },
      ];
      expect(validateAll(rowsOf(row('A')), hidden)).toHaveLength(0);
    });

    it('2층은 그 API 에서만 돈다', () => {
      const rows = rowsOf(row('A'));
      const perApi = { columns: { memo: () => '승인에는 사유가 필요합니다' } };

      // 같은 데이터가 1층만으로는 통과한다.
      expect(validateAll(rows, columns)).toHaveLength(0);
      expect(validateAll(rows, columns, perApi)).toHaveLength(1);
    });

    it('3층은 행을 종합한다 — 삭제 행을 뺀 결과로 계산한다', () => {
      const rows = rowsOf(row('A'), row('A'));
      const duplicates = {
        grid: (given: GridRow<Row>[]) => {
          const seen = new Set<string>();
          const issues = [];
          for (const candidate of given) {
            if (seen.has(candidate.data.code)) {
              issues.push({ rowId: candidate.id, field: 'code', message: '중복입니다' });
            }
            seen.add(candidate.data.code);
          }
          return issues;
        },
      };
      expect(validateAll(rows, columns, duplicates)).toHaveLength(1);

      // 둘 중 하나를 지우면 중복이 아니다 — 합계·중복은 저장 후의 모습을 물어야 한다.
      expect(validateAll(toggleDelete(rows, rows[1].id), columns, duplicates)).toHaveLength(0);
    });
  });
});
