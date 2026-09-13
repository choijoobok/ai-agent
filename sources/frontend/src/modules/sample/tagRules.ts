// @feat FEAT-503
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { GridRow } from '@/shared/grid/rows';
import type { GridIssue } from '@/shared/grid/types';
import type { SampleOrderTagRow } from '@/modules/sample/types';

/**
 * 태그의 규칙 — playbook/INDEX.md · frontend/grid.md. `features/user/detailRules.ts` 와 같은 자리다.
 *
 * <p>화면에서 뽑아낸 것은 **검사가 붙을 곳이 필요해서**다. 앞의 둘은 `SORT_NO` 가
 * **값이라는 사실**(playbook/INDEX.md)에서 나오며, 틀리면 증상이 조용하다 — 순서가 겹친 판은
 * 저장까지 되고 나서 *조회할 때마다 태그가 뒤바뀐다* 로만 드러난다.
 *
 * <p>**화면 폴더 밖에 있다**(2026-09-02 — ①이 개수 상한의 둘째 소비자가 되면서 옮겼다).
 * `popups.ts` · `types.ts` 와 같은 자리이며 같은 이유다: 상한은 **두 화면이 한 값을 봐야
 * 하는 규칙**이라(같은 테이블을 고치므로) 화면마다 두면 ⑤에서 만든 판을 ①이 저장하지
 * 못하는 상태가 생긴다.
 */

/**
 * 신규 행이 제안할 정렬순서 — 지금 판에서 가장 큰 것 다음이다.
 *
 * <p>**화면이 제안한다.** 서버가 정하면 신규 행의 칸이 저장 전까지 비어 있는데, 이 컬럼은
 * 사용자가 고치는 값이라(그것이 `TAG_SEQ` 와 갈리는 이유다) 빈 칸을 주면 *무엇을 적어야
 * 하나* 를 매번 묻게 된다.
 *
 * <p>**삭제 표시된 행도 센다.** 지울 행의 순서를 비워 두면 새 행이 그 자리를 제안하는데,
 * 사용자가 삭제를 되돌리는 순간(frontend/grid.md 의 토글) 둘이 겹친다.
 */
export function nextSortNo(rows: GridRow<SampleOrderTagRow>[]): number {
  return rows.reduce((max, row) => Math.max(max, row.data.sortNo ?? 0), 0) + 1;
}

/**
 * 3층 검증 — **정렬순서가 겹치면 막는다**(frontend/grid.md).
 *
 * <p>겹치면 읽는 순서가 정해지지 않고, 사용자에게는 *고치지도 않았는데 조회할 때마다
 * 태그가 뒤바뀐다* 로 보인다 — playbook/INDEX.md 이 이 컬럼을 둔 이유가 그 증상을 없애는 것이었다.
 *
 * <p>**삭제 행은 컨트롤러가 이미 뺐다**(`validate.ts` 가 `state !== 'D'` 로 거른다). 지울
 * 행과 새 행이 같은 순서를 갖는 것은 정상이며, 세면 *3번을 지우고 3번을 새로 만드는* 흔한
 * 편집이 통과하지 못한다.
 *
 * <p>**첫 행은 짚지 않는다.** 겹친 값을 처음 쓴 행은 잘못이 없고, 사용자가 고쳐야 하는 것은
 * **뒤에 온 행**이다 — 둘 다 붉히면 어느 쪽을 바꿔야 하는지 화면이 말하지 못한다.
 *
 * <p>**빈 칸은 여기서 보지 않는다.** 필수는 컬럼 선언(`required`)이 1층에서 잡으며, 여기서
 * 또 보면 같은 칸에 문구가 둘 붙는다.
 */
export function duplicatedSortNo(rows: GridRow<SampleOrderTagRow>[]): GridIssue[] {
  const seen = new Set<number>();
  const issues: GridIssue[] = [];
  for (const row of rows) {
    const sortNo = row.data.sortNo;
    if (sortNo === null || sortNo === undefined) continue;
    if (seen.has(sortNo)) {
      issues.push({
        rowId: row.id,
        field: 'sortNo',
        message: label(MSG.SAMPLE_TAG_SORT_DUPLICATED),
      });
      continue;
    }
    seen.add(sortNo);
  }
  return issues;
}

/**
 * 한 주문의 태그 개수 상한 — playbook/INDEX.md 의 결정(2026-09-02).
 *
 * <p>근거는 서버의 같은 상수가 갖는다(`SampleRules.MAX_TAGS`) — **상한을 정하는
 * 것은 기계가 아니라 창이다**: 순서 변경이 위·아래 버튼이라(playbook/INDEX.md) 마지막 항목을 맨
 * 앞으로 옮기는 데 N−1 번을 눌러야 하고, 엑셀·저장이 무너지는 자리는 훨씬 뒤다.
 *
 * <p>**두 곳에 같은 숫자가 있는 것이 이 규칙의 모양이다.** 서버가 다시 보지 않으면 화면
 * 밖 경로가 그대로 통과하고(frontend/grid.md), 화면이 보지 않으면 사용자가 **저장을 눌러 보고**
 * 안다. 설정 키로 올리지 않는 것은 frontend/grid.md 이 개수를 **업무 규칙**으로 못 박았기
 * 때문이다 — *"창고가 A 면 최대 50개"* 가 성립하는 자리는 배포 설정이 될 수 없다.
 */
export const MAX_TAGS = 20;

/**
 * ①의 **컬럼 층**(1층 · frontend/grid.md) — 배열이 셀 값이므로 여기서 센다.
 *
 * <p>playbook/INDEX.md 의 초안은 *"검증 3층의 그리드 층이 받는다"* 고 적었는데, **어느 층인지는
 * 편집 어휘가 정한다**: ①에서 태그는 `list` 컬럼 한 칸이라 다른 행을 볼 필요가 없고,
 * 그리드 층으로 올리면 *어느 셀의 문제인가* 에 답할 자리를 잃는다(frontend/grid.md).
 *
 * <p>**빈 배열은 여기 오지 않는다** — `validateCell` 이 길이 0 을 *비었다* 로 보고
 * 건너뛴다. 상한 검사에는 상관이 없다.
 */
export function tooManyTags(value: unknown): string | null {
  if (!Array.isArray(value) || value.length <= MAX_TAGS) return null;
  return label(MSG.SAMPLE_TAG_TOO_MANY, { max: MAX_TAGS });
}

/**
 * ⑤의 **그리드 층**(3층 · frontend/grid.md) — 행이 편집 단위이므로 판 전체를 봐야 안다.
 *
 * <p>**삭제 행은 컨트롤러가 이미 뺐다**(`validate.ts`). 그래서 여기 센 수가 곧 저장 뒤의
 * 개수이며, 스물다섯 중 여섯을 지우는 편집이 통과한다 — 세어야 하는 것은 *지금 판에 몇
 * 줄인가* 가 아니라 **저장하면 몇 개가 되는가**다(frontend/grid.md 의 *저장 후의 모습*).
 *
 * <p>**초과분의 첫 행을 짚는다.** 상한까지는 잘못이 없고 사용자가 지워야 하는 것은 그
 * 뒤이며, 짚어 두면 화면이 그 행으로 데려간다(frontend/grid.md ②) — `field` 를 주지 않는 것은
 * **어느 칸의 문제도 아니기** 때문이다.
 */
export function tooManyTagRows(rows: GridRow<SampleOrderTagRow>[]): GridIssue[] {
  if (rows.length <= MAX_TAGS) return [];
  const first = rows[MAX_TAGS];
  if (!first) return [];
  return [{ rowId: first.id, message: label(MSG.SAMPLE_TAG_TOO_MANY, { max: MAX_TAGS }) }];
}
