import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShellSider } from '@/layouts/ShellLayout/ShellSider';
import { indexMenuTree, type MenuNode } from '@/shared/authz/menuTree';
import { useAuthStore } from '@/shared/stores/authStore';
import { useUiStore } from '@/shared/stores/uiStore';
import { useTabStore } from '@/shared/stores/tabStore';

/**
 * 트리는 스스로 펼쳐지지 않는다 — frontend/tabs.md.
 *
 * <p><b>두 번 틀렸던 자리다.</b> 처음에는 활성 메뉴가 바뀔 때마다 <b>메뉴를 통째로 새로
 * 만들어</b> 조상을 펼쳤는데, 사람이 접어 둔 폴더까지 다시 열리고 접힌 사이더에서는 팝업으로
 * 튀어나왔다. 그래서 아무것도 열지 않게 했더니 이번에는 <b>선택 표시가 닫힌 폴더 안에 숨어</b>
 * 지금 어디인지 보이지 않았다.
 *
 * <p>지금은 <b>열린 목록을 제어하되 빼지 않는다</b> — 사람이 연 것에 활성 메뉴의 조상을 더한
 * 합집합이다. 접혀 있을 때는 제어하지 않는다.
 */
describe('사이더 트리', () => {
  const leaf = (menuCd: string, menuUrl: string): MenuNode => ({
    menuCd,
    menuNm: menuCd,
    menuUrl,
    iconCd: null,
    children: [],
  });
  const tree: MenuNode[] = [
    leaf('USER_MGMT', '/user'),
    {
      menuCd: 'SYSTEM',
      menuNm: 'SYSTEM',
      menuUrl: null,
      iconCd: null,
      children: [leaf('DEEP_MGMT', '/deep')],
    },
  ];

  const mountTree = () => {
    useAuthStore.setState({ menuTree: tree });
    useUiStore.setState({ siderCollapsed: false });
    useTabStore.getState().reset();
    render(
      <ShellSider
        index={indexMenuTree(tree)}
        onOpen={vi.fn()}
        onOpenInBrowser={vi.fn()}
      onOpenInNewTab={vi.fn()}
        onOpenEntry={vi.fn()}
      />,
    );
  };
  const openFolders = () =>
    [...document.querySelectorAll('.ant-menu-submenu-open')].map((el) => el.textContent);

  it('활성 메뉴가 든 폴더는 열어 둔다 — 닫힌 폴더 안의 선택은 보이지 않는다', () => {
    mountTree();
    expect(openFolders()).toHaveLength(0);

    act(() => {
      useTabStore
        .getState()
        .open({ menuCd: 'DEEP_MGMT', pathname: '/deep', titleKey: 'DEEP_MGMT' });
    });

    expect(openFolders()).toHaveLength(1);
    expect(document.querySelector('.ant-menu-item-selected')?.textContent).toBe('DEEP_MGMT');
  });

  it('모두 펼치기는 폴더를 전부 연다 — 리프는 열 것이 없다', () => {
    mountTree();

    fireEvent.click(screen.getByLabelText('shell.tree.expandAll'));

    expect(openFolders()).toHaveLength(1);
  });

  /**
   * <b>활성 탭의 조상은 접히지 않는다.</b> 여기서 조상까지 닫으면 선택 표시가 닫힌 폴더
   * 안에 숨어 지금 어디인지 보이지 않는다 — 보이지 않는 선택은 선택이 아니다.
   *
   * <p>조용히 깨지는 종류다. 화면은 <i>접혔다</i> 는 결과를 보여 주고, 무엇이 사라졌는지는
   * 그 폴더를 다시 열어 봐야 안다.
   */
  it('모두 접기는 활성 탭의 조상을 남긴다', () => {
    mountTree();
    fireEvent.click(screen.getByLabelText('shell.tree.expandAll'));
    act(() => {
      useTabStore
        .getState()
        .open({ menuCd: 'DEEP_MGMT', pathname: '/deep', titleKey: 'DEEP_MGMT' });
    });

    fireEvent.click(screen.getByLabelText('shell.tree.collapseAll'));

    // 사람이 연 것은 비었지만 조상은 그대로다.
    expect(openFolders()).toHaveLength(1);
    expect(document.querySelector('.ant-menu-item-selected')?.textContent).toBe('DEEP_MGMT');
  });

  it('활성 탭이 없으면 모두 접기가 전부 접는다', () => {
    mountTree();
    fireEvent.click(screen.getByLabelText('shell.tree.expandAll'));

    fireEvent.click(screen.getByLabelText('shell.tree.collapseAll'));

    expect(openFolders()).toHaveLength(0);
  });

  it('접혀 있으면 열린 목록을 강제하지 않는다 — 강제하면 판이 팝업으로 낸다', () => {
    useAuthStore.setState({ menuTree: tree });
    useUiStore.setState({ siderCollapsed: true });
    useTabStore.getState().reset();
    render(
      <ShellSider
        index={indexMenuTree(tree)}
        onOpen={vi.fn()}
        onOpenInBrowser={vi.fn()}
      onOpenInNewTab={vi.fn()}
        onOpenEntry={vi.fn()}
      />,
    );

    act(() => {
      useTabStore
        .getState()
        .open({ menuCd: 'DEEP_MGMT', pathname: '/deep', titleKey: 'DEEP_MGMT' });
    });

    expect(openFolders()).toHaveLength(0);
  });

});
