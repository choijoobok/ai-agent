import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { GridRow } from '@/shared/grid/rows';
import type { GridIssue } from '@/shared/grid/types';
import type { SampleOrderItem } from '@/features/sample/types';

/**
 * ⑥의 키 규칙 — 68 §8.7. `features/sample/tagRules.ts` 와 같은 자리다.
 *
 * <p>화면에서 뽑아낸 것은 **검사가 붙을 곳이 필요해서**다. 이 함수가 틀렸을 때의 증상이
 * 조용하기 때문이며 — 겹친 키는 서버가 거절하지만, **너무 많이 짚으면** 멀쩡한 파일이
 * 저장되지 않고 사용자는 *왜 안 되는지* 를 412행에서 찾는다.
 */

/**
 * `ORD_NO`␟`ITEM_CD` — 이 표에서 행 하나를 가리키는 이름이다(48 §4.3).
 *
 * <p>**구분자가 값에 들어갈 수 없어야 한다.** 그냥 이으면 `(SO-1, 001)` 과 `(SO-10, 01)`
 * 이 같은 글자가 되어 **서로 다른 두 행이 겹친 것으로** 잡힌다. 유닛 구분자(`U+001F`)를
 * 쓰는 것은 `matchRows.keyOf` · `SampleItemSpec` 과 같은 선택이며, 셋이 같은 키를 다루므로
 * 같은 판단이 세 곳에 있는 것이 우연이 아니다.
 *
 * <p>**소스에 그 글자를 직접 적지 않는다.** 제어 문자는 편집기와 diff 에서 보이지 않거나
 * 다른 글자처럼 보이고, 그러면 지우거나 공백으로 바꿔도 아무도 모른다.
 */
export function itemKeyOf(row: SampleOrderItem): string {
  return `${row.ordNo}${String.fromCharCode(31)}${row.itemCd}`;
}

/**
 * 3층 검증 — **같은 `(주문번호, 품목코드)` 가 두 번이면 막는다**(grid-edit-validation.md §3.3 · 68 §8.7).
 *
 * <p>그 쌍이 이 표의 키다. 겹치면 저장이 **어느 행을 고치는지 말할 수 없고**, 서버도 같은
 * 것을 보아 전부 거절한다 — 여기서 먼저 짚는 것은 사용자에게 **어느 줄**인지 말하기
 * 위해서다.
 *
 * <p>**뒤에 온 행만 짚는다.** 처음 쓴 행은 잘못이 없고 고쳐야 하는 것은 뒤엣것이다 —
 * 둘 다 붉히면 어느 쪽을 바꿔야 하는지 화면이 말하지 못한다.
 *
 * <p>**어느 칸이라 말하지 않는다.** 겹친 것은 두 칸의 **조합**이라 한쪽을 짚으면
 * *저 칸이 틀렸다* 로 읽힌다.
 *
 * <p>**삭제 행은 컨트롤러가 이미 뺐다**(`validate.ts` 가 `state !== 'D'` 로 거른다).
 * 지울 행과 새 행이 같은 키를 갖는 것은 정상이며, 세면 *한 품목을 지우고 같은 코드로 다시
 * 만드는* 편집이 통과하지 못한다.
 */
export function duplicatedKeys(rows: GridRow<SampleOrderItem>[]): GridIssue[] {
  const seen = new Set<string>();
  const issues: GridIssue[] = [];
  for (const row of rows) {
    const key = itemKeyOf(row.data);
    if (seen.has(key)) {
      issues.push({ rowId: row.id, message: label(MSG.SAMPLE_EXCEL_KEY_DUPLICATED) });
      continue;
    }
    seen.add(key);
  }
  return issues;
}
