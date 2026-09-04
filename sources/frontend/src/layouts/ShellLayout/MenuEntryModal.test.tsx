import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuEntryModal } from '@/layouts/ShellLayout/MenuEntryModal';
import type { EntryTab } from '@/layouts/ShellLayout/entryTabs';
import { indexMenuTree, type MenuNode } from '@/shared/authz/menuTree';
import { rememberRecentMenu } from '@/shared/authz/recentMenus';
import { useFavoriteStore } from '@/shared/favorite/favoriteStore';

/**
 * 메뉴 진입 모달 — frontend/tabs.md.
 *
 * <p><b>여기서 지키는 것 셋이다.</b> ① <b>여는 경로가 탭을 정한다</b>, ② <b>모달 밖에서 난
 * 키는 결과를 열지 않는다</b>, ③ <b>탭마다 목록의 출처가 다르다</b>.
 *
 * <p>②는 이 화면의 고질이다 — 검색을 확정하는 Enter 와 결과를 고르는 Enter 가 같은 키라,
 * `window` 에서 들으면 자기를 연 Enter 를 자기가 듣고 첫 항목을 즉시 연다.
 */
describe('메뉴 진입 모달', () => {
  const node = (menuCd: string, menuUrl: string | null, children: MenuNode[] = []): MenuNode => ({
    menuCd,
    menuNm: menuCd,
    menuUrl,
    iconCd: null,
    children,
  });

  const index = indexMenuTree([
    node('DASHBOARD', '/dashboard'),
    node('SYSTEM', null, [node('USER_MGMT', '/user'), node('USER_AUTH_MGMT', '/user-auth')]),
  ]);

  beforeEach(() => {
    window.localStorage.clear();
    useFavoriteStore.setState({ menuCds: [] });
  });

  const show = (tab: EntryTab, query = '', onOpen = vi.fn<(node: MenuNode) => void>()) => {
    const view = render(
      <MenuEntryModal
        open
        tab={tab}
        query={query}
        index={index}
        onOpen={onOpen}
        onClose={vi.fn()}
      />,
    );
    return { ...view, onOpen };
  };

  const modalWrap = () => document.querySelector('.ant-modal-wrap') as HTMLElement;

  it('여는 경로가 탭을 정한다 — 아이콘을 눌렀는데 검색 탭이 열리면 누른 뜻이 사라진다', async () => {
    show('recent');

    // 활성 탭은 antd 가 `aria-selected` 로 표시한다.
    await waitFor(() => {
      const selected = document.querySelector('.ant-tabs-tab-active');
      expect(selected?.textContent).toBe('shell.entry.tab.recent');
    });
  });

  it('사이더에서 넘어온 질의가 그대로 실린다 — 다시 치게 하지 않는다', () => {
    show('search', 'USER');

    expect(screen.getByDisplayValue('USER')).toBeDefined();
    // 그 질의로 이미 걸러져 있다.
    expect(screen.queryByText('USER_MGMT')).not.toBeNull();
    expect(screen.queryByText('DASHBOARD')).toBeNull();
  });

  it('검색 탭의 빈 질의는 묻지 않은 것이다 — 전체를 쏟아 놓지 않는다', () => {
    show('search');

    expect(screen.queryByText('USER_MGMT')).toBeNull();
    expect(screen.queryByText('shell.entry.search.prompt')).not.toBeNull();
  });

  it('최근 탭은 localStorage 를 읽는다 — 서버가 없어도 동작하는 유일한 탭이다', async () => {
    rememberRecentMenu('USER_AUTH_MGMT');
    rememberRecentMenu('USER_MGMT');
    show('recent');

    // 최근이 맨 앞이다.
    await waitFor(() => expect(screen.queryByText('USER_MGMT')).not.toBeNull());
    expect(screen.queryByText('USER_AUTH_MGMT')).not.toBeNull();
  });

  it('권한을 잃은 코드는 조용히 빠진다 — 인덱스에 없으면 없는 것이다', async () => {
    rememberRecentMenu('GONE_MGMT');
    rememberRecentMenu('USER_MGMT');
    show('recent');

    await waitFor(() => expect(screen.queryByText('USER_MGMT')).not.toBeNull());
    expect(screen.queryByText('GONE_MGMT')).toBeNull();
  });

  it('모달 밖의 Enter 는 결과를 열지 않는다 — 검색을 확정하는 키가 곧 이 키다', () => {
    const { onOpen } = show('search', 'USER');
    expect(screen.queryByText('USER_MGMT')).not.toBeNull();

    // 사이더의 검색 칸에서 난 Enter 가 window 까지 올라가는 상황과 같은 모양이다.
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    fireEvent.keyDown(outside, { key: 'Enter' });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('모달 안에서는 화살표로 고르고 Enter 로 연다', () => {
    const { onOpen } = show('search', 'MGMT');

    fireEvent.keyDown(modalWrap(), { key: 'ArrowDown' });
    fireEvent.keyDown(modalWrap(), { key: 'Enter' });

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0].menuCd).toBe('USER_AUTH_MGMT');
  });

  describe('즐겨찾기 지우기', () => {
    it('즐겨찾기 탭에만 휴지통이 있다 — 최근·자주는 파생이라 지울 것이 없다', () => {
      useFavoriteStore.setState({ menuCds: ['USER_MGMT'] });

      const { unmount } = show('favorite');
      expect(screen.getAllByLabelText('favorite.remove')).toHaveLength(1);
      unmount();

      rememberRecentMenu('USER_MGMT');
      show('recent');
      expect(screen.queryByLabelText('favorite.remove')).toBeNull();
    });

    it('휴지통은 빼기만 부른다 — 넣는 쪽으로 갈 길이 없어야 한다', () => {
      useFavoriteStore.setState({ menuCds: ['USER_MGMT'] });
      const remove = vi.fn(() => Promise.resolve());
      useFavoriteStore.setState({ remove });

      show('favorite');
      fireEvent.click(screen.getByLabelText('favorite.remove'));

      expect(remove).toHaveBeenCalledWith('USER_MGMT');
    });

    it('지우는 클릭이 그 메뉴를 열지 않는다 — 지우려다 화면이 열리면 최악이다', () => {
      useFavoriteStore.setState({ menuCds: ['USER_MGMT'], remove: () => Promise.resolve() });
      const { onOpen } = show('favorite');

      fireEvent.click(screen.getByLabelText('favorite.remove'));

      expect(onOpen).not.toHaveBeenCalled();
    });
  });
});

/**
 * 입력 칸과 탭 이동 — frontend/tabs.md.
 *
 * <p>셋 다 <b>다시 열었을 때</b>에 관한 것이다. 지난 질의가 남아 있으면 지우고 다시 쳐야
 * 하고, 포커스가 없으면 한 번 더 클릭해야 한다 — 단축키로 여는 창에서 그 한 번이 단축키를
 * 무의미하게 만든다.
 */
describe('메뉴 진입 모달 — 입력 칸', () => {
  const node = (menuCd: string, menuUrl: string): MenuNode => ({
    menuCd,
    menuNm: menuCd,
    menuUrl,
    iconCd: null,
    children: [],
  });
  const index = indexMenuTree([node('DASHBOARD', '/dashboard'), node('USER_MGMT', '/user')]);

  const view = (open: boolean, query = '') =>
    render(
      <MenuEntryModal
        open={open}
        tab="search"
        query={query}
        index={index}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );

  const field = () => document.querySelector('.ant-modal input') as HTMLInputElement;
  const activeTab = () => document.querySelector('.ant-modal .ant-tabs-tab-active')?.textContent;

  it('다시 열면 지난 질의가 남지 않는다 — 지우고 다시 치게 하지 않는다', () => {
    const { rerender } = view(true);
    fireEvent.change(field(), { target: { value: 'USER' } });
    expect(field().value).toBe('USER');

    const same = (open: boolean) => (
      <MenuEntryModal
        open={open}
        tab="search"
        query=""
        index={index}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />
    );
    rerender(same(false));
    rerender(same(true));

    expect(field().value).toBe('');
  });

  it('열 때 있던 글은 선택해 둔다 — 그냥 치면 새로 치는 것이 된다', async () => {
    view(true, 'USER');

    // 선택 범위로 잰다. jsdom 은 판의 모션이 없어 포커스가 어디에 앉는지가 실제와 다르지만,
    // `focus({cursor:'all'})` 이 부르는 `select()` 는 범위를 남긴다 — 그것이 이 판정의 알맹이다.
    // `selectionEnd` 로 기다리면 안 된다 — 캐럿이 끝에 있는 것만으로 참이라 **선택되기
    // 전에 통과한다**. 선택은 시작이 0 이 되는 것으로만 확인된다.
    await waitFor(() => expect(field().selectionStart).toBe(0));
    expect(field().selectionEnd).toBe('USER'.length);
  });

  it('PageDown 은 모달의 탭을 옮기고 셸로 내려가지 않는다', () => {
    const shell = vi.fn();
    window.addEventListener('keydown', shell);
    try {
      view(true);
      const before = activeTab();

      // **모달 밖에서** 난 키다 — 모달 안의 빈 곳을 눌러 포커스가 빠진 상황이며,
      // 래퍼에서만 듣는 방식은 여기서 조용히 셸의 탭바를 옮긴다.
      fireEvent.keyDown(document.body, { key: 'PageDown' });

      expect(activeTab()).not.toBe(before);
      // 탭을 가진 모달이 그 단축키의 주인이다 — 뒤에 가린 탭바가 함께 움직이면
      // 무엇이 바뀌었는지 알 수 없다(frontend/tabs.md). 셸도 **같은 키**를 듣게 된 지금은
      // 이 한 줄이 둘을 가르는 규칙 전부다.
      expect(shell).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', shell);
    }
  });

  it('탭을 옮기면 입력 칸의 글을 다시 선택한다 — 같은 말로 훑거나 새 말로 치거나 둘 다 된다', async () => {
    view(true, 'USER');
    await waitFor(() => expect(field().selectionStart).toBe(0));
    // 선택을 풀어 두고, 탭 이동이 되돌리는지 본다.
    field().setSelectionRange(4, 4);

    fireEvent.keyDown(document.body, { key: 'PageDown' });

    expect(field().selectionStart).toBe(0);
    expect(field().selectionEnd).toBe('USER'.length);
  });

  it('수정자가 붙으면 이 키가 아니다 — 셸과 같은 규칙이라 길이 하나다', () => {
    view(true);
    const before = activeTab();

    fireEvent.keyDown(document.body, { key: 'PageDown', altKey: true });
    fireEvent.keyDown(document.body, { key: 'PageDown', ctrlKey: true });

    expect(activeTab()).toBe(before);
  });

  /**
   * 즐겨찾기 <b>탭에서 직접 지운다</b> — frontend/tabs.md.
   *
   * <p><b>휴지통이 넣는 일을 하면 안 된다.</b> 스토어의 `toggle` 로도 같은 결과가 나오지만
   * 그것은 <i>지금 상태</i> 에 달려 있다 — 목록이 잠깐 어긋난 순간에 누른 사용자가
   * 지우려다 넣게 된다.
   */
});
