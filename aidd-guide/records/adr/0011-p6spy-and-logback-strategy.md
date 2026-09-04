# ADR-0011. SQL 로깅은 P6Spy 단일화, 비동기·사용자별 로깅은 Logback

- 상태: 채택
- 일자: 2026-08-26

## 맥락

시스템 로깅 요구가 여섯 가지 나왔다.

1. 비동기 로깅 설정 토글
2. 사용자별 로그 파일 분리
3. JPA·QueryDSL·MyBatis **모두** 포맷팅된 쿼리 출력
4. **파라미터 바인딩된** SQL — 복사해서 바로 실행 가능
5. 총 건수·소요시간 출력
6. 쿼리 **호출 경로 추적**

## 결정

| 요구 | 수단 |
|---|---|
| 3·4·5 | **P6Spy** (`p6spy-spring-boot-starter` 2.0.x) + 커스텀 `SimpleJdbcEventListener` |
| 6 | **StackWalker** 로 프로젝트 첫 프레임 탐색 + **MDC `requestId` 병행** ([28](../../standard/backend/_study/system-logging.md) §3.3) |
| 1 | Logback `AsyncAppender`, 프로파일별 설정 파일 지정으로 전환 |
| 2 | Logback `SiftingAppender` + MDC `userId` |

상세: [28-system-logging](../../standard/backend/_study/system-logging.md)

## 근거

### SQL 로깅을 JDBC 계층에서 잡는 이유

Hibernate `show-sql` 은 JPA 만 잡고 파라미터가 물음표로 남는다.
MyBatis 로거는 MyBatis 만 잡는다. **ORM 별로 3벌을 만들면 출력 형식이 제각각**이 된다.

JDBC 는 세 경로가 반드시 통과하는 유일한 지점이다. P6Spy 는 여기서 가로채므로
**한 벌의 리스너로 세 요구가 모두 해결**되고, `getSqlWithValues()` 가 파라미터를
바인딩한 SQL 을 만들어 준다 (요구 4).

### 호출 경로 — `Thread.getStackTrace()` 가 아니라 `StackWalker`

`getStackTrace()` 는 전체 스택을 배열로 materialize 한다.
`StackWalker` 는 lazy 순회라 첫 매칭에서 멈춘다. JDK 25 를 쓰므로 사용에 제약이 없다.

### 비동기와 경로 추적의 충돌 해소

Logback 의 `includeCallerData` 를 켜면 비동기에서도 호출 위치를 얻을 수 있지만,
**로그 이벤트마다 스택트레이스를 캡처해 비동기의 이점을 상쇄**한다.

우리는 호출 위치를 **P6Spy 리스너에서 직접 구해 메시지 본문에 넣는다.**
Logback caller data 에 의존하지 않으므로 `includeCallerData=false` 를 유지하면서
요구 1 과 요구 6 을 동시에 만족한다.

### 조건부 설정에 Janino 를 쓰지 않는 이유

Logback 의 `<if>` 조건 분기는 Janino 의존성을 요구한다.
프로파일별로 `logging.config` 를 지정해 **설정 파일 자체를 바꾸는 편**이
의존성도 늘지 않고 어떤 설정이 적용됐는지도 명확하다.

## 대안

| 대안 | 기각 사유 |
|---|---|
| Hibernate `show-sql` + `format_sql` | JPA 전용. 파라미터가 물음표. MyBatis 미포착 |
| `datasource-proxy` (net.ttddyy) | 기능은 유사하나 **조회 건수**를 얻으려면 ResultSet 프록시를 직접 짜야 한다. P6Spy 는 `onAfterResultSetClose` 로 내장. 국내 레퍼런스도 많다 |
| `log4jdbc` | 사실상 유지보수 중단 |
| APM(Pinpoint·Scouter 등)으로 대체 | 운영 추적에는 유효하나 **개발 중 바인딩 SQL 확인**이라는 요구를 대체하지 못한다 |
| ORM 별 로거 3벌 | 출력 형식 불일치. 유지보수 3배 |
| Log4j2 AsyncLogger (LMAX Disruptor) | 성능은 낫지만 Spring Boot 기본 Logback 을 교체해야 한다. 이 규모에는 과함 |
| `includeCallerData=true` | 비동기 성능 이점 상쇄 |
| Janino + `<if>` | 의존성 추가. 적용 결과가 불투명 |

## 결과

### 감수하는 것

- **JPA dirty checking flush 의 호출 경로는 추적할 수 없다.**
  커밋 시점에 UPDATE 가 나가므로 그 스택에는 값을 바꾼 서비스 메서드가 없다.
  MDC `requestId` 로 요청 단위 대조까지만 가능하다.
- `resultset` 건수는 **실제로 읽은 행 수**다. 커서·스트리밍으로 중간에 멈추면 다르다.
- 운영에서 SQL 로깅을 상시 켤 수 없다 (포맷팅 + I/O 비용).

### 반드시 지킬 것

| # | 항목 |
|---|---|
| 1 | `AsyncAppender.discardingThreshold` 를 **`0`** 으로. 기본값(20%)이면 큐가 80% 찰 때 **INFO 로그를 조용히 버린다** |
| 2 | SQL 한 건 = `log.info` **한 번**. 나눠 호출하면 비동기·멀티스레드에서 줄이 섞인다 |
| 3 | 요청 종료 시 `MDC.clear()`. 스레드풀 재사용으로 다른 사용자 로그에 섞인다 |
| 4 | `SiftingAppender` 의 `userId` 를 **경로 조작 검증** 후 사용. 파일 경로에 직접 들어간다 |
| 5 | `maxAppenderCount` + `timeout` 으로 파일 핸들 폭증 방지 |
| 6 | 사용자별 파일은 **추가 출력**. 통합 로그 파일은 항상 유지 |
| 7 | `p6spy-spring-boot-starter` 2.0.x 의 Spring Boot 4.1 실동작을 **Phase 7 에서 검증** |
| 8 | 스타터가 막히면 **라이브러리를 바꾸지 말고 스타터를 벗는다.** 리스너·포맷터는 어차피 우리 코드이므로 `P6DataSource` 직접 래핑으로 대체 가능 |
