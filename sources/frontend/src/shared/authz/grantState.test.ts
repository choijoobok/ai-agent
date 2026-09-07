import { describe, expect, it } from 'vitest';
import { GRANT_STATES, GRANT_TONE, grantDisplay } from '@/shared/authz/grantState';

/**
 * 부여 상태의 **선언 검사** — quality/test-design.md §2·§3.
 *
 * <p><b>여기서 지키려는 것은 값이 아니라 갈리지 않음이다.</b> 2026-09-07 까지 같은 상태에
 * 공통물은 주의색, 화면 둘은 무색을 주고 있었고 **아무 검사도 울지 않았다** — 6차 화면
 * 재현 회귀가 사람 눈으로 찾았다.
 *
 * <p><b>"아무도 제 맵을 다시 만들지 않는가" 는 여기서 못 본다</b> — 소스 전체를 봐야 하고
 * 그것은 `scripts/check-grant-tone.mjs` 가 `npm run lint` 에서 본다. 둘이 함께여야
 * 잠긴다: 여기는 <i>값이 맞는가</i>, 저기는 <i>정본이 하나인가</i>.
 */
describe('부여 상태', () => {
  it('상태마다 색이 있다 — 하나라도 빠지면 배지가 무색으로 조용히 떨어진다', () => {
    // 타입이 `Record<string, Tone>` 이라 빠진 것을 잡아 주지 않는다 — 그 몫이 이 루프다.
    for (const state of GRANT_STATES) {
      expect(GRANT_TONE[state], `${state} 에 색이 없다`).toBeDefined();
    }
    expect(Object.keys(GRANT_TONE).sort()).toEqual([...GRANT_STATES].sort());
  });

  it('예정은 무색이다 — 경고할 일이 아니다(사용자 결정 2026-09-07)', () => {
    expect(GRANT_TONE).toEqual({ SCHEDULED: 'none', ACTIVE: 'ok', EXPIRED: 'muted' });
  });

  describe('grantDisplay', () => {
    const LABELS = {
      SCHEDULED: 'role.grant.SCHEDULED',
      ACTIVE: 'role.grant.ACTIVE',
      EXPIRED: 'role.grant.EXPIRED',
    };
    const display = grantDisplay(LABELS);

    it('아는 코드는 그 화면의 문구로 바꾼다', () => {
      // 번들이 안 실린 테스트에서 `label` 은 키를 그대로 낸다 — 그 자체가 결정적이다.
      expect(display('ACTIVE')).toBe('role.grant.ACTIVE');
    });

    it('모르는 코드는 그대로 낸다 — 빈 칸으로 만들면 누락이 숨는다', () => {
      expect(display('DELETED')).toBe('DELETED');
    });

    it('문자열이 아니면 빈 칸이다 — 객체가 오면 `[object Object]` 가 셀에 박힌다', () => {
      expect(display({ code: 'ACTIVE' })).toBe('');
      expect(display(undefined)).toBe('');
    });
  });
});
