import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellTabBar } from '@/layouts/ShellLayout/ShellTabBar';
import { useMessageStore } from '@/shared/i18n/messageStore';
import { DASHBOARD_TAB, useTabStore, type WorkTab } from '@/shared/stores/tabStore';

vi.mock('@/shared/favorite/favoriteStore', () => ({
  useFavoriteStore: (select: (state: unknown) => unknown) =>
    select({ menuCds: [], toggle: vi.fn() }),
}));

/**
 * 탭바의 <b>미저장 표시</b> — frontend/tabs.md.
 *
 * <p>이 점은 <b>탭을 닫기 전에</b> 무엇이 남았는지 알려 주는 유일한 표시다. 확인 모달은
 * 이미 닫으려 할 때 뜨지만, 이것은 <i>닫기 전에</i> 보인다.
 *
 * <p><b>오랫동안 한 번도 켜지지 않았다</b> — {@code setDirty} 를 부르는 곳이 없어
 * {@code dirtyKeys} 가 언제나 비어 있었다(shared/grid/useTabDirty). 배선이 생겼으므로
 * <b>표시도 함께 잠근다</b>.
 */
describe('탭바의 미저장 표시 — frontend/tabs.md', () => {
  const TAB: WorkTab = {
    key: 'USER_MGMT#1',
    menuCd: 'USER_MGMT',
    pathname: '/user',
    titleKey: 'menu.USER_MGMT',
    instance: 1,
    closable: true,
    seq: 1,
  };

  beforeEach(() => {
    useMessageStore.setState({
      status: 'ready',
      messages: { 'menu.DASHBOARD': '대시보드', 'menu.USER_MGMT': '사용자 관리' },
    });
    useTabStore.setState({
      tabs: [DASHBOARD_TAB, TAB],
      activeKey: TAB.key,
      dirtyKeys: [],
      dirtySources: {},
    });
  });

  const draw = () => render(<ShellTabBar onSelect={vi.fn()} onClose={vi.fn()} />);

  it('미저장이 없으면 제목뿐이다', () => {
    draw();

    expect(screen.getByText('사용자 관리')).toBeTruthy();
    expect(screen.queryByText(/사용자 관리 •/)).toBeNull();
  });

  it('미저장이면 점이 붙는다 — 닫기 전에 알 수 있는 유일한 자리다', () => {
    useTabStore.setState({ dirtyKeys: [TAB.key], dirtySources: { [TAB.key]: ['g1'] } });

    draw();

    expect(screen.getByText(/사용자 관리\s*•/)).toBeTruthy();
    // 깨끗한 탭에는 붙지 않는다 — 전부에 붙으면 표시가 아니라 장식이다.
    expect(screen.queryByText(/대시보드\s*•/)).toBeNull();
  });
});
