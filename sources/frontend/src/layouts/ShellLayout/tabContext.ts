import { createContext, useContext } from 'react';

/**
 * 이 화면이 <b>어느 탭 안에 있는가</b>.
 *
 * <p>필요한 이유는 <b>비활성 탭도 마운트된 채</b>이기 때문이다(ADR-0005). 셸의 한 자리를
 * 화면이 채우는 구조(main-shell.md §5.1 의 브레드크럼 슬롯)에서 모든 탭이 그 자리에 그리려 들면
 * <b>마지막에 그린 탭이 이긴다</b> — 활성 탭만 그려야 한다.
 *
 * <p>`menuCd` 가 아니라 <b>탭 키</b>다. 같은 메뉴를 여러 탭에 띄울 수 있으므로(main-shell.md §4.7.1)
 * 메뉴 코드로는 인스턴스를 가릴 수 없다.
 *
 * <p><b>"지금 활성인가" 는 여기 없다.</b> 한동안 {@code active} 를 실어 보냈는데 <b>읽는
 * 곳이 하나도 없었다</b> — 위의 "활성 탭만 그린다" 는 {@code BreadcrumbSlot} 이
 * {@code tabStore.activeKey} 를 직접 보고 판단한다. 그 값이 실려 있는 동안에는 봉투가 전환마다
 * 새것이 되어 <b>모든 탭의 소비자가 함께 깨어났다</b>(2026-08-31). 여기 담는 것은 <b>탭이
 * 사는 동안 바뀌지 않는 것</b>뿐이며, 바뀌는 것을 담아야 할 날에는 그 비용을 먼저 재야 한다.
 */
export interface TabIdentity {
  tabKey: string;
  menuCd: string;
}

const TabContext = createContext<TabIdentity | null>(null);

export const TabIdentityProvider = TabContext.Provider;

/** 셸 밖(로그인 화면 등)에서는 {@code null} 이다 — 그 자리에는 슬롯이 없다. */
export function useTabIdentity(): TabIdentity | null {
  return useContext(TabContext);
}
