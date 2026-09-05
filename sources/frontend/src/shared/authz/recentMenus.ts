/**
 * 최근 연 메뉴 — frontend/tabs.md.
 *
 * <p><b>원본이 `localStorage` 다.</b> 즐겨찾기(`SYS_USER_FAVORITE`)·자주 쓰는 메뉴
 * (`SYS_USER_MENU_STAT`)와 달리 이것만 서버에 두지 않기로 되어 있다 — <i>"방금 뭘 보고
 * 있었나"</i> 는 그 자리 그 기기의 맥락이고, 다른 PC 로 옮겨 갈 이유가 없다.
 *
 * <p><b>권한 필터는 여기서 하지 않는다.</b> 코드만 담고, 읽는 쪽이 메뉴 인덱스로 옮기면서
 * 없는 것은 자연히 떨어진다 — 인덱스는 서버가 유효 권한으로 만들어 준 트리다.
 * 여기서 한 번 더 거르면 <b>규칙이 두 곳</b>이 된다.
 */

const KEY = 'backoffice.recentMenus';

/**
 * 몇 개까지 기억하는가.
 *
 * <p>목록이 길어지면 <i>"최근"</i> 이 아니게 된다 — 스무 개를 훑을 바에는 트리에서 찾는
 * 편이 빠르다.
 */
export const RECENT_LIMIT = 15;

export function readRecentMenus(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    // 남의 손이 닿을 수 있는 저장소다 — 모양이 다르면 없는 것으로 친다.
    return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === 'string') : [];
  } catch {
    return [];
  }
}

/** 맨 앞으로 올린다 — 이미 있으면 옮기는 것이지 하나 더 쌓는 것이 아니다. */
export function rememberRecentMenu(menuCd: string): void {
  const next = [menuCd, ...readRecentMenus().filter((code) => code !== menuCd)].slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 사파리 프라이빗 모드 등에서 쓰기가 막힌다. 최근 목록이 비는 것뿐이라 넘어간다.
  }
}
