/**
 * 프로필 모달이 받는 것 — frontend/tabs.md. 서버 record 와 1:1 이다.
 *
 * <p>시각은 ISO-8601 문자열이다(`Instant`), 날짜는 `YYYY-MM-DD`(`LocalDate`). 둘을 같은
 * 타입으로 두지 않는 이유는 **업무 날짜에 시간대가 없기** 때문이다(sys/INDEX.md) — `validToDt`
 * 를 현지 시각으로 해석하면 하루가 어긋난다.
 */

/** 비밀번호 정책 중 사람에게 보여줄 것. **거절당하기 전에** 규칙을 알아야 한다. */
export interface PasswordRule {
  minLength: number;
  requireCharsetKinds: number;
  /** 0 이면 재사용을 막지 않는다. */
  reuseBlockCount: number;
  /** 0 이면 주기 만료를 쓰지 않는다. */
  expireDays: number;
}

export interface MyProfile {
  userId: string;
  userNm: string;
  email: string | null;
  localeCd: string;
  validFromDt: string | null;
  validToDt: string | null;
  lastLoginDtm: string | null;
  pwdChgDtm: string | null;
  /** 관리자가 발급한 임시 비밀번호를 아직 쓰고 있다 — 체인 #5 의 독립 조건(backend/security.md). */
  pwdInitYn: boolean;
  /** `null` 이면 보여줄 것이 없다(주기를 안 쓰거나 기준 시각이 없다). 음수면 이미 지났다. */
  pwdExpiresInDays: number | null;
  passwordRule: PasswordRule;
}

/** `SYS_LO_LOGIN.LOGIN_RSLT_CD` — sys/logs.md. 값 자체를 분기에 쓰지 않고 성공 여부만 본다. */
export interface MyLoginRecord {
  creDtm: string;
  loginRsltCd: string;
  clientIp: string | null;
  userAgent: string | null;
}

export interface MyRoleGrant {
  roleId: string;
  roleNm: string;
  roleDesc: string | null;
  validFromDt: string | null;
  validToDt: string | null;
  /** 역할 자체가 켜져 있는가 — `effective` 가 거짓일 때 **어느 쪽이 문제인지**를 가른다. */
  roleUseYn: boolean;
  effective: boolean;
}

export interface MyMenuGrant {
  menuCd: string;
  /** 이름이 아니라 메시지 키(`menu.{MENU_CD}`)다 — sys/code.md. */
  menuNm: string;
  actionCd: 'READ' | 'SAVE' | 'EXPORT' | 'EXECUTE';
  validFromDt: string;
  validToDt: string;
  grantRsn: string;
  effective: boolean;
}

export interface MyAuthority {
  roles: MyRoleGrant[];
  grants: MyMenuGrant[];
  /** 유효 판정의 기준일 — 업무 시간대의 오늘이며 브라우저의 오늘이 아니다(sys/INDEX.md). */
  businessToday: string;
}
