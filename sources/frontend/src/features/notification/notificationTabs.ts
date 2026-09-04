import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 알림 모달의 탭 셋 — main-shell.md §7.
 *
 * **순서가 뜻을 갖는다 — 방향이다.** 관리자→전체, 시스템→나, 나→관리자.
 *
 * `ProfileModal` 의 `profileTabs.ts` 와 같은 자리다. 키가 라벨의 메시지 키였던 것을
 * 별도 식별자로 가른 것은 탭이 **내용을 갖게 되면서**다 — 컴포넌트를 고르는 값과 사람이
 * 읽는 글자는 다른 것이고, 번역을 바꾸면 탭이 바뀌는 코드는 설명할 수 없다.
 */
export const NOTIFICATION_TABS = [
  { key: 'notice', label: MSG.NOTIFICATION_TAB_NOTICE },
  { key: 'mine', label: MSG.NOTIFICATION_TAB_MINE },
  { key: 'request', label: MSG.NOTIFICATION_TAB_REQUEST },
] as const;

export type NotificationTab = (typeof NOTIFICATION_TABS)[number]['key'];

/** 키만 뽑은 차례 — 탭 이동 단축키가 읽는다(`useModalTabHotkeys` · main-shell.md §10). */
export const NOTIFICATION_TAB_KEYS: readonly NotificationTab[] = NOTIFICATION_TABS.map(
  (tab) => tab.key,
);
