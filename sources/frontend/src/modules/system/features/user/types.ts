// @feat FEAT-501
/** 서버 `UserRow` · `IssuedPassword` 와 1:1 — screen/admin/system/user/requirements.md. */

import type { AccountStat } from '@/shared/user/accountStat';

/*
  **계정 상태는 여기 없다** — `shared/user/accountStat.ts` 다.

  `USER_AUTH_MGMT`(screen/admin/system/user/requirements.md)의 좌 pane 이 같은 값을 쓰면서 올렸다. frontend/packages.md 의
  *"두 번째 화면이 쓰는 순간 shared/ 로 올린다"* 이며, 무엇보다 **같은 계정이 두 화면에서
  다르게 보이면 안 된다** — 체인 순서든 라벨이든 한쪽만 고치면 그 순간 *어느 쪽이 맞나*
  라는 질문이 생긴다.
*/

/**
 * 마스터의 한 행 — **목록이 곧 상세다**(screen/admin/system/user/requirements.md).
 *
 * <p>편집 폼을 없애면서(frontend/grid.md) 이 행이 `SYS_USER` 의 모든 컬럼을 갖게 됐다. 숨김 컬럼도
 * 응답에는 들어 있고 그리드 설정에서 켜면 보인다 — 그래서 행을 골라 다시 조회할 것이 없고
 * `getDetail` 이 없다.
 *
 * <p>**비밀번호가 없다.** 해시조차 내리지 않는다 — 응답에 담기는 순간 그것은 화면에 없어도
 * 브라우저에 있는 값이 된다(backend/security.md).
 */
export interface UserRow {
  /** PK. **신규 행에서만 편집 가능**하다 — 자연키라 등록 후 수정 불가다(sys/user-role.md). */
  userId: string;
  /** **필수**다. 평문이며 암호화하지 않는다 — sys/user-role.md. */
  userNm: string;
  /** **필수**다. 임시 비밀번호의 발송처이기도 하다(AUTH-07). */
  email: string | null;
  /** 파생 하나 — 원본 넷은 아래에 각각 있고 기본 숨김이다(screen/admin/system/user/requirements.md). */
  accountStat: AccountStat;
  /** **관리자가 건다** — 편집 가능(screen/admin/system/user/requirements.md). */
  useYn: boolean;
  /** 〃. **양끝 포함**이며 `null` 은 제한 없음이다(sys/INDEX.md). */
  validFromDt: string | null;
  validToDt: string | null;
  lastLoginDtm: string | null;
  localeCd: string;
  /** **시스템이 건다** — 셀은 읽기 전용이고 푸는 것은 ①의 버튼이다(screen/admin/system/user/requirements.md). */
  lockYn: boolean;
  lockDtm: string | null;
  loginFailCnt: number;
  /** 〃. 배치가 건다(sys/user-role.md). */
  dormantYn: boolean;
  /** 발급 후 미변경(AUTH-06) — 임시 비밀번호가 그대로 남아 있다는 뜻이다. */
  pwdInitYn: boolean;
  pwdChgDtm: string | null;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

/**
 * 발급된 임시 비밀번호 하나 — **이 응답에만 있다**(screen/admin/system/user/requirements.md).
 *
 * <p>DB 에는 해시가 들어가므로 재조회로 다시 얻을 수 없다. 잃으면 다시 발급하는 것 말고
 * 길이 없어서, 저장과 발급 API 가 결과를 화면에 준다.
 *
 * <p>**화면에 보여주는 것이 결정이다**(2026-08-30 — screen/admin/system/user/requirements.md 의 미결을 닫는다). 메일 연동이
 * 없는 배포에서 관리자가 전할 수단이 이것뿐이며, sys/code.md 이 이 기능을 *"잠긴 계정을 푸는
 * 유일한 경로"* 라 부른 이상 전달 수단이 없으면 경로가 아니다.
 */
export interface IssuedPassword {
  userId: string;
  /** **여러 건을 한 번에** 발급할 수 있어 함께 온다 — 누구의 것인지를 모달이 말해야 한다. */
  userNm: string;
  password: string;
}

// ── 디테일 탭 다섯 (screen/admin/system/user/requirements.md) ───────────────────────────────────────
//
// **다섯이 다 그리드다.** 편집 폼을 두지 않으므로(frontend/grid.md) 탭 전환이 곧 그리드 교체이며,
// 조회 전용 탭도 엑셀과 그리드 설정을 갖는다.
//
// 상태 셋(예정 · 유효 · 만료)은 **기간에서 파생**한다 — 컬럼이 아니라 조회 시 계산이라
// 배치가 실패해도 화면과 판정이 갈리지 않는다(sys/menu.md).

/** 예정 · 유효 · 만료 — 세 탭이 함께 쓴다(보유 역할 · 개인 예외 · 유효 권한). 정의는 공통물이 갖는다. */
import type { GrantState } from '@/shared/authz/grantState';

export type { GrantState };

/** 액션 넷 — 서버 `ActionType` 과 1:1. */
export type ActionCd = 'READ' | 'SAVE' | 'EXPORT' | 'EXECUTE';

/**
 * 탭 1 — **이 사람이 가진 역할**(USER-03).
 *
 * <p>`roleUseYn` 이 함께 오는 것이 요점이다. 판정은 **두 조건의 AND** 이고(sys/menu.md)
 * 상태 배지는 **기간만** 보므로, 역할이 꺼져 있으면 *유효라는데 왜 안 되나* 가 된다 —
 * 그 답은 이 칸에만 있다.
 */
export interface UserRoleRow {
  /** PK 의 절반. **신규 행에서만** 열린다 — 다른 역할은 다른 부여다(sys/menu.md). */
  roleId: string;
  roleNm: string;
  roleDesc: string | null;
  /** **역할 자체**의 사용 여부다. 부여의 것이 아니다. */
  roleUseYn: boolean;
  /** **양끝 포함**이며 `null` 이 무기한이다 — 개인 예외와 갈리는 자리다(sys/menu.md). */
  validFromDt: string | null;
  validToDt: string | null;
  grantState: GrantState;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

/** 역할 후보 하나 — 신규 부여의 콤보와 조회조건의 `역할` 이 같은 목록을 본다(screen/admin/system/user/requirements.md). */
export interface RoleCandidate {
  roleId: string;
  roleNm: string;
  /** 꺼진 역할도 후보다 — *켜기 전에 부여를 구성해 두는* 동선이 정상이다(sys/menu.md). */
  useYn: boolean;
}

/**
 * 탭 2 — **이 사람이 가진 개인 예외**(AUTHZ-07 조회).
 *
 * <p>**조회 전용이다.** 사용자 관리 권한이 있다고 예외 권한 부여 권한이 따라오면 안 되며,
 * 권한은 `(MENU_CD, ACTION_CD)` 쌍이므로 **메뉴가 갈려야 갈린다**(screen/admin/system/user/requirements.md).
 */
export interface UserGrantRow {
  menuCd: string;
  /** 조상 경로 포함 — `사용자 > 사용자 관리`(frontend/tabs.md 와 같은 형식). */
  menuPath: string;
  /** 게이트 ④ — `false` 면 부여는 살아 있는데 **대상이 죽은 것**이다(backend/security.md). */
  menuAuthorizable: boolean;
  actionCd: ActionCd;
  grantState: GrantState;
  /** 기간이 **필수**라 셋 중 하나가 반드시 정해진다(sys/menu.md). */
  validFromDt: string;
  validToDt: string;
  grantRsn: string;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

/**
 * 탭 3 — **이 사람의 접속 허용 대역**(AUTH-08 · sys/user-role.md).
 *
 * <p>**행이 없으면 제한 없음이다.** 빈 목록에 그 문구를 내는 것이 이 탭의 요점이며,
 * *"등록된 대역이 없습니다"* 로 끝내면 **지금 어디서든 들어올 수 있다**는 사실을 아무도
 * 말하지 않는다.
 */
export interface UserIpRow {
  /** PK 의 절반. 단일 IP 또는 CIDR 이며 고치는 것이 아니라 지우고 다시 넣는다. */
  ipCidr: string;
  useYn: boolean;
  /**
   * **양끝 포함**이며 `null` 이 무기한이다 — sys/menu.md 과 같은 규칙이다(2026-08-31).
   *
   * <p>**파견·출장처럼 기한이 있는 접근**이 이 기능의 흔한 용도다. 기간이 없으면 그 대역을
   * 사람이 기억해서 지워야 하고, 잊으면 **끝난 계약의 IP 가 열려 있는 상태**가 된다.
   *
   * <p>**판정 시각은 서버 기준이다**(`BusinessCalendar`) — 브라우저 시계가 접근 정책을
   * 하루 밀 수 있다.
   */
  validFromDt: string | null;
  validToDt: string | null;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

/**
 * 탭 4 — **활성 세션 하나**(AUTH-10 · screen/admin/system/user/requirements.md).
 *
 * <p>**IP 와 User-Agent 는 이력에서 온다**(2026-08-31). 세션 스토어는 그 값을 갖고 있지
 * 않으며 여기서도 **담지 않는다** — 원본은 여전히 `SYS_LO_LOGIN` 하나이고(sys/logs.md · screen/admin/system/log/access/requirements.md),
 * 조회 시점에 *그 세션이 만들어진 무렵의 로그인* 을 찾아 붙일 뿐이다. 그래서 이력이
 * 파기되면(retention.md) 그 칸은 빈다.
 *
 * <p>2026-08-30 에는 **두지 않기로** 했었다. 근거가 *"같은 사실이 두 곳이 되고 짧은 쪽이
 * 원본 행세를 한다"* 였는데, **담지 않으면 그 문제가 없다**. 실제로 이 탭이 하는 일은
 * *끊을까 말까* 이고, 세션 ID 앞 8자와 시각 셋만으로는 **어느 것이 남의 것인지** 를 가릴
 * 수 없다 — *"모르는 곳에서 들어온 세션을 끊는다"* 가 이 버튼의 첫 용도다.
 */
export interface UserSessionRow {
  /** **전체**가 온다. 화면은 앞 8자만 그리지만 끊을 때는 온전한 값이 필요하다. */
  sessionId: string;
  /** 이 요청의 세션인가 — screen/admin/system/user/requirements.md 의 **자기 자신 금지**를 눈으로 확인시킨다. */
  current: boolean;
  createdDtm: string;
  /** *끊을까 말까* 를 가르는 값이다 — 목록의 기본 정렬도 이것이다. */
  lastAccessedDtm: string;
  /** 최근 접근 + 유휴 한도. **파생**이며 스토어가 갖고 있는 값이 아니다. */
  expiryDtm: string;
  /**
   * 그 세션을 만든 로그인의 IP — **못 찾으면 `null`** 이다.
   *
   * <p>이력이 파기됐거나(retention.md), 세션이 로그인 없이 만들어졌거나, 시각이 너무 멀어
   * 짝지을 수 없는 경우다. **빈 칸이 정직하다** — 다른 로그인의 IP 를 끌어다 채우면
   * *어디서 들어왔나* 에 **틀린 답**을 하게 된다.
   */
  clientIp: string | null;
  /** 〃 브라우저. `VARCHAR(500)` 이라 셀에서 잘리고 툴팁으로 펼친다(frontend/grid.md). */
  userAgent: string | null;
}

/**
 * 탭 5 — **유효 권한 한 줄**(screen/admin/system/user/requirements.md). sys/menu.md 의 미결을 닫는다.
 *
 * <p>**메뉴 하나가 여러 행일 수 있다** — 경유가 둘이면 행이 둘이다. `MenuUserRow`(screen/menu/requirements.md)
 * 를 반대쪽에서 본 것이며, 합쳐 한 행으로 내면 액션 합집합은 맞아도 **어느 부여를
 * 건드려야 하는지를 잃는다**.
 */
export interface EffectiveAuthRow {
  menuCd: string;
  menuPath: string;
  /** 게이트 ④ — `SYS_MENU.USE_YN='Y'` 이고 `MENU_URL` 이 있는가(backend/security.md). */
  menuAuthorizable: boolean;
  /** 그 메뉴에 **정의된** 액션. 여기 없으면 `—` 이고 **부여할 수도 없다**(sys/menu.md). */
  definedActions: ActionCd[];
  /** 역할명 또는 `PERSONAL`. 부여가 없는 행에서는 `null` 이다. */
  via: string | null;
  /** 경유가 역할일 때만 채운다. */
  roleId: string | null;
  /** **이 경유가 주는** 액션이다 — 합집합이 아니다(backend/security.md ③은 여기서 하지 않는다). */
  actions: ActionCd[];
  /**
   * 지금 실제로 권한을 주는가 — `grantState === 'ACTIVE'` 이고 `menuAuthorizable` 이다.
   *
   * <p>**서버가 낸다.** 화면 전용 계산을 두면 실제 판정과 갈리고, 갈리는 순간 이 탭은
   * 진단이 아니라 **또 하나의 거짓말**이 된다(screen/admin/system/user/requirements.md 의 요구 1).
   */
  effective: boolean;
  grantState: GrantState | null;
  validFromDt: string | null;
  validToDt: string | null;
  grantRsn: string | null;
}

/** 경유가 역할이 아닐 때의 값 — 화면이 문구로 바꾼다(서버 `MenuUserRow.PERSONAL`). */
export const VIA_PERSONAL = 'PERSONAL';
