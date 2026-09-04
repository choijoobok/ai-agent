import { describe, expect, it } from 'vitest';
import { useMessageStore } from '@/shared/i18n/messageStore';
import type { GridRow, RowState } from '@/shared/grid/rows';
import {
  MAX_TAGS,
  duplicatedSortNo,
  nextSortNo,
  tooManyTagRows,
  tooManyTags,
} from '@/features/sample/tagRules';
import type { SampleOrderTagRow } from '@/features/sample/types';

/**
 * 태그의 규칙 — playbook/INDEX.md · frontend/grid.md.
 *
 * <p><b>둘 다 `SORT_NO` 가 값이라는 사실에서 나온다</b>(playbook/INDEX.md). 틀렸을 때의 증상이
 * 조용한 것이 이 검사의 이유다 — 순서가 겹친 판은 <b>저장까지 되고</b> 나서
 * <i>조회할 때마다 태그가 뒤바뀐다</i> 로만 드러나며, 그 시점에 원인을 이 함수까지
 * 거슬러 오는 사람은 없다.
 *
 * <p>그래서 재는 것이 <i>겹치면 막는가</i> 하나가 아니라 <b>막지 말아야 할 것을 통과
 * 시키는가</b> 도 함께다. 지나치게 막는 쪽의 실패는 흔한 편집을 아예 못 하게 만든다.
 */

/** `state: null` 이 <b>조회된 그대로</b> 다 — 'R' 이 아니다(frontend/grid.md). */
function row(state: RowState, id: string, sortNo: number | null): GridRow<SampleOrderTagRow> {
  const data: SampleOrderTagRow = {
    ordId: '1',
    tagSeq: 1,
    tagNm: '태그',
    tagTypeCd: 'GEN',
    sortNo,
    regId: null,
    regDtm: null,
    modId: null,
    modDtm: null,
  };
  return { id, state, data, original: state === 'C' ? null : data };
}

describe('정렬순서 중복 — 뒤에 온 행을 짚는다', () => {
  it('겹치지 않으면 아무것도 짚지 않는다', () => {
    const rows = [row(null, 'r1', 1), row(null, 'r2', 2), row(null, 'r3', 3)];

    expect(duplicatedSortNo(rows)).toEqual([]);
  });

  it('겹치면 그 칸을 짚는다 — 저장 전에 막힌다', () => {
    const rows = [row(null, 'r1', 1), row('C', 'r2', 1)];

    const issues = duplicatedSortNo(rows);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rowId: 'r2', field: 'sortNo' });
    // 문구는 메시지 키에서 온다 — 값을 여기 적으면 번역을 고칠 때 검사가 깨진다(sys/code.md).
    expect(issues[0]?.message).toBeTruthy();
  });

  /*
    <b>첫 행을 짚지 않는 것이 요점이다.</b> 겹친 값을 처음 쓴 행은 잘못이 없고 사용자가
    고쳐야 하는 것은 뒤에 온 행인데, 둘 다 붉히면 <i>어느 쪽을 바꿔야 하나</i> 를 화면이
    말하지 못한다.
  */
  it('셋이 겹치면 뒤의 둘만 짚는다 — 처음 쓴 행은 잘못이 없다', () => {
    const rows = [row(null, 'r1', 5), row('C', 'r2', 5), row('C', 'r3', 5)];

    expect(duplicatedSortNo(rows).map((issue) => issue.rowId)).toEqual(['r2', 'r3']);
  });

  /*
    <b>지나치게 막는 쪽의 실패다.</b> 삭제 행은 컨트롤러가 이미 뺐으므로(`validate.ts` 가
    `state !== 'D'` 로 거른다) 여기 오는 판에는 없다 — <i>3번을 지우고 3번을 새로 만드는</i>
    편집이 통과해야 하며, 이 검사가 그 흔한 동선을 지킨다.
  */
  it('삭제 행이 빠진 판에서는 같은 순서를 새로 쓸 수 있다', () => {
    const rows = [row('C', 'r2', 3)];

    expect(duplicatedSortNo(rows)).toEqual([]);
  });

  it('빈 칸은 여기서 보지 않는다 — 필수는 컬럼 선언이 1층에서 잡는다', () => {
    const rows = [row('C', 'r1', null), row('C', 'r2', null)];

    expect(duplicatedSortNo(rows)).toEqual([]);
  });
});

describe('신규 행이 제안할 정렬순서', () => {
  it('빈 판에서는 1 이다', () => {
    expect(nextSortNo([])).toBe(1);
  });

  it('가장 큰 것 다음이다 — 마지막 행이 아니라 최대값을 본다', () => {
    const rows = [row(null, 'r1', 3), row(null, 'r2', 1), row(null, 'r3', 2)];

    expect(nextSortNo(rows)).toBe(4);
  });

  /*
    <b>삭제 표시된 행도 센다.</b> 그 자리를 비워 주면 새 행이 지울 행의 순서를 제안하는데,
    사용자가 삭제를 되돌리는 순간(frontend/grid.md 의 토글) 둘이 겹쳐 저장이 막힌다 — 되돌리기가
    <i>왜 저장을 깨는가</i> 를 설명할 방법이 없다.
  */
  it('삭제 표시된 행의 순서도 센다 — 되돌리면 겹치기 때문이다', () => {
    const rows = [row('D', 'r1', 9)];

    expect(nextSortNo(rows)).toBe(10);
  });

  it('빈 칸은 0 으로 센다 — 그 행이 제안을 1 로 끌어내리지 않는다', () => {
    const rows = [row(null, 'r1', 2), row('C', 'r2', null)];

    expect(nextSortNo(rows)).toBe(3);
  });
});

/**
 * 개수 상한 — playbook/INDEX.md 의 결정. <b>같은 값을 두 층이 본다</b>(frontend/grid.md).
 *
 * <p>재는 것이 <i>넘으면 막는가</i> 하나가 아니다. <b>경계에서 어느 쪽으로 서는가</b>가
 * 함께여야 하는데, 한 칸 어긋난 상한은 <i>스무 개까지</i> 라고 적어 두고 <b>열아홉에서
 * 막는</b> 화면이 되고 그것은 문구가 거짓이 되는 종류의 버그다.
 *
 * <p>그리고 <b>층이 갈린 이유</b>가 검사로 남아야 한다 — ①은 값(배열)을 받고 ⑤는 행
 * 봉투를 받는다. 한쪽 함수로 둘을 다 하려 하면 배열에 `rowId` 가 없어 <i>어느 행인가</i>
 * 에 답할 수 없고, 그 사실이 여기 두 describe 로 보인다.
 */
describe('개수 상한 — ①의 컬럼 층', () => {
  it('상한까지는 통과한다 — 경계가 맞는 방향으로 선다', () => {
    expect(tooManyTags(new Array(MAX_TAGS).fill({ tagNm: '정기' }))).toBeNull();
  });

  it('하나 넘으면 막는다', () => {
    expect(tooManyTags(new Array(MAX_TAGS + 1).fill({ tagNm: '정기' }))).toBeTruthy();
  });

  /*
    <b>문구가 숫자를 말해야 한다.</b> *태그가 너무 많습니다* 만으로는 몇 개를 빼야 하는지
    알 수 없어 사용자가 하나 지우고 저장하기를 반복한다(frontend/grid.md 의 *건수를 먼저*).

    <b>번들을 여기서 심는다.</b> 다른 검사들처럼 문구 값을 단정하지 않는 것이 규약이지만
    (번역을 고칠 때 검사가 깨진다) 여기서 재는 것은 문구가 아니라 <b>상수가 자리표에
    닿는가</b> 다 — 심는 틀은 이 검사의 픽스처이고 배포되는 번역이 아니다.
  */
  it('상한이 자리표에 들어간다 — 문구가 몇 개인지 말한다', () => {
    useMessageStore.setState({ messages: { 'sample.tag.tooMany': '최대 {max}개' } });

    expect(tooManyTags(new Array(MAX_TAGS + 1).fill({}))).toBe(`최대 ${MAX_TAGS}개`);

    useMessageStore.setState({ messages: {} });
  });

  /*
    배열이 아닌 값에는 셀 것이 없다. `list` 컬럼의 값은 언제나 배열이지만 조회가 `null` 을
    줄 수 있고(태그가 없는 주문), 거기서 던지면 <b>판이 그 셀에서 죽는다</b>.
  */
  it('배열이 아니면 아무 말도 하지 않는다', () => {
    expect(tooManyTags(null)).toBeNull();
    expect(tooManyTags(undefined)).toBeNull();
  });
});

describe('개수 상한 — ⑤의 그리드 층', () => {
  const rows = (count: number) =>
    Array.from({ length: count }, (_item, index) => row(null, `r${index}`, index + 1));

  it('상한까지는 통과한다', () => {
    expect(tooManyTagRows(rows(MAX_TAGS))).toEqual([]);
  });

  /*
    <b>초과분의 첫 행을 짚는다.</b> 상한까지는 잘못이 없고 사용자가 지워야 하는 것은 그
    뒤이며, 짚어 두면 화면이 그 행으로 데려간다(frontend/grid.md ②) — 정렬순서 중복이 *뒤에 온
    행* 을 짚는 것과 같은 규칙이다.
  */
  it('넘으면 스물한 번째 행을 짚는다 — 앞의 스물은 잘못이 없다', () => {
    const issues = tooManyTagRows(rows(MAX_TAGS + 3));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.rowId).toBe(`r${MAX_TAGS}`);
  });

  /*
    <b>어느 칸의 문제도 아니다.</b> `field` 를 주면 화면이 그 셀을 붉히는데, 그 셀의 값은
    잘못되지 않았다 — frontend/grid.md 이 합계 오류에 `field` 를 선택으로 둔 것과 같은 자리다.
  */
  it('칸을 짚지 않는다 — 개수는 셀에 귀속되지 않는다', () => {
    expect(tooManyTagRows(rows(MAX_TAGS + 1))[0]?.field).toBeUndefined();
  });
});
