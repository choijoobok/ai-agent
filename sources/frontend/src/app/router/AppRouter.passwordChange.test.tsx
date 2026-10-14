// @feat FEAT-501
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import { useAuthStore } from '@/shared/stores/authStore';
import { useMessageStore } from '@/shared/i18n/messageStore';
import { changePassword } from '@/modules/system/public/profile/api/profileApi';
import { fetchMe, fetchPasswordPolicy, logout } from '@/modules/system/public/auth/api/authApi';

vi.mock('@/layouts/ShellLayout', () => ({ ShellLayout: () => <div>메인 화면</div> }));
vi.mock('@/modules/system/public/auth/useSessionSignals', () => ({
  useSessionSignals: () => ({ reauth: null, dismissReauth: vi.fn(), giveUp: vi.fn() }),
}));
vi.mock('@/modules/system/public/profile/api/profileApi', () => ({ changePassword: vi.fn() }));
vi.mock('@/modules/system/public/auth/api/authApi', () => ({
  fetchMe: vi.fn(), fetchPasswordPolicy: vi.fn(), logout: vi.fn(), login: vi.fn(),
}));

describe('TC-5016 초기 비밀번호 강제 변경', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/admin/system/user');
    useAuthStore.setState({ user: { userId: 'admin', userNm: '관리자', localeCd: 'ko' }, mustChangePassword: true, restored: true });
    useMessageStore.setState({ status: 'ready' });
    vi.mocked(fetchMe).mockImplementation(() => new Promise(() => {}));
    vi.mocked(fetchPasswordPolicy).mockResolvedValue({
      rules: [{ id: 'MIN_LENGTH', params: { min: 9 }, clientCheckable: true, message: '최소 9자' }],
      reset: { tokenValidMinutes: 10, resendCooldownSeconds: 60 },
    });
  });

  const show = () => render(<App><AppRouter /></App>);
  async function fill(next = 'NewPassw0rd!') {
    fireEvent.change(await screen.findByLabelText('profile.pwd.current'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('profile.pwd.new'), { target: { value: next } });
    fireEvent.change(screen.getByLabelText('profile.pwd.confirm'), { target: { value: next } });
    const button = screen.getByRole('button', { name: 'profile.pwd.submit' });
    if (next.length >= 9) await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
  }

  it('직접 URL로 들어와도 변경 폼으로 이동하고 성공할 때만 메인을 연다', async () => {
    let complete!: () => void;
    vi.mocked(changePassword).mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
    show();
    await fill();
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('admin', 'NewPassw0rd!'));
    expect(window.location.pathname).toBe('/password/change');
    expect(screen.queryByText('메인 화면')).toBeNull();
    complete();
    await screen.findByText('메인 화면');
    expect(useAuthStore.getState().mustChangePassword).toBe(false);
  });

  it('서버가 변경을 거절하면 제한을 유지한다', async () => {
    vi.mocked(changePassword).mockRejectedValue(new Error('현재 비밀번호 불일치'));
    show();
    await fill();
    await screen.findByText('현재 비밀번호 불일치');
    expect(useAuthStore.getState().mustChangePassword).toBe(true);
    expect(screen.queryByText('메인 화면')).toBeNull();
  });

  it('정책을 만족하지 않는 새 비밀번호는 제출하지 않는다', async () => {
    show();
    await fill('admin');
    expect(screen.getByRole('button', { name: 'profile.pwd.submit' }).hasAttribute('disabled')).toBe(true);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('정책 조회 실패를 알리고 로그아웃할 수 있다', async () => {
    vi.mocked(fetchPasswordPolicy).mockRejectedValue(new Error('정책 조회 실패'));
    vi.mocked(logout).mockResolvedValue(undefined);
    show();
    await screen.findByText('정책 조회 실패');
    fireEvent.click(screen.getByRole('button', { name: 'shell.logout' }));
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(screen.queryByText('메인 화면')).toBeNull();
  });
});
