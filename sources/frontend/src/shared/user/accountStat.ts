import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';

/**
 * 계정 상태 — sys/user-role.md · screen/user/requirements.md. **파생값이며 컬럼이 아니다.**
 *
 * <p>계정을 못 쓰게 하는 넷(`USE_YN` · 기간 만료 · `LOCK_YN` · `DORMANT_YN`)을 **접근 제어
 * 체인 순서로 먼저 걸린 것 하나**로 접은 것이다. 로그인 이력이 결과 코드를 하나만 남기는
 * 것과 같은 규칙이다(sys/logs.md).
 *
 * <h2>왜 `shared/` 인가</h2>
 *
 * <p>**두 화면이 쓴다** — `USER_MGMT`(screen/user/requirements.md)와 `USER_AUTH_MGMT`(screen/user/requirements.md). frontend/packages.md 이
 * *"두 번째 화면이 쓰는 순간 `shared/` 로 올린다"* 고 정한 그 자리이며, features 끼리 직접
 * import 하면 **한쪽이 다른 쪽의 부품 창고**가 된다.
 *
 * <p>여기 있는 것이 특히 중요한 이유는 **같은 계정이 두 화면에서 다르게 보이면 안 되기**
 * 때문이다. 체인 순서든 라벨이든 한쪽만 고치면 그 순간 *어느 쪽이 맞나* 라는 질문이 생긴다.
 *
 * <p>**공통코드가 아니다.** 서버가 계산하는 값이고 다섯에서 늘 일이 없으므로 표시 문자열은
 * 메시지 키(`user.stat.*`)이며, 컬럼 타입도 `code` 가 아니라 `text` 다(frontend/packages.md).
 */
export type AccountStat = 'NORMAL' | 'DISABLED' | 'EXPIRED' | 'LOCKED' | 'DORMANT';

/** 코드 → 메시지 키. **값이 아니라 키**다 — 한국어·영어는 `SYS_MESSAGE` 의 것이다. */
export const ACCOUNT_STAT_LABEL: Record<AccountStat, string> = {
  NORMAL: MSG.USER_STAT_NORMAL,
  DISABLED: MSG.USER_STAT_DISABLED,
  EXPIRED: MSG.USER_STAT_EXPIRED,
  LOCKED: MSG.USER_STAT_LOCKED,
  DORMANT: MSG.USER_STAT_DORMANT,
};

/**
 * 셀에 그릴 글자.
 *
 * <p>**모르는 값이 오면 `정상` 이 아니라 값 그대로**다. 서버가 열거를 늘렸는데 화면이 아직
 * 모르는 상태이며, 그때 *정상* 으로 접으면 **못 쓰는 계정을 쓸 수 있다고 말한다** — 화면이
 * 거짓말을 하느니 코드가 그대로 보이는 편이 낫다(sys/code.md 과 같은 방향).
 */
export function accountStatText(value: unknown): string {
  const key = ACCOUNT_STAT_LABEL[value as AccountStat];
  if (key) {
    return label(key);
  }
  // `unknown` 을 그대로 잇지 않는다 — 객체가 오면 `[object Object]` 가 셀에 박힌다.
  return typeof value === 'string' ? value : '';
}
