import { App as AntApp } from 'antd';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useShellNavigation, type ShellNavigation } from '@/layouts/ShellLayout/useShellNavigation';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTabStore } from '@/shared/stores/tabStore';
import type { MenuNode } from '@/shared/authz/menuTree';

/**
 * URL 과 탭을 잇는 자리 — frontend/packages.md.
 *
 * <p><b>닫기는 스토어만 건드린다.</b> 활성 탭이 닫히면 스토어는 다음 탭으로 옮기는데
 * 주소창은 <b>방금 닫은 화면</b>을 가리킨 채 남는다. 그 상태로 새로고침하면 URL → 탭 효과가
 * 그 경로를 다시 열어 <b>닫은 탭이 되살아난다</b>.
 *
 * <p>화면에는 아무 표시도 나지 않는 종류다 — 주소창을 보지 않으면 모르고, 되살아나는 것은
 * 새로고침한 뒤에야 드러난다.
 */
describe('셸 내비게이션', () => {
  const node = (menuCd: string, menuUrl: string): MenuNode => ({
    menuCd,
    menuNm: menuCd,
    menuUrl,
    iconCd: null,
    children: [],
  });

  beforeEach(() => {
    useAuthStore.setState({ menuTree: [node('DASHBOARD', '/admin/system/dashboard'), node('USER_MGMT', '/user')] });
    useTabStore.getState().reset();
  });

  /** 훅과 현재 경로를 함께 꺼낸다 — 결과가 주소에 나타나는지가 이 검사의 전부다. */
  function mount() {
    const captured: { nav?: ShellNavigation; pathname?: string } = {};

    function Probe() {
      captured.nav = useShellNavigation();
      captured.pathname = useLocation().pathname;
      return <span data-testid="path">{captured.pathname}</span>;
    }

    render(
      <MemoryRouter initialEntries={['/admin/system/dashboard']}>
        <AntApp>
          <Probe />
        </AntApp>
      </MemoryRouter>,
    );
    return captured;
  }

  it('활성 탭을 닫으면 주소가 남은 탭을 따라간다', () => {
    const captured = mount();

    act(() => {
      captured.nav?.openMenu(node('USER_MGMT', '/user'));
    });
    expect(screen.getByTestId('path').textContent).toBe('/user');

    // 헤더 로고(모든 탭 닫기)가 지나는 길이다.
    act(() => {
      useTabStore.getState().closeAll();
      captured.nav?.syncUrlToActiveTab();
    });

    // 대시보드는 닫히지 않으므로 남은 탭은 언제나 있다.
    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(screen.getByTestId('path').textContent).toBe('/admin/system/dashboard');
  });

  it('활성 탭이 살아 있으면 주소를 건드리지 않는다', () => {
    const captured = mount();

    act(() => {
      captured.nav?.openMenu(node('USER_MGMT', '/user'));
    });

    act(() => captured.nav?.syncUrlToActiveTab());

    expect(screen.getByTestId('path').textContent).toBe('/user');
  });
});
