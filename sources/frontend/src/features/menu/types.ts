/** 서버 `MenuTreeRow` · `MenuApiRow` · `MenuUserRow` · `MenuRoleRow` 와 1:1 — screen/menu/requirements.md. */

import type { Action } from '@/shared/authz/permission';

export interface MenuTreeRow {
  /** PK. **신규 행에서도 셀이 아니다** — §4.6 의 모달이 받는다. */
  menuCd: string;
  /**
   * 부모. **컬럼이 아니다** — 트리의 모양이 곧 이 값이며(sys/menu.md) 들여쓰기가 그것을 그린다.
   *
   * <p>응답에는 있고 저장 DTO 에는 없다. 읽기는 구조를 알아야 그리고, 쓰기는 그 필드를
   * 받지 않는 것으로 조작 경로를 없앤다 — **다른 축이다**.
   */
  upMenuCd: string | null;
  /**
   * 메뉴명 — **서버가 `menu.{MENU_CD}` 를 풀어 준 것**이다(sys/menu.md · sys/code.md).
   *
   * <p>키 문자열 그대로 보이면 **아직 이름을 안 채운 것**이며 그것이 진단이다. 고치는 곳은
   * `MESSAGE_MGMT` 하나다 — 여기서도 고칠 수 있게 하면 이름의 원본이 둘이 된다.
   */
  menuNm: string;
  /**
   * `null` 이면 **구조 노드**다(backend/security.md). URL 과 자식은 배타이며 그 사이가 없다.
   *
   * <p>화면에서는 **라우트 목록에서 고른다**(screen/menu/requirements.md) — 손으로 치게 두면 오타가 곧 404 이고,
   * 그 값은 **저장은 되지만 열리지 않는다**.
   */
  menuUrl: string | null;
  iconCd: string | null;
  /** 유효 권한 계산의 **최종 게이트**다(backend/security.md). 구조 노드에 놓으면 자손 전체에 쓴다. */
  useYn: boolean;
  /**
   * 누가 만들었나 — `SEED` · `USER` · **`ORPHAN`**(seed.md).
   *
   * <p>**`ORPHAN` 은 선언에서 사라진 메뉴**다. 화면이 없어져 눌러도 열리지 않으며 시드는
   * 그것을 **지우지 않고 표시만** 한다 — 그 행에 역할 권한과 개인 예외가 딸려 있고,
   * 배포가 그것을 지우는 것은 운영 결정을 배포가 되돌리는 일이다(seed.md).
   *
   * <p>`API_CATALOG` 의 *미매핑* · `MESSAGE_MGMT` 의 *미사용* 과 **같은 자리**이며,
   * 셋 다 막지 않고 표시하고 **사람이 판단한다**.
   */
  srcCd: 'SEED' | 'USER' | 'ORPHAN';
  /** `0` 이면 **미매핑** — 이 화면의 기능을 아무도 쓸 수 없다(sys/menu.md). */
  apiCount: number;
  /** AUTHZ-13. **리프만 값이 있다** — 구조 노드는 권한 대상이 아니다. */
  accessibleUserCount: number;
  /** 매핑 역할 수. 삭제 게이트의 근거이며 `USE_YN='N'` 인 역할도 센다. */
  roleCount: number;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

/** 탭 1 — 조회 전용이다. 매핑은 시드로만 바뀐다(backend/api.md). */
export interface MenuApiRow {
  apiUrl: string;
  apiNm: string;
  apiDesc: string | null;
  actionCd: Action;
}

/** 탭 3 — 조회 전용. 편집은 `ROLE_AUTH_MGMT`(screen/menu/requirements.md)다. */
export interface MenuRoleRow {
  roleId: string;
  roleNm: string;
  /** `false` 인 역할도 나온다 — 권한 행은 살아 있다(screen/menu/requirements.md). */
  useYn: boolean;
  actions: Action[];
}

/** 부여가 지금 어디에 있는가 — **기간에서 파생**한다(sys/menu.md). */
export type GrantState = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';

/** 탭 2 — AUTHZ-13. **경유마다 한 행**이다(screen/menu/requirements.md). */
export interface MenuUserRow {
  userId: string;
  userNm: string;
  /** `USE_YN` 과 계정 유효기간만 본다 — 잠금·휴면은 일시적이라 보지 않는다(sys/user-role.md). */
  accountUsable: boolean;
  /** 역할명 또는 `PERSONAL`(개인 예외) — backend/security.md 의 두 갈래다. */
  via: string;
  /** 경유가 역할일 때만 있다. **더블 클릭으로 그 역할을 열** 수 있어야 한다. */
  roleId: string | null;
  actions: Action[];
  grantState: GrantState;
  validFromDt: string | null;
  validToDt: string | null;
}

/** 개인 예외의 `via` 값 — 서버 `MenuUserRow.PERSONAL` 과 같은 문자열이다. */
export const VIA_PERSONAL = 'PERSONAL';

/**
 * 순서 저장의 한 묶음 — 서버 `MenuSiblingGroup` 과 1:1(screen/menu/requirements.md).
 *
 * <p><b>형제 전체가 한 묶음이다.</b> 옮긴 노드 하나만 보내면 뺀 쪽에 번호 구멍이 남는다
 * (`1,2,4`) — sys/menu.md 가 전체 재작성으로 얻으려던 *언제나 정규화 상태* 가 그것으로 깨진다.
 * 드래그 하나가 묶음 둘(원래 부모 · 새 부모)을 만들 수 있다.
 */
export interface MenuSiblingGroup {
  upMenuCd: string | null;
  menuCds: string[];
}
