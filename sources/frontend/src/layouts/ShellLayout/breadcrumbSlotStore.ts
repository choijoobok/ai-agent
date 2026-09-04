import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { useTabStore } from '@/shared/stores/tabStore';
import { useTabIdentity } from '@/layouts/ShellLayout/tabContext';

/**
 * 브레드크럼 줄의 오른쪽 슬롯 — main-shell.md §5.1.
 *
 * <p><b>줄은 셸의 것이고 슬롯은 활성 탭의 화면이 채운다.</b> 셸이 자리만 내주며 무엇이
 * 들어가는지는 모른다 — 화면이 조회조건을 갖지 않으면 <b>그 자리는 빈다</b>(대시보드가 그렇다).
 *
 * <p><b>포털이 아니라 스토어다.</b> 포털은 셸의 DOM 노드를 찾아야 하는데, 화면의 첫 렌더
 * 시점에는 그 노드가 <b>아직 커밋되지 않았다</b> — 찾을 때까지 상태를 하나 더 두게 되고
 * 그것은 효과가 상태를 밀어 다시 그리는 모양이 된다. 등록해 두고 셸이 읽어 가면 그 왕복이
 * 없다.
 *
 * <p><b>활성 탭의 것만 그린다.</b> 비활성 탭도 마운트된 채이므로(ADR-0005) 전부 그리면
 * 사용자는 <b>다른 탭의 조회조건 토글</b>을 보게 된다 — 등록은 탭마다, 표시는 활성 하나다.
 */

interface SlotState {
  byTab: Record<string, ReactNode>;
  put: (tabKey: string, content: ReactNode) => void;
  drop: (tabKey: string) => void;
}

const useSlotStore = create<SlotState>((set) => ({
  byTab: {},
  put: (tabKey, content) => set((state) => ({ byTab: { ...state.byTab, [tabKey]: content } })),
  drop: (tabKey) =>
    set((state) => {
      const { [tabKey]: removed, ...rest } = state.byTab;
      void removed;
      return { byTab: rest };
    }),
}));

/** 화면이 부른다. 탭이 닫히면 등록도 사라진다 — 남으면 없는 탭의 컨트롤이 그려진다. */
export function useBreadcrumbSlot(content: ReactNode): void {
  const identity = useTabIdentity();
  const tabKey = identity?.tabKey;

  useEffect(() => {
    if (!tabKey) return;
    useSlotStore.getState().put(tabKey, content);
    return () => useSlotStore.getState().drop(tabKey);
  }, [tabKey, content]);
}

/** 활성 탭이 등록해 둔 것 — {@code BreadcrumbSlot} 만 부른다. */
export function useBreadcrumbSlotContent(): ReactNode {
  const activeKey = useTabStore((state) => state.activeKey);
  return useSlotStore((state) => (activeKey ? state.byTab[activeKey] : null));
}
