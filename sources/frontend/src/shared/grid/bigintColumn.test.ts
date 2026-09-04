import { describe, expect, it } from 'vitest';
import { toColDefs } from '@/shared/grid/columnDefs';
import { cellValue } from '@/shared/grid/excel/workbook';
import type { ColumnDef } from '@/shared/grid/types';

interface Row {
  seq: string;
}

/**
 * 큰 정수 컬럼 — 68 §9.10.
 *
 * <p><b>이 타입이 존재하는 이유는 <i>보이는 것</i>이 아니라 <i>조용히 틀리는 것</i>이다.</b>
 * 값은 문자열로 오고 셀에는 그대로 그려지므로 화면만 봐서는 아무 문제가 없다 — 깨지는
 * 자리는 <b>정렬</b>과 <b>엑셀</b> 둘이고, 둘 다 사용자가 <i>틀렸다</i> 고 말해 주지 않는다:
 * 정렬은 <i>순서가 이상하다</i> 로만 드러나고 파일은 <b>나중에 다른 사람이</b> 연다.
 *
 * <p>그래서 여기서 검사하는 것은 렌더링이 아니라 <b>그 둘</b>이다.
 */
describe('bigint 컬럼', () => {
  const column: ColumnDef<Row> = { field: 'seq', header: 'h', type: 'bigint', sortable: true };

  const comparatorOf = (serverSort: boolean) => {
    const defs = toColDefs<Row>({
      columns: [column],
      onEdit: () => undefined,
      onEditDenied: () => undefined,
      onInvalidEdit: () => undefined,
      menuCd: 'TEST',
      issues: [],
      serverSort,
      editable: false,
      showState: false,
      onRevert: () => undefined,
      multiSelect: false,
    });
    /*
      판의 {@code comparator} 는 함수이거나 <b>정렬 방향별 맵</b>일 수 있는 유니언이다.
      우리 어댑터가 넣는 것은 언제나 함수 하나이므로 여기서 좁힌다 — 맵이 오면 그것은
      어댑터가 바뀐 것이고, 그때는 이 테스트가 그 자리에서 죽는 편이 낫다.
    */
    const comparator = defs.find((def) => def.colId === 'seq')?.comparator;
    return typeof comparator === 'function' ? comparator : undefined;
  };

  /** 비교자를 태워 정렬한 결과 — 판이 하는 일과 같다. */
  const sorted = (values: string[]): string[] => {
    const compare = comparatorOf(false);
    if (!compare) throw new Error('bigint 컬럼에 비교자가 없다');
    return [...values].sort((left, right) =>
      compare(left, right, undefined as never, undefined as never, false),
    );
  };

  it('자릿수가 다르면 자릿수가 이긴다 — 글자로 견주면 9 가 10 뒤로 간다', () => {
    expect(sorted(['10', '9', '100'])).toEqual(['9', '10', '100']);
  });

  it('2^53 을 넘어도 이웃한 두 값이 갈린다 — Number 를 거쳤다면 같아졌을 자리다', () => {
    const a = '9007199254740993';
    const b = '9007199254740992';
    // 이 둘은 `Number()` 를 통과하면 **같은 값**이 된다. 그것이 이 타입의 존재 이유다.
    expect(Number(a)).toBe(Number(b));
    expect(sorted([a, b])).toEqual([b, a]);
  });

  it('앞의 0 은 크기가 아니다 — 007 은 8 보다 작다', () => {
    expect(sorted(['007', '8'])).toEqual(['007', '8']);
  });

  it('음수는 자릿수가 많을수록 작다', () => {
    expect(sorted(['-100', '-9', '3'])).toEqual(['-100', '-9', '3']);
  });

  it('빈 값은 뒤로 간다 — 값이 없는 것이 0 보다 작다고 말할 근거가 없다', () => {
    expect(sorted(['5', '', '1'])).toEqual(['1', '5', '']);
  });

  it('서버 정렬이면 비교자가 순서를 만들지 않는다 — 서버가 준 그대로다(grid-column-contract.md §3)', () => {
    const compare = comparatorOf(true);
    expect(compare?.('9', '10', undefined as never, undefined as never, false)).toBe(0);
  });

  it('엑셀에 문자열로 쓴다 — 숫자로 쓰면 엑셀이 다시 정밀도를 잃는다', () => {
    expect(cellValue(column, { seq: '9007199254740993' })).toBe('9007199254740993');
  });

  /*
    <b>서버가 숫자로 내리기 시작해도</b> 파일은 문자열이어야 한다. 지금은 그럴 일이 없지만,
    그 회귀는 화면에서는 보이지 않고 <b>파일에서만</b> 드러난다 — 그리고 파일을 여는 사람은
    그 숫자가 원래 무엇이었는지 알 방법이 없다.
  */
  it('값이 숫자로 와도 문자열로 쓴다', () => {
    const numeric = { field: 'seq', header: 'h', type: 'bigint' } as ColumnDef<{ seq: number }>;
    expect(cellValue(numeric, { seq: 12345 })).toBe('12345');
  });
});
