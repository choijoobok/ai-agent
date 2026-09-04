/**
 * 화면이 권한을 읽는 유일한 방법 — security-design.md §4 · AUTHZ-06.
 *
 * <p><b>역할명으로 분기하지 않는다.</b> 서버가 내리는 것은 평탄화된 `MENU_CD:ACTION`
 * 문자열뿐이고 역할명은 오지 않는다 — `if (roles.includes('ADMIN'))` 이 생기면 역할을
 * 신설할 때마다 프론트를 고쳐야 하고, **인가 사실의 원본이 데이터 하나**라는 규칙이 깨진다.
 *
 * <p><b>여기서 하는 판정은 UX 이지 보안이 아니다.</b> 프론트가 든 권한 사본은 재조회 전까지
 * 낡을 수 있다 — 방금 회수된 권한의 버튼이 아직 보일 수 있고, **그 클릭을 막는 것은
 * 서버**다. 그래서 이 함수가 틀려도 데이터는 새지 않는다. 반대로 이 함수가 없으면
 * 사용자는 누를 수 없는 버튼을 계속 누른다.
 */

/** security-design.md §4 — 집합은 4종에서 닫힌다. */
export const ACTIONS = ['READ', 'SAVE', 'EXPORT', 'EXECUTE'] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * 이 (메뉴, 액션) 쌍을 가졌는가.
 *
 * <p><b>쌍으로 묻는 것이 규약이다.</b> 메뉴 목록과 액션 목록을 따로 들고 교차시키면
 * 서버가 주지 않은 조합이 화면에 나타난다 — security-design.md §4 가 곱집합을 금지한 것과 같은 실수이며,
 * 여기서는 권한 상승이 아니라 **누르면 403 이 되는 버튼**으로 드러난다.
 */
export function hasPermission(
  permissions: readonly string[],
  menuCd: string,
  action: Action,
): boolean {
  return permissions.includes(`${menuCd}:${action}`);
}

/**
 * 이 메뉴에 대해 가진 액션들. 화면 하나가 버튼 여럿을 그릴 때 쌍을 매번 조립하지 않게 한다.
 *
 * <p>순서는 {@link ACTIONS} 의 선언 순서다 — 서버가 내리는 정렬에 기대지 않는다.
 */
export function actionsOf(permissions: readonly string[], menuCd: string): Action[] {
  return ACTIONS.filter((action) => hasPermission(permissions, menuCd, action));
}

/**
 * 이 메뉴에 들어갈 수 있는가.
 *
 * <p><b>`READ` 를 묻는다.</b> 42 §6 이 *"`READ` 는 나머지 셋의 전제"* 로 정해 두었으므로
 * 진입 판정은 액션 하나로 끝난다 — 서버의 저장 검증이 그 전제를 지킨다.
 */
export function canEnterMenu(permissions: readonly string[], menuCd: string): boolean {
  return hasPermission(permissions, menuCd, 'READ');
}
