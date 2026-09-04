import { describe, expect, it } from 'vitest';
import type { GridRow, RowState } from '@/shared/grid/rows';
import { duplicatedKeys, itemKeyOf } from '@/features/sample/excel/itemKeyRules';
import type { SampleOrderItem } from '@/features/sample/types';

/**
 * ⑥의 키 규칙 — 68 §8.7.
 *
 * <p>재는 것이 <i>겹치면 막는가</i> 하나가 아니다. <b>너무 많이 짚는 쪽의 실패</b>가 더
 * 나쁘기 때문이다: 멀쩡한 412행짜리 파일이 저장되지 않고 사용자는 <i>왜 안 되는지</i> 를
 * 그 412행에서 찾는다.
 *
 * <p><b>구분자가 그 자리다.</b> 잇기만 하면 `(SO-1, 001)` 과 `(SO-10, 01)` 이 같은 글자가
 * 되어 <b>서로 다른 두 행이 겹친 것으로</b> 잡히는데, 그 사고는 <i>왜 이 두 줄이
 * 겹쳤다는 거지</i> 로만 보이고 원인이 이 함수에 있다는 것을 아무도 모른다.
 */

/** `state: null` 이 <b>조회된 그대로</b> 다 — 'R' 이 아니다(grid-standard.md §3.2). */
function row(state: RowState, id: string, ordNo: string, itemCd: string): GridRow<SampleOrderItem> {
  const data: SampleOrderItem = {
    ordId: '1',
    itemSeq: 1,
    ordNo,
    itemCd,
    itemNm: '품목',
    uomCd: 'EA',
    qty: 1,
    unitAmt: 1,
    amt: 1,
    dlvrDt: null,
    itemStatCd: 'WAIT',
    useYn: true,
    rmk: null,
    regId: null,
    regDtm: null,
    modId: null,
    modDtm: null,
  };
  return { id, state, data, original: state === 'C' ? null : data };
}

describe('키 조합 중복 — 뒤에 온 행을 짚는다', () => {
  it('겹치지 않으면 아무것도 짚지 않는다', () => {
    const rows = [
      row(null, 'x1', 'SO-1', 'P-1'),
      row(null, 'x2', 'SO-1', 'P-2'),
      row(null, 'x3', 'SO-2', 'P-1'),
    ];

    expect(duplicatedKeys(rows)).toEqual([]);
  });

  it('같은 주문에 같은 품목코드가 두 번이면 뒤엣것을 짚는다', () => {
    const rows = [row(null, 'x1', 'SO-1', 'P-1'), row('C', 'x2', 'SO-1', 'P-1')];

    const issues = duplicatedKeys(rows);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.rowId).toBe('x2');
  });

  /*
    <b>어느 칸이라 말하지 않는다.</b> 겹친 것은 두 칸의 조합이라 한쪽을 짚으면
    <i>저 칸이 틀렸다</i> 로 읽히고, 사용자는 멀쩡한 주문번호를 고치려 든다.
  */
  it('칸을 짚지 않는다 — 겹친 것은 두 칸의 조합이다', () => {
    const rows = [row(null, 'x1', 'SO-1', 'P-1'), row('C', 'x2', 'SO-1', 'P-1')];

    expect(duplicatedKeys(rows)[0]?.field).toBeUndefined();
  });

  it('셋이 겹치면 뒤의 둘만 짚는다 — 처음 쓴 행은 잘못이 없다', () => {
    const rows = [
      row(null, 'x1', 'SO-1', 'P-1'),
      row('C', 'x2', 'SO-1', 'P-1'),
      row('C', 'x3', 'SO-1', 'P-1'),
    ];

    expect(duplicatedKeys(rows).map((issue) => issue.rowId)).toEqual(['x2', 'x3']);
  });

  /*
    <b>지나치게 막는 쪽의 실패다.</b> 삭제 행은 컨트롤러가 이미 뺐으므로(`validate.ts` 가
    `state !== 'D'` 로 거른다) 여기 오는 판에는 없다 — <i>한 품목을 지우고 같은 코드로 다시
    만드는</i> 편집이 통과해야 한다.
  */
  it('삭제 행이 빠진 판에서는 같은 코드를 새로 쓸 수 있다', () => {
    const rows = [row('C', 'x2', 'SO-1', 'P-1')];

    expect(duplicatedKeys(rows)).toEqual([]);
  });
});

describe('키의 경계 — 구분자가 값에 먹히지 않는다', () => {
  /*
    이것이 <b>구분자 없이 잇는 순간 깨지는 경우</b>다. `SO-1` + `001` 과 `SO-10` + `01` 은
    이어 붙이면 둘 다 `SO-1001` 이라 서로 다른 두 행이 겹친 것으로 잡힌다.
  */
  it('SO-1 + 001 과 SO-10 + 01 은 다른 행이다', () => {
    const rows = [row(null, 'x1', 'SO-1', '001'), row(null, 'x2', 'SO-10', '01')];

    expect(duplicatedKeys(rows)).toEqual([]);
  });

  it('키가 같으면 같은 글자다 — 대조의 양쪽이 같은 규칙을 쓴다', () => {
    const left = row(null, 'x1', 'SO-1', 'P-1');
    const right = row(null, 'x2', 'SO-1', 'P-1');

    expect(itemKeyOf(left.data)).toBe(itemKeyOf(right.data));
  });
});
