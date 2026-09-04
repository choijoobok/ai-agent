import type { GridRow } from '@/shared/grid/rows';

/**
 * 읽은 행 ↔ 기존 행 대조 — ADR-0024 §4 · 68 §8.6.
 *
 * <p><b>붙는 상태가 셋이다.</b> DB 에 없으면 신규(`C`), 있고 값이 다르면 변경(`U`),
 * 있고 같으면 <b>상태가 없다</b> — 마지막이 요점이다: 사람이 412행짜리 파일에서 세 줄만
 * 고쳐 올리면 <b>나가는 것도 세 줄</b>이어야 한다. 전량을 보내면 감사 컬럼이 전부
 * 갱신되어 <i>누가 언제 무엇을 고쳤나</i> 를 잃는다.
 *
 * <p><b>`D` 가 생기지 않는다</b>(68 §8.6). 파일에서 줄을 지운 것과 <i>"지워라"</i> 를
 * 구별할 방법이 없다 — 삭제는 업무 탭의 삭제 컬럼이다.
 */

/**
 * 키 컬럼들의 값을 이어 붙인 것 — <b>행을 가리키는 이름</b>이다.
 *
 * <p><b>구분자가 값에 들어갈 수 없어야 한다.</b> 콤마나 하이픈이면 `A,B` + `C` 와
 * `A` + `B,C` 가 같은 키가 되어 <b>다른 두 행이 하나로 대조된다</b> — 그 사고는 한쪽
 * 행의 값이 다른 행에 덮여 저장되는 모습으로 나타난다. 유닛 구분자(`U+001F`)는 업무
 * 키에 들어가지 않는다.
 */
export function keyOf<T>(row: T, keyFields: string[]): string {
  return keyFields
    .map((field) => scalar((row as Record<string, unknown>)[field]))
    .join(SEPARATOR);
}

/**
 * 유닛 구분자(`U+001F`) — 업무 키에 들어가지 않는 글자다(위 {@link keyOf}).
 *
 * <p><b>소스에 그 글자를 직접 적지 않는다.</b> 제어 문자는 편집기·diff·터미널에서
 * <b>보이지 않거나 다른 글자처럼</b> 보이고, 그러면 <i>이 따옴표 안에 무엇이 있는가</i> 를
 * 바이트로 뜻어보아야 안다 — 지우거나 공백으로 바꿔도 <b>아무도 모른다</b>.
 */
const SEPARATOR = String.fromCharCode(31);

/**
 * 키 한 조각의 글자 — <b>키가 될 수 있는 것만</b> 글자로 만든다.
 *
 * <p>객체를 {@code String()} 에 밀면 `[object Object]` 가 되고, 그러면 <b>서로 다른 두
 * 행이 같은 키</b>가 된다 — 업무 키에 객체가 올 일은 없지만, 오는 날 조용히 섞이는
 * 것보다 <b>빈 값으로 떨어져 대조에 실패하는</b> 편이 낫다.
 */
function scalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export interface MatchResult<T> {
  rows: GridRow<T>[];
  /** 파일 안에서 <b>키가 겹친 행</b>들의 id — 그리드 층 검증이 받는다(grid-edit-validation.md §3.2). */
  duplicated: string[];
}

/**
 * @param parsed 파일에서 읽은 행들 — <b>순서가 파일 순서</b>다. 정렬하지 않는 것은
 *     사용자가 자기 파일의 몇째 줄인지로 오류를 찾기 때문이다
 * @param existing 같은 조회 API 가 준 기존 행(ADR-0024 §4)
 */
export function matchRows<T>(parsed: T[], existing: T[], keyFields: string[]): MatchResult<T> {
  const byKey = new Map<string, T>();
  for (const row of existing) {
    byKey.set(keyOf(row, keyFields), row);
  }

  const seen = new Set<string>();
  const duplicated: string[] = [];
  const rows: GridRow<T>[] = [];

  parsed.forEach((data, index) => {
    const key = keyOf(data, keyFields);
    // 화면 안에서만 쓰는 식별자다 — <b>파일 순서</b>가 곧 이름이라 오류를 찾기 쉽다.
    const id = `x${index + 1}`;
    const found = byKey.get(key);

    if (seen.has(key)) duplicated.push(id);
    seen.add(key);

    if (!found) {
      rows.push({ id, state: 'C', data, original: null });
      return;
    }
    /*
      <b>기존 행을 원본으로 둔다.</b> 되돌리기가 그것을 쓰고(grid-standard.md §3.1), <i>같은 값이면
      상태가 없다</i> 는 판정도 여기서 나온다 — 파일의 행을 원본으로 두면 무엇을 고쳐도
      <b>영원히 무변경</b>이다.
    */
    const same = matchesExisting(data, found);
    rows.push({ id, state: same ? null : 'U', data, original: found });
  });

  return { rows, duplicated };
}

/**
 * 값이 같은가 — <b>파일에 있는 칸만 본다</b>.
 *
 * <p>기존 행에는 파일에 없는 컬럼이 있다(`ITEM_SEQ`·`ORD_ID`·감사 4 — 68 §8.2). 통째로
 * 비교하면 <b>모든 행이 변경</b>이 되고, 그러면 위의 <i>세 줄만 나간다</i> 가 성립하지
 * 않는다.
 */
function matchesExisting<T>(parsed: T, existing: T): boolean {
  const left = parsed as Record<string, unknown>;
  const right = existing as Record<string, unknown>;
  return Object.keys(left).every((field) => equalValue(left[field], right[field]));
}

/**
 * <b>빈 값 셋을 같게 본다</b>({@code null} · {@code undefined} · {@code ''}).
 *
 * <p>파일에서 온 빈 칸은 {@code null} 이고 서버가 준 것은 {@code null} 이거나 아예 키가
 * 없을 수 있다 — 가르면 <b>손대지 않은 행이 전부 변경</b>으로 잡힌다.
 */
function equalValue(left: unknown, right: unknown): boolean {
  const empty = (value: unknown) => value === null || value === undefined || value === '';
  if (empty(left) && empty(right)) return true;
  return left === right;
}
