/**
 * 셀 하나를 클립보드에 — frontend/grid.md.
 *
 * <p><b>복사하는 것은 데이터가 아니라 화면에 보이는 글자다.</b> 코드 컬럼의 값은
 * {@code 'Y'} 인데 사람이 보고 있는 것은 <i>사용</i> 이고, 그것을 어딘가에 붙여 넣으려는
 * 것이므로 <b>보이는 쪽</b>이 답이다(frontend/grid.md). 그래서 값을 다시 포맷하지 않고 <b>그려진
 * 셀의 글자</b>를 읽는다.
 *
 * <p><b>다만 셀의 글자가 전부 값인 것은 아니다</b>(2026-08-30 — 실물에서 잡음). 값 뒤에
 * 배지를 덧붙이는 셀이 있고(54 의 {@code badge} — screen/code/requirements.md 의 <i>시스템</i>, §4.3 의
 * <i>변경됨</i>), 거기서 셀을 통째로 읽으면 {@code CODE_REF_KEY시스템} 이 복사된다 —
 * <b>붙여 넣을 수 없는 문자열</b>이다.
 *
 * <p>가르는 기준은 <b>배지가 값인가 값의 곁인가</b> 하나다.
 *
 * <table>
 *   <tr><td>{@code renderer: 'badge'}</td><td><b>배지가 곧 값</b>이다</td>
 *       <td>복사된다 — 값 대신 그린 것이므로 그것 말고 복사할 것이 없다</td></tr>
 *   <tr><td>{@code badge}</td><td>값 <b>뒤에</b> 덧붙는 <b>내력</b>이다</td>
 *       <td><b>빠진다</b> — 값은 따로 있다</td></tr>
 * </table>
 *
 * <p><b>판정을 여기서 하지 않는다.</b> 어느 조각이 값이 아닌지는 <b>그린 쪽이 안다</b> —
 * 어댑터가 그 조각에 {@link ASIDE_CLASS} 를 달고 여기는 그것을 뺄 뿐이다. 여기서 태그
 * 모양이나 색으로 짐작하면 <b>새 렌더러가 생길 때마다 조용히 틀린다</b>.
 *
 * <p><b>글자가 없는 셀이 있다.</b> 스위치 컬럼(frontend/grid.md)이 그렇다 — 그때 빈 문자열을
 * 복사하면 <i>눌렀는데 아무 일도 없는</i> 것과 구별되지 않는다. 참·거짓은 DB 의 말투로
 * 되돌린다: {@code Y} · {@code N}.
 */

/**
 * <b>값이 아니라 값의 곁</b> — 복사에서 빠지는 조각.
 *
 * <p>스타일이 아니라 <b>표시</b>다. 어댑터가 값 뒤에 덧붙이는 배지에 달며, 값 자체를
 * 그리는 배지({@code renderer: 'badge'})에는 달지 않는다.
 */
export const ASIDE_CLASS = 'bo-cell-aside';

/**
 * 그려진 셀 → 복사할 글자 — <b>곁들인 조각을 뺀다</b>.
 *
 * <p><b>원본을 건드리지 않는다.</b> 복제해서 지운다 — 화면의 DOM 에서 배지를 떼면 그 셀은
 * 복사할 때마다 배지를 잃는다.
 */
export function renderedText(cell: Element | null | undefined): string {
  if (!cell) return '';

  const copy = cell.cloneNode(true) as Element;
  copy.querySelectorAll(`.${ASIDE_CLASS}`).forEach((aside) => aside.remove());
  return copy.textContent ?? '';
}

/** 그려진 글자 → 복사할 글자. DOM 을 읽는 일은 부르는 쪽이 한다. */
export function cellText(rendered: string | null | undefined, value: unknown): string {
  const text = (rendered ?? '').trim();
  if (text !== '') {
    return text;
  }
  if (typeof value === 'boolean') {
    // 스위치는 글자를 그리지 않는다 — 화면에 없는 말을 지어내는 유일한 자리다.
    return value ? 'Y' : 'N';
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  // 객체는 `[object Object]` 대신 빈 칸이다 — frontend/grid.md 이 기각한 모양이다.
  return '';
}

/**
 * 지금 누른 것이 <b>셀 복사</b>인가.
 *
 * <p><b>글자를 골라 둔 사용자를 가로채지 않는다.</b> 셀 안의 글자 일부를 드래그해
 * 놓고 {@code Ctrl+C} 를 누른 사람이 원하는 것은 <b>고른 그것</b>이지 셀 전체가 아니다.
 *
 * <p><b>편집 중에도 비켜선다.</b> 입력 칸 안의 복사는 판이 아니라 브라우저의 일이다.
 */
export function isCopyShortcut(
  event: { key: string; ctrlKey: boolean; metaKey: boolean },
  selectedText: string,
  editing: boolean,
): boolean {
  if (event.key !== 'c' && event.key !== 'C') return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  return selectedText.trim() === '' && !editing;
}
