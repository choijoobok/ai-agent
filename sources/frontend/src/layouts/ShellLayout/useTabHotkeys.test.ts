import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTabHotkeys } from '@/layouts/ShellLayout/useTabHotkeys';
import { useTabStore } from '@/shared/stores/tabStore';

/**
 * 탭 이동 단축키 — frontend/tabs.md.
 *
 * <p><b>수정자 없이 듣기로 하면서 "무엇이 화면의 것인가" 를 정해야 했다.</b> 그리드는
 * `PageUp`/`PageDown` 으로 행을 넘기고 긴 입력 칸은 캐럿을 옮긴다 — 그 자리에서 탭이 바뀌면
 * <b>쓰던 것을 잃는다</b>. 여기서 재는 것은 그 경계다.
 */
describe('탭 이동 단축키', () => {
  const seed = () => {
    const store = useTabStore.getState();
    store.reset();
    store.open({ menuCd: 'A', pathname: '/a', titleKey: 'A' });
    store.open({ menuCd: 'B', pathname: '/b', titleKey: 'B' });
    return useTabStore.getState().tabs;
  };

  const mount = () => {
    const selectTab = vi.fn();
    renderHook(() => useTabHotkeys(selectTab));
    return selectTab;
  };

  /** 그 요소에서 난 키로 만든다 — 경계가 <b>어디서 눌렀는가</b>로 갈리기 때문이다. */
  const pressOn = (element: Element, init: Record<string, unknown> = {}) => {
    document.body.appendChild(element);
    fireEvent.keyDown(element, { key: 'PageDown', ...init });
  };

  it('수정자 없이 오른쪽 탭으로 간다', () => {
    const tabs = seed();
    useTabStore.getState().activate(tabs[0].key);
    const selectTab = mount();

    fireEvent.keyDown(window, { key: 'PageDown' });

    expect(selectTab).toHaveBeenCalledWith(tabs[1].key);
  });

  it('끝에서 순환한다 — 마지막에서 오른쪽이면 첫 탭이다', () => {
    const tabs = seed();
    useTabStore.getState().activate(tabs[tabs.length - 1].key);
    const selectTab = mount();

    fireEvent.keyDown(window, { key: 'PageDown' });

    expect(selectTab).toHaveBeenCalledWith(tabs[0].key);
  });

  it('Ctrl 이 눌려 있으면 비켜 간다 — 그쪽은 브라우저의 탭 전환이다', () => {
    seed();
    const selectTab = mount();

    fireEvent.keyDown(window, { key: 'PageDown', ctrlKey: true });

    expect(selectTab).not.toHaveBeenCalled();
  });

  it('Alt 가 눌려 있으면 비켜 간다 — 같은 일에 길이 둘이면 정본이 갈린다', () => {
    seed();
    const selectTab = mount();

    fireEvent.keyDown(window, { key: 'PageDown', altKey: true });

    expect(selectTab).not.toHaveBeenCalled();
  });

  it('입력 칸에서는 캐럿이 움직여야 한다', () => {
    seed();
    const selectTab = mount();

    pressOn(document.createElement('textarea'));

    expect(selectTab).not.toHaveBeenCalled();
  });

  it('그리드 안에서는 행이 넘어가야 한다 — 그리드가 이 키를 쓴다', () => {
    seed();
    const selectTab = mount();

    const grid = document.createElement('div');
    grid.className = 'ag-root-wrapper';
    const cell = document.createElement('div');
    grid.appendChild(cell);
    document.body.appendChild(grid);

    fireEvent.keyDown(cell, { key: 'PageDown' });

    expect(selectTab).not.toHaveBeenCalled();
  });

  it('화면이 이미 쓴 키는 화면의 것이다', () => {
    seed();
    const selectTab = mount();

    const target = document.createElement('div');
    document.body.appendChild(target);
    target.addEventListener('keydown', (event) => event.preventDefault());

    fireEvent.keyDown(target, { key: 'PageDown' });

    expect(selectTab).not.toHaveBeenCalled();
  });
});
