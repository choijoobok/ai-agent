import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellHeader } from '@/layouts/ShellLayout/ShellHeader';
import { useAuthStore } from '@/shared/stores/authStore';
import { useUiStore } from '@/shared/stores/uiStore';

/**
 * 헤더 우측 — frontend/tabs.md.
 *
 * <p><b>순서가 결정이다.</b> *받는 것(알림) → 나(프로필) → 내 환경(설정) → 끝내기(로그아웃)*
 * 이며 오른쪽으로 갈수록 되돌리기 어렵다. 코드에서는 JSX 한 줄을 옮기면 끝나는 일이라
 * 리뷰가 알아채기 어렵고, 화면에서도 <b>틀린 순서가 그럴듯해 보인다</b> — 그래서 잰다.
 *
 * <p>넷을 상한으로 둔 것도 함께 잰다(frontend/tabs.md). 다섯째가 붙으면 설정 또는 프로필 모달 안으로
 * 들어가야 하며, 막지 않으면 헤더가 기능 목록이 된다.
 */
describe('헤더 우측', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { userId: 'kim', userNm: '김철수', localeCd: 'ko' } });
    useUiStore.setState({ siderCollapsed: false });
  });

  const mount = () => {
    const handlers = {
      onLogoClick: vi.fn(),
      onLogout: vi.fn(),
      onSettings: vi.fn(),
      onProfile: vi.fn(),
      onNotification: vi.fn(),
    };
    // 배지는 여기서 검사하지 않는다 — 세는 규칙은 알림 모달의 것이다(frontend/tabs.md).
    render(<ShellHeader {...handlers} unreadCount={0} />);
    return handlers;
  };

  /** 좌측(사이더 토글·로고)을 뺀 나머지가 우측이다. */
  const rightSide = () =>
    screen
      .getAllByRole('button')
      .map((element) => element.textContent)
      .filter((text) => text !== 'AI Agent' && text !== '');

  it('알림 · 사용자 · 설정 · 로그아웃 순서다 — 오른쪽으로 갈수록 되돌리기 어렵다', () => {
    mount();

    expect(rightSide()).toEqual([
      'shell.notification',
      // 여기 붙는 글자는 기능의 이름이 아니라 사람의 이름이다.
      '김철수',
      'settings.title',
      'shell.logout',
    ]);
  });

  it('사용자명을 누르면 프로필이 열린다 — 이름 자체가 버튼이다(frontend/tabs.md)', () => {
    const handlers = mount();

    // 접근성 이름에는 아이콘의 `aria-label`(user)이 함께 들어간다 — 부분 일치로 찾는다.
    screen.getByRole('button', { name: /김철수/ }).click();

    expect(handlers.onProfile).toHaveBeenCalledTimes(1);
  });

  it('벨을 누르면 알림이 열린다', () => {
    const handlers = mount();

    screen.getByRole('button', { name: /shell\.notification/ }).click();

    expect(handlers.onNotification).toHaveBeenCalledTimes(1);
  });
});
