import { beforeEach, describe, expect, it } from 'vitest';
import { UI_DEFAULTS, UI_STORAGE_KEY, useUiStore } from '@/shared/stores/uiStore';

/**
 * 설정 저장과 초기화 — main-shell.md §9.2.
 *
 * <p><b>초기값과 초기화 값이 같아야 한다.</b> 둘을 따로 두면 <i>"초기화했는데 처음과
 * 다르다"</i> 가 생기고, 되돌릴 경로를 믿지 못하면 사용자는 설정 자체를 피한다.
 */
describe('uiStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUiStore.getState().resetAll();
  });

  it('기본값이 그룹 표 그대로다 — 표가 유일한 출처다', () => {
    const state = useUiStore.getState();
    expect(state.themeMode).toBe(UI_DEFAULTS.theme.themeMode);
    expect(state.primaryColor).toBe(UI_DEFAULTS.theme.primaryColor);
    expect(state.gridRowHeight).toBe(UI_DEFAULTS.grid.gridRowHeight);
    expect(state.fontSize).toBe(UI_DEFAULTS.font.fontSize);
  });

  it('그룹 초기화는 그 그룹만 되돌린다 — 하나 고치려다 전부 잃지 않는다', () => {
    const store = useUiStore.getState();
    store.setPrimaryColor('#ff0000');
    store.setGridRowHeight(52);

    useUiStore.getState().resetGroup('theme');

    expect(useUiStore.getState().primaryColor).toBeNull();
    // 그리드는 건드리지 않았다.
    expect(useUiStore.getState().gridRowHeight).toBe(52);
  });

  it('전체 초기화는 넷을 다 되돌린다', () => {
    const store = useUiStore.getState();
    store.setColorTone('warm');
    store.setFontSize(18);
    store.setGridFontSize(11);
    store.setHeaderAutoHide(true);
    store.setSiderAutoHide(true);

    useUiStore.getState().resetAll();

    const state = useUiStore.getState();
    expect(state.colorTone).toBe('neutral');
    expect(state.fontSize).toBe(14);
    expect(state.gridFontSize).toBe(14);
    expect(state.headerAutoHide).toBe(false);
    expect(state.siderAutoHide).toBe(false);
  });

  it('저장 키가 하나다 — 항목마다 두면 부분 복원된 상태가 생긴다', () => {
    useUiStore.getState().setColorTone('cold');

    const raw = window.localStorage.getItem(UI_STORAGE_KEY);
    expect(raw).not.toBeNull();

    const stored = JSON.parse(raw ?? '{}') as { state: Record<string, unknown> };
    expect(stored.state.colorTone).toBe('cold');
  });

  it('액션은 저장하지 않는다 — 복원되지 않고 배포마다 모양이 바뀐다', () => {
    useUiStore.getState().setCompact(true);

    const stored = JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}') as {
      state: Record<string, unknown>;
    };
    expect(Object.keys(stored.state).some((key) => key.startsWith('set'))).toBe(false);
    expect(stored.state).not.toHaveProperty('resetAll');
  });

  it('자동 숨기기와 접힘은 다른 축이다 — 하나를 켜도 다른 하나가 따라 움직이지 않는다', () => {
    // 접힘은 자리를 차지한 채 좁아지고, 숨기기는 자리를 비운다. 숨긴 채로도 접힘이
    // 남아 있어야 나올 때 그 너비로 나온다(main-shell.md §9.5).
    useUiStore.getState().setSiderCollapsed(true);
    useUiStore.getState().setSiderAutoHide(true);

    expect(useUiStore.getState().siderCollapsed).toBe(true);
    expect(useUiStore.getState().siderAutoHide).toBe(true);
  });

  it('사이더 접힘이 설정 항목이 아니라 현재 상태다 — 설정에 있는 것은 자동 숨기기다', () => {
    useUiStore.getState().setSiderCollapsed(true);
    expect(useUiStore.getState().siderCollapsed).toBe(true);

    useUiStore.getState().toggleSider();
    expect(useUiStore.getState().siderCollapsed).toBe(false);
  });
});
