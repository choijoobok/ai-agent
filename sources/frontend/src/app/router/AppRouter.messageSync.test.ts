// @feat FEAT-505
import { describe, expect, it } from 'vitest';
import appRouterSource from './AppRouter.tsx?raw';

describe('AppRouter 메시지 세션 복원 계약', () => {
  it('세션 복원도 로그인 응답의 메시지 캐시 버전과 동기화한다', () => {
    expect(appRouterSource).toContain('messages.syncWithSession(session.user.localeCd, session.cacheVersions?.message)');
    expect(appRouterSource).not.toContain('messages.load({ lang: session.user.localeCd, verify: false })');
  });
});
