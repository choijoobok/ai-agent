import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { allowNextUnload, useUnsavedGuard } from '@/layouts/ShellLayout/useUnsavedGuard';
import { DASHBOARD_TAB, useTabStore, type WorkTab } from '@/shared/stores/tabStore';

/**
 * <b>브라우저가 하는 이탈</b>에서 미저장을 지킨다 — frontend/tabs.md.
 *
 * <p>셸의 확인들(탭 닫기 · 로그아웃 · 로고 · 언어)은 <b>셸이 아는 이탈</b>만 막는다.
 * 새로고침 · 주소창 엔터 · 브라우저 탭 닫기 · 뒤로 가기는 셸을 거치지 않고 넷 다
 * {@code beforeunload} 하나로 온다.
 *
 * <p>앱은 그것을 <b>막을 수 없고 물어 달라고 요청</b>할 수만 있다. 요청의 실물이
 * {@code preventDefault()} 와 빈 {@code returnValue} 둘이며, 이 파일이 그 둘을 잠근다.
 */
describe('브라우저 이탈에서 미저장을 지킨다 — frontend/tabs.md', () => {
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
    useTabStore.setState({
      tabs: [DASHBOARD_TAB, TAB],
      activeKey: TAB.key,
      dirtyKeys: [],
      dirtySources: {},
    });
  });

  function Guard() {
    useUnsavedGuard();
    return null;
  }

  /**
   * 브라우저가 떠나려는 순간 — 막았으면 {@code prevented} 가 참이다.
   *
   * <p><b>{@code returnValue} 를 실물처럼 만든다.</b> jsdom 의 {@code Event} 에서 그 칸은
   * {@code defaultPrevented} 의 별칭이라 <b>핸들러가 무엇을 썼는지 볼 수 없다</b>. 실제
   * {@code BeforeUnloadEvent} 에서는 <b>자기 문자열 칸</b>이므로(HTML 명세) 여기서도 그렇게
   * 둔다 — 아니면 사파리용 한 줄이 사라져도 테스트가 초록이다.
   */
  function tryToLeave(): { prevented: boolean; returnValue: unknown } {
    const event = new Event('beforeunload', { cancelable: true });
    Object.defineProperty(event, 'returnValue', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(event);
    return {
      prevented: event.defaultPrevented,
      returnValue: (event as unknown as BeforeUnloadEvent).returnValue,
    };
  }

  const soil = () =>
    act(() => useTabStore.setState({ dirtyKeys: [TAB.key], dirtySources: { [TAB.key]: ['g'] } }));

  it('미저장이면 브라우저에게 물어 달라고 한다', () => {
    render(<Guard />);
    soil();

    const asked = tryToLeave();

    expect(asked.prevented).toBe(true);
    // 사파리와 옛 브라우저는 이쪽만 본다 — 하나만 두면 어느 한쪽에서 조용히 안 뜬다.
    expect(asked.returnValue).toBe('');
  });

  it('깨끗하면 아무 말도 하지 않는다 — 늘 걸어 두면 bfcache 가 꺼진다', () => {
    render(<Guard />);

    expect(tryToLeave().prevented).toBe(false);
  });

  it('저장해서 깨끗해지면 다시 조용해진다', () => {
    render(<Guard />);
    soil();
    expect(tryToLeave().prevented).toBe(true);

    act(() => useTabStore.setState({ dirtyKeys: [], dirtySources: {} }));

    expect(tryToLeave().prevented).toBe(false);
  });

  it('언마운트하면 남지 않는다 — 죽은 화면이 이탈을 막으면 앱을 못 벗어난다', () => {
    const view = render(<Guard />);
    soil();
    expect(tryToLeave().prevented).toBe(true);

    act(() => view.unmount());

    expect(tryToLeave().prevented).toBe(false);
  });

  /**
   * <b>같은 결정을 두 번 시키지 않는다.</b> 로고를 눌러 셸을 새로 띄우는 길은 어느 탭이
   * 미저장인지 <b>이름까지 대며</b> 이미 물었다 — 그 직후 브라우저가 자기 문구로 다시
   * 물으면, 두 번째 창은 <b>무엇을 잃는지 말해 주지도 못한 채</b> 같은 것을 묻는다.
   */
  describe('앱이 이미 물었으면 브라우저는 묻지 않는다', () => {
    it('한 번은 통과시킨다', () => {
      render(<Guard />);
      soil();

      allowNextUnload();

      expect(tryToLeave().prevented).toBe(false);
    });

    it('그 한 번뿐이다 — 표를 쓰고 나면 다시 막는다', () => {
      render(<Guard />);
      soil();
      allowNextUnload();
      tryToLeave();

      expect(tryToLeave().prevented).toBe(true);
    });
  });
});
