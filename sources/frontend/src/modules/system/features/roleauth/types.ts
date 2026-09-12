// @feat FEAT-502
/** 서버 `RolePickRow` · `RoleAuthTreeRow` · `RoleHolderRow` 와 1:1 — screen/admin/system/role-auth/requirements.md. */

import type { Action } from '@/shared/authz/permission';

/** 좌 — **읽기 전용**이다. 생성·비활성화·삭제는 `ROLE_MGMT`(screen/admin/system/role-auth/requirements.md)의 일이다. */
export interface RolePickRow {
  roleId: string;
  roleNm: string;
  /** **비활성 역할도 나온다** — 권한 구성은 켜기 전에 해 두는 것이 정상이다(screen/admin/system/role-auth/requirements.md). */
  useYn: boolean;
  /** 저장 확인의 둘째 줄이 말할 수를 **고르기 전에** 보여준다(screen/admin/system/role-auth/requirements.md). */
  holderCount: number;
}

/**
 * 우 — 권한 트리의 한 행. **정의는 screen/user/requirements.md 가 갖고 여기는 덜어 내기만 한다**(screen/admin/system/role-auth/requirements.md).
 *
 * <p>셀 상태가 일곱에서 넷으로 준다 — 켜짐 · 꺼짐 · `—` · 구조 노드. 기간 컬럼이 없어
 * *예정*·*만료* 배지가 사라지고, **역할 자신이 원본**이라 *역할 경유* 배지도 사라진다.
 */
export interface RoleAuthTreeRow {
  menuCd: string;
  upMenuCd: string | null;
  /** 서버가 `menu.{MENU_CD}` 를 세션 언어로 풀어 준 것이다(sys/menu.md · sys/code.md). */
  menuNm: string;
  /**
   * `SYS_MENU.ICON_CD` — **사이더와 같은 코드**다(frontend/tabs.md).
   *
   * <p>무엇으로 그릴지는 `menuIcons` 가 정한다. 트리가 자기 아이콘 규칙을 갖지 않는 것이
   * 요점이다 — 같은 메뉴가 화면마다 다른 모양이면 **같은 것을 두 개로** 보게 된다.
   */
  iconCd: string | null;
  /** `null` 이면 **구조 노드**다 — 스위치가 없고 파생 3-state 다(sys/menu.md). */
  menuUrl: string | null;
  /** 최종 게이트(backend/security.md ④). **꺼진 메뉴에도 권한은 줄 수 있다** — 화면은 이름을 흐리게 그린다. */
  useYn: boolean;
  /**
   * 이 메뉴에 **있는** 액션 — sys/menu.md 의 액션 열이 데이터로 온 것이다.
   *
   * <p>여기 없는 칸은 `—` 이며 그것은 *안 줬다* 가 아니라 **줄 것이 없다** 다(screen/user/requirements.md).
   * 빈 스위치로 두면 관리자가 켜고 저장하는데 사용자는 여전히 못 한다.
   */
  definedActions: Action[];
  /**
   * 이 역할이 **준** 액션.
   *
   * <p>`definedActions` 에 없는 값이 섞여 있을 수 있다 — API 가 사라져 고아가 된 부여이며
   * **지우지 않는다**(screen/user/requirements.md · seed.md). 화면에는 `—` 로 보이고 저장 페이로드에서도 빠지며,
   * 서버가 **정의된 조합 안에서만** 지우므로 그 행은 그대로 남는다.
   */
  grantedActions: Action[];
}

/*
  하단 pane 의 행 타입은 **여기 없다** — `shared/authz/roleHolder.ts` 다.

  screen/admin/system/role-auth/requirements.md 가 하단을 *"§2.5 와 같은 그리드"* 로 정했으므로 `ROLE_MGMT` 도 같은 타입을 쓰는데,
  features 끼리 직접 import 하면 **한쪽이 다른 쪽의 부품 창고**가 된다 — frontend/packages.md 이
  *"두 번째 화면이 쓰는 순간 shared/ 로 올린다"* 고 정한 그 자리다.
*/

/** 저장이 보내는 부여 하나 — **켜진 스위치 전부**가 나간다(screen/admin/system/role-auth/requirements.md). */
export interface RoleAuthGrant {
  menuCd: string;
  actionCd: Action;
}
