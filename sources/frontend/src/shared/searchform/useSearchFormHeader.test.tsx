import { useEffect, useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSearchFormHeader } from '@/shared/searchform/useSearchFormHeader';
import { BreadcrumbSlot } from '@/layouts/ShellLayout/BreadcrumbSlot';
import { TabIdentityProvider } from '@/layouts/ShellLayout/tabContext';
import { useTabStore } from '@/shared/stores/tabStore';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 조회조건 헤더 — frontend/tabs.md · UX-15.
 *
 * <p>스물한 화면이 갖고 있던 스무 줄을 한 훅으로 모은 뒤(2026-09-02), <b>그 스무 줄이 하던
 * 일 셋</b>을 여기서 지킨다 — ① 토글이 <b>브레드크럼 줄</b>에 등록된다, ② 접힘이
 * {@code collapsed} 로 나간다, ③ <b>접힌 채로 걸린 조건 수</b>를 말한다.
 *
 * <p>번들이 없는 테스트에서는 메시지 키가 그대로 글자로 나온다 — 키로 찾는다.
 */
describe('조회조건 헤더', () => {
  /** 화면 하나가 훅을 부르고, 셸의 자리(`BreadcrumbSlot`)가 그것을 그린다. */
  function Screen({ count }: { count: number }) {
    const header = useSearchFormHeader();
    const seen = useRef<((value: number) => void)[]>([]);
    seen.current.push(header.onActiveCountChange);

    // 폼이 하는 일을 대신한다 — 조건 수는 렌더가 아니라 효과에서 올라온다.
    useEffect(() => header.onActiveCountChange(count), [header, count]);

    return (
      <>
        <span data-testid="collapsed">{String(header.collapsed)}</span>
        {/* 렌더가 여러 번 돌아도 같은 함수인지 — 화면이 의존 배열에 넣을 수 있는 근거다. */}
        <span data-testid="stable">{String(new Set(seen.current).size)}</span>
      </>
    );
  }

  function draw(count = 0) {
    return render(
      <TabIdentityProvider value={{ tabKey: 't1', menuCd: 'NOTICE_MGMT' }}>
        <BreadcrumbSlot />
        <Screen count={count} />
      </TabIdentityProvider>,
    );
  }

  beforeEach(() => {
    localStorage.clear();
    useTabStore.setState({ activeKey: 't1' });
  });

  it('토글이 브레드크럼 줄에 등록된다 — 폼 안에 있으면 접은 뒤 되돌릴 수 없다', () => {
    draw();
    expect(screen.getByText(MSG.SEARCH_FORM_HIDE)).toBeTruthy();
    expect(screen.getByTestId('collapsed').textContent).toBe('false');
  });

  it('누르면 접히고 그 사실이 폼으로 나간다', () => {
    draw();
    fireEvent.click(screen.getByText(MSG.SEARCH_FORM_HIDE));
    expect(screen.getByText(MSG.SEARCH_FORM_SHOW)).toBeTruthy();
    expect(screen.getByTestId('collapsed').textContent).toBe('true');
  });

  it('접힌 채로 걸린 조건이 있으면 그 수를 말한다 — 펼쳐 있으면 말하지 않는다', () => {
    draw(3);
    expect(screen.queryByText(MSG.SEARCH_FORM_ACTIVE)).toBeNull();

    fireEvent.click(screen.getByText(MSG.SEARCH_FORM_HIDE));
    expect(screen.getByText(MSG.SEARCH_FORM_ACTIVE)).toBeTruthy();
  });

  it('조건이 0이면 접혀도 말하지 않는다 — 걸린 것이 없다', () => {
    draw(0);
    fireEvent.click(screen.getByText(MSG.SEARCH_FORM_HIDE));
    expect(screen.queryByText(MSG.SEARCH_FORM_ACTIVE)).toBeNull();
  });

  it('조건 수를 받는 함수가 렌더 사이에 같은 것이다', () => {
    draw(1);
    fireEvent.click(screen.getByText(MSG.SEARCH_FORM_HIDE));
    expect(screen.getByTestId('stable').textContent).toBe('1');
  });
});
