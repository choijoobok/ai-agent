/**
 * 자주 쓰는 메뉴의 API — UX-16 · 42 §8.
 *
 * <p>호출 URL 은 `api/endpoints.ts` 에만 둔다(frontend-stack.md §9). 둘 다 **`common` 계층**이다 —
 * 모든 메뉴에 해당하므로 특정 메뉴에 소속시킬 수 없다(security-design.md §4).
 */
export const MENU_STAT_ENDPOINTS = {
  saveSelect: '/common/menu/saveSelect',
  getFrequent: '/common/menu/getFrequent',
} as const;
