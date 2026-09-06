---
id: LLM-FWK-BE-005
title: "예외 — ErrorCode · BusinessException · GlobalExceptionHandler"
category: standard/backend
type: operation
created: 2026-05-04
updated: 2026-09-06
status: active
sources: ["sources/backend/core/error/", "sources/backend/core/message/MsgKey.java", "sources/backend/api/error/"]
tier: 2
tags: [backend, exception, error, message]
---

# 예외 — `ErrorCode` · `BusinessException` · `GlobalExceptionHandler`

> **던지는 쪽은 코드만 안다. 문구를 만드는 것은 한 곳뿐이다.**
> 서비스가 `messageSource` 를 부르기 시작하면 문구 조립이 코드 곳곳에 생기고,
> 같은 사건이 사람마다 다른 문자열로 로그에 쌓여 **묶어 셀 수 없다.**

## 1. 세 조각

```
ErrorCode (interface)          code() · type() · defaultMessage()
   └ {도메인}ErrorCode (enum)  도메인마다 하나 — CommonErrorCode · AuthErrorCode …
BusinessException              ErrorCode + message + List<FieldError> + List<RowError>
GlobalExceptionHandler         @RestControllerAdvice — 봉투로 감싸고 로그에 남긴다
```

- **`ErrorCode` 는 인터페이스다.** 도메인마다 enum 하나가 구현한다
  (`CommonErrorCode` · `AuthErrorCode` · `MenuErrorCode` · `BatchScheduleErrorCode` …).
  **하나의 거대한 enum 을 두지 않는다** — 도메인을 지우면 그 코드도 함께 사라져야 한다.
- **`defaultMessage()` 는 최종 문구가 아니다.** `SYS_MESSAGE` 조회가 실패했을 때의
  **폴백**이다.

## 2. `ErrorType` 이 상태 코드를 정한다

| `ErrorType` | 상태 | 언제 |
|---|---|---|
| `INVALID_REQUEST` | **400** | 검증 실패 · 조회조건 위반. 폼이 필드별 오류를 표시한다 |
| `UNAUTHENTICATED` | **401** | 세션 만료. 프론트는 **재인증 모달** — 로그아웃하지 않는다 |
| `FORBIDDEN` | **403** | 인가 거부. **`code` 가 갈래를 나른다** |
| `CONFLICT` | **409** | 읽은 뒤 쓰기 전에 남이 먼저 썼다. **입력이 틀린 것이 아니다** — 답은 *다시 조회* |
| `INTERNAL_ERROR` | **500** | 그 밖. **스택트레이스를 응답에 담지 않는다** — `traceId` 만 준다 |

**상태 코드를 컨트롤러가 고르지 않는다.** 예외가 나르는 `ErrorType` 이 정한다.

## 3. 던지기

```java
throw new BusinessException(CodeErrorCode.DUPLICATE_CODE);
throw new BusinessException(CodeErrorCode.DUPLICATE_CODE, "이미 등록된 코드입니다: " + grpCd);
throw new BusinessException(CommonErrorCode.VALIDATION, msg, List.of(
        new FieldError("cron", "쿨다운이 크론 최소 간격보다 깁니다"),
        new FieldError("lockMinIntervalSec", "〃")));
```

**그리드 저장은 행을 짚는다** — `fields` 로는 *어느 줄* 인지 말할 수 없다.

```java
throw BusinessException.rows(CodeErrorCode.DUPLICATE_CODE, msg, List.of(
        RowError.of(3, "dtlCd", "이미 있는 코드입니다", "STAT_A"),
        RowError.of(7, "dtlCd", "이미 있는 코드입니다", "STAT_B")));
```

- **루프 안에서 던지지 않는다.** `RowTx.oneTxForAll(rows, row -> …)` 이 그 루프다 —
  몸통이 던지면 그 행의 실패로 모이고 끝에 한 번 던진다. **순번을 몸통에 주지 않는다**:
  세는 자리가 하나여야 다른 수를 실어 보낼 길이 없다.
- **한 덩이로 묶을지 건별로 나눌지는 여기서 정하지 않는다.** 목록의 성질이 정하며,
  건별을 고르면 던지지 않고 `RowReport` 를 돌려준다 →
  [row-transaction.md](./row-transaction.md).
- **순번은 요청 배열의 것이다.** 행을 `added`·`removed` 로 갈라 담고 **나중 순회의 루프
  번호**를 실으면 화면에서 **남의 행이 붉어진다**([api.md](./api.md) §3-1).
- **칸 없는 실패를 던지지 않는다.** 화면은 `RowError.fields` 를 돌며 표를 만들므로
  **`fields` 가 비면 그 행은 표에 나타나지 않는다** — 순번만 있고 내용이 없는 실패는
  **빈 표가 뜬 모달**이 된다. 그러느니 예전처럼 첫 실패에서 멈추는 편이 낫다.
  `new BusinessException(code, msg)` 로 끝내지 말고 **어느 칸인지 붙인다**.
- **필수 누락에는 값을 싣지 않고, 중복·형식 위반에는 싣는다.** 빈 값을 실으면 표의
  값 칸이 비고, 같은 줄이 여러 번 접힌다([save-errors.md](../frontend/save-errors.md)).
- **행에 매이지 않는 검사는 `RowTx.oneTxForAll` 밖에 둔다.** 저장 뒤의 *전체 상태* 를
  판정하는 검사가 그렇다(`ConfigService.checkValues`) — 틀린 것이 값이 아니라 **값들
  사이의 관계**라 한 행에 붙이면 **애먼 행이 붉어진다**. 그쪽은 `fields` 로 나간다.
- **DB 제약 위반은 여기로 오지 않는다.** flush 시점이라 행을 알 수 없어 전역 핸들러가
  409 로 돌린다. 행을 짚어야 하면 **서비스가 그 예외를 잡아 다시 검사해** 이 모양으로
  바꿔 던진다 — 예외 경로에서만 드는 비용이다.
- **`fieldErrors` 는 배열이다.** 같은 문구가 두 필드에 실릴 수 있다 — *어느 쪽이 틀렸는지
  서버가 말할 수 없는*, **관계가 틀린** 경우가 있다. `RowError.fields` 가 배열인 것은
  다른 이유다 — **복합 키**를 나른다.
- `BusinessException` 이 나르는 `message` 는 **서버 언어**이고 그대로 로그에 남는다.
  응답에 나가는 문구는 **다시 읽은 사용자 언어**다(§4).

## 4. 문구는 `ErrorMessages` 하나가 만든다

```java
messages.find(errorCode.code(), locale.current())
        .orElseGet(errorCode::defaultMessage);
```

| | |
|---|---|
| 원본 | **`SYS_MESSAGE`** — `MESSAGE_MGMT` 화면에서 바꾼다 |
| 키 | `ErrorCode.code()` — 점 표기 문자열 상수 (`err.login.failed`) |
| 언어 | 세션이 있으면 `SYS_USER.LOCALE_CD`, 없으면 `Accept-Language` |
| 실패하면 | **`defaultMessage()` 로 떨어지고 `warn` 을 남긴다** — 메시지 조회 실패가 원래 예외를 덮어서는 안 된다 |

> **로그의 언어와 응답의 언어를 가른다.** 합치면 **같은 사건이 사람마다 다른 문자열로**
> 쌓여 묶어 셀 수 없다. 예외의 `getMessage()` 는 서버 언어로 `SYS_LO_EXCEPTION` 에 남고,
> 응답 문구는 `code()` 를 키로 다시 읽는다.

## 5. 키는 소스가 소유한다

```
MsgKey.java (서버)  ·  messageKeys.ts (프론트)
        └─→ ./gradlew generateMessageSeed ─→ SYS_MESSAGE_KEY 시드 CSV
                                             SYS_MESSAGE 값은 새 changeset 으로
```

- **문구를 소스에 박지 않는다**(CLAUDE.md §5-6). 서버는 `MsgKey` 상수 + `SYS_MESSAGE`.
- **키 시드는 생성물이다.** `MsgKey.java` 를 고쳤으면 생성 태스크를 돌려 **CSV 를 같은
  커밋에** 담는다. 값(`SYS_MESSAGE`)은 **이미 적재된 changeset 을 고치지 않고 새 파일로** 더한다.
- `SeedMessageTest` 가 **값 시드의 키가 키 시드에 있는가**를 검사한다.
- **`USE_SCOPE` 가 프론트 번들의 경계다.** 에러 문구는 프론트가 쓰지 않으므로 공개 번들에서
  빠진다 — 서버가 완성해 내려보내기 때문이다([api.md §4](./api.md)).

## 6. 핸들러가 잡는 것

| 예외 | 상태 | 코드 |
|---|---|---|
| `BusinessException` | `ErrorType` 이 정함 | 예외가 나르는 것 |
| `MethodArgumentNotValidException` | 400 | `err.validation` + 필드별 배열 |
| `NoResourceFoundException` | 404 | `err.not-found` |
| `HttpRequestMethodNotSupportedException` | 405 | `err.method-not-allowed` — **서버 고장이 아니라 클라이언트 잘못** |
| `HttpMessageNotReadableException` | 400 | `err.malformed-body` — **어느 필드인지 알 수 없다** |
| `Exception` | 500 | `err.internal` — **`traceId` 하나만 나간다** |

- **예외 로그는 `REQUIRES_NEW` 독립 트랜잭션으로 저장한다** — 비동기가 아니다. 부르는
  시점이 **언제나 예외 처리 중**이라 본 트랜잭션이 이미 rollback-only 이고, 같은
  트랜잭션에 얹으면 **예외가 난 요청의 기록만 골라서 사라진다.** 실패를 삼키는 자리는
  경계 **밖**(`ExceptionLogRecorder`)이다 — 서비스 안에서 잡으면 프록시가 커밋하며
  `UnexpectedRollbackException` 을 던진다. 상세는 [logging.md](./logging.md).
- **4xx 는 `ROOT_CAUSE_STACK` 을 저장하지 않는다** — 규칙의 정본은
  [logging.md](./logging.md) 다. 여기서는 예외 처리 흐름이 그것을 지킨다는 것만 적는다.
- **소스에 남는 로그·예외의 기본 메시지는 한국어로 쓴다**(CLAUDE.md §5-6). 사용자 문구는 `SYS_MESSAGE` 다.

## 관련

- [api.md](./api.md) — 봉투 · 서버가 문구를 완성하는 이유
- [knowledge/sys/message.md](../../knowledge/sys/message.md) — `SYS_MESSAGE` 도메인
- [CLAUDE.md §5-6 · §5-8](../../../CLAUDE.md) — 문구를 박지 않는다 · 시드는 생성물이다
