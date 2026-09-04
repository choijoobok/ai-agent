import { describe, expect, it } from 'vitest';
import { actionsOf, canEnterMenu, hasPermission } from '@/shared/authz/permission';

/**
 * 여기서 지키려는 것은 **화면이 서버가 주지 않은 조합을 만들어 내지 않는다**는 것이다.
 * 서버 쪽 같은 규칙은 `EffectiveAuthorityServiceTest` 가 지킨다 — 양쪽에 두는 이유는
 * 실수의 모양이 같고(곱집합) 드러나는 자리가 다르기 때문이다.
 */
describe('permission', () => {
  const PERMISSIONS = ['USER_MGMT:READ', 'USER_MGMT:SAVE', 'LOGIN_LOG:EXPORT'];

  it('쌍이 있으면 참이다', () => {
    expect(hasPermission(PERMISSIONS, 'USER_MGMT', 'SAVE')).toBe(true);
  });

  it('메뉴와 액션을 교차시키지 않는다 — 서버가 주지 않은 조합은 거짓이다', () => {
    // 컬럼별로 합치면 (LOGIN_LOG, SAVE) 와 (USER_MGMT, EXPORT) 가 생긴다.
    expect(hasPermission(PERMISSIONS, 'LOGIN_LOG', 'SAVE')).toBe(false);
    expect(hasPermission(PERMISSIONS, 'USER_MGMT', 'EXPORT')).toBe(false);
  });

  it('모르는 메뉴는 거짓이다', () => {
    expect(hasPermission(PERMISSIONS, 'GHOST', 'READ')).toBe(false);
  });

  it('가진 액션을 선언 순서로 낸다 — 서버 정렬에 기대지 않는다', () => {
    expect(actionsOf(PERMISSIONS, 'USER_MGMT')).toEqual(['READ', 'SAVE']);
    expect(actionsOf(PERMISSIONS, 'LOGIN_LOG')).toEqual(['EXPORT']);
    expect(actionsOf(PERMISSIONS, 'GHOST')).toEqual([]);
  });

  it('진입 판정은 READ 하나다 — READ 가 나머지의 전제이기 때문이다', () => {
    expect(canEnterMenu(PERMISSIONS, 'USER_MGMT')).toBe(true);
    // EXPORT 만 있는 상태는 서버의 저장 검증이 막는다. 프론트는 그것을 흉내내지 않고
    // 규칙대로 READ 만 본다 — 흉내내면 두 곳이 같은 규칙을 각자 갖게 된다.
    expect(canEnterMenu(PERMISSIONS, 'LOGIN_LOG')).toBe(false);
  });

  it('권한이 비면 전부 거짓이다 — 빈 셸이 화면에서도 빈 셸이다', () => {
    expect(hasPermission([], 'USER_MGMT', 'READ')).toBe(false);
    expect(actionsOf([], 'USER_MGMT')).toEqual([]);
  });
});
