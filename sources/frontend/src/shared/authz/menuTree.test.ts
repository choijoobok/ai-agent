import { describe, expect, it } from 'vitest';
import { findByUrl, indexMenuTree, pathOf, type MenuNode } from '@/shared/authz/menuTree';

/**
 * 트리 색인 — frontend/tabs.md.
 *
 * <p>여기서 지키는 것은 <b>브레드크럼과 검색 결과가 같은 경로 값을 쓴다</b>는 것이다.
 * 각자 계산하면 같은 메뉴가 두 곳에서 다른 경로로 보인다.
 */
describe('menuTree', () => {
  const node = (menuCd: string, menuUrl: string | null, children: MenuNode[] = []): MenuNode => ({
    menuCd,
    menuNm: `menu.${menuCd}`,
    menuUrl,
    iconCd: null,
    children,
  });

  const TREE: MenuNode[] = [
    node('DASHBOARD', '/dashboard'),
    node('SYSTEM', null, [
      node('USER', null, [node('USER_MGMT', '/user'), node('USER_AUTH_MGMT', '/user-auth')]),
      node('LOG', null, [node('LOGIN_LOG', '/log/login')]),
    ]),
  ];

  const index = indexMenuTree(TREE);

  it('구조 노드까지 전부 색인한다 — 브레드크럼이 조상 이름을 그려야 한다', () => {
    expect([...index.byCode.keys()]).toContain('SYSTEM');
    expect([...index.byCode.keys()]).toContain('USER');
  });

  it('열 수 있는 것은 MENU_URL 이 있는 마디뿐이다', () => {
    expect(index.leaves.map((leaf) => leaf.menuCd)).toEqual([
      'DASHBOARD',
      'USER_MGMT',
      'USER_AUTH_MGMT',
      'LOGIN_LOG',
    ]);
  });

  it('경로는 자신을 포함한다 — 브레드크럼의 마지막 칸이 현재 메뉴다', () => {
    expect(pathOf(index, 'USER_MGMT').map((n) => n.menuCd)).toEqual([
      'SYSTEM',
      'USER',
      'USER_MGMT',
    ]);
  });

  it('최상위 리프의 경로는 자기 하나다 — 브레드크럼을 비울 판단의 근거', () => {
    expect(pathOf(index, 'DASHBOARD')).toHaveLength(1);
  });

  it('모르는 코드의 경로는 빈 배열이다 — 던지지 않는다', () => {
    // 권한을 잃어 트리에서 사라진 메뉴의 탭이 아직 닫히기 전에 이 경로를 지난다.
    expect(pathOf(index, 'GHOST')).toEqual([]);
  });

  it('경로로 메뉴를 찾는다 — 딥링크와 F5 가 URL 하나로 시작한다', () => {
    expect(findByUrl(index, '/log/login')?.menuCd).toBe('LOGIN_LOG');
  });

  it('트리에 없는 경로는 null 이다 — 그것이 곧 "권한 없음" 이다', () => {
    // 없는 메뉴인지 권한이 없는 것인지 프론트는 구분하지 않는다(frontend/packages.md).
    expect(findByUrl(index, '/order')).toBeNull();
  });

  it('구조 노드의 경로로는 찾히지 않는다 — 열 수 없는 것을 열게 하면 안 된다', () => {
    expect(findByUrl(index, '')).toBeNull();
  });

  it('빈 트리도 색인된다 — 권한 공집합은 로그인이 막히지만 호출 경로는 지난다', () => {
    const empty = indexMenuTree([]);
    expect(empty.leaves).toEqual([]);
    expect(findByUrl(empty, '/user')).toBeNull();
  });
});
