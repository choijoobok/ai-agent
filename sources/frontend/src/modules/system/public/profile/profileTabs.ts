// @feat FEAT-501
import { MSG } from '@/shared/i18n/messageKeys';

/** 프로필 모달의 탭 — frontend/tabs.md. 넷 다 "나에 대한 것" 이다. */
export type ProfileTab = 'info' | 'password' | 'history' | 'roles';

/**
 * 순서가 뜻을 갖는다 — 자주 보는 것부터다. 내 정보가 첫 탭인 이유는 모달을 여는 가장 흔한
 * 까닭이 그것이기 때문이고, 그래서 첫 응답(`getMyProfile`)만 모달과 함께 온다.
 *
 * <p>컴포넌트 파일 밖에 두는 것은 `react-refresh/only-export-components` 때문이다 —
 * 컴포넌트와 상수를 한 파일에서 내보내면 그 파일의 빠른 갱신이 꺼진다.
 */
export const PROFILE_TABS: ReadonlyArray<{ key: ProfileTab; titleKey: string }> = [
  { key: 'info', titleKey: MSG.PROFILE_TAB_INFO },
  { key: 'password', titleKey: MSG.PROFILE_TAB_PASSWORD },
  { key: 'history', titleKey: MSG.PROFILE_TAB_HISTORY },
  { key: 'roles', titleKey: MSG.PROFILE_TAB_ROLES },
];

/** 키만 뽑은 차례 — 탭 이동 단축키가 읽는다(`useModalTabHotkeys` · frontend/tabs.md). */
export const PROFILE_TAB_KEYS: readonly ProfileTab[] = PROFILE_TABS.map((tab) => tab.key);
