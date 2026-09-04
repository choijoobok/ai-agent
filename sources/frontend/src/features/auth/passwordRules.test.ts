import { describe, expect, it } from 'vitest';
import type { PasswordRuleSpec } from '@/features/auth/api/authApi';
import {
  allClientRulesSatisfied,
  charsetKinds,
  evaluateRules,
} from '@/features/auth/passwordRules';

/**
 * 비밀번호 규칙의 프론트 판정 — pwd-change 요건서 §6-2.
 *
 * <p><b>황금 케이스 표가 이 파일의 전부다.</b> 프론트와 서버가 같은 입력에 같은 판정을
 * 내는지가 유일하게 지켜야 할 것이고, 여기 있는 입력은 서버
 * {@code PasswordRulesTest} 가 쓰는 것과 <b>같은 뜻</b>으로 골랐다 — 계열 경계
 * (대문자·소문자·숫자·그 밖)와 길이 경계.
 */
describe('비밀번호 규칙 — 프론트 판정', () => {
  const rule = (
    id: string,
    params: Record<string, number>,
    clientCheckable = true,
  ): PasswordRuleSpec => ({ id, params, clientCheckable, message: `${id} 규칙` });

  describe('문자 종류 — 서버 charsetKinds 와 같은 정의', () => {
    it.each([
      ['', 0],
      ['abcd', 1],
      ['abcD', 2],
      ['abcD1', 3],
      ['abcD1!', 4],
      // "그 밖" 이 특수문자다 — 허용 목록을 두지 않으므로 한글도 한 계열을 채운다.
      ['가나다', 1],
      ['abc가', 2],
    ])('%s → %i종', (value, expected) => {
      expect(charsetKinds(value)).toBe(expected);
    });
  });

  it('최소 길이는 경계를 포함한다 — 9자는 통과한다', () => {
    const rules = [rule('MIN_LENGTH', { min: 9 })];
    expect(evaluateRules(rules, 'abcdefgh', { loginId: 'u' })[0].satisfied).toBe(false);
    expect(evaluateRules(rules, 'abcdefghi', { loginId: 'u' })[0].satisfied).toBe(true);
  });

  it('빈 입력은 판정 불가가 아니라 미충족이다 — 초록으로 시작하면 다 된 것으로 보인다', () => {
    const states = evaluateRules([rule('MIN_LENGTH', { min: 9 })], '', { loginId: 'u' });
    expect(states[0].satisfied).toBe(false);
  });

  it('clientCheckable:false 는 판정하지 않는다 — 서버가 잡는다', () => {
    const states = evaluateRules([rule('NO_REUSE', { count: 3 }, false)], 'anything', {
      loginId: 'u',
    });
    expect(states[0].satisfied).toBeNull();
    // 판정할 수 없는 것으로 제출을 막지 않는다 — 통과할 수 있는 값도 막히게 된다.
    expect(allClientRulesSatisfied(states)).toBe(true);
  });

  it('모르는 식별자는 조용히 통과시킨다 — 서버가 규칙을 더해도 화면이 먼저 깨지지 않는다', () => {
    const states = evaluateRules([rule('NO_REPEAT', { len: 4 })], 'aaaaaaaaa', { loginId: 'u' });
    expect(states[0].satisfied).toBeNull();
    expect(allClientRulesSatisfied(states)).toBe(true);
  });

  it('문구는 서버가 준 것을 그대로 나른다 — 화면이 조립하지 않는다', () => {
    const spec = rule('MIN_LENGTH', { min: 9 });
    expect(evaluateRules([spec], 'x', { loginId: 'u' })[0].rule.message).toBe(spec.message);
  });

  it('판정 가능한 것 하나라도 미충족이면 제출을 막는다', () => {
    const rules = [rule('MIN_LENGTH', { min: 9 }), rule('CHARSET_KINDS', { kinds: 3 })];
    expect(allClientRulesSatisfied(evaluateRules(rules, 'abcdefghi', { loginId: 'u' }))).toBe(
      false,
    );
    expect(allClientRulesSatisfied(evaluateRules(rules, 'abcdefgH1', { loginId: 'u' }))).toBe(
      true,
    );
  });
});
