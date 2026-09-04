import { describe, expect, it } from 'vitest';
import { indexMenuTree, type MenuNode } from '@/shared/authz/menuTree';
import { normalizeForSearch, searchMenus } from '@/shared/authz/menuSearch';

/**
 * 메뉴 검색 — main-shell.md §4.2.
 *
 * <p><b>번역된 이름으로 비교하는 것이 이 기능의 전제다.</b> 키(`menu.USER_MGMT`)로 비교하면
 * 사용자가 보는 것과 다른 것을 찾게 되고, 그것이 이 기능을 메시지 슬라이스 뒤로 미룬 이유다.
 */
describe('메뉴 검색', () => {
  /** 이름은 메시지 키다 — 화면이 `label()` 로 옮긴다(43 §3). */
  const node = (menuCd: string, menuUrl: string | null, children: MenuNode[] = []): MenuNode => ({
    menuCd,
    menuNm: `menu.${menuCd}`,
    menuUrl,
    iconCd: null,
    children,
  });

  const tree: MenuNode[] = [
    node('DASHBOARD', '/dashboard'),
    node('SYSTEM', null, [
      node('USER', null, [node('USER_MGMT', '/user'), node('USER_AUTH_MGMT', '/user-auth')]),
      node('MASTER', null, [node('MESSAGE_MGMT', '/message')]),
    ]),
  ];

  const NAMES: Record<string, string> = {
    'menu.DASHBOARD': '대시보드',
    'menu.SYSTEM': '시스템',
    'menu.USER': '사용자',
    'menu.USER_MGMT': '사용자 관리',
    'menu.USER_AUTH_MGMT': '개인 예외 권한 관리',
    'menu.MASTER': '기준정보',
    'menu.MESSAGE_MGMT': 'Message Admin',
  };

  const index = indexMenuTree(tree);
  const translate = (key: string) => NAMES[key] ?? key;
  const find = (query: string) => searchMenus(index, query, translate).map((hit) => hit.node.menuCd);

  it('공백을 지우고 비교한다 — "사용자 관리" 와 "사용자관리" 가 같다', () => {
    expect(find('사용자관리')).toEqual(['USER_MGMT']);
    expect(find('  사용자 관리  ')).toEqual(['USER_MGMT']);
  });

  it('대소문자를 무시한다 — 구분하면 en 배포에서 검색이 사실상 동작하지 않는다', () => {
    expect(find('message')).toEqual(['MESSAGE_MGMT']);
    expect(find('MESSAGE ADMIN')).toEqual(['MESSAGE_MGMT']);
  });

  it('포함이면 걸린다 — 앞뒤 위치를 따지지 않는다', () => {
    // `관리` 는 "사용자 관리" 의 뒤, "개인 예외 권한 관리" 의 끝에 있다. 둘 다 걸린다.
    expect(find('관리')).toEqual(['USER_MGMT', 'USER_AUTH_MGMT']);
  });

  it('구조 노드는 결과에 없다 — 열 수 없는 것을 고르게 하지 않는다', () => {
    // "시스템" · "사용자" · "기준정보" 는 URL 이 없다.
    expect(find('시스템')).toEqual([]);
    expect(find('사용자')).toEqual(['USER_MGMT']);
  });

  it('경로는 매칭에 참여하지 않는다 — 넣으면 폴더 하나로 하위 전체가 걸린다', () => {
    expect(find('기준정보')).toEqual([]);
  });

  it('정규화 후 비면 검색하지 않는다 — 공백만 친 것은 묻지 않은 것이다', () => {
    expect(find('')).toEqual([]);
    expect(find('   ')).toEqual([]);
    expect(normalizeForSearch('  A b ')).toBe('ab');
  });

  it('결과 순서는 트리 순서다 — 일치 위치로 정렬하면 순서를 예측할 수 없다', () => {
    // 셋 다 이름에 `관` 이 있다. 트리에 놓인 차례가 그대로 나와야 한다.
    const ordered: Record<string, string> = { ...NAMES, 'menu.DASHBOARD': '관제 대시보드' };
    expect(searchMenus(index, '관', (key) => ordered[key] ?? key).map((hit) => hit.node.menuCd))
      .toEqual(['DASHBOARD', 'USER_MGMT', 'USER_AUTH_MGMT']);
  });

  it('경로를 함께 준다 — 같은 이름이 여러 자리에 있으면 경로가 유일한 구분이다', () => {
    const [hit] = searchMenus(index, '사용자관리', translate);
    expect(hit.path.map((node) => node.menuCd)).toEqual(['SYSTEM', 'USER', 'USER_MGMT']);
  });

  it('번역이 없으면 키로 걸린다 — 미번역이 조용히 사라지지 않는다', () => {
    // 43 §7.3 의 폴백이 화면에 키를 그대로 내므로, 검색도 그 키를 찾을 수 있어야 한다.
    const raw = (key: string) => key;
    expect(searchMenus(index, 'USER_MGMT', raw).map((hit) => hit.node.menuCd)).toEqual([
      'USER_MGMT',
    ]);
  });
});
