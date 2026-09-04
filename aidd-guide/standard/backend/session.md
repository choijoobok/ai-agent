---
id: LLM-FWK-BE-007
title: "세션 — 스토어 선택 · 담는 것 · 동시 접속"
category: "06-framework/backend"
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/bootstrap/src/main/resources/application.yml", "aidd-guide/standard/backend/_study/security-design.md"]
author: Bong Jong Hyeon
tier: 2
tags: [backend, session, spring-session, redis, jdbc]
---

# 세션 — 스토어 선택 · 담는 것 · 동시 접속

> **세션을 외부화하되 Redis 를 필수 인프라로 강제하지 않는다.**
> 고객사마다 인프라가 다르고, 폐쇄망에서 Redis 를 세우지 못하는 곳이 실재한다.

## 1. 선택은 **자동설정 제외**로 표현한다

```yaml
spring:
  autoconfigure:
    exclude:
      # jdbc(기본) : Redis 세션 자동설정을 뺀다
      # redis      : 아래를 JdbcSessionAutoConfiguration 으로 바꾼다
      # none       : 둘 다 뺀다 — 서블릿 컨테이너 세션으로 떨어진다
      - org.springframework.boot.session.data.redis.autoconfigure.SessionDataRedisAutoConfiguration
  session:
    timeout: 30m
    jdbc:
      table-name: SPRING_SESSION
      initialize-schema: never     # Liquibase 가 관리
```

| 선택 | 용도 | 주의 |
|---|---|---|
| `none` | 단일 노드 로컬 개발 | 재기동 시 세션 소멸 |
| **jdbc** | **기본값.** Redis 없이 다중화 | 세션 조회 부하가 DB 로. **만료 세션 정리 배치 필요** |
| redis | 트래픽 큰 환경 | **Redis 가용성이 로그인 가용성이 된다** |

> **`spring.session.store-type` 은 Spring Boot 4 에 없다.** 이전 판은 그것을 `jdbc` 로
> 적어 두었는데 **그 프로퍼티가 사라졌고, 알 수 없는 프로퍼티는 오류가 아니라 무시다.**
> 스토어는 **클래스패스의 자동설정**이 정하고 둘 다 있으면 **Redis 가 이긴다** —
> `jdbc` 라고 적힌 채 Redis 로 붙었고, *"Unable to connect to Redis"* 가 나기 전까지
> 아무도 몰랐다.

> **대가가 하나 는다.** 클래스 이름을 `yml` 에 적으므로 Spring Boot 가 그 클래스를 옮기면
> **제외가 조용히 무효**가 된다 — 오타나 이름 변경도 오류가 아니라 *무시*다.
> **세션 스토어가 무엇인지 기동 로그로 확인하는 것**을 배포 점검 항목에 둔다.

## 2. 구현 시 유의점

1. **스타터를 쓴다** — `spring-boot-starter-session-jdbc` · `-session-data-redis`.
   라이브러리만 넣으면 **Boot 4 는 자동설정을 붙이지 않는다.** 둘 다 클래스패스에 둔다.
2. Redis 미사용 환경에서 **Redis 헬스체크가 기동을 막지 않게** 한다 —
   `management.health.redis.enabled: false`.
3. `SPRING_SESSION` DDL 은 **Spring Session 제공 벤더별 스크립트**를 Liquibase `dbms=`
   분기로 포함한다. **직접 작성하지 않는다.**

## 3. 세션에 담는 것 — 계산 **결과**만

| 담는다 | 담지 않는다 |
|---|---|
| principal (사용자ID · 로그인ID **최소 필드**) | 계산 **입력** — 역할 목록 · 개인 예외 · 유효기간 |
| **유효 권한 계산 결과** | **메뉴 트리** — 로그인 후 프론트 메모리로 1회 |
| 계정 상태 | |

- **`serialVersionUID` 를 고정한다.** 무중단 배포 시 역직렬화 실패를 막는다.
- **유효 권한이 세션에 있는 이유**는 [caching.md](./caching.md) §1 — 매 요청 필요하지만
  **낡으면 보안 결함**이라 TTL 캐시로 둘 수 없다.
- 계산 입력을 담지 않는 이유: 담으면 **같은 사실이 두 곳**에 생기고, 관리자가 역할을
  회수했을 때 **무엇을 지워야 하는지가 갈린다.**

## 4. 세션 중 재검사 — 인가 인터셉터가 한다

세션이 유지되는 동안 상태가 바뀔 수 있다(관리자가 계정 비활성화). 그래서 **계정 상태와
유효 권한을 매 요청 다시 본다** — 캐시 조회 두 번이면 끝난다.
체인 전체는 [security.md §5](./security.md).

## 5. 만료 처리

| 상황 | 응답 | 프론트 |
|---|---|---|
| 세션 없음·만료 | **401** | **재인증 모달** — 로그아웃하지 않는다 |
| 비밀번호 만료 | 제한 세션 → 변경 API 외 **403** | 비밀번호 변경 화면으로 유도 |

**401 에서 로그아웃하지 않는 것이 규칙이다** — 작성 중이던 입력이 사라지면 사용자가
같은 일을 두 번 한다.

## 관련

- [security.md](./security.md) — 접근 제어 체인 · 계층 셋
- [caching.md](./caching.md) — 대상마다 다른 캐시 백엔드
- [`_study/security-design.md`](./_study/security-design.md) §2 · §4-1 — 원문(동시 접속 제어 포함)
