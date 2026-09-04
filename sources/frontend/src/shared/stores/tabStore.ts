import { create } from 'zustand';

/**
 * 열린 탭 하나 — frontend/packages.md.
 *
 * <p><b>`key` 가 `pathname` 이 아닌 것이 이 설계의 중심</b>이다. 같은 메뉴를 여러 탭에
 * 띄울 수 있으므로(frontend/tabs.md "새 탭으로 열기") 경로는 탭을 식별하지 못한다. 라우트
 * 엘리먼트에 이 `key` 를 React key 로 주면 <b>같은 라우트라도 탭이 다르면 별개 인스턴스</b>가
 * 되어 검색 조건·스크롤·입력값을 공유하지 않는다.
 */
export interface WorkTab {
  key: string;
  menuCd: string;
  pathname: string;
  /** 메뉴명이 아니라 메시지 키(`menu.{MENU_CD}`)다 — 번역은 그리는 쪽이 한다. */
  titleKey: string;
  /**
   * 같은 메뉴의 몇 번째 인스턴스인가. 1 이면 제목에 번호를 붙이지 않는다.
   *
   * <p><b>닫아도 다시 매기지 않는다.</b> `(2)` 를 남겨 두고 `(1)` 을 닫으면 남은 탭은 계속
   * `(2)` 다 — 눈앞의 탭 제목이 스스로 바뀌는 쪽이 더 혼란스럽다.
   */
  instance: number;
  closable: boolean;
  /**
   * 연 순서. <b>위치가 아니라 나이</b>다 — 드래그로 자리를 바꿔도(frontend/packages.md) 상한에 닿았을 때
   * 닫히는 대상은 바뀌지 않아야 한다(frontend/packages.md).
   */
  seq: number;
}

/** frontend/packages.md 요구 1 — <b>비고정 탭</b> 기준이다. 대시보드가 한 칸을 잡아먹지 않는다(frontend/tabs.md). */
export const TAB_LIMIT = 20;

export const DASHBOARD_MENU_CD = 'DASHBOARD';

/**
 * frontend/tabs.md — 닫을 수 없고 언제나 첫 자리다.
 *
 * <p><b>탭이 0개인 상태를 허용하지 않으려는 것</b>이다. 허용하면 탭바가 나타났다 사라지고
 * 그때마다 콘텐츠 영역의 높이가 바뀐다.
 */
export const DASHBOARD_TAB: WorkTab = {
  key: 'dashboard',
  menuCd: DASHBOARD_MENU_CD,
  pathname: '/dashboard',
  titleKey: 'menu.DASHBOARD',
  instance: 1,
  closable: false,
  seq: 0,
};

/** 메뉴를 여는 데 필요한 것 전부. 트리·검색·즐겨찾기가 모두 이 모양을 만든다. */
export interface OpenTarget {
  menuCd: string;
  pathname: string;
  titleKey: string;
}

export type OpenOutcome =
  /** 열었거나(새 탭) 이미 있던 탭으로 전환했다. */
  | { type: 'opened'; key: string }
  | { type: 'activated'; key: string }
  /** 상한에 닿았다. <b>열지 않았다</b> — 확인을 받고 {@link TabState.closeAndOpen} 을 부른다. */
  | { type: 'limit'; victim: WorkTab };

export interface TabState {
  tabs: WorkTab[];
  activeKey: string;
  /** 미저장 변경이 있는 탭. 화면이 스스로 세운다 — 스토어는 폼을 모른다. */
  dirtyKeys: string[];

  open: (target: OpenTarget) => OpenOutcome;
  /** frontend/tabs.md — 이미 열려 있어도 <b>항상 새 인스턴스</b>를 만든다. */
  openNewInstance: (target: OpenTarget) => OpenOutcome;
  closeAndOpen: (victimKey: string, target: OpenTarget) => OpenOutcome;

  activate: (key: string) => void;
  close: (key: string) => void;
  /** frontend/packages.md — 현재 탭과 대시보드를 남긴다. */
  closeOthers: (key: string) => void;
  /** frontend/packages.md · frontend/tabs.md — 대시보드만 남긴다. 헤더 로고와 같은 동작이다. */
  closeAll: () => void;
  /**
   * frontend/packages.md — 드래그로 순서를 바꾼다.
   *
   * <p><b>고정 탭은 제자리를 지키고, 그 앞으로 끼어들 수도 없다</b> — 대시보드는 언제나 맨
   * 왼쪽이다. 둘을 함께 막지 않으면 대시보드는 못 옮기는데 다른 탭이 그 왼쪽에 들어간다.
   */
  move: (fromKey: string, toKey: string) => void;

  setDirty: (key: string, dirty: boolean) => void;
  /** — 권한을 잃은 메뉴의 탭을 정리한다. 닫힌 탭을 돌려준다. */
  retain: (allowedMenuCds: readonly string[]) => WorkTab[];
  /** 로그아웃 정리. */
  reset: () => void;
}

/**
 * 화면에 보이는 탭 제목. <b>탭바와 확인·토스트 문구가 같은 값을 써야 한다</b> — 갈리면
 * "menu.LOGIN_LOG, menu.LOGIN_LOG 탭을 닫았습니다" 처럼 <b>어느 탭인지 구분되지 않는</b>
 * 안내가 나간다(실제로 그렇게 나왔다).
 *
 * <p>번역은 부르는 쪽이 한다 — 스토어가 메시지 번들을 알면 테스트가 그것을 끌고 온다.
 */
export function tabTitle(tab: WorkTab, translate: (key: string) => string): string {
  const title = translate(tab.titleKey);
  return tab.instance > 1 ? `${title} (${tab.instance})` : title;
}

let sequence = 0;

function nextSeq(): number {
  sequence += 1;
  return sequence;
}

function createTab(target: OpenTarget, instance: number): WorkTab {
  const seq = nextSeq();
  return {
    key: `${target.menuCd}#${seq}`,
    menuCd: target.menuCd,
    pathname: target.pathname,
    titleKey: target.titleKey,
    instance,
    closable: true,
    seq,
  };
}

/**
 * 열린 탭과 활성 탭 — frontend/packages.md.
 *
 * <p><b>`persist` 를 쓰지 않는다.</b> 새로고침 시 탭을 복원하지 않기로 이미 정했으므로
 * (frontend/packages.md 요구 6) 저장할 대상이 없다 — F5 는 <b>대시보드 + 현재 URL 의 탭 하나</b>로 시작한다.
 *
 * <p><b>폼 입력값·스크롤은 여기 없다.</b> 비활성 탭의 컴포넌트를 언마운트하지 않고 숨기므로
 * 그 값들은 컴포넌트 안에 그대로 남는다. 이 스토어가 아는 것은 <i>"어떤 탭이 열려 있는가"</i>
 * 뿐이며, 화면 데이터를 여기 복사해 넣으면 같은 메뉴의 두 인스턴스가 그것을 공유하게 된다
 * (frontend/packages.md).
 */
export const useTabStore = create<TabState>((set, get) => ({
  tabs: [DASHBOARD_TAB],
  activeKey: DASHBOARD_TAB.key,
  dirtyKeys: [],

  open: (target) => {
    const { tabs } = get();

    // 트리에서 이미 열린 메뉴를 다시 누르면 그 탭으로 전환한다 — 새 인스턴스는 명시적
    // 조작(새 탭으로 열기)일 때만 만든다(frontend/tabs.md).
    const existing = tabs.find((tab) => tab.menuCd === target.menuCd);
    if (existing) {
      set({ activeKey: existing.key });
      return { type: 'activated', key: existing.key };
    }
    return openFresh(target, set, get);
  },

  openNewInstance: (target) => openFresh(target, set, get),

  closeAndOpen: (victimKey, target) => {
    closeTabs(set, get, [victimKey]);
    return openFresh(target, set, get);
  },

  activate: (key) => {
    if (get().tabs.some((tab) => tab.key === key)) {
      set({ activeKey: key });
    }
  },

  close: (key) => closeTabs(set, get, [key]),

  closeOthers: (key) =>
    closeTabs(
      set,
      get,
      get()
        .tabs.filter((tab) => tab.closable && tab.key !== key)
        .map((tab) => tab.key),
    ),

  move: (fromKey, toKey) =>
    set((state) => {
      const from = state.tabs.findIndex((tab) => tab.key === fromKey);
      const to = state.tabs.findIndex((tab) => tab.key === toKey);
      if (from < 0 || to < 0 || from === to) {
        return {};
      }
      // 고정 탭은 집을 수도, 그 자리를 내줄 수도 없다.
      if (!state.tabs[from].closable || !state.tabs[to].closable) {
        return {};
      }
      const next = [...state.tabs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { tabs: next };
    }),

  closeAll: () =>
    closeTabs(
      set,
      get,
      get()
        .tabs.filter((tab) => tab.closable)
        .map((tab) => tab.key),
    ),

  setDirty: (key, dirty) =>
    set((state) => ({
      dirtyKeys: dirty
        ? state.dirtyKeys.includes(key)
          ? state.dirtyKeys
          : [...state.dirtyKeys, key]
        : state.dirtyKeys.filter((dirtyKey) => dirtyKey !== key),
    })),

  retain: (allowedMenuCds) => {
    const allowed = new Set(allowedMenuCds);
    const doomed = get().tabs.filter((tab) => tab.closable && !allowed.has(tab.menuCd));
    if (doomed.length > 0) {
      closeTabs(
        set,
        get,
        doomed.map((tab) => tab.key),
      );
    }
    return doomed;
  },

  reset: () => {
    sequence = 0;
    set({ tabs: [DASHBOARD_TAB], activeKey: DASHBOARD_TAB.key, dirtyKeys: [] });
  },
}));

/** 상한 판정과 인스턴스 번호가 한 곳에 있어야 두 진입 경로가 어긋나지 않는다. */
function openFresh(
  target: OpenTarget,
  set: (partial: Partial<TabState>) => void,
  get: () => TabState,
): OpenOutcome {
  const { tabs } = get();
  const closable = tabs.filter((tab) => tab.closable);

  if (closable.length >= TAB_LIMIT) {
    // 말없이 닫지 않는다 — 사용자는 무엇이 사라졌는지 모른 채 작업을 잃는다(frontend/packages.md).
    // 기준은 위치가 아니라 나이다.
    const victim = closable.reduce((oldest, tab) => (tab.seq < oldest.seq ? tab : oldest));
    return { type: 'limit', victim };
  }

  const instance = tabs.filter((tab) => tab.menuCd === target.menuCd).length + 1;
  const tab = createTab(target, instance);
  set({ tabs: [...tabs, tab], activeKey: tab.key });
  return { type: 'opened', key: tab.key };
}

/**
 * 닫기의 유일한 구현. 경로가 넷(탭 x · 다른 탭 · 모든 탭 · 권한 정리)인데 <b>활성 탭이
 * 닫혔을 때 어디로 가는가</b>를 각자 정하면 넷이 다르게 움직인다.
 */
function closeTabs(
  set: (partial: Partial<TabState>) => void,
  get: () => TabState,
  keys: readonly string[],
): void {
  const doomed = new Set(keys);
  const { tabs, activeKey, dirtyKeys } = get();

  // 고정 탭은 어떤 경로로도 닫히지 않는다 — 여기 한 줄이 그것을 보장한다.
  const remaining = tabs.filter((tab) => !tab.closable || !doomed.has(tab.key));
  if (remaining.length === tabs.length) {
    return;
  }

  const activeSurvives = remaining.some((tab) => tab.key === activeKey);
  set({
    tabs: remaining,
    // 활성 탭이 닫히면 첫 탭으로 간다. 남은 탭이 언제나 있으므로(대시보드) 빈 상태가 없다.
    activeKey: activeSurvives ? activeKey : remaining[0].key,
    dirtyKeys: dirtyKeys.filter((key) => !doomed.has(key)),
  });
}
