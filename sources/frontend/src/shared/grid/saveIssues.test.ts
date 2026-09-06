import { describe, expect, it } from 'vitest';
import type { FieldError, RowError } from '@/shared/api';
import { toRows, type GridRow } from '@/shared/grid/rows';
import type { ColumnDef, GridIssue } from '@/shared/grid/types';
import { collapse, entriesOfIssues, issueTable, serverIssues } from '@/shared/grid/saveIssues';

interface Row {
  code: string;
  kind: string;
  memo: string;
}

/**
 * 저장 실패를 <b>어느 셀</b>과 <b>무슨 값</b>으로 되돌리는 규칙 — frontend/grid.md ④.
 *
 * <p>여기서 잠그는 것은 셋이다. ① 순번을 믿을 수 없으면 <b>칠하지 않는다</b> — 틀린 행을
 * 칠하는 것이 안 칠하는 것보다 나쁘다. ② 복합 키는 <b>셀 둘</b>이 붉어진다. ③ 접기는
 * <i>값이 있으면 편다</i> 이며, 그것은 곧 <b>같은 줄을 한 번만</b> 낸다는 뜻이다.
 */
describe('저장 실패 표', () => {
  const columns: ColumnDef<Row>[] = [
    { field: 'code', header: '코드' },
    { field: 'kind', header: '구분' },
    { field: 'memo', header: '비고' },
  ];

  const rowsOf = (...data: Row[]): GridRow<Row>[] => toRows(data);
  const row = (code: string, kind = 'A', memo = ''): Row => ({ code, kind, memo });

  const failure = (index: number, ...fields: FieldError[]): RowError => ({ index, fields });

  describe('행을 되찾기 — 순번', () => {
    it('보낸 배열이 있으면 그 순번의 행을 칠한다', () => {
      const sent = rowsOf(row('A1'), row('A2'), row('A3'));
      const { issues } = serverIssues(
        [failure(1, { field: 'code', message: '이미 있습니다' })],
        [],
        sent,
        columns,
      );

      expect(issues).toEqual([{ rowId: sent[1].id, field: 'code', message: '이미 있습니다' }]);
    });

    it('순번을 믿을 수 없으면(sent === null) 칠하지 않는다 — 표는 그대로 낸다', () => {
      const { issues, entries } = serverIssues(
        [failure(1, { field: 'code', message: '이미 있습니다', value: 'A2' })],
        [],
        null,
        columns,
      );

      expect(issues).toEqual([]);
      expect(entries).toEqual([{ column: '코드', value: 'A2', message: '이미 있습니다' }]);
    });

    it('복합 키는 셀 둘이 함께 붉어진다', () => {
      const sent = rowsOf(row('A1', 'X'));
      const { issues } = serverIssues(
        [
          failure(
            0,
            { field: 'code', message: '이미 있는 조합입니다' },
            { field: 'kind', message: '이미 있는 조합입니다' },
          ),
        ],
        [],
        sent,
        columns,
      );

      expect(issues.map((issue) => issue.field)).toEqual(['code', 'kind']);
      expect(new Set(issues.map((issue) => issue.rowId))).toEqual(new Set([sent[0].id]));
    });

    it('판에 없는 컬럼을 가리키면 행만 표시한다 — 없는 칸은 칠할 수 없다', () => {
      const sent = rowsOf(row('A1'));
      const { issues, entries } = serverIssues(
        [failure(0, { field: 'hiddenKey', message: '규칙 위반입니다', value: 'zz' })],
        [],
        sent,
        columns,
      );

      expect(issues).toEqual([{ rowId: sent[0].id, field: undefined, message: '규칙 위반입니다' }]);
      // 컬럼을 못 찾으면 서버가 준 이름과 값을 그대로 싣는다 — 빈 칸보다 낫다.
      expect(entries).toEqual([{ column: 'hiddenKey', value: 'zz', message: '규칙 위반입니다' }]);
    });
  });

  describe('값 — 화면의 것이 먼저다', () => {
    it('행을 되찾았으면 사용자가 보고 있는 값을 쓴다', () => {
      const sent = rowsOf(row('A1'));
      const { entries } = serverIssues(
        [failure(0, { field: 'code', message: '이미 있습니다', value: '서버가 본 값' })],
        [],
        sent,
        columns,
      );

      expect(entries[0].value).toBe('A1');
    });

    it('행에 매이지 않은 필드 오류는 서버가 실어 보낸 값을 쓴다', () => {
      const { issues, entries } = serverIssues(
        [],
        [{ field: 'code', message: '이미 있습니다', value: 'A9' }],
        rowsOf(row('A1')),
        columns,
      );

      expect(issues).toEqual([]);
      expect(entries).toEqual([{ column: '코드', value: 'A9', message: '이미 있습니다' }]);
    });
  });

  describe('접기 — 값이 있으면 편다', () => {
    it('값이 다르면 행마다 한 줄이다 — 중복은 값 하나하나가 사건이다', () => {
      const entries = [
        { column: '코드', value: 'A1', message: '이미 있습니다' },
        { column: '코드', value: 'A2', message: '이미 있습니다' },
      ];

      expect(collapse(entries)).toHaveLength(2);
    });

    it('값이 비면 한 줄로 접힌다 — 규칙 하나를 고치면 다 낫는다', () => {
      const entries = [
        { column: '코드', value: '', message: '필수 항목입니다' },
        { column: '코드', value: '', message: '필수 항목입니다' },
        { column: '코드', value: '', message: '필수 항목입니다' },
      ];

      expect(collapse(entries)).toEqual([
        { column: '코드', value: '', message: '필수 항목입니다' },
      ]);
    });

    it('같은 값·같은 사유는 한 번만 — 붉은 셀이 둘 다 가리킨다', () => {
      const entries = [
        { column: '코드', value: 'A1', message: '이미 있습니다' },
        { column: '코드', value: 'A1', message: '이미 있습니다' },
      ];

      expect(collapse(entries)).toHaveLength(1);
    });

    it('같은 값이라도 컬럼이 다르면 갈린다', () => {
      const entries = [
        { column: '코드', value: 'A', message: '이미 있습니다' },
        { column: '구분', value: 'A', message: '이미 있습니다' },
      ];

      expect(collapse(entries)).toHaveLength(2);
    });
  });

  describe('선 색은 밖에서 들어온다', () => {
    /**
     * 하드코딩한 `rgba(0,0,0,…)` 이 <b>다크 모드에서 검정 위의 검정</b>이라 표가 줄 없는 글
     * 뭉치로 보였다. 색을 인자로 받게 고쳤고, 여기서 잠그는 것은 <b>그 값이 실제로
     * 선까지 닿는가</b> 다 — 인자만 받고 안 쓰면 조용히 예전으로 돌아간다.
     */
    const borders = (node: unknown): string[] => {
      const found: string[] = [];
      const walk = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach(walk);
          return;
        }
        const element = value as { props?: Record<string, unknown> };
        const style = element.props?.style as { borderBottom?: string } | undefined;
        if (style?.borderBottom) found.push(style.borderBottom);
        if (element.props?.children !== undefined) walk(element.props.children);
      };
      walk(node);
      return found;
    };

    it('머리와 행이 각자 받은 색을 쓴다', () => {
      const table = issueTable([{ column: '코드', value: 'A1', message: '이미 있습니다' }], {
        head: 'rgba(255,255,255,0.45)',
        row: '#424242',
      });
      const lines = borders(table);

      expect(lines.filter((line) => line.includes('rgba(255,255,255,0.45)'))).toHaveLength(3);
      expect(lines.filter((line) => line.includes('#424242'))).toHaveLength(3);
      // 검정을 박아 두면 다크 모드에서 사라진다 — 다시 들어오지 못하게 잠근다.
      expect(lines.some((line) => line.includes('rgba(0,0,0'))).toBe(false);
    });
  });

  describe('화면 검증 실패도 같은 표를 쓴다', () => {
    it('값은 그 행에서 읽는다', () => {
      const rows = rowsOf(row('A1', 'X'), row('A2', 'Y'));
      const issues: GridIssue[] = [
        { rowId: rows[1].id, field: 'kind', message: '허용되지 않은 구분입니다' },
      ];

      expect(entriesOfIssues(issues, rows, columns)).toEqual([
        { column: '구분', value: 'Y', message: '허용되지 않은 구분입니다' },
      ]);
    });

    it('컬럼이 없는 실패(그리드 검증)는 값 칸이 빈다 — 그래서 접힌다', () => {
      const rows = rowsOf(row('A1'), row('A2'));
      const issues: GridIssue[] = [
        { rowId: rows[0].id, message: '최소 한 건이 필요합니다' },
        { rowId: rows[1].id, message: '최소 한 건이 필요합니다' },
      ];

      expect(collapse(entriesOfIssues(issues, rows, columns))).toEqual([
        { column: '', value: '', message: '최소 한 건이 필요합니다' },
      ]);
    });
  });
});
