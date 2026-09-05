/** 서버 `LoginLogRow` 와 1:1 — screen/log/login/requirements.md. **`LoginLogDetail` 이 없다**. */
export interface LoginLogRow {
  /** tie-breaker. 기본 숨김이며 `⚙` 에서 켠다(screen/log/login/requirements.md). */
  loginLogSeq: number;
  /** ISO-8601. **정렬이 열린 유일한 컬럼**이다(screen/log/login/requirements.md). */
  creDtm: string;
  /**
   * **시도한 ID** 다 — `SYS_USER` 에 없는 값일 수 있다(sys/logs.md).
   *
   * <p>그것이 이 화면의 두 번째 용도(침입 시도 탐지)가 찾는 값이다(screen/log/login/requirements.md).
   */
  userId: string | null;
  /**
   * 사용자명 — 서버가 `SYS_USER` 를 **`leftJoin`** 해서 얻는다(2026-09-01).
   *
   * <p>**없는 계정의 시도에서는 `null` 이고 그것이 흔한 일이다.** screen/log/login/requirements.md 가 *"조인하면
   * 없는 ID 행에서 이름이 비고 그 빈칸이 조회가 덜 됐다 로 읽힌다"* 는 이유로 이름을
   * 붙이지 않았는데, **문제는 빈칸이었으므로** 셀이 그 자리에 `없는 계정` 배지를 그린다 —
   * 결과 컬럼의 `FAIL_NO_USER` 와 **같은 공통코드 행**에서 온 같은 글자·같은 색이다.
   *
   * <p>지워진 계정의 예전 로그인도 같은 `null` 이다 — 그 행에도 같은 배지가 맞다:
   * *"지금 이 아이디로 들어올 계정이 없다"* 가 두 경우에 다 참이다.
   */
  userNm: string | null;
  /** `LOGIN_RSLT_CD` 15종 — 이름은 공통코드가 붙인다(sys/code.md · sys/logs.md). */
  loginRsltCd: string;
  clientIp: string | null;
  /** 500자에서 잘린 채 저장된다. **`…` 를 붙이지 않는다**(screen/log/login/requirements.md). */
  userAgent: string | null;
  /** 5xx 토스트에 뜨는 그 값이다 — 사용자가 복사해 온다(frontend/packages.md · screen/log/access/requirements.md). */
  traceId: string | null;
}
