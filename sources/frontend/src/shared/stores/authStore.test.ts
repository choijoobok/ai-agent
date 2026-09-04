import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/shared/stores/authStore';

const SESSION = {
  user: { userId: 'admin', userNm: '관리자', localeCd: 'ko' },
  mustChangePassword: false,
  menus: ['USER_MGMT'],
  permissions: ['USER_MGMT:READ'],
  menuTree: [
    {
      menuCd: 'SYSTEM',
      menuNm: 'menu.SYSTEM',
      menuUrl: null,
      iconCd: null,
      children: [
        {
          menuCd: 'USER_MGMT',
          menuNm: 'menu.USER_MGMT',
          menuUrl: '/user',
          iconCd: null,
          children: [],
        },
      ],
    },
  ],
  cacheVersions: { message: 1 },
  expiresInSeconds: 1800,
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      mustChangePassword: false,
      menus: [],
      permissions: [],
      menuTree: [],
      authzVersion: null,
      restored: false,
    });
  });

  it('로그인하면 세션이 담기고 복원 완료로 표시된다', () => {
    useAuthStore.getState().signIn(SESSION);

    const state = useAuthStore.getState();
    expect(state.user?.userId).toBe('admin');
    expect(state.menus).toEqual(['USER_MGMT']);
    expect(state.restored).toBe(true);
  });

  it('로그아웃하면 이전 사용자의 메뉴가 남지 않는다', () => {
    // persist 를 쓰지 않기로 한 결정의 이유가 이것이다 — 로그아웃 뒤 그 PC 에
    // 이전 사용자의 메뉴 구조가 남으면 안 된다(frontend/packages.md).
    useAuthStore.getState().signIn(SESSION);
    useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.menus).toEqual([]);
    expect(state.permissions).toEqual([]);
    // 트리도 함께 비워야 한다 — 메뉴 구조가 남으면 앞사람이 무슨 업무를 하는지 보인다.
    expect(state.menuTree).toEqual([]);
  });

  it('복원 표시는 세션이 없어도 선다 — 그래야 로그인 화면으로 보낼 수 있다', () => {
    useAuthStore.getState().markRestored();

    expect(useAuthStore.getState().restored).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
