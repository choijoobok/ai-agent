import type { PasswordRuleSpec } from '@/features/auth/api/authApi';

/**
 * 비밀번호 규칙의 <b>판정만</b> 갖는다 — pwd-change 요건서 §6-2.
 *
 * <p><b>여기 없는 것이 요점이다.</b> 파라미터(9·3·3)도 문구도 갖지 않는다 — 둘 다 서버가
 * 내려주며(`getPasswordPolicy`), 그래야 즉시 검증 문구와 제출 뒤 거절 문구가 **같은
 * `SYS_MESSAGE` 행**에서 나와 갈릴 수 없다.
 *
 * <p><b>모르는 식별자는 건너뛴다.</b> 서버가 규칙을 더하면 화면은 조용히 통과시키고 서버가
 * 거부한다 — 실패가 안전한 방향으로만 난다. 반대는 성립할 수 없다: 규칙 목록의 출처가
 * 서버 하나이므로 화면이 서버에 없는 규칙으로 막을 방법이 없다.
 */

/** 판정에 쓸 문맥. 지금은 로그인 ID 하나이며 `NO_LOGIN_ID` 규칙이 생기는 날 쓰인다. */
export interface PasswordContext {
  loginId: string;
}

type Check = (
  value: string,
  params: Record<string, number>,
  context: PasswordContext,
) => boolean;

/**
 * 영대 · 영소 · 숫자 · 그 밖(특수) 네 계열 중 몇 종이 쓰였는가.
 *
 * <p>서버 `PasswordRules.charsetKinds` 와 <b>같은 정의</b>다 — "그 밖" 이 특수문자이며
 * 허용 목록을 두지 않는다. 목록을 두면 한글·이모지가 아무 계열도 아닌 문자가 되어,
 * 그것만으로 만든 비밀번호가 0종으로 계산되고 왜 거절되는지 설명할 수 없다.
 */
export function charsetKinds(password: string): number {
  let upper = false;
  let lower = false;
  let digit = false;
  let other = false;

  for (const char of password) {
    if (char >= 'A' && char <= 'Z') upper = true;
    else if (char >= 'a' && char <= 'z') lower = true;
    else if (char >= '0' && char <= '9') digit = true;
    else other = true;
  }
  return Number(upper) + Number(lower) + Number(digit) + Number(other);
}

/**
 * 식별자 → 판정. <b>서버가 내는 식별자의 부분집합</b>이어야 한다.
 *
 * <p>`NO_REUSE` 가 여기 없는 것은 원리상 프론트가 할 수 없기 때문이다 — 과거 해시를
 * 내려보낼 수 없다. 서버가 그 규칙에 `clientCheckable: false` 를 실어 보내므로 아래의
 * 조회는 애초에 일어나지 않지만, <b>둘 다 없는 것이 맞다</b>: 한쪽만 막으면 다른 쪽이
 * 바뀌는 날 조용히 틀린 판정이 생긴다.
 */
const CHECKS: Record<string, Check> = {
  MIN_LENGTH: (value, params) => value.length >= (params.min ?? 0),
  CHARSET_KINDS: (value, params) => charsetKinds(value) >= (params.kinds ?? 0),
};

export interface RuleState {
  rule: PasswordRuleSpec;
  /** 프론트가 판정할 수 없는 규칙이면 `null` — 화면은 그것을 <i>아직 모른다</i> 로 그린다. */
  satisfied: boolean | null;
}

/**
 * 체크리스트 한 줄씩 — 서버가 준 순서를 그대로 지킨다.
 *
 * <p><b>빈 입력은 전부 미충족이다</b>(판정 불가가 아니라). 아직 아무것도 안 친 상태에서
 * 모든 줄이 초록이면 <i>이미 다 됐다</i> 로 보인다.
 */
export function evaluateRules(
  rules: PasswordRuleSpec[],
  value: string,
  context: PasswordContext,
): RuleState[] {
  return rules.map((rule) => {
    const check = rule.clientCheckable ? CHECKS[rule.id] : undefined;
    return { rule, satisfied: check ? check(value, rule.params, context) : null };
  });
}

/** 화면이 제출을 막을 근거 — <b>판정할 수 있는 것 전부가 충족</b>인가. */
export function allClientRulesSatisfied(states: RuleState[]): boolean {
  return states.every((state) => state.satisfied !== false);
}
