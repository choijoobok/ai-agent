// @feat FEAT-504
/** 서버 `CodeGroupRow` · `CodeRow` · `CodeRefDefRow` 와 1:1 — screen/admin/system/code/requirements.md. */

export interface CodeGroupRow {
  /** PK. **신규 행에서만 열린다** — 고치려면 지우고 다시 만든다(screen/admin/system/code/requirements.md). */
  grpCd: string;
  /** **다국어가 아니다** — 관리 화면 전용 명칭이라 컬럼 값이다(sys/code.md). */
  grpNm: string;
  grpDesc: string | null;
  /*
    **`useYn` 이 없다**(sys/code.md). 코드 쪽(`CodeRow`)에는 있다 — 이름이 같다고 같은 것이 아니다.

    코드의 `useYn` 은 **콤보 후보에서 뺀다**는 뜻이라 읽는 쪽이 있지만, 그룹은 콤보의 후보가
    아니라 **소스가 이름으로 지목하는 것**이라 끄는 것의 뜻이 정의되지 않는다.
  */
  sortNo: number;
  /**
   * 그 그룹의 코드 수 — **삭제 게이트가 읽는다**(frontend/grid.md · screen/admin/system/code/requirements.md).
   *
   * <p>하단을 조회하기 전에도 *지울 수 있는가* 에 답해야 하므로 마스터 응답이 갖는다.
   */
  codeCount: number;
  /** **읽기 전용**이다 — 화면에 켜고 끄는 수단이 없다(screen/admin/system/code/requirements.md). 배지의 근거다. */
  sysYn: boolean;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

export interface CodeRow {
  dtlCd: string;
  /**
   * 지금 세션 언어의 **코드명** — screen/admin/system/code/requirements.md.
   *
   * <p>값이 없으면 기본 언어, 그것도 없으면 **키 문자열 그대로**다(sys/code.md). 셀에
   * `code.ORDER_KIND.B2B` 가 보이면 **아직 안 채운 것**이며 그것이 진단이다.
   *
   * <p>**비우면 지운다** — 빈 문자열을 저장하면 폴백이 죽고 *이름이 없는 코드* 가 조용히
   * 생긴다.
   */
  codeNm: string;
  dtlDesc: string | null;
  useYn: boolean;
  /** **콤보 정렬**이다 — 관리 화면용이 아니다(screen/admin/system/code/requirements.md). */
  sortNo: number;
  sysYn: boolean;
  /**
   * 참조값 맵(`REF_CD → REF_VAL`) — **전송 형태이지 저장 형태가 아니다**(frontend/grid.md).
   *
   * <p>정의는 있는데 값이 없는 속성은 **키가 아예 없다**(sys/code.md). 화면이 정의 목록과
   * 아우터 조인해 빈 셀을 그리며, **그 빈 칸이 곧 할 일이다**.
   */
  refs: Record<string, string>;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

export interface CodeRefDefRow {
  /** `CODE_REF_KEY` 공통코드의 화이트리스트에서 고른다 — 신규 행에서만 열린다(sys/code.md). */
  refCd: string;
  /**
   * 하단 그리드의 **컬럼 헤더**가 된다 — frontend/grid.md 계약의 유일한 예외이며 **메시지 키가
   * 아니다**(frontend/grid.md). 같은 `REF_CD` 를 그룹마다 다르게 부르는 것이 이 값의 존재 이유라
   * 전역 코드명이 대신할 수 없다(sys/code.md).
   */
  refNm: string;
  refDesc: string | null;
  /** 이 정의로 입력된 값의 수 — 삭제 **확인** 문구가 말하는 건수다(screen/admin/system/code/requirements.md). */
  valueCount: number;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}
