// @feat FEAT-510
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openMenuInBrowser } from '@/layouts/ShellLayout/browserMenuOpen';

describe('브라우저 메뉴 열기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-5105: window.open으로 실제 새 탭 또는 창이 열리면 메뉴 선택을 한 번 기록한다', () => {
    const countMenu = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    openMenuInBrowser({ menuCd: 'USER_MGMT', menuUrl: '/admin/system/user' }, countMenu);

    expect(open).toHaveBeenCalledWith('/admin/system/user', '_blank', 'noopener');
    expect(countMenu).toHaveBeenCalledOnce();
    expect(countMenu).toHaveBeenCalledWith('USER_MGMT');
  });

  it('TC-5105: 팝업 차단으로 열리지 않으면 메뉴 선택을 기록하지 않는다', () => {
    const countMenu = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue(null);

    openMenuInBrowser({ menuCd: 'USER_MGMT', menuUrl: '/admin/system/user' }, countMenu);

    expect(countMenu).not.toHaveBeenCalled();
  });
});
