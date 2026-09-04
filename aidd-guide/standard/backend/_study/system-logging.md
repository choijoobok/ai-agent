---
id: LLM-FWK-BE-S005
title: "시스템 로깅 — 원문"
category: "06-framework/backend"
type: study
created: 2026-08-28
updated: 2026-09-03
status: active
sources: ["(원본) docs/design/28-system-logging.md — 2026-09-04 폐지"]
author: Bong Jong Hyeon
tier: 2
tags: [backend, logging, p6spy, study]
---

> **이 파일은 근거다** — 규칙은 [`../logging.md`](../logging.md) 가 갖는다.
> P6Spy 단일화 · 호출 경로 추적 · 비동기 어펜더 · 사용자별 파일의 상세가 여기 남는다.

# 28. 시스템 로깅

- 상태: 확정
- 최종수정일: 2026-08-26
- 관련: [21-backend-architecture](./architecture.md) §6(DB 저장 요청 로그) · [ADR-0011](../../../records/adr/0011-p6spy-and-logback-strategy.md)
- **읽어야 할 때**: 로그 출력을 바꿀 때 · SQL·요청 로그로 진단할 때

> 본 문서는 **파일·콘솔로 출력하는 애플리케이션 로그**를 다룬다.
> DB 테이블에 저장하는 사용 이력·에러 로그는 [21](./architecture.md) §6 소관이다.

## 1. 요구사항

| # | 요구 |
|---|---|
| 1 | **비동기 로깅**을 설정으로 켜고 끌 수 있어야 한다 |
| 2 | **사용자별 로그 파일** 분리 저장이 가능해야 한다 |
| 3 | JPA · QueryDSL · MyBatis **모두** 쿼리를 보기 좋게 포맷팅 출력 |
| 4 | **파라미터가 바인딩된** SQL — 복사해서 DB 툴에서 바로 실행 가능해야 함 |
| 5 | 조회·저장의 **총 건수와 소요시간** 출력 |
| 6 | 그 쿼리가 **어디서 호출됐는지 경로 추적** |

## 2. SQL 로깅 — P6Spy 단일화 (요구 3·4·5)

Hibernate 의 `show-sql` 은 JPA 만 잡고 파라미터가 물음표로 남는다.
MyBatis 로거는 MyBatis 만 잡는다. **JDBC 계층에서 가로채야 세 경로가 한 번에 해결된다.**

```
JPA ──────┐
QueryDSL ─┼──→ JDBC ← [P6Spy] → 단일 로거
MyBatis ──┘
```

| 항목 | 설계 | **선 것**(2026-08-30) |
|---|---|---|
| 라이브러리 | `com.github.gavlyukovskiy:p6spy-spring-boot-starter` **2.0.x** | **`p6spy:p6spy` 만** — §2.0 의 2단계 |
| 로그 지점 | 커스텀 `SimpleJdbcEventListener` | **`MessageFormattingStrategy`** — 아래 |
| 포맷 | Hibernate `FormatStyle` | **`SqlPretty`** — 우리 것. 아래 |
| 파라미터 바인딩 | `getSqlWithValues()` | 〃 — 포맷터가 받는 `sql` 이 이미 그것이다 |
| 활성화 | `decorator.datasource.p6spy.enable-logging` | **`app.logging.sql.enabled`** — 운영 기본 false |

> **스타터를 쓰지 않았다.** 최신 릴리스가 Spring Boot 3 계열이라, 쓰면 *"판을 올릴 때
> 자동설정이 따라오는가"* 가 매번 확인 대상이 된다. §2.0 이 미리 열어 둔 2단계가 실제로
> **설정 클래스 하나**였다 — `SqlLogConfig` 의 `BeanPostProcessor` 가 `DataSource` 를
> `P6DataSource` 로 감싼다.
>
> **리스너 대신 포맷터다.** 우리가 필요한 것(값이 박힌 SQL · 소요시간 · 카테고리)은
> `MessageFormattingStrategy` 가 인자로 전부 받는다. 리스너는 **행 수**를 위해 필요한데
> (§2.2) 그것은 아직 세지 않는다 — 요구 5 의 절반(시간)만 서 있다.
>
> **포맷은 우리 것이다.** Hibernate 의 `FormatStyle` 은 판의 내부 클래스라 판을 올릴 때
> 자리가 바뀔 수 있고, 무엇보다 **support 가 Hibernate 를 알게 된다** — 이 모듈은 core 만
> 참조한다([21](./architecture.md) §1). `SqlPretty` 가 하는 일은 **절 앞에서 줄을 바꾸는 것** 하나이며
> 그 이상은 DB 툴이 훨씬 잘한다.
>
> **따옴표 안은 건드리지 않는다.** 값에 `from` 이 들어 있는 경우가 실제로 있고(주소·메시지)
> 거기서 줄을 바꾸면 **붙여 넣었을 때 다른 쿼리**가 된다 — 이 기능이 존재하는 이유가 그
> 복사이므로 그것을 깨면 전부가 무의미하다. `from_dt` 를 `from` 으로 읽어 컬럼 이름
> 한가운데서 끊던 것도 같은 종류이며, **테스트가 잡았다**.

### 2.0 스타터 의존은 편의일 뿐이다

스타터(`spring-boot-data-source-decorator`)가 해주는 일은 **자동 래핑과 yml 프로퍼티 바인딩**뿐이다.
리스너·포맷터는 어차피 우리가 직접 구현한다. 따라서 스타터가 Spring Boot 4 를 따라오지 못해도
**라이브러리를 갈아탈 이유는 없다.**

| 단계 | 대응 | 비용 |
|---|---|---|
| 1 | 스타터 사용 (기본) | — |
| 2 | 스타터 제거, `P6DataSource` 직접 래핑 + `spy.properties` | 설정 클래스 1개 |
| 3 | `datasource-proxy` 로 교체 | 리스너 재작성 + **조회 건수 직접 구현** |

```java
@Bean
DataSource dataSource(DataSource real) {
    return new P6DataSource(real);   // 스타터 없이도 동일 동작
}
```

3단계를 최후로 두는 이유는 **조회 건수** 때문이다. P6Spy 는 `onAfterResultSetClose` 로
행 수를 내장 제공하지만, `datasource-proxy` 는 ResultSet 프록시를 직접 만들어야 한다.

### 2.1 출력 형식

**한 번의 `log.info` 호출로 모든 정보를 담는다.** 여러 번 나눠 호출하면
비동기 로깅·멀티스레드에서 줄이 뒤섞인다.

```
[2026-08-23 14:23:11.482] | resultset | thread=http-nio-8080-exec-3 | conn=12 | 27ms | readOnly | rows=42
  <- com.ordinary.backoffice.domain.user.service.UserService.searchPage(UserService.java:88)
select
    u.user_id, u.login_id, u.phone_no
from
    sys_user u
where
    u.use_yn = 'Y'
    and u.reg_dtm >= '2026-08-01'
order by
    u.reg_dtm desc
```

### 2.2 카테고리별 건수·시간 (요구 5)

| 카테고리 | 콜백 | 건수 |
|---|---|---|
| `resultset` (SELECT) | `onAfterResultSetClose` | `getCurrRow() + 1` — **fetch 한 행 수** |
| `insert`/`update`/`delete` | `onAfterExecuteUpdate` | `rowCount` |
| MyBatis 쓰기 | `onAfterAnyExecute` | `Statement.getUpdateCount()` |
| `batch` | `onAfterExecuteBatch` | `updateCounts` 합계 |
| `commit`/`rollback` | `onAfterCommit`/`Rollback` | — |

> **한계**: `resultset` 의 건수는 **실제로 읽은 행 수**다. 스트리밍·커서로 중간에 멈추면
> 결과 집합 전체 건수와 다르다. Hibernate 는 통상 끝까지 읽으므로 일치한다.

MyBatis 는 `execute()` + `getUpdateCount()` 패턴이라 `onAfterExecuteUpdate` 가 아닌
`onAfterAnyExecute` 로 들어온다. 두 콜백을 모두 오버라이드하되
**SELECT 는 `onAfterAnyExecute` 에서 skip** 해야 `resultset` 과 중복 발화하지 않는다.

### 2.3 노이즈 제거

> **거르면 빈 줄이 남는다**(2026-08-30 — 실물에서 걸렸다). 포맷터가 걸러 낸 SQL 에
> 빈 문자열을 내는데, 판의 기본 appender 는 그것을 **그대로 한 줄로** 찍는다 — 노이즈를
> 지우려던 것이 다른 노이즈가 된다. `SqlLogAppender` 가 빈 줄을 삼킨다.
>
> **`commit`·`rollback` 은 아예 만들지 않는다.** SQL 이 없어 포맷터가 낼 것이 없으므로
> `spy.properties` 의 `excludecategories` 에서 끊는다. §2.2 의 표는 리스너가 설 때 살아난다.

| 대상 | 처리 |
|---|---|
| `SPRING_SESSION` 테이블 | SQL 패턴 매칭으로 제외 |
| 제외 SQL 만 있던 트랜잭션의 commit/rollback | connection 별 플래그로 함께 제외 |
| 특정 구간 일시 중단 | `pushSuppress()` / `popSuppress()` — 스레드별 depth 카운터(중첩 안전) |

## 3. 쿼리 호출 경로 추적 (요구 6)

P6Spy 는 JDBC 계층이라 호출자를 모른다. **스택을 직접 걸어 프로젝트 코드의 첫 프레임**을 찾는다.

### 3.1 StackWalker 사용

```java
private static final List<String> SKIP = List.of(
    "org.springframework", "org.hibernate", "com.querydsl",
    "org.apache.ibatis", "com.p6spy", "com.zaxxer", "jdk.", "java.");

StackWalker.getInstance()
    .walk(s -> s
        .filter(f -> f.getClassName().startsWith(BASE_PKG))
        .filter(f -> SKIP.stream().noneMatch(f.getClassName()::startsWith))
        .findFirst())
    .map(f -> f.getClassName() + "." + f.getMethodName()
              + "(" + f.getFileName() + ":" + f.getLineNumber() + ")")
    .orElse("unknown");
```

`Thread.currentThread().getStackTrace()` 는 **전체 스택을 배열로 만든다.**
`StackWalker` 는 lazy 하게 순회하며 `findFirst()` 에서 멈추므로 훨씬 저렴하다.
그래도 공짜는 아니므로 **설정으로 on/off** 한다 (`app.logging.sql.trace-caller`, 운영 기본 false).

### 3.2 추적이 불가능한 경우 — 반드시 알아둘 것

| 상황 | 스택에 남는 것 | 대응 |
|---|---|---|
| **JPA dirty checking flush** | `TransactionInterceptor` — **값을 바꾼 코드는 이미 스택에 없다** | §3.3 |
| 트랜잭션 커밋 시 일괄 flush | 동일 | 동일 |
| 비동기·배치 스레드 | 호출 체인이 끊김 | MDC 로 배치 작업명 전달 |

**이게 가장 큰 한계다.** JPA 는 엔티티 값을 바꿔두면 커밋 시점에 UPDATE 가 나가므로,
그 시점 스택에는 수정한 서비스 메서드가 없다. 스택 추적만으로는 못 찾는다.

### 3.3 보조 수단 — MDC 병행

스택으로 못 찾아도 **어느 요청에서 발생했는지**는 알 수 있어야 한다.

| MDC 키 | 값 | 설정 시점 |
|---|---|---|
| `requestId` | **클라이언트 발급** `X-Request-Id` (없으면 서버 생성) | `RequestIdMdcFilter` (최우선) |
| `userId` | 로그인 사용자 | 인증 이후 |
| `uri` | 요청 경로 | `RequestIdMdcFilter` |
| `job` | 배치 작업명 | 스케줄러 진입 시 |

로그 패턴에 `%X{requestId}` 를 항상 포함하면, 스택 추적이 실패해도
**같은 requestId 의 요청 로그와 대조**해 출처를 좁힐 수 있다. 두 수단을 병행한다.

> `requestId` 는 **클라이언트가 발급**한다. 서버 생성 ID 는 인프라 재전송마다 값이 달라
> "같은 요청인가" 를 판정할 수 없다. 이 값이 중복 요청 방어의 키이기도 하다
> → [29-request-dedup](../crosscutting.md) §4.
>
> **같은 값이 자리마다 이름이 다르다** — 헤더 `X-Request-Id`, MDC 키 `requestId`,
> DB 컬럼 `TRACE_ID`([45](../../../knowledge/sys/logs.md) §7), 에러 응답 필드 `traceId`([21](./architecture.md) §6-1).
> 새 이름을 늘리지 않는다.

## 4. 비동기 로깅 (요구 1)

Logback `AsyncAppender` 를 쓰고 **설정으로 전환**한다.

```xml
<appender name="ASYNC_FILE" class="ch.qos.logback.classic.AsyncAppender">
    <appender-ref ref="FILE"/>
    <queueSize>8192</queueSize>
    <discardingThreshold>0</discardingThreshold>
    <neverBlock>false</neverBlock>
    <includeCallerData>false</includeCallerData>
</appender>
```

### 4.1 반드시 조정해야 할 기본값 — 두 개

| 속성 | 기본값 | 문제 | 우리 설정 |
|---|---|---|---|
| `discardingThreshold` | `queueSize / 5` (20%) | 큐가 80% 차면 **TRACE·DEBUG·INFO 를 조용히 버린다.** SQL 로그가 INFO 라 그대로 사라짐 | **`0`** (버리지 않음) |
| `includeCallerData` | `false` | 비동기에서는 **클래스·메서드·줄번호가 소실**된다 | **`false` 유지** (§4.2) |

> `discardingThreshold` 기본값이 특히 위험하다. 로그가 사라져도 **아무 경고가 없고**,
> 부하 상황에서만 재현되어 원인 파악이 어렵다.

### 4.2 `includeCallerData` 를 켜지 않는 이유

`true` 로 하면 로그 이벤트마다 스택트레이스를 캡처해 성능이 크게 떨어진다.
비동기를 쓰는 의미가 사라진다.

**대신 호출 위치를 §3 에서 직접 구해 메시지 본문에 넣는다.**
Logback 의 caller data 에 의존하지 않으므로 `false` 로 두고도 경로 추적이 동작한다.
요구 1(비동기)과 요구 6(경로 추적)이 충돌하지 않는 이유가 이것이다.

### 4.3 전환 방식

Logback 의 조건부 설정(`<if>`)은 Janino 의존성이 필요하다. 의존성을 늘리지 않기 위해
**프로파일별로 설정 파일 자체를 지정**한다.

```yaml
# application-local.yml
logging:
  config: classpath:logback-sync.xml

# application-prod.yml
logging:
  config: classpath:logback-async.xml
```

공통 appender 정의는 `logback-base.xml` 에 두고 `include` 한다.

| 항목 | 방침 |
|---|---|
| 로컬 개발 | **동기** — 즉시 출력돼야 디버깅이 된다 |
| 운영 | **비동기** — 응답 지연 방지 |
| 종료 시 유실 | Spring Boot 가 shutdown hook 으로 appender 를 정리한다. graceful shutdown 과 함께 검증 |

## 5. 사용자별 로그 파일 (요구 2)

Logback `SiftingAppender` + MDC `userId` 로 분리한다.

```xml
<appender name="USER_FILE" class="ch.qos.logback.classic.sift.SiftingAppender">
    <discriminator>
        <key>userId</key>
        <defaultValue>system</defaultValue>
    </discriminator>
    <maxAppenderCount>200</maxAppenderCount>
    <timeout>30 minutes</timeout>
    <sift>
        <appender name="FILE-USER" class="ch.qos.logback.core.rolling.RollingFileAppender">
            <file>logs/users/${userId}/app.log</file>
        </appender>
    </sift>
</appender>
```

### 5.1 반드시 처리할 것

| # | 항목 | 처리 |
|---|---|---|
| 1 | **MDC 오염** | 요청 종료 시 `MDC.clear()` **필수**. 스레드풀이 재사용되므로 안 지우면 다른 사용자 로그에 섞인다 |
| 2 | **파일 핸들 폭증** | `maxAppenderCount` + `timeout` 으로 유휴 appender 자동 종료 |
| 3 | **경로 조작** | `userId` 가 파일 경로에 들어간다. 상위 경로 이동·구분자·널바이트를 **화이트리스트 검증**으로 차단 |
| 4 | 비로그인 스레드 | 배치·스케줄러는 `defaultValue`(`system`) |
| 5 | 비동기 조합 | `AsyncAppender` 는 MDC 를 복사해 전달하므로 함께 사용 가능 |
| 6 | 활성화 | `app.logging.per-user.enabled` — **기본 false**. 필요할 때만 켠다 |

> 3번은 실제 취약점이다. `userId` 를 그대로 경로에 넣으면 임의 경로에 파일을 만들 수 있다.
> 로그인 ID 형식(영숫자·언더스코어·하이픈, 30자 이내)을 강제 검증한다.

### 5.2 사용자별 파일만 쓰지 않는다

사용자별 파일은 **추가 출력**이다. 통합 로그 파일은 항상 유지한다.
사용자별 파일만 있으면 요청 간 상관관계를 볼 수 없다.

## 6. 개인정보와 SQL 로그

`getSqlWithValues()` 는 **파라미터가 바인딩된 SQL** 을 만든다. 평문이 로그에 남을 위험이 있다.

**PII Vault 패턴이 이 문제를 구조적으로 막는다.**

| 경로 | SQL 에 나타나는 값 |
|---|---|
| PII 저장 | vault 에 들어가는 것은 **이미 암호화된 값** |
| PII 검색 | 평문이 아니라 **해시** |
| 원본 테이블 | **참조키(UUID)** 뿐 |
| 비밀번호 | BCrypt 해시 |

→ [27-pii-vault](../pii-vault.md) 를 채택한 결과, SQL 로그에 평문 개인정보가 나타나지 않는다.

단 예외가 있다. **PII 로 지정하지 않은 값이 조건절에 들어가는 경우**는 여전히 노출된다.
운영에서 `enable-logging: false` 를 기본으로 두는 이유 중 하나다.

## 7. 설정 요약

```yaml
app:
  logging:
    sql:
      enabled: true             # DataSource 를 P6Spy 로 감싼다. 운영 false
      trace-caller: true        # 호출 경로 추적. 운영 false
      exclude-patterns: [SPRING_SESSION, DATABASECHANGELOG]
    per-user:
      enabled: false            # 사용자별 파일 분리
      max-appenders: 200
      idle-timeout: 30m

logging:
  config: classpath:logback-sync.xml   # 운영은 logback-async.xml
  file:
    name: logs/ordinary-backoffice.log
  logback:
    rollingpolicy:
      max-file-size: 50MB
      max-history: 14          # 통합 로그. 사용자별 로그는 30일 — 아래
      total-size-cap: 1GB
```

**사용자별 로그(§5 `SiftingAppender`)의 롤링 정책은 별도다** — `maxHistory` **30**,
`totalSizeCap` 은 사용자 수에 맞춰 정한다. 통합 로그의 14일과 다른 값이며, 이 30일이
[32](../../../knowledge/retention.md) §3 이 *"사용자별 로그 파일 30일 + 용량 상한"* 으로 기록한 그 값이다.

> **로컬에서 Hibernate 자신의 SQL 로거는 끈다**(`org.hibernate.SQL: off`). 켜 두면
> **같은 쿼리가 두 번** 나온다 — 그쪽은 물음표가 남은 원문이고, 우리가 보려는 것은 값이
> 박힌 쪽이다.

## 8. 환경별 방침

| 항목 | 로컬/개발 | 운영 |
|---|---|---|
| SQL 로깅 | ON | **OFF** (진단 시 일시 ON) |
| 호출 경로 추적 | ON | OFF |
| 비동기 | OFF (즉시 출력) | ON |
| 사용자별 파일 | OFF | 필요 시 ON |
| 로그 레벨 | 일부 `debug` | `info` |

운영에서 SQL 로깅을 켜면 **모든 쿼리마다 문자열 포맷팅과 I/O** 가 발생한다.
상시 활성화는 하지 않는다.

## 9. 미결 사항

| 항목 | 성격 | 범위 | 게이트 |
|---|---|---|---|
| JSON 구조화 로그(logstash-encoder) 적용 범위 | 결정 | 템플릿 | Phase 7 |
| `p6spy-spring-boot-starter` 2.0.x 의 Spring Boot 4.1 실동작 | 검증 | 템플릿 | **스파이크 (Phase 7 이전)** |
| P6Spy 오버헤드 실측 (운영 상시 활성 가능 여부) | 실측 | 템플릿 | 릴리스 |

**폴백** — p6spy 검증 실패 시 §2.0 의 단계적 폴백을 적용한다. (폴백이 이미 문서화된 유일한 검증 항목)

### 해소된 미결

| 항목 | 결정 | 해소일 |
|---|---|---|
| 사용자별 로그의 보존·정리 정책 | **30일 + 용량 상한** (logback `maxHistory`·`totalSizeCap`). DB 파기 배치와 다른 메커니즘 — [32-data-retention](../../../knowledge/retention.md) §3 | 2026-08-24 |
