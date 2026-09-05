---
id: LLM-FWK-003
title: "스택 — 버전과 그 버전이 강요한 것"
category: standard
type: operation
created: 2026-05-04
updated: 2026-09-04
status: active
sources: ["sources/gradle/libs.versions.toml", "sources/frontend/package.json", "aidd-guide/standard/stack.md"]
author: Bong Jong Hyeon
tier: 2
tags: [stack, version, gradle, npm]
---

# 스택 — 버전과 그 버전이 강요한 것

> **버전 자체보다 중요한 것은 *그 버전이 무엇을 강요했는가* 다.**
> Boot 4 · JDK 25 · Jackson 3 이 각각 조용한 함정을 하나씩 갖고 있다.
>
> **원본은 `sources/gradle/libs.versions.toml` 과 `sources/frontend/package.json` 이다** — 이 문서가
> 그것과 어긋나면 **이 문서가 낡은 것이다**(CLAUDE.md §3).

## 1. 백엔드

| 항목 | 버전 |
|---|---|
| JDK | **25 (LTS)** |
| **Spring Boot** | **4.1.1** — Spring Framework 7.x |
| Gradle | 9.x — Kotlin DSL + Version Catalog |
| Hibernate | 7.4.x |
| **QueryDSL** | `io.github.openfeign.querydsl` **7.6** — 원본은 유지보수 중단, **OpenFeign 포크** |
| MyBatis | **아직 없다** — 좌표가 카탈로그에 없다. 들여올 조건은 [persistence.md](./backend/persistence.md) |
| 마이그레이션 | **Liquibase** (`spring-boot-starter-liquibase`) |
| 보안 | Spring Security 7.1.x |
| **ArchUnit** | **1.5.0** |
| 엑셀 | Apache POI 5.4.1 — **임의 API 경로에만** |
| SQL 로깅 | **P6Spy** |
| 테스트 | JUnit 5 · AssertJ · Mockito · **Testcontainers** |

**표에 없는 것을 적지 않는다.** 이 표는 `libs.versions.toml` 과 `package.json` 의 요약이며,
그 둘에 없는 아티팩트는 여기에도 없다 — *있다고 적힌 없는 것* 이 가장 비싼 거짓말이다.
개인정보 암호화(Bouncy Castle)를 걷은 것이 그 예다: [`backend/pii-vault.md`](./backend/pii-vault.md) 이
컬럼 암호화를 버리고 분리보관으로 갔고 그마저 미뤘는데, 표에만 남아 있었다.

**JDBC 드라이버의 버전은 적지 않는다** — 다섯 다 Spring Boot BOM 관리 대상이라, 카탈로그에
적으면 **높은 쪽이 이겨 적은 값이 그대로 쓰이지 않는다.**

## 2. 프론트엔드

| 항목 | 버전 |
|---|---|
| React | **19** |
| **TypeScript** | **6.0.3** — 고정. **7 은 린트가 막는다** |
| Vite | 8 |
| AntD | **6** |
| **AG Grid** | **Community 36** — Enterprise 기능에 기대지 않는다 |
| 서버 상태 | `@tanstack/react-query` 5 |
| 클라이언트 상태 | zustand 5 |
| HTTP | axios |
| 드래그 | **`@dnd-kit`** — 탭바 · 메뉴 트리 · 즐겨찾기가 **셋이 공유** |
| 엑셀 | `exceljs` — **프론트 생성 두 갈래** |
| 테스트 | vitest · testing-library |

## 3. 이 버전들이 강요한 것 — 조용한 함정 넷

### 3.1 Boot 4 는 라이브러리 존재만으로 자동설정을 붙이지 않는다

**`spring-boot-starter-{기술}` 을 쓴다.** 라이브러리만 넣으면 —

| 넣은 것 | 일어나는 일 |
|---|---|
| `liquibase-core` 만 | **마이그레이션이 아예 돌지 않는다.** 기동은 성공한다 — 스키마가 빌 뿐이다 |
| `spring-session-jdbc` 만 | **세션 스토어가 붙지 않는다** |

> **자동설정 누락은 원래 조용하다.** Liquibase 쪽이 드러난 이유는 `ddl-auto=validate` 가
> *"missing table"* 로 기동을 실패시켰기 때문이다 — **장치가 값을 한 사례**다.
> 세션 쪽은 그런 장치가 없어 *"Unable to connect to Redis"* 가 날 때까지 몰랐다.

### 3.2 ArchUnit 1.4.0 은 JDK 25 바이트코드를 하나도 읽지 못한다

**예외도 경고도 없이 임포트가 0개가 되고, 모든 규칙이 "위반 0건" 으로 통과한다** —
**영원히 초록인 게이트**다. 1.5.0 에서 해소됐지만, **임포트가 비어 있음을 검사하는 테스트를
함께 둔다.**

### 3.3 Spring Boot 4.1 은 Jackson **3** 이다

`ObjectMapper` 의 패키지가 **`tools.jackson.databind`** 이고 `com.fasterxml.jackson.databind`
는 클래스패스에 없다. **애너테이션만 `com.fasterxml.jackson.annotation` 에 그대로 남아**
한 파일에 두 최상위 패키지가 섞여 보인다 — **오타가 아니다.**

### 3.4 QueryDSL 포크의 좌표는 드롭인이 아니다

패키지명(`com.querydsl.*`)은 같지만 **좌표가 다르다.**
**`querydsl-jpa` 는 분류자가 없다**(포크가 jakarta 네이티브) — **`querydsl-apt` 만
`jakarta` 분류자를 갖는다.** 원본 시절의 `querydsl-jpa:7.6:jakarta` 는 **Maven Central 에
없는 아티팩트**다.

> **`core` 에 `@MappedSuperclass` 를 두면 QueryDSL 프로세서가 `core` 에서도 돌아야 한다** —
> 상속받는 엔티티의 Q 클래스가 `_super` 로 상위를 참조하기 때문이다. 그래서 `core` 의
> 의존이 *"프레임워크 최소"* 에 **`querydsl-core` 하나를 더한** 모양이 된다.
> `querydsl-jpa` 는 필요 없다 — JPA 쿼리를 조립하는 것은 `domain` 이다.

## 4. 버전을 적는 자리

| | 어디 |
|---|---|
| 백엔드 | **`sources/gradle/libs.versions.toml`** 하나 |
| BOM 관리 대상 | **적지 않는다** — 적으면 겹쳐서 높은 쪽이 이긴다 |
| 프론트 | `sources/frontend/package.json` |

**모듈의 `sources/build.gradle.kts` 에 버전 문자열을 쓰지 않는다.**

## 관련

- [sources/backend/packages.md](./backend/packages.md) — 모듈 다섯과 의존 방향
- [sources/backend/persistence.md](./backend/persistence.md) — 다섯 벤더
- [sources/frontend/packages.md](./frontend/packages.md) — 프론트 구조
