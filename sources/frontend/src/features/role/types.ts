/** 서버 `RoleRow` 와 1:1 — screen/role/requirements.md. */

export interface RoleRow {
  /** PK. **신규 행에서만 편집 가능**하다(sys/user-role.md) — 고치려면 지우고 다시 만든다. */
  roleId: string;
  /** **필수**다. */
  roleNm: string;
  roleDesc: string | null;
  /**
   * 유효 권한 계산의 **입력 필터**(backend/security.md ②). 끄면 이 역할의 권한이 합집합에 들어가지 않는다.
   *
   * <p>메뉴의 `USE_YN` 은 **최종 게이트**여서 자리가 다르다(AUTHZ-01) — 같은 이름의 플래그가
   * 계산의 다른 단계에 있다.
   */
  useYn: boolean;
  /*
    건수 셋은 **`null` 을 가질 수 있다** — 서버는 언제나 수를 보내고, `null` 은 **미저장 신규
    행**이라는 뜻이다(screen/role/requirements.md 주석 8).

    `0` 으로 채우지 않는 것이 요점이다: *"세어 보니 0"* 과 *"아직 세지 않았다"* 는 다른
    사실이고, 둘을 같은 값으로 두면 **셀이 거짓말을 한다** — 그 행은 서버에 없어서 셀 수가
    없는 것이지 0 건인 것이 아니다. 화면은 이 값을 `—` 로 그린다.
  */
  /**
   * `SYS_USER_ROLE` **전체** 행 수 — **삭제 게이트가 보는 수**다(screen/role/requirements.md).
   *
   * <p>기간을 보지 않는다: 만료된 부여도 행이며 **FK 는 날짜를 보지 않는다**.
   */
  holderCount: number | null;
  /** 그중 오늘 유효한 부여. **게이트가 보지 않는 수**이며 운영자가 궁금한 쪽이다(screen/role/requirements.md). */
  activeHolderCount: number | null;
  /**
   * `SYS_ROLE_MENU_AUTH` 행 수 — **디테일이 없는 자식**의 건수다(편집은 `ROLE_AUTH_MGMT`).
   *
   * <p>frontend/grid.md 가 *"디테일이 전부 도착한 뒤 판정"* 이라고만 적은 자리를 이 컬럼이 대신한다.
   */
  authCount: number | null;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}
