/** 서버 `AccessLogRow` · `AccessLogDetail` 과 1:1 — 64 §3.2. */

export interface AccessLogRow {
  /** tie-breaker. 기본 숨김이며 `⚙` 에서 켠다(64 §2.7). */
  accessLogSeq: number;
  /** ISO-8601. **정렬이 열린 유일한 컬럼**이다(64 §2.3). */
  creDtm: string;
  /** 응답 상태. **2xx 도 4xx 도 5xx 도 온다**(64 §3.2.2). */
  httpStat: number;
  /** 미인증 요청은 `null` — 셀은 `(익명)` 이다(64 §2.7). */
  userId: string | null;
  /**
   * 사용자명 — 서버가 `SYS_USER` 를 조인해 얻는다(2026-09-01).
   *
   * <p>**`null` 이 두 가지 뜻이다**: 미인증 요청이라 `userId` 자체가 없거나, 그 계정이
   * **지금 `SYS_USER` 에 없다**(FK 가 없다 — 45 §2.2). 셀은 둘을 가르지 않고 비운다 —
   * 바로 왼쪽 칸이 이미 `(익명)` 이라고 말하고 있다.
   */
  userNm: string | null;
  /** `X-Menu-Code` 헤더 값. **클라이언트 주장이다**(architecture.md §6.3). */
  menuCd: string | null;
  /**
   * 번역된 메뉴명 — `menuCd` 가 `null` 이거나 `SYS_MENU` 에 없으면 `null` 이다(43 §3).
   *
   * <p>둘을 함께 받는 것이 요점이다. 코드는 **필터와 조건**이 쓰고 이름은 **셀**이 쓴다 —
   * 이름만 받으면 `set` 필터의 항목이 번역에 따라 갈리고, 코드만 받으면 사람이 읽을 수 없다.
   */
  menuNm: string | null;
  requestUri: string;
  /**
   * 전문이 있는가 — **값이 아니라 유무다**(64 §2.4).
   *
   * <p>`link` 렌더러가 이것을 `[보기]` 로 그리고, 엑셀은 원본 값(`true`/`false`)을 쓴다.
   */
  hasParameters: boolean;
  clientIp: string | null;
  /** 5xx 토스트에 뜨는 그 값이다 — 사용자가 복사해 온다(frontend-stack.md §9 · 64 §2.5). */
  traceId: string | null;
}

export interface AccessLogDetail {
  accessLogSeq: number;
  /** 마스킹을 거친 요청 전문(LOG-06). 캐싱이 꺼진 구간·멀티파트 요청은 `null` 이다. */
  parameters: string | null;
  /**
   * 상한에서 잘렸는가 — architecture.md §6.2.
   *
   * <p>말하지 않으면 잘린 JSON 을 받은 사람이 *"저장이 깨졌다"* 로 읽는다. 이 화면에서
   * 가장 흔한 오독이다(64 §2.4).
   */
  truncated: boolean;
}
