import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 진입 모달의 탭 — main-shell.md §4.3.
 *
 * <p><b>모달과 같은 파일에 두지 않는다.</b> 사이더의 아이콘도 이 표를 쓰는데, 컴포넌트
 * 파일에서 상수를 함께 내보내면 개발 중 Fast Refresh 가 <b>파일 전체를 다시 만든다</b> —
 * 그때마다 모달의 탭과 커서가 초기화된다.
 */
export type EntryTab = 'search' | 'favorite' | 'recent' | 'frequent';

/** 탭의 차례와 이름. 사이더의 아이콘 툴팁도 같은 키를 쓴다. */
export const ENTRY_TABS: { key: EntryTab; title: string }[] = [
  { key: 'search', title: MSG.SHELL_ENTRY_TAB_SEARCH },
  { key: 'favorite', title: MSG.SHELL_ENTRY_TAB_FAVORITE },
  { key: 'recent', title: MSG.SHELL_ENTRY_TAB_RECENT },
  { key: 'frequent', title: MSG.SHELL_ENTRY_TAB_FREQUENT },
];

/**
 * 키만 뽑은 차례 — 탭 이동 단축키가 읽는다(`useModalTabHotkeys`).
 *
 * <p><b>모듈 상수로 둔다.</b> 렌더 안에서 `ENTRY_TABS.map` 으로 만들어도 되지만, 그러면
 * 같은 배열을 <b>키를 누를 때마다가 아니라 렌더마다</b> 새로 만든다.
 */
export const ENTRY_TAB_KEYS: readonly EntryTab[] = ENTRY_TABS.map((entry) => entry.key);
