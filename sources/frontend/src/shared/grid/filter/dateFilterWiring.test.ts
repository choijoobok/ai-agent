import { describe, expect, it } from 'vitest';
import { toColDefs } from '@/shared/grid/columnDefs';
import { DateFilter, type DateFilterParams } from '@/shared/grid/filter/DateFilter';
import { SetFilter } from '@/shared/grid/filter/SetFilter';
import type { ColumnDef } from '@/shared/grid/types';

interface Row {
  regDt: string;
  regDtm: string;
  statYm: string;
  memo: string;
  stat: string;
}

/**
 * 날짜 컬럼이 <b>우리 필터를 받는가</b> — frontend/grid.md · playbook/INDEX.md.
 *
 * <p>이 배선이 끊기면 판은 <b>아무 소리 없이 자기 텍스트 필터로 되돌아간다</b>. 사람이
 * {@code 2026-08-27} 을 손으로 치고, 형식이 틀리면 조용히 걸리지 않는다 — 필터를 걸었는데
 * 아무 일도 안 일어난 것처럼 보이며, 그것이 정확히 이 절이 없애려던 상태다.
 *
 * <h2>화면을 띄우지 않는 것이 결정이다</h2>
 *
 * <p>한동안 판을 실제로 띄워 팝업의 칸 둘을 눈으로 찾는 검사를 뒀다(2026-09-02). <b>전체
 * 스위트에서 흔들렸다</b> — 팝업이 떴다가 다음 조회 전에 닫히는 일이 나고, 첫 렌더가 15초
 * 상한을 넘기기도 했다. <b>흔들리는 검사는 없는 것보다 나쁘다</b>: 붉은 줄이 배선을
 * 말하는 것인지 기계가 느렸던 것인지 매번 사람이 확인해야 한다.
 *
 * <p>그래서 <b>조용히 깨지는 자리</b>만 남겼다 — 컴포넌트를 물려줬는가와
 * {@code filterParams} 의 모양이다. 팝업이 <i>어떻게 생겼는가</i> 는 {@code DateFilter} 의
 * 선언 몇 줄이고, 판정은 {@code dateFilterModel.test} 가 따로 잰다.
 */
describe('날짜 필터 배선', () => {
  const build = (column: ColumnDef<Row>) => {
    const defs = toColDefs<Row>({
      columns: [column],
      onEdit: () => undefined,
      onEditDenied: () => undefined,
      onInvalidEdit: () => undefined,
      menuCd: 'TEST',
      issues: [],
      serverSort: true,
      editable: false,
      showState: false,
      onRevert: () => undefined,
      multiSelect: false,
    });
    const def = defs.find((candidate) => candidate.colId === column.field);
    if (!def) throw new Error('컬럼이 없다');
    return def;
  };

  const precisionOfDef = (column: ColumnDef<Row>) => {
    const def = build(column);
    expect(def.filter).toBe(DateFilter);
    return (def.filterParams as DateFilterParams).precision;
  };

  it('date 는 일, dateTime 은 초 — 타입의 기본이 그대로 흘러간다', () => {
    expect(precisionOfDef({ field: 'regDt', header: 'x', type: 'date' })).toBe('day');
    expect(precisionOfDef({ field: 'regDtm', header: 'x', type: 'dateTime' })).toBe('second');
  });

  /*
    년월은 타입으로 표현되지 않으므로 <b>선언해야</b> 나온다(frontend/grid.md). 흘러가지 않으면
    사용자가 일을 고르게 되고, 그 자릿수는 말없이 버려진다.
  */
  it('precision 을 적으면 그것이 이긴다 — 년월 컬럼', () => {
    expect(
      precisionOfDef({ field: 'statYm', header: 'x', type: 'date', precision: 'month' }),
    ).toBe('month');
  });

  it('날짜가 아닌 컬럼은 건드리지 않는다 — 텍스트는 판의 기본 필터다', () => {
    expect(build({ field: 'memo', header: 'x', type: 'text' }).filter).not.toBe(DateFilter);
  });

  /*
    <b>고르는 필터가 먼저다.</b> 날짜 컬럼에 후보 목록이 달릴 일은 없으므로 둘은 만나지
    않지만, 만난다면 그것은 집합이 닫혀 있다는 뜻이라 {@code set} 이 이기는 편이 낫다.
    순서를 뒤집으면 코드 컬럼이 달력을 받는 사고가 조용히 난다.
  */
  it('후보 목록이 있으면 고르는 필터가 이긴다', () => {
    const def = build({
      field: 'stat',
      header: 'x',
      type: 'code',
      options: [{ value: 'A', text: 'a' }],
    });
    expect(def.filter).toBe(SetFilter);
  });

  it('filter:false 면 필터 자체가 없다 — 날짜라도 끌 수 있다', () => {
    expect(build({ field: 'regDt', header: 'x', type: 'date', filter: false }).filter).toBe(false);
  });
});
