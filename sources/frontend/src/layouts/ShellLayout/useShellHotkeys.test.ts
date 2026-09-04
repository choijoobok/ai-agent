import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShellHotkeys } from '@/layouts/ShellLayout/useShellHotkeys';

/**
 * 셸 단축키 — main-shell.md §10.
 *
 * <p><b>`Shift` 두 번은 조합이 아니라 같은 키를 잇달아 누르는 것</b>이라, 무엇이 <i>두 번이
 * 아닌가</i>를 정확히 정해야 한다. 그 판정이 느슨하면 <b>대문자를 잇달아 치는 동안 모달이
 * 튀어나온다</b> — 켜지지 않는 단축키보다 나쁘다.
 */
describe('셸 단축키', () => {
  afterEach(() => vi.restoreAllMocks());

  /**
   * 시계를 그 시각에 세워 두고 누른다 — 실제로 400ms 를 기다릴 수는 없고, 기다린다 해도
   * <b>경계에서만 갈리는 판정</b>이라 그 지점을 직접 짚는 편이 정확하다.
   */
  const shift = (at: number, extra: Record<string, unknown> = {}) => {
    vi.spyOn(performance, 'now').mockReturnValue(at);
    fireEvent.keyDown(window, { key: 'Shift', ...extra });
  };

  const mount = () => {
    const openEntry = vi.fn();
    renderHook(() => useShellHotkeys(openEntry));
    return openEntry;
  };

  it('Shift 를 빠르게 두 번 누르면 검색 탭으로 연다', () => {
    const openEntry = mount();

    shift(1000);
    expect(openEntry).not.toHaveBeenCalled();

    shift(1200);
    expect(openEntry).toHaveBeenCalledWith('search');
  });

  it('사이가 멀면 두 번이 아니다', () => {
    const openEntry = mount();

    shift(1000);
    shift(1600);

    expect(openEntry).not.toHaveBeenCalled();
  });

  it('사이에 다른 키가 끼면 두 번이 아니다 — 대문자 연타가 그 경우다', () => {
    const openEntry = mount();

    // Shift+A · Shift+B 를 잇달아 치는 모양이다.
    shift(1000);
    fireEvent.keyDown(window, { key: 'A', shiftKey: true });
    shift(1100);
    fireEvent.keyDown(window, { key: 'B', shiftKey: true });

    expect(openEntry).not.toHaveBeenCalled();
  });

  it('누르고 있는 것은 두 번이 아니다 — 키 반복이 저절로 조건을 채운다', () => {
    const openEntry = mount();

    shift(1000);
    shift(1100, { repeat: true });
    shift(1200, { repeat: true });

    expect(openEntry).not.toHaveBeenCalled();
  });

  it('세 번째부터 다시 셈한다 — 한 번 열고 나면 처음부터다', () => {
    const openEntry = mount();

    shift(1000);
    shift(1100);
    expect(openEntry).toHaveBeenCalledTimes(1);

    // 곧바로 한 번 더 눌러도 열리지 않는다. 두 번이 아니라 한 번이다.
    shift(1200);
    expect(openEntry).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+K 도 연다', () => {
    const openEntry = mount();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(openEntry).toHaveBeenCalledWith('search');
  });

  it('K 만으로는 열지 않는다 — 화면 어디서 치든 듣는 리스너다', () => {
    const openEntry = mount();

    fireEvent.keyDown(window, { key: 'k' });

    expect(openEntry).not.toHaveBeenCalled();
  });
});
