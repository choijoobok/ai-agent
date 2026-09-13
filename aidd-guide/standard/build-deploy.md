---
id: LLM-FWK-005
title: "빌드 · 배포 — 단일 JAR · 프로파일 · CI"
category: standard
type: operation
class: none
created: 2026-09-04
updated: 2026-09-13
status: active
sources: ["sources/build.gradle.kts", "sources/backend/bootstrap/build.gradle.kts", ".github/workflows/", "sources/backend/bootstrap/src/main/resources/application.yml", "sources/frontend/vite.config.ts"]
tier: 2
tags: [build, deploy, ci, profile, spa]
---

# 빌드 · 배포 — 단일 JAR · 프로파일 · CI

> **`.github/workflows/` 와 `vite.config.ts` 가 이 파일을 단일 원본으로 가리킨다.**
> 파이프라인 단계를 바꾸면 여기도 바꾼다 — 둘이 갈리면 **워크플로가 무엇을 하는지
> 아무 데도 적혀 있지 않게 된다.**

## 1. 단일 실행 JAR — 프론트를 임베드한다

```
npm run build  →  sources/frontend/dist/
      ↓ (Gradle copy)
bootstrap/build/resources/main/static/
      ↓
bootstrap-{version}.jar   (단일 산출물 — 이름은 모듈명이 정한다)
```

| | |
|---|---|
| **얻는 것** | 배포 대상이 하나. 웹서버 별도 구성 불필요. **동일 오리진이라 CORS 가 없고** 세션 쿠키가 자연스럽다 |
| **감수하는 것** | 프론트만 고쳐도 전체 재배포(개발 중에는 Vite dev 서버로 대응) · JAR 크기 · CDN 불가(사내 백오피스라 요구 없음) |

`bootstrap`은 항상 `api`·`modules/system`을 조립한다. `modules/sample`은
`-PincludeSample=true`인 **local 변형에서만** 조립한다. product JAR에는 sample 클래스·라우트·
changelog·API 시드가 들어가지 않는다(ADR-009).

## 2. SPA 라우팅 — `/api/**` 를 반드시 제외한다

React Router 의 클라이언트 라우팅과 정적 리소스 처리가 충돌한다. `/user` 로 **새로고침**하면
404 가 난다. 정적 파일과 `/api/**` 를 뺀 모든 GET 을 `index.html` 로 포워딩한다.

> **`/api/**` 를 빼지 않으면 없는 API 경로가 `index.html` 을 돌려준다** — 그러면 프론트는
> *JSON 인 줄 알았는데 HTML* 을 받고, **원인이 드러나지 않는다.** 404 JSON 을 돌려준다.

정적 리소스 캐시 — 해시 파일명(`assets/*.{hash}.js`)은 `max-age=1y` immutable,
`index.html` 은 `no-cache`.

## 3. 프로파일과 빌드 변형

| 프로파일 | 용도 | 특징 |
|---|---|---|
| `local` | 로컬 개발 | PostgreSQL(**ICU**) · **세션 스토어 `jdbc`** · Swagger 노출 · SQL 로그 |
| 그 외 | 배포 환경 | 현재 저장소에는 설정 파일을 두지 않는다. 배포 환경이 명시 프로파일·데이터소스·비밀값을 제공한다. |

**비밀값은 파일에 두지 않고 환경변수로 주입한다**(`DB_PASSWORD` · `REDIS_PASSWORD`).
다만 **암호화 키는 운영에서 키 파일이 기본**이고 환경변수는 로컬·개발용이다.

> **기본 프로파일을 아는 자리는 `bootRun` 태스크 하나다.** `application.yml` 에 기본값을
> 두지 않았다 — 두면 운영에서 잘못된 프로파일로 조용히 뜬다. 대신 `bootRun` 이
> `-Pprofile` 을 읽어 `local` 을 기본으로 주며, **IDE 실행 구성도 그 태스크를 부른다.**
> `java -jar` 은 이 경로 밖이라 프로파일을 직접 받는다.

| 목적 | 명령 |
|---|---|
| local 실행 | `./gradlew :backend:bootstrap:bootRun -PincludeSample=true` |
| product JAR | `./gradlew :backend:bootstrap:bootJar` |
| product 백엔드 검증 | `./gradlew check -PskipFrontend` |
| local 생성 시드 검증 | `./gradlew :backend:bootstrap:checkSeeds -PincludeSample=true` |

> **`application-local.yml` 은 저장소에 넣는다.** `.gitignore` 대상으로 두면
> **템플릿을 받은 사람이 "로컬을 어떻게 띄우나" 의 답을 갖지 못한다.**
> 비밀값 규칙은 그대로이며 값은 `${DB_PASSWORD:...}` 형태로 **환경변수가 이긴다.**

> **로컬 세션 스토어는 `none` 이 아니라 `jdbc` 다.** `none` 이면
> 세션 스토어가 **로컬에서 한 번도 돌지 않아** `SPRING_SESSION` DDL 과 직렬화 경로가
> **배포 뒤에야 시험된다.** *조용히 통과하는 게이트를 만들지 않는다* 는 원칙 그대로다.

## 4. DB 전환 — 소스를 고치지 않는다

`spring.datasource` 의 URL · 드라이버 · 계정만 바꾼다.

- **JPA 방언을 명시하지 않는다.** Hibernate 가 드라이버로 판별한다 — 명시하면 **DB 전환 시
  고칠 자리가 하나 더 생긴다.**
- Liquibase 가 기동 시 그 벤더용 DDL 을 만들어 적용한다.
- MyBatis `databaseIdProvider` 가 벤더를 감지해 분기 쿼리를 고른다.
- 드라이버 넷은 이미 JAR 에 들어 있다.

## 5. CI 파이프라인

```
1. 체크아웃
2. JDK 25 / Node 셋업
3. ./gradlew build      컴파일 + 단위테스트 + ArchUnit + Spotless
4. npm ci && npm run lint && npm run test && npm run build
5. 통합테스트 (Testcontainers)
     PR   : PostgreSQL · MySQL
     야간 : + MariaDB · MSSQL · Oracle
6. 의존성 취약점 스캔
7. bootJar → 아티팩트 업로드
```

**시드 태스크의 절차는 [seed.md](./seed.md) 가 갖는다** — 여기는 파이프라인의 자리만 말한다.
local 시드 변경이 있는 CI는 `checkSeeds -PincludeSample=true`를 별도 실행한다. product `check`는
local 전용 생성물을 의도적으로 비교하지 않는다. **시드를 다시 만들지 않은 local 커밋은 CI에서
막힌다.**

## 6. 개발 중에는 두 서버를 프록시로 잇는다

`vite.config.ts` 가 `/api` 를 백엔드로 넘긴다. **단일 JAR 로 배포하면 같은 오리진이라
프록시가 필요 없다** — 개발에서만 쓰는 장치다.

## 관련

- [stack.md](./stack.md) — 무엇으로 만드나
- [seed.md](./seed.md) — 시드 생성 절차와 검증
- [standard/backend/persistence.md](./backend/persistence.md) — DB 중립을 지키는 규칙
- — 단일 저장소 + 임베드 빌드
- [`backend/persistence.md`](./backend/persistence.md) · [`backend/session.md`](./backend/session.md)
