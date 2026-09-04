/**
 * `set` 필터의 <b>판정 둘</b> — grid-column-contract.md §4.3.
 *
 * <p>컴포넌트에서 갈라 둔 이유는 <b>화면 없이 잴 수 있어야</b> 하기 때문이다. 판의 필터는
 * 그리드 안에서만 살아 있어 컴포넌트째로는 단위 테스트가 서지 않는데, 조용히 깨지는 것은
 * 이 둘이다 — 키가 어긋나면 <b>체크는 되는데 아무것도 안 걸리고</b>, 전부 고른 상태를
 * 필터로 두면 화면은 정상인데 푸터가 <i>N건 중 M건</i> 을 계속 말한다.
 */

export interface SetFilterModel {
  values: string[];
}

/** 셀 값 하나를 <b>고르는 키</b>로 — `null` 도 고를 수 있어야 하므로 문자열이다. */
export function keyOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  // 객체는 고를 값이 아니다 — `[object Object]` 라는 항목을 목록에 만들지 않는다.
  return '';
}

/**
 * 고른 것 → 모델. <b>전부 고른 것은 아무것도 안 고른 것과 같다.</b>
 *
 * <p>{@code null} 로 되돌리지 않으면 푸터의 <i>N건 중 M건</i> 표기가 <b>걸리지 않은
 * 필터를 걸린 것으로</b> 말하고(grid-standard.md §2.3), 헤더에도 필터 표시가 남아 사용자가
 * <i>"필터를 풀었는데 표시가 남는다"</i> 를 겪는다.
 */
export function toModel(next: string[], total: number): SetFilterModel | null {
  return next.length === total ? null : { values: next };
}
