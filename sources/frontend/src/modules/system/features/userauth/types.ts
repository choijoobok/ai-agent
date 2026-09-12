/** 서버 `UserPickRow` · `UserAuthTreeRow` · `PersonalGrant` 와 1:1 — screen/admin/system/user-auth/requirements.md. */

import type { Action } from '@/shared/authz/permission';
import type { RowState } from '@/shared/grid/rows';
// @feat FEAT-502
import type { AccountStat } from '@/shared/user/accountStat';

/**
 * 부여가 **지금** 어디에 있는가 — screen/admin/system/user-auth/requirements.md.
 *
 * <p>**기간에서 파생**한다. 컬럼으로 두면 배치가 그것을 갱신해야 하고, 배치가 실패한 동안
 * 화면과 판정이 갈린다 — 계정 잠금 자동 해제를 조회 시 계산으로 둔 것과 같은 구조다.
 */
import type { GrantState } from '@/shared/authz/grantState';

export type { GrantState };

/**
 * 좌 — **읽기 전용**이다. 계정 생성은 `USER_MGMT`(screen/admin/system/user-auth/requirements.md)의 일이다.
 *
 * <p>그래서 이 화면에는 **미저장 신규 부모가 생길 수 없고**, frontend/grid.md 의 상태 셋 중
 * *잠긴 상태* 가 없다(screen/admin/system/user-auth/requirements.md).
 */
export interface UserPickRow {
  userId: string;
  userNm: string;
  /**
   * `USER_MGMT` 와 **같은 파생 규칙**이다 — 같은 계정이 두 화면에서 다르게 보이면 안 된다.
   *
   * <p>그래서 타입도 라벨도 `shared/user/accountStat` 하나가 갖는다(frontend/packages.md).
   */
  accountStat: AccountStat;
  /**
   * **지금 유효한** 개인 예외의 건수 — screen/admin/system/user-auth/requirements.md.
   *
   * <p>예정·만료는 세지 않는다. 하단 그리드의 *상태* 컬럼과 **같은 규칙**이어야
   * 화면에서 눈으로 센 수와 이 수가 맞는다(screen/admin/system/user-auth/requirements.md).
   *
   * <p>**조회조건이 아니다**(screen/admin/system/user-auth/requirements.md) — 거르면 *예외가 없는 사람에게 처음 주는* 동선이
   * 막힌다. 좁히는 데 쓰는 것은 컬럼 정렬이 아니라 **눈**이다.
   */
  activeGrantCnt: number;
}

/** 개인 예외 한 칸 — `SYS_USER_MENU_AUTH` 의 행 하나(sys/menu.md · AUTHZ-07). */
export interface PersonalGrant {
  actionCd: Action;
  /** 스위치가 켜지는 것은 `ACTIVE` 하나뿐이다 — 나머지 둘은 **꺼진 채 배지**다(screen/admin/system/user-auth/requirements.md). */
  state: GrantState;
  validFromDt: string;
  validToDt: string;
  /** **필수**다(AUTHZ-07). 역할 부여에는 없는 컬럼이며 그 차이가 의도다. */
  grantRsn: string;
}

/**
 * 우 — 권한 트리의 한 행. **screen/admin/system/user-auth/requirements.md 가 정의를 갖는 그것**이다.
 *
 * <p>`RoleAuthTreeRow`(screen/menu/requirements.md)가 *덜어 낸* 쪽이고 여기가 **원본**이다 — 셀 상태가 넷에서
 * 일곱으로 는다: 부여 없음 · 유효 · 예정 · 만료 · 역할 경유 · 액션 미정의 · 구조 노드.
 */
export interface UserAuthTreeRow {
  menuCd: string;
  upMenuCd: string | null;
  /** 서버가 `menu.{MENU_CD}` 를 세션 언어로 풀어 준 것이다(sys/menu.md · sys/code.md). */
  menuNm: string;
  /**
   * `SYS_MENU.ICON_CD` — **사이더와 같은 코드**다(frontend/tabs.md).
   *
   * <p>뜻의 코드(`user-auth`)이고 무엇으로 그릴지는 `menuIcons` 가 정한다. 트리가 자기
   * 아이콘 규칙을 갖지 않는 것이 요점이다 — 같은 메뉴가 사이더에서는 사람 모양이고
   * 권한 트리에서는 폴더면 **같은 것을 두 개로** 보게 된다.
   */
  iconCd: string | null;
  /** `null` 이면 **구조 노드**다 — 스위치가 없고 파생 3-state 다(sys/menu.md). */
  menuUrl: string | null;
  /** 최종 게이트(backend/security.md ④). **꺼진 메뉴에도 예외는 줄 수 있다** — 화면은 이름을 흐리게 그린다. */
  useYn: boolean;
  /** 여기 없는 칸은 `—` 이며 *안 줬다* 가 아니라 **줄 것이 없다** 다(screen/admin/system/user-auth/requirements.md). */
  definedActions: Action[];
  /**
   * 이 사용자의 개인 예외 — **기간과 사유까지** 온다.
   *
   * <p>하단 그리드가 이것을 펴서 만들어진다. 서버가 목록을 따로 내면 **같은 질문에 답이
   * 둘**이 되고, 그 둘이 갈리는 순간 *"트리에는 있는데 목록에 없다"* 가 된다.
   *
   * <p>`definedActions` 에 없는 값이 섞여 있을 수 있다 — API 가 사라져 고아가 된 부여이며
   * **지우지 않는다**(screen/admin/system/user/requirements.md · seed.md). 다만 이 화면에서는 **지울 수는 있다**: screen/admin/system/user/requirements.md 이
   * *잘못 등록한 행 정리* 를 셋째 수단으로 적어 두었고, 그 판단은 사람이 한다.
   */
  grants: PersonalGrant[];
  /**
   * 액션 → 그 액션을 주는 **지금 유효한** 역할들의 이름(screen/admin/system/user-auth/requirements.md).
   *
   * <p>배지가 말하는 것은 *"지금 역할로도 갖고 있다"* 이므로 만료된 역할 부여와 꺼진 역할은
   * 오지 않는다. **막지 않고 알려만 준다** — 중복은 무해하고(backend/security.md — 합집합), 막으면
   * **역할 부여가 곧 만료되는 경우**를 처리할 수 없다.
   */
  viaRoles: Partial<Record<Action, string[]>>;
}

/**
 * 하 — 예외 목록의 한 행. **트리에서 편 것**이며 서버 타입에 대응이 없다.
 *
 * <p>`menuNm` 을 함께 드는 것이 요점이다. 목록만 보면 **메뉴 코드로 무엇인지 알 수 없고**,
 * screen/admin/system/user-auth/requirements.md 가 *"목록만 두면 메뉴를 코드로 찾아야 한다"* 고 적은 그 자리다.
 */
export interface GrantRow {
  menuCd: string;
  /** 조상 경로를 포함한 표시 이름 — `사용자 > 사용자 관리`(frontend/tabs.md 와 같은 형식). */
  menuPath: string;
  actionCd: Action;
  /** **필수**다. 신규 행은 오늘로 시작하고 종료일은 비어 있다(screen/admin/system/user-auth/requirements.md). */
  validFromDt: string | null;
  validToDt: string | null;
  grantRsn: string | null;
  /**
   * 이 메뉴에 그 액션이 **정의돼 있는가** — 아니면 **고아**다(screen/admin/system/user/requirements.md · seed.md).
   *
   * <p>API 가 사라져 미정의가 된 부여이며 트리에서는 `—` 로 보인다. 목록에는 보여야
   * **사람이 판단**할 수 있다 — 배포가 운영 결정을 지우지 않는다.
   */
  defined: boolean;
}

/** 저장이 보내는 행 하나 — **행 상태가 있다**(screen/admin/system/user/requirements.md · frontend/grid.md). */
export interface UserAuthSaveRow {
  rowState: RowState;
  menuCd: string;
  actionCd: Action;
  validFromDt: string | null;
  validToDt: string | null;
  grantRsn: string | null;
}

/**
 * 트리 셀 하나를 가리키는 키 — `${menuCd}|${actionCd}`.
 *
 * <p>**컴포넌트가 아니라 여기 있다.** 트리 파일이 컴포넌트만 내보내야 Fast Refresh 가
 * 동작하고(`react-refresh/only-export-components`), 무엇보다 이 키를 **만드는 쪽(화면)과
 * 읽는 쪽(트리)** 이 갈려 있어 한 곳에 두는 편이 맞다 — 한쪽만 바꾸면 **트리가 통째로
 * 비어 보인다**.
 */
export function cellKey(menuCd: string, action: Action): string {
  return `${menuCd}|${action}`;
}
