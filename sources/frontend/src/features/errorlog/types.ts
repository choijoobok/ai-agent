/** 서버 `ErrorLogRow` · `ErrorLogDetail` 과 1:1 — screen/log/access/requirements.md. */

export interface ErrorLogRow {
  /** tie-breaker. 기본 숨김이며 `⚙` 에서 켠다(screen/log/error/requirements.md). */
  exceptionLogSeq: number;
  /** ISO-8601. **정렬이 열린 유일한 컬럼**이다(screen/log/error/requirements.md). */
  creDtm: string;
  /**
   * 응답 상태 — **4xx 와 5xx 를 가르는 유일한 값**이다(screen/log/error/requirements.md).
   *
   * <p>2xx 는 오지 않는다(예외가 아니다). 401 도 오지 않는다 — 세션 만료는 정상 흐름이라
   * 기록하지 않으며, 그 사건은 로그인 이력의 `SESSION_TIMEOUT` 이 갖는다.
   */
  httpStat: number;
  /**
   * `ErrorCode.code()` 그대로 — **문자열 상수**라 흔들리지 않는다(backend/packages.md).
   *
   * <p>403 의 세 갈래(`err.api-not-registered` · `err.api-not-mapped` · `err.no-authority`)를
   * 나르는 것도 이 값이며, 셋은 사용자에게 같은 403 이지만 **고치는 곳이 다르다**(screen/log/error/requirements.md).
   */
  errCd: string | null;
  /** 서버가 번역을 완성해 담은 문장 — **사용자가 그때 본 그 글**이다(backend/packages.md). */
  errMsg: string | null;
  /** 미인증 요청은 `null` — 셀은 `(익명)` 이다(screen/log/error/requirements.md). */
  userId: string | null;
  /**
   * 사용자명 — 서버가 `SYS_USER` 를 조인해 얻는다(2026-09-01).
   *
   * <p>**`null` 이 두 가지 뜻이다**: 미인증 요청이라 `userId` 자체가 없거나, 그 계정이
   * **지금 `SYS_USER` 에 없다**(FK 가 없다 — sys/logs.md). 셀은 둘을 가르지 않고 비운다 —
   * 바로 왼쪽 칸이 이미 `(익명)` 이라고 말하고 있다.
   */
  userNm: string | null;
  /** `X-Menu-Code` 헤더 값. **클라이언트 주장이다**(backend/packages.md). */
  menuCd: string | null;
  /** 번역된 메뉴명 — 없으면 `null` 이다(sys/code.md). `AccessLogRow` 와 같은 규칙이다. */
  menuNm: string | null;
  requestUri: string;
  /**
   * 스택이 있는가 — **값이 아니라 유무다**(screen/log/error/requirements.md).
   *
   * <p>`false` 는 곧 *4xx 라 저장하지 않았다* 이며(screen/log/error/requirements.md), 모달의 스택 탭이 그것으로
   * 비활성이 된다. 상세 컬럼의 원본 값이기도 해서 **엑셀에는 이 참·거짓이 나간다** —
   * `[보기]` 는 표시일 뿐이고 파일은 원본을 쓴다(frontend/grid.md).
   */
  hasStack: boolean;
  clientIp: string | null;
  /** 5xx 토스트에 뜨는 그 값이다 — **사용자가 이것을 들고 온다**(frontend/packages.md · screen/log/access/requirements.md). */
  traceId: string | null;
}

export interface ErrorLogDetail {
  exceptionLogSeq: number;
  /** `null` 이면 **4xx 라 저장하지 않은 것**이다 — 탭이 비활성이 된다(screen/log/error/requirements.md). */
  rootCauseStack: string | null;
  stackTruncated: boolean;
  /** 마스킹을 거친 요청 전문(LOG-06) — **사용 이력에서 온다**(screen/log/error/requirements.md). */
  parameters: string | null;
  /**
   * 사용 이력에 그 요청이 남아 있는가 — `false` 면 **90일이 지나 파기된 것**이다(retention.md).
   *
   * <p>`parameters` 가 `null` 인 것과 **다른 사실**이다: 전문 없이 남은 정상 행이 있다
   * (멀티파트 요청 · 캐싱이 꺼진 구간). 섞으면 그 정상 행이 *파기됨* 으로 보인다.
   */
  parametersFound: boolean;
  parametersTruncated: boolean;
}
