# ADR-0013. Virtual Thread 기본 채택 + TaskDecorator 컨텍스트 전파

- 상태: 채택
- 일자: 2026-08-26

## 맥락

백오피스 특성상 오래 걸리는 작업(대량 저장, 엑셀 생성, 일괄 처리)을 멀티스레드로 실행해야 한다.
이때 `SecurityContextHolder` 같은 ThreadLocal 기반 컨텍스트가 자식 스레드로 전파되어야
비동기 작업 안에서 사용자 식별·권한 검사·로그 상관관계가 유지된다.

## 결정

| 항목 | 결정 |
|---|---|
| 스레드 모델 | **Virtual Thread** (`spring.threads.virtual.enabled: true`) |
| 컨텍스트 전파 | **단일 `TaskDecorator`** 로 SecurityContext · MDC · Locale 을 함께 전파 |
| **트랜잭션 전파** | **금지.** 비동기 작업은 자기 트랜잭션을 새로 시작 |
| 요청 스코프 전파 | 금지. 필요한 값만 파라미터로 복사 |
| 동시성 | **작업 유형별 상한.** 무제한 생성 금지 |
| 오래 걸리는 작업 | jobId 발급 + 진행률 폴링 |

상세: [30-async-and-concurrency](../../standard/backend/crosscutting.md)

## 근거

### Virtual Thread 를 기본으로

JDK 25 는 **JEP 491(`synchronized` 핀닝 제거)을 포함한 첫 LTS** 다.
`synchronized` 를 쓰는 기존 라이브러리를 그대로 쓸 수 있어 채택 장벽이 사라졌다.
백오피스 작업은 대부분 I/O 대기(DB·파일·외부 API)라 Virtual Thread 의 이점이 크다.

### `DelegatingSecurityContextAsyncTaskExecutor` 만으로 부족한 이유

이 래퍼는 SecurityContext 만 전파한다. **MDC 는 전파되지 않는다.**
[28-system-logging](../../standard/backend/_study/system-logging.md) 은 `requestId` 로 요청 로그와 SQL 로그를
대조하도록 설계됐는데, 비동기 구간에서 그 연결이 끊긴다.

컨텍스트를 종류별로 래퍼를 겹치면 순서·중복 정리 문제가 생긴다.
**`TaskDecorator` 하나에 모으는 편**이 무엇이 전파되는지 명확하고, Spring Boot 가
`TaskDecorator` 빈을 자동 구성 executor 에 적용해 준다.

### 트랜잭션 전파를 금지하는 이유

`TransactionSynchronizationManager` 에는 `EntityManager` 와 JDBC `Connection` 이 묶여 있다.
**Hibernate `Session` 은 thread-safe 하지 않다.** 두 스레드가 같은 영속성 컨텍스트를 만지면
1차 캐시가 깨지고 데이터가 손상된다. 커밋·롤백 경계도 뒤엉킨다.

이건 성능 문제가 아니라 **정합성 문제**이므로 예외를 두지 않는다.

### 동시성 상한이 필요한 이유

Virtual Thread 는 수만 개를 만들 수 있지만 **DB 커넥션은 유한**하다.
JEP 491 이후 병목은 핀닝이 아니라 **커넥션 풀로 이동**했다.
요청 처리 스레드도 Virtual Thread 라 같은 풀을 쓰므로, 일괄 작업이 풀을 고갈시키면
**전체 서비스가 영향**을 받는다.

## 대안

| 대안 | 기각 사유 |
|---|---|
| 플랫폼 스레드 풀(`ThreadPoolTaskExecutor`) | I/O 대기 위주 작업에서 풀 크기가 처리량 상한이 된다 |
| `MODE_INHERITABLETHREADLOCAL` | 스레드 풀에서는 **풀 생성자의 컨텍스트를 상속**해 잘못된 사용자로 동작할 수 있다 |
| `DelegatingSecurityContextAsyncTaskExecutor` 단독 | MDC·Locale 미전파 |
| `ContextPropagatingTaskDecorator` (Micrometer) | 기능은 우수하나 의존성이 늘고, 무엇이 전파되는지 `ThreadLocalAccessor` 등록을 따라가야 보인다. **관측 스택 도입 시 재검토** |
| Scoped Values (JDK 25 정식) | Spring Security·MDC 등 기존 스택이 전부 `ThreadLocal` 기반이라 지금 전환 불가 |
| 동시성 무제한 | 커넥션 풀 고갈로 전체 서비스 장애 |

## 결과

### 감수하는 것

- **CPU 바운드 작업에는 이점이 없다.** 오히려 컨텍스트 스위칭만 는다.
  해당 작업은 플랫폼 스레드 풀을 별도로 둔다.
- JNI 프레임·클래스 초기화자에서는 여전히 핀닝이 발생한다.
- 진행률 store 가 `caffeine`/`inmemory` 면 **다중화 환경에서 폴링이 다른 노드로 가면 깨진다.**
  다중화에서는 **노드 간 공유 store** 가 필요하다 — `jdbc` 가 기본이고, 고부하일 때만 `redis`
  다([ADR-0017](./0017-cache-strategy-per-target.md) · [30](../../standard/backend/crosscutting.md) §6.1). Redis 는 필수가 아니다.

### 반드시 지킬 것

| # | 항목 |
|---|---|
| 1 | `decorate()` **안에서** 컨텍스트를 캡처한다. 이 메서드는 제출 스레드에서 실행된다 |
| 2 | `SecurityContext` 객체를 공유하지 말고 `createEmptyContext()` 로 새로 만들어 `Authentication` 만 복사 |
| 3 | `finally` 에서 `SecurityContextHolder.clearContext()` · `MDC.clear()` · Locale 리셋 |
| 4 | **트랜잭션·`EntityManager` 를 절대 전파하지 않는다** |
| 5 | 요청 스코프 객체 대신 **필요한 값을 파라미터로** 넘긴다 |
| 6 | DB 작업 동시성은 **커넥션 풀 크기 이하**로 제한 |
| 7 | `@Async` 풀과 진행률 작업 풀을 **분리** |
| 8 | `@Async` + `@Transactional` 은 같은 빈 내부 호출에서 동작하지 않는다 — 별도 빈으로 |
| 9 | 커밋 후 실행이 필요하면 `@TransactionalEventListener(AFTER_COMMIT)` |
| 10 | 스케줄러 스레드에는 SecurityContext 가 없다 — **시스템 계정 명시 주입** |
