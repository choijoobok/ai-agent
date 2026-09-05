---
id: LLM-FWK-BE-010
title: "로깅 — 요청 전문 · 애플리케이션 로그 · 마스킹"
category: standard/backend
type: operation
created: 2026-09-03
updated: 2026-09-03
status: active
sources: ["sources/backend/api/", "sources/backend/support/logging/", "aidd-guide/standard/backend/packages.md", "aidd-guide/standard/backend/logging.md"]
tier: 2
tags: [backend, logging, audit, masking, p6spy]
---

# 로깅 — 요청 전문 · 애플리케이션 로그 · 마스킹

> **감사 이력(데이터 변경 before/after)을 만들지 않는다.** 대신 **Ajax API 요청 전문을
> 통째로 저장**한다. 그 대체는 **요청 로그가 완전할 때만** 성립하므로, 무엇을 빠뜨리지
> 않는가가 이 문서의 전부다.

## 1. 한 요청 = 사용 이력 **1행**. 예외면 에러 로그가 **한 행 더**

| | `SYS_LO_ACCESS` (사용 이력) | `SYS_LO_EXCEPTION` (에러 로그) |
|---|---|---|
| 조건 | **전 요청** — 2xx · 4xx · 5xx | 예외 발생 시 **추가로** |
| 담당 | `HandlerInterceptor.afterCompletion` | `@RestControllerAdvice` |
| 공통 컬럼 | `USER_ID` · `MENU_CD` · `REQUEST_URI` · `CLIENT_IP` · **`HTTP_STAT`** · `TRACE_ID` · `CRE_DTM` | 동일 |
| 고유 컬럼 | **`PARAMETERS`**(전문) | **`ERR_CD` · `ERR_MSG` · `ROOT_CAUSE_STACK`** |
| 보존 | 90일 | 180일 |

**배타가 아니다 — 403 은 양쪽에 남는다.** 사용 이력에 *일어난 요청*으로, 에러 로그에
*`ERR_CD` 로 구분된 원인*으로.

> **한때 *"예외 발생 요청은 사용 이력에 중복 기록하지 않는다"* 였고 그 배타가 셋을 깼다.**
> ① 감사 이력을 요청 로깅으로 대체한 전제가 무너진다 — 실패한 요청이 다른 테이블에
> 있으면 *"이 사용자가 무엇을 했나"* 에 두 테이블이 필요하고 **컬럼이 달라 `UNION` 도
> 안 된다.** ② *"한 요청이 같은 추적 ID 로 남는다"* 는 그림이 사실이 아니게 된다.
> ③ 403 을 기록할 곳이 정해지지 않는다.
>
> **중복의 정체가 판단을 바꿨다.** 공통 컬럼 일곱 중 여섯은 `VARCHAR` 이고 비싼 것은
> **`PARAMETERS`(1MB `nclob`) 하나**다. **그것만 사용 이력에 두면 중복 회피의 목적이
> 달성되고 배타가 필요 없어진다.**

- **`PARAMETERS` 는 사용 이력에만 있다.** 에러 로그에서 전문을 보려면 `TRACE_ID` 로 건너뛴다
  — 보존이 달라 **180일 된 에러의 전문은 없다.** 받아들인다: `ERR_CD`·`ERR_MSG`·스택이
  자기 테이블에 있어 **진단은 자립한다.**
- **`HTTP_STAT` 이 양쪽에 있다.** 사용 이력은 그것으로 성공·실패를 가르고, 에러 로그는
  **4xx 와 5xx 를 가른다.**
- **4xx 는 `ROOT_CAUSE_STACK` 을 저장하지 않는다** — 인가 거부의 스택은 인터셉터
  프레임뿐이고 **전 행이 같다.** 180일치 노이즈다.
- **응답 body 는 저장하지 않는다** — 목록 응답이 수 MB 가 될 수 있다.
- **저장은 `REQUIRES_NEW` 독립 트랜잭션.** 로그 저장 실패가 원본 응답에 영향을 주면
  안 된다 — `warn` 만 남기고 삼킨다.

### `MENU_CD` 는 클라이언트가 밝힌다

매 요청 `X-Menu-Code` 헤더로 온다. **기록 전용이며 인가 판정에 쓰지 않는다** —
클라이언트 주장 값이라 통계·추적 외 용도로 신뢰하지 않는다.

**메뉴 문맥 없는 호출(로그인·하트비트)은 `NULL` 로 저장한다.** 빈 문자열은 Oracle 에서
NULL 이 되어 **구분이 성립하지 않고**, 특수값은 메뉴명 조인이 비어 같은 처리를 부른다.

### `PARAMETERS` 매핑

```java
@Nationalized
@JdbcTypeCode(SqlTypes.LONG32NVARCHAR)   // @Lob 은 MySQL 에서 tinytext(255B) 가 된다
private String parameters;
```

쿼리스트링 + 헤더 + body 를 직렬화한 **하나의 CLOB** 이다. 상한 1MB 는
**UTF-8 바이트로** 잰다([crosscutting.md §4](./crosscutting.md)).

## 2. 마스킹 — 없으면 로그가 최대 취약점이 된다

| 대상 | 기본값 |
|---|---|
| 파라미터 키 | `password` · `passwd` · `secret` · `token` |
| 헤더 | `authorization` · `cookie` · `set-cookie` · `proxy-authorization` |
| **PII 컬럼** | **`SYS_PII_DEF` 등록 컬럼을 자동 추가** |
| 텍스트 판정 | `application/json`·`xml`·`x-www-form-urlencoded`·`text/` 화이트리스트. 그 외 `[binary: N bytes]` |

설정: `app.http-log.*` (사용 이력·에러 로그 공유)

## 3. SQL 로그 — P6Spy 하나로

Hibernate 의 `show-sql` 은 **JPA 만** 잡고 파라미터가 물음표로 남는다. MyBatis 로거는
**MyBatis 만** 잡는다. **JDBC 계층에서 가로채야 세 경로가 한 번에 해결된다.**

```
JPA ──────┐
QueryDSL ─┼──→ JDBC ← [P6Spy] → 단일 로거
MyBatis ──┘
```

| 항목 | 값 |
|---|---|
| 의존 | **`p6spy:p6spy` 만** — 스타터를 쓰지 않는다 |
| 지점 | `MessageFormattingStrategy` |
| 포맷 | `SqlPretty` — 우리 것 |
| 활성화 | **`app.logging.sql.enabled`** — **운영 기본 `false`** |

### 개인정보와 SQL 로그

`getSqlWithValues()` 는 **파라미터가 바인딩된 SQL** 을 만든다 — 평문이 남을 위험이 있다.
**PII Vault 패턴이 이것을 구조적으로 막는다**: 저장은 암호문, 검색은 해시, 원본 테이블은
참조키(UUID), 비밀번호는 BCrypt.

**예외가 하나 있다 — PII 로 지정하지 않은 값이 조건절에 들어가면 여전히 노출된다.**
운영에서 `enabled: false` 를 기본으로 두는 이유 중 하나다.

## 4. 비동기 로깅 — 반드시 고쳐야 하는 기본값 둘

| 속성 | 기본값 | 문제 | 우리 값 |
|---|---|---|---|
| `discardingThreshold` | `queueSize / 5` | 큐가 80% 차면 **TRACE·DEBUG·INFO 를 조용히 버린다** | **`0`** |
| `includeCallerData` | `false` | 비동기에서 클래스·메서드·줄번호가 소실 | **`false` 유지** |

> **`discardingThreshold` 기본값이 특히 위험하다.** 로그가 사라져도 **아무 경고가 없고**,
> **부하 상황에서만 재현**되어 원인 파악이 어렵다.

**`includeCallerData` 를 켜지 않는 이유** — 로그 이벤트마다 스택트레이스를 캡처해
**비동기를 쓰는 의미가 사라진다.** 대신 호출 위치를 `StackWalker` 로 직접 구해 **메시지
본문에 넣는다.** 비동기와 경로 추적이 충돌하지 않는 이유가 이것이다.

## 5. 사용자별 로그 파일

Logback `SiftingAppender` + MDC `userId` 로 나눈다(`logs/users/${userId}/app.log`).
**사용자별 파일만 쓰지 않는다** — 통합 파일을 함께 남긴다.

## 6. 로그 문구는 한국어로 쓴다

소스에 남는 로그·예외의 기본 메시지는 **한국어**다(CLAUDE.md §5-5). 정본은
`SYS_MESSAGE` 이고 소스의 것은 폴백·진단이며, **그것을 읽는 사람이 한국어 운영자**다.
사용자에게 보이는 문구만 `SYS_MESSAGE` 를 거친다.

## 관련

- [crosscutting.md](./crosscutting.md) — 인터셉터 순서 · body 캐싱 상한
- [exception.md](./exception.md) — `ERR_CD` · `ERR_MSG` 를 만드는 곳
- [knowledge/sys/logs.md](../../knowledge/sys/logs.md) — 로그 도메인
