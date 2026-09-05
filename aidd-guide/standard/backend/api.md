---
id: LLM-FWK-BE-002
title: "API 규약 — 경로 · 봉투 · 헤더 · 시간"
category: standard/backend
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/api/", "sources/backend/core/response/ApiResponse.java", "aidd-guide/standard/backend/api.md"]
tier: 2
tags: [backend, api, rest, response, header]
---

# API 규약 — 경로 · 봉투 · 헤더 · 시간

> **경로 하나가 세 가지를 동시에 정한다** — 어디로 가는가 · 누가 부를 수 있는가 ·
> 무슨 액션인가. 그래서 경로를 짓는 것이 이 프로젝트에서 가장 되돌리기 비싼 결정이다.
>
> 조회 프로토콜(조건·정렬·페이징·화이트리스트)은 [search.md](./search.md) 가 갖는다.

## 1. 경로

```
/api/{계층}/{도메인}/{동작}
     service   batchSchedule   runNow
     common    code            getList
     public    auth            login
```

| 마디 | 무엇 |
|---|---|
| **계층** | `public` · `common` · `service` **셋뿐**. 그 밖의 `/api/**` 는 **무조건 403** |
| **도메인** | 애그리거트 이름 그대로 — [packages.md §2](./packages.md) 의 패키지와 같다 |
| **동작** | **접두가 액션을 정한다** — 아래 §2 |

**표기는 camelCase 단수다.** 도메인도 동작도. 복수형·케밥을 쓰지 않는다.

| | 왜 |
|---|---|
| 도메인이 단수 | **애그리거트 이름 그대로**다. 복수형은 *리소스 컬렉션* 을 뜻하는 REST 관례인데 **여기는 리소스가 아니라 동작**이다 |
| 동작이 camelCase | **접두 매칭이 한 겹 단순해진다.** `get-list` 면 접두가 `get` 인지 `get-` 인지 규칙이 늘고, 둘 다 받으면 시드가 갈린다 |
| 원본은 소스의 메서드명 | 시드가 **생성물**이라, 자바 메서드명이 그대로 경로가 되는 것이 표기를 하나로 유지하는 유일한 방법이다 |

- **버전 프리픽스가 없다** — 단일 JAR 배포라 구버전 클라이언트가 없다.
- **`service` 는 고정 경로**다. 경로 변수·와일드카드 금지, **식별자와 조건은 body**.
  인가 판정이 **경로 완전 일치**로 `SYS_API` 를 찾기 때문이다.
- **`service` 는 전부 `POST`** — 조회도 그렇다. 조건이 body 에 들어가고, 쿼리스트링에
  담으면 길이 상한과 인코딩에 걸린다.
- **`common`·`public` 은 조회에 `GET`.** 예외 둘: `POST /api/common/code/getList`
  (본문으로 그룹 코드 목록을 보낸다) · `GET /api/common/progress/{jobId}`
  (진행률 폴링 — 이 계층은 경로 일치 판정을 하지 않는다).

> **`common`·`public` 도 같은 접두를 쓴다.** 인가 시드가 읽는 것은 `/api/service/**` 뿐이라
> 나머지 두 계층의 접두는 **기계가 아니라 사람을 위한 것**이다. 규칙 밖에 두었더니
> 실제로 이렇게 됐다 — 즐겨찾기는 `add`·`remove`, 저장된 조건은 `save`·`delete`,
> 메뉴 통계는 `select`·`frequent`, 번들은 키가 `bundle` 인데 경로는 `getBundle`.
> **같은 일이 네 가지 이름으로 불렸다.**

## 2. 접두가 액션을 정한다

| 접두 | `ACTION_CD` |
|---|---|
| `get` · `search` · `find` · `retrieve` | `READ` |
| `save` · `insert` · `update` · `delete` | `SAVE` |
| `export` | `EXPORT` |
| 그 외 전부 | `EXECUTE` |

- **조회는 네 접두 중 하나로 시작해야 한다.** `list` · `detail` · `count` 만 쓰면
  `EXECUTE` 로 떨어진다 — `getList` · `getDetail` 로 쓴다.
- **`save*`·`delete*` 의 기준은 버튼 이름이 아니라 *우리 테이블 컬럼을 쓰는가* 다.**
- 접두가 실제 동작과 어긋나면 **`@ApiActionType` 이 우선한다**(예외용).
  이 애노테이션은 **시드 생성 입력**이며 런타임 판정에 참여하지 않는다.
- **`export` 접두를 쓰는 API 는 아직 없다** — 엑셀 두 갈래가 프론트 생성이라 서버 경로가
  없다. 그 화면들의 `EXPORT` 는 **메뉴가 선언한다.** 규칙은 살아 있고, 서버 생성 갈래를
  만들면 그때 발동한다.

## 3. 봉투 — 성공도 실패도 감싼다

`ApiResponse<T>` (`core/response`) 하나다. `NON_NULL` 이라 안 쓰는 키는 나가지 않는다.

```jsonc
{ "success": true,  "data": { … }, "traceId": "7f2a1c9e-…" }
{ "success": false, "code": "err.duplicate-code",
  "message": "이미 등록된 코드입니다: USE_YN / Y", "traceId": "7f2a1c9e-…" }
```

| 키 | 언제 | 비고 |
|---|---|---|
| `success` | 언제나 | 프론트의 첫 분기 |
| `data` | 성공 | 목록이면 `PageResponse` |
| `code` | 실패 | **문자열 상수.** `SYS_LO_EXCEPTION.ERR_CD` 에 그대로 남는다 |
| `message` | 실패 | **서버가 번역을 완성한다** — §4 |
| `fields` | 검증 실패 | 필드별 오류 배열 |
| **`traceId`** | **언제나** | 성공에도 담는다 — 아래 |

> **성공 응답에도 `traceId` 를 담는다.** 5xx 토스트만 그것을 쓰는 것이 아니다.
> *"저장은 됐다는데 값이 이상하다"* 는 문의는 **성공한 요청을 사용 이력에서 찾아야** 하고,
> 그 열쇠가 `traceId` 다. 담지 않으면 사용자가 **시각과 화면 이름으로만** 찾아온다.

| 상태 | 언제 | 프론트 |
|---|---|---|
| 200 | 성공 | — |
| **400** | 검증 실패 · 조회조건 위반 | 폼이 필드별 오류를 표시 |
| **401** | 세션 만료 | **재인증 모달** — 로그아웃하지 않는다 |
| **403** | 인가 거부 | 권한 없음 화면 또는 토스트. `code` 가 세 갈래를 나른다 |
| 500 | 그 밖 | 공통 에러 토스트 + `traceId` |

**`fields` 는 배열이다.** 같은 문구가 두 필드에 실릴 수 있다 — *"쿨다운이 크론 최소 간격보다
깁니다"* 처럼 **어느 쪽이 틀렸는지 서버가 말할 수 없는**, 관계가 틀린 경우다.

## 4. 에러 메시지는 서버가 완성한다

`message` 에는 **번역이 끝난 문자열**을 담는다. 프론트는 `code` 로 문구를 조립하지 않고
받은 값을 그대로 보여준다. **프론트에 에러 메시지 카탈로그를 두지 않는다.**

| 근거 | |
|---|---|
| **로그 추적성** | 예외의 `getMessage()` 가 그대로 에러 로그에 남는다. 코드만 남으면 *"`err.password.reuse` 가 무슨 뜻인가"* 를 매번 되찾아야 한다 |
| **파라미터를 서버만 안다** | *"최근 3개와 같습니다"* 의 `3` 은 `SYS_CONFIG` 값이다. 프론트가 조립하려면 조립 규칙이 두 곳에 생긴다 |
| **번들이 가벼워진다** | 에러 문구는 공개 메시지 번들에서 뺀다 — `SYS_MESSAGE_KEY.USE_SCOPE` 가 그 경계다 |

- **언어는 서버가 판정한다** — 세션이 있으면 `SYS_USER.LOCALE_CD`, 없으면 `Accept-Language`.
  그 헤더는 **프론트가 고른 언어**를 실어 보낸 값이다. 브라우저 원래 헤더를 쓰면
  **화면은 영어인데 실패 문구만 한국어로** 나온다.
- **로그의 언어와 응답의 언어를 가른다.** 예외가 나르는 문구는 **서버 언어**로 로그에 남고,
  응답 문구는 `code` 를 키로 다시 읽은 **사용자 언어**다. 합치면 같은 사건이 사람마다 다른
  문자열로 쌓여 **묶어 셀 수 없다.**
- **`code` 는 유지한다** — 프론트가 분기해야 하는 소수가 있다(`err.duplicate-request` 무음
  통과). **분기는 코드로, 표시는 메시지로.**
- 문구의 단일 원본은 `SYS_MESSAGE` 이며 `MESSAGE_MGMT` 화면에서 바꾼다.
  **서버가 완성한다는 것이 "코드에 박는다"는 뜻이 아니다.**

## 4-1. `@Operation(summary=…)` 은 **강제다**

`/api/service/**` 의 모든 핸들러에 붙인다 — `ApiOperationSummaryTest`(ArchUnit)가 막는다.

```java
@Operation(summary = "역할 권한 트리 조회")
@PostMapping("/getMenuTree")
```

- **문서용이 아니라 시드용이다.** `generateApiSeed` 가 이 문장을 읽어
  `SYS_API.API_NM` 을 채우고, 그것이 **권한 화면에서 운영자가 보는 이름**이 된다.
  비우면 운영자가 `/service/roleAuth/getMenuTree` 를 보고 무엇인지 판단해야 한다.
- 한국어로 쓴다(CLAUDE.md §5-6). 컨트롤러 javadoc 과 같은 말을 두 번 적지 않는다 —
  **`summary` 는 운영자의 말, javadoc 은 다음 개발자의 말**이다.
- **고치면 시드가 어긋난다.** `006-init-api.csv` 는 이 문장의 **생성물**이라 한 글자만
  달라도 `checkSeeds` 가 빨개진다 — 문구를 손보면 `./gradlew generateApiSeed` 를 돌려
  **CSV 를 같은 커밋에** 담는다(CLAUDE.md §5-8). **이미 있는 화면을 다시 만들 때는 반대로
  읽는다**: CSV 가 정답이므로 문장을 거기 맞춘다.

## 5. 헤더 넷

| 헤더 | 언제 |
|---|---|
| **`X-Request-Id`** | 매 요청 — 쿼리 `_rid` 와 **이중 채널**. `traceId` 와 같은 값이다 |
| **`X-Menu-Code`** | 매 요청. **메뉴 문맥이 없으면 생략**하고 서버는 `NULL` 로 저장 |
| `X-XSRF-TOKEN` | 매 요청 (axios 기본) |
| `Accept-Language` | 매 요청 — 세션 언어가 우선이고 이것은 폴백 |

**중복 방어는 쓰기만 받는다.** `X-Request-Id` 는 전 요청에 붙지만 선점은 `SAVE`·`EXECUTE`
에만 건다 — 조회는 멱등이라 막을 것이 없고, 막으면 **새로고침이 중복으로 걸린다.**

## 6. 시간 — 오프셋 포함 ISO-8601

```
2026-08-28T09:14:02+09:00
```

- **서버가 현재시각을 SQL 로 구하지 않는다**(`SYSDATE`·`NOW()`·`GETDATE()` 금지).
  애플리케이션이 주입하므로 **경계 판단이 한 곳**이다.
- **조회조건의 날짜에도 오프셋을 붙인다.** 빠지면 **서버 타임존에 따라 하루가 밀린다.**
- **날짜만 다루는 필드**는 `2026-08-28` · `2026-08` 로 보낸다. **오프셋을 붙이지 않는다** —
  시점이 아니라 달력 값이다.

## 관련

- [search.md](./search.md) — 조회 요청·화이트리스트·빌더
- [packages.md](./packages.md) — 도메인 마디의 원본
- [exception.md](./exception.md) — `code`·`message` 를 만드는 곳
- [CLAUDE.md §8](../../../CLAUDE.md) — 호출 URL 은 `endpoints.ts` 에만
