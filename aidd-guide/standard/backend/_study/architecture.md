---
id: LLM-FWK-BE-S001
title: "백엔드 아키텍처 — 원문"
category: "06-framework/backend"
type: study
created: 2026-08-28
updated: 2026-09-03
status: active
sources: ["(원본) docs/design/21-backend-architecture.md — 2026-09-04 폐지"]
author: Bong Jong Hyeon
tier: 2
tags: [backend, architecture, study]
---

> **이 파일은 근거다 — 규칙은 [`../packages.md`](../packages.md) 가 갖는다.**
> `docs/design/21-backend-architecture.md` 을 옮겨온 것이며, *규칙은 알겠는데 왜 그런가*
> 가 남을 때만 들어온다(02-context/budget.md).
>
> **소스가 이긴다.** 아래 §2 의 패키지 트리는 실물과 다른 곳이 있다 —
> `core` 에 `util` 은 없고 `grid`·`message` 가 있으며, `support` 는 `cache`·`storage`·
> `crypto`·`notification` 대신 `config`·`logging`·`time` 이다. 실물은 `packages.md` §2 다.

# 21. 백엔드 아키텍처

- 상태: 확정
- 최종수정일: 2026-08-28 (캐시 상한을 바이트로 확정 — §6.2)
- **읽어야 할 때**: 새 모듈·패키지를 만들 때 · 레이어 배치를 정할 때

## 1. 모듈 구성

Gradle 멀티모듈. 목적은 **P2(삭제하기 쉬운 템플릿)** 와 의존 방향 강제다.

```
ai-agent/
├── sources/settings.gradle.kts
├── sources/gradle/libs.versions.toml          # 버전 단일 출처
├── sources/backend/
│   ├── core/                          # 도메인 비종속 커널
│   ├── support/                       # 기술 어댑터 (캐시/파일/암호화/알림)
│   ├── domain/                        # 백오피스 공통 도메인
│   ├── api/                           # REST 컨트롤러 + 보안 설정
│   └── bootstrap/                     # 실행 모듈 (main, yml, Liquibase, 프론트 임베드)
└── sources/frontend/                          # React (별도 빌드 → bootstrap 에 임베드)
```

### 모듈별 책임

| 모듈 | 책임 | 의존 |
|---|---|---|
| `core` | 공통 응답/에러코드/예외, 페이징·검색 규약, `BaseEntity`·Auditing, 유틸, 상수. **프레임워크 의존 최소** | — |
| `support` | 캐시 추상화, 파일 스토리지 추상화, 암복호화, 메일/알림 채널, 락 추상화([31](../persistence.md)), 엑셀 | `core` |
| `domain` | 사용자·역할·메뉴·권한·코드·메시지·이력·배치의 엔티티/리포지토리/서비스 (조직 계층 없음 → [ADR-0009](../../../records/adr/0009-role-based-authz-without-org.md)) | `core`, `support` |
| `api` | REST 컨트롤러, DTO, Spring Security 설정, 필터/인터셉터, 예외 핸들러 | `core`, `support`, `domain` |
| `bootstrap` | `@SpringBootApplication`, `application.yml`, Liquibase changelog, 프론트 정적 리소스 | 전부 |

### 의존 방향 규칙 (ArchUnit 강제)
- `core` 는 다른 모듈을 참조하지 않는다.
- `domain` 은 `api` 를 참조하지 않는다.
- 하위 모듈이 상위 모듈을 참조하면 빌드 실패.
- 순환 의존 금지.
- **공통 코드는 샘플 패키지를 참조하지 않는다.** 샘플(`SMPL`)은 통째로 삭제 가능해야 한다
  → [10-feature-inventory](../../../knowledge/features.md) L 그룹

> **왜 헥사고날/클린 아키텍처를 쓰지 않는가**
> 백오피스 CRUD 가 대부분인 템플릿에서 포트/어댑터 전면 도입은 파일 수만 3배로 만든다.
> 교체 가능성이 실제로 있는 지점(캐시·스토리지·알림·락)만 인터페이스로 분리하고,
> 나머지는 계층형으로 단순하게 간다.

## 2. 패키지 규칙

```
com.aiagent
├── core
│   ├── response        # ApiResponse, PageResponse
│   ├── error           # ErrorCode, BusinessException, ErrorType
│   ├── domain          # BaseAuditEntity, YnConverter, Auditing
│   ├── search          # SearchCondition, Pageable 변환
│   └── util
├── support
│   ├── cache / storage / crypto / lock / excel / notification
├── domain
│   └── {aggregate}     # user, role, menu, code, message, history, batch, file
│                       # 조직 계층 없음 → ADR-0009
│       ├── entity  repository
│       └── {기능}       # 화면 하나가 쓰는 것들이 여기 모인다 — 아래 §2.1
└── api
    └── {aggregate}     # controller  request  (필요 시) response
```

### 애그리거트 단위 패키지
레이어(`controller/`, `service/`, `entity/`)를 최상위로 두지 않고 **기능 단위**로 묶는다.
업무 화면을 추가할 때 건드리는 파일이 한 디렉터리에 모이는 것이 유지보수에 유리하다.

### 2.1 기능 서브패키지와 이름 규칙 (2026-09-02 — 실제 구현에 맞춰 고침)

`dto/` 는 두지 않는다. 애그리거트 안은 **엔티티·리포지터리 둘과 기능 서브패키지**로 갈리며,
한 화면이 쓰는 것들(`*Service` · `*QueryService` · `*Row` · `*SaveRow` · `*Spec` · `*Params` ·
`*ErrorCode`)이 그 서브패키지에 모인다 — `code/admin`, `user/detail`, `authz/menu`,
`batch/schedule`, `notification/notice` 가 그 모양이다. 공통 계층이 쓰는 서비스는 `service/` 에
둔다(`code/service/CodeService` · `message/service/MessageService`).

| 무엇 | 이름 |
|---|---|
| 조회 서비스 | **`<기능>QueryService`** — 예외 없다. `Admin` 을 넣지 않는다(패키지가 이미 말한다). `ServiceConventionTest` 가 강제한다 |
| 명령 서비스 | **`<기능>Service`** — 기본이다 |
| 〃 이름이 부딪힐 때 | **`<기능>AdminService`** — 같은 도메인에 공통 계층 서비스가 있어 이름을 쓸 수 없는 경우뿐이다. 실제로 둘이다: `CodeAdminService`(↔ `CodeService`) · `MessageAdminService`(↔ `MessageService`) |
| 컨트롤러 | 같은 규칙이다 — `MenuController` · `UserController` 가 기본이고, 공통 계층 컨트롤러와 부딪히는 `CodeAdminController`(↔ `CodeController`) · `MessageAdminController`(↔ `MessageController`) 만 `Admin` 을 단다 |
| 응답 레코드 | 목록 행은 **`<도메인><무엇>Row`**, 저장 입력은 **`*SaveRow`**, 단건 키는 **`*Params`**, 화이트리스트는 **`*Spec`** |
| api 층 DTO | 요청은 **`*Request`**(`api/{도메인}/request/`), API 전용 응답이 필요할 때만 **`*Response`**(`api/{도메인}/response/`). 도메인 레코드를 그대로 내보내는 것이 기본이다 |

> **`Admin` 을 이름의 장식으로 쓰지 않는다.** 한때 조회 열일곱 중 여섯이 `*AdminQueryService`
> 였고 그 여섯은 모두 `<도메인>/admin/` 패키지 안에 있었다 — **같은 말을 두 번** 하면서
> 나머지 열하나와 갈렸다. 새 화면을 만드는 사람은 그 둘 중 무엇을 따라야 할지 알 수 없다.

## 3. 데이터 접근 전략 — JPA / QueryDSL / MyBatis 사용 기준

세 가지를 다 쓰기로 한 이상 **경계를 명문화하지 않으면 반드시 뒤섞인다.**

| 상황 | 사용 | 비고 |
|---|---|---|
| 단건 조회, 저장, 수정, 삭제 | **JPA (Spring Data)** | 기본값 |
| 동적 조건 목록 조회, 조인, 프로젝션 | **QueryDSL** | 검색 화면의 표준 |
| 통계/집계, 다중 조인 리포트, 벤더별 튜닝 필요 쿼리 | **MyBatis** | 예외적 사용 |
| 대량 INSERT/UPDATE | JDBC Batch 또는 MyBatis | JPA 반복 저장 금지 |

> **MyBatis 를 *예외적 사용* 으로 좁힌 것은 성능 취향이 아니라 안전 장치이기도 하다.**
> 동적 조건을 MyBatis 로 받으면 **조인 별칭이 XML 에만 존재**해 자바의 화이트리스트와
> **기계로 묶을 수 없다** — 별칭을 개명하면 컴파일도 기동도 통과하고 **그 조건을 쓰는
> 화면에서만 런타임에 깨진다.** QueryDSL 은 조인이 스펙 안에 있어 그 문제가 없다
> ([72](./api-conventions.md) §5.2 · [34](../search.md) §5.8).

### 규칙
1. **쓰기(Command)는 JPA 만 사용한다.** MyBatis 는 원칙적으로 읽기 전용.
   같은 트랜잭션에서 MyBatis 로 쓰면 JPA 1차 캐시와 어긋난다.
2. 부득이 MyBatis 로 써야 하면 `EntityManager.flush()` 후 실행하고 주석으로 사유를 남긴다.
3. **MyBatis XML 에서 `${}` 는 식별자(컬럼 · 정렬 방향)에만 쓴다. 값은 언제나 `#{}` 다.**
   식별자에 넣는 것도 **화이트리스트(`QuerySpec`)가 돌려준 소스 상수**여야 하며
   **요청에서 온 문자열은 어떤 경로로도 SQL 에 들어가지 않는다.**
   전면 금지가 아니게 된 이유는 **JDBC 가 식별자를 바인딩하지 못하기 때문**이다 —
   `PreparedStatement` 의 `?` 는 값 자리이므로 **동적 조회 조건의 컬럼명은 `${}` 외에 방법이 없다.**
   **빌드 시 검사는 유지하되 공통 조각 `common-search.xml` 하나만 예외**로 둔다.
   화면 XML 에 `${}` 가 나타나면 그것은 사고다 → [34](../search.md) §5·§6 · [72](./api-conventions.md) §5.2
4. MyBatis 쿼리는 **DB 벤더 분기 가능**하도록 `databaseIdProvider` 를 전제로 작성한다 →
   [22-db-portability](./db-portability.md)
5. QueryDSL `Q` 클래스는 `build/generated` 에 생성. VCS 미포함.

## 4. 트랜잭션

| 규칙 | 내용 |
|---|---|
| 경계 | `Service` 메서드 |
| **모양은 셋이다** | **서비스가 무엇인가에 따라 다르다**(2026-09-02 — 실제 구현에 맞춰 고침). ① **순수 조회**(`*QueryService`) — 클래스 레벨 `@Transactional(readOnly = true)`, 메서드 레벨 **없음**. ② **순수 명령**(관리 화면의 저장 — `*Service`) — 클래스 레벨을 **두지 않고** 쓰기 메서드마다 `@Transactional`. ③ **혼합**(공통 계층 — 읽기와 쓰기를 함께 갖는다) — 클래스 레벨 `readOnly = true` **+** 쓰기 메서드마다 `@Transactional`. ①만 `ServiceConventionTest`(ArchUnit)가 강제한다 — ②는 **붙이지 않는 것이 맞는 경우**가 있어(`MenuService` 는 이미 락의 트랜잭션 안이다 — [31](../persistence.md) §4) 기계로 셀 수 없다 |
| 컨트롤러 | 트랜잭션 금지 |
| 외부 호출 | 트랜잭션 안에서 HTTP/메일 호출 금지. 커밋 후 `@TransactionalEventListener(AFTER_COMMIT)` |
| **비동기** | **트랜잭션·`EntityManager` 를 다른 스레드로 전파 금지.** 비동기 작업은 자기 트랜잭션을 시작 → [30](../crosscutting.md) §3.1 |
| 전파 | 이력 기록 등은 `REQUIRES_NEW` 로 본 트랜잭션 롤백과 분리 |

## 5. 횡단 관심사 (AOP / 필터)

| 관심사 | 구현 | 순서 |
|---|---|---|
| 추적 ID(MDC) | `RequestIdMdcFilter` — **클라이언트 발급 `X-Request-Id` 를 이어받음** | 최우선 |
| 인증 | Spring Security 필터 체인 (세션 복원 · CSRF) | |
| **요청 body 캐싱** | `RequestCachingFilter` (`ContentCachingRequestWrapper`) | 추적 ID 다음 |
| **중복 요청 방어** | `RequestDedupInterceptor.preHandle` | Security 이후 → [29](../crosscutting.md) |
| **인가** | `AuthorizationInterceptor.preHandle` — 계정 상태 재검사 + 메뉴×액션 판정 → [23](./security-design.md) §4 | dedup 다음 |
| 사용 이력 (LOG-01) | `HandlerInterceptor.afterCompletion` | **등록은 인가보다 앞**, 실행은 응답 완료 후 — §6.1 |
| 개인정보 접근 이력 (LOG-04) | PII 응답 어드바이스 + `PiiSupport` | 복호화 시점 |
| 에러 로그 (LOG-03) | `@RestControllerAdvice` + 비동기 저장 | 예외 발생 시 |
| 개인정보 분리 저장 | Hibernate `PreInsert`/`PreUpdateEventListener` | 영속화 시 |
| 캐시 | `@Cacheable` / `@CacheEvict` | 서비스 계층 |

## 6. 요청 로깅 (사용 이력 · 에러 로그)

**감사 이력(데이터 변경 before/after)은 만들지 않는다.** → [ADR-0010](../../../records/adr/0010-request-logging-without-audit-trail.md)
대신 **Ajax API 요청 전문을 통째로 저장**한다.

### 6.1 구조

```
요청 → [RequestIdMdcFilter] → [RequestCachingFilter] → Security
                              │
                    ContentCachingRequestWrapper
                    (body 재독 가능)
                              ↓
                  [UserActionLogInterceptor]   ← 인가 인터셉터보다 앞에 등록한다
                              ↓
                     [인가 인터셉터] → Controller
                              │
              ┌───────────────┴───────────────┐
         예외 발생                        정상 종료
              ↓                               │
   [GlobalExceptionHandler]                   │
              ↓  SYS_LO_EXCEPTION             │
     (ERR_CD · ERR_MSG · 스택)                │
              └───────────────┬───────────────┘
                              ↓  afterCompletion
                        SYS_LO_ACCESS  — **전 요청 1행** (전문 + HTTP_STAT)
```

`HttpServletRequest` 의 body 는 한 번만 읽을 수 있다. 컨트롤러가 읽은 뒤에도
인터셉터·예외 핸들러가 같은 내용을 보려면 **필터에서 미리 감싸야** 한다.

**등록 순서가 규약이다 — 로깅 인터셉터가 인가 인터셉터보다 앞이어야 한다.**
`preHandle` 이 거부해도 **이미 `true` 를 반환한 인터셉터의 `afterCompletion` 은 호출**되므로,
앞에 두어야 403 이 사용 이력에 남는다. 뒤에 두면 **인가가 막은 요청이 통째로 사라진다.**

### 6.2 필터 정책

| 항목 | 값 |
|---|---|
| 적용 URL | `/api/*` — Ajax API 만 |
| 제외 Content-Type | `multipart/` — 파일 업로드 바이너리 버퍼링 시 OOM |
| 캐시 상한 | **1MB — 문자가 아니라 UTF-8 바이트로 잰다** (초과분 미캐싱). 아래 |
| 설정 | `app.request-cache.*` |

**상한은 바이트다 — 문자로 재면 최대 3배가 샌다.** 스파이크에서 실측했다(2026-08-28):

```
chars = 1,048,576   utf8Bytes = 1,359,272   배율 1.296   (한글 + ASCII 혼합)
```

전문이 **전부 한글이면 3배**다. 상한을 문자로 잡으면 *"1MB 제한"* 이 실제로는 3MB 를
흘려보내고, 그만큼 용량 산정(§6.5 · [32](../../../knowledge/retention.md))이 어긋난다. `PARAMETERS` 컬럼은
`nclob` 이라 저장은 되므로 **넘친 사실조차 드러나지 않는다.**

절단은 **UTF-8 바이트 경계에서** 한다 — 문자 중간에서 자르면 깨진 바이트가 남는다.

### 6.3 저장 대상 — 한 요청 = **사용 이력 1행**, 예외면 에러 로그가 **한 행 더**

| | `SYS_LO_ACCESS` (사용 이력) | `SYS_LO_EXCEPTION` (에러 로그) |
|---|---|---|
| 조건 | **전 요청** — 2xx · 4xx · 5xx | 예외 발생 시 **추가로** |
| 담당 | `HandlerInterceptor.afterCompletion` | `@RestControllerAdvice` |
| 공통 컬럼 | `USER_ID` · `MENU_CD` · `REQUEST_URI` · `CLIENT_IP` · **`HTTP_STAT`** · `TRACE_ID` · `CRE_DTM` | 동일 |
| 고유 컬럼 | **`PARAMETERS`**(전문) | **`ERR_CD` · `ERR_MSG` · `ROOT_CAUSE_STACK`** |

#### 배타를 없앤다 (2026-08-28 개정)

**이전 규약은 *"예외 발생 요청은 사용 이력에 중복 기록하지 않는다"* 였다.** 화면을 그려 보니
그 배타가 셋을 깼다([64](../../../../documents/screen/log/access/requirements.md) §6).

| 무엇이 깨졌나 | |
|---|---|
| **[ADR-0010](../../../records/adr/0010-request-logging-without-audit-trail.md) 의 전제** | 감사 이력을 요청 전문 로깅으로 대체했는데, 그 대체는 **요청 로그가 완전할 때만** 성립한다. 실패한 요청이 다른 테이블에 있으면 *"이 사용자가 무엇을 했나"* 에 두 테이블이 필요하고, **컬럼이 달라 `UNION` 도 안 된다** |
| **[45](../../../knowledge/sys/logs.md) §7 의 `TRACE_ID` 그림** | *"한 요청이 네 갈래에 같은 추적 ID 로 남는다"* 고 그렸는데 **앞 둘이 배타**라 그림이 사실이 아니었다 |
| **[23](./security-design.md) §4 의 *"403 두 경우를 구분해 기록한다"*** | 기록할 곳이 정해져 있지 않았다 |

**중복의 정체가 판단을 바꾼다.** 공통 컬럼 일곱 중 여섯은 `VARCHAR` 이고 비싼 것은
**`PARAMETERS`(1MB `nclob`) 하나**다. 그것만 사용 이력에 두면 **중복 회피의 목적이 달성되고
배타가 필요 없어진다.**

- **`PARAMETERS` 는 사용 이력에만 있다.** 에러 로그에서 전문을 보려면 `TRACE_ID` 로 건너뛴다
  — **보존이 90일 / 180일로 달라**(→ [32](../../../knowledge/retention.md) §3) 180일 된 에러의 전문은 없다.
  받아들인다: `ERR_CD` · `ERR_MSG` · 스택이 자기 테이블에 있어 **진단은 자립한다**
- **`HTTP_STAT` 이 양쪽에 있다.** 사용 이력은 그것으로 성공·실패를 가르고, 에러 로그는
  **4xx 와 5xx 를 가른다** — [21](./architecture.md) §6-1 이 검증 실패를 400 으로 정했으므로
  **에러 로그에는 이미 4xx 가 들어 있다.** 403 기록은 그 사실을 늘릴 뿐 새로 만들지 않는다
- **403 은 양쪽에 남는다** — 사용 이력에 *일어난 요청*으로, 에러 로그에 *`ERR_CD` 로 구분된
  원인*으로([23](./security-design.md) §4 의 미등록 · 미매핑 · 권한 없음). **둘 중 하나를 고르는 문제가 아니었다**
- **4xx 는 `ROOT_CAUSE_STACK` 을 저장하지 않는다.** 인가 거부의 스택은 인터셉터 프레임뿐이고
  **전 행이 같다** — 180일치 노이즈다. `NULL` 로 둔다

- `PARAMETERS` 는 **쿼리스트링 + 헤더 + body** 를 직렬화한 하나의 CLOB.
  매핑은 `@Nationalized` + `@JdbcTypeCode(LONG32NVARCHAR)` **고정** — `@Lob` 은 MySQL 에서
  `tinytext`(255B) 가 되어 전문이 들어가지 않는다 → [22](./db-portability.md) §3.1.
- **응답 body 는 저장하지 않는다** — 목록 응답이 수 MB 가 될 수 있다.
- **`ERR_CD` · `ERR_MSG` 는 응답이 이미 갖고 있는 값**이다(§6-1.2) — 새로 만드는 것이 아니라
  버리고 있던 것을 적는다. 그 절이 *"코드와 완성된 문구가 함께 남는 것이 운영 대응의 값"*
  이라고 한 문장이 **컬럼을 얻는다.**
- `MENU_CD` 는 **클라이언트가 매 요청 `X-Menu-Code` 헤더로 밝히는 현재 메뉴 코드**다
  (→ [24](../../frontend/_study/frontend-stack.md) §9). 공유 API·공통 API 도 어느 메뉴에서 쓰였는지 남으므로
  메뉴 활용도를 측정할 수 있다. **기록 전용** — 인가 판정에 쓰지 않고([23](./security-design.md) §4),
  클라이언트 주장 값이므로 통계·추적 외 용도로 신뢰하지 않는다. 메뉴 문맥 없는 호출(로그인,
  하트비트)은 생략된다. **생략된 요청은 `NULL` 로 저장한다** — 빈 문자열은 Oracle 에서 NULL 이
  되어 구분이 성립하지 않고, 특수값은 메뉴명 조인이 비어 같은 처리를 부른다([64](../../../../documents/screen/log/access/requirements.md) §3.2.1).
- 저장은 `REQUIRES_NEW` 독립 트랜잭션. **로그 저장 실패가 원본 응답에 영향을 주면 안 된다** (warn 만 남기고 삼킴).

### 6.4 마스킹 (필수)

전문을 통째로 저장하므로 마스킹이 없으면 **로그가 최대 취약점이 된다.**

| 대상 | 기본값 |
|---|---|
| 파라미터 키 | `password`, `passwd`, `secret`, `token` |
| 헤더 | `authorization`, `cookie`, `set-cookie`, `proxy-authorization` |
| **PII 컬럼** | **`SYS_PII_DEF` 등록 컬럼을 자동 추가** → [27](../pii-vault.md) §9 |
| 텍스트 판정 | `application/json`·`xml`·`x-www-form-urlencoded`·`text/` 화이트리스트. 그 외 `[binary: N bytes]` |

설정: `app.http-log.*` (access-log / exception-log 공유)

### 6.5 용량 관리

전문 저장이라 원본 데이터보다 빠르게 커진다. LOG-07 아카이브 배치는 **선택이 아니라 필수**다.
보존 기간은 `SYS_CONFIG` 로 관리한다.

## 6-1. API 규약 (요약, 상세 설계는 Phase 5 — 설계 개요 §4)

| 항목 | 규칙 |
|---|---|
| 경로 | `/api/{계층}/{도메인}/{동작}` — 계층은 `public`/`common`/`service`([23](./security-design.md) §4). **도메인·동작 모두 camelCase 단수**(`batchSchedule/runNow`) — [72](./api-conventions.md) §2.2 가 확정했다(2026-08-28 개정. **이전 규약은 *케밥케이스 복수형* 이었고 `60`~`65` 의 경로 열다섯이 전부 그것과 달랐다**). **버전 프리픽스 없음.** `service` 계층은 **고정 경로**(경로 변수·와일드카드 금지) — 식별자·조건은 body |
| 응답 | 성공/실패 모두 `ApiResponse<T>` 로 감싼다 |
| 에러 | `code`(문자열 상수) + `message`(**서버가 번역을 완성해 담는다** — §6-1.2) + `traceId` |
| **`traceId`** | **성공 응답에도 담는다**([72](./api-conventions.md) §2.3) — *"저장은 됐는데 값이 이상하다"* 는 문의가 **성공한 요청을 사용 이력에서 찾아야** 한다([64](../../../../documents/screen/log/access/requirements.md) §2.5) |
| 페이징 | 요청 `page`(0-base), `size`, `sort`. 응답 `PageResponse<T>` |
| 검증 실패 | 400 + 필드별 오류 배열 |
| 인증 만료 | **401** (프론트가 로그인 화면으로 전환) |
| 권한 없음 | **403** (프론트가 권한 없음 화면 표시) |
| 시간 | ISO-8601, UTC 오프셋 포함 |

### 6-1.1 업무 API 의 동작 마디가 액션을 정한다

`service` 계층 경로는 `/api/service/{도메인}/{동작}` 이며, **`{동작}` 이 무엇으로 시작하는가**가
`SYS_API.ACTION_CD` 를 결정한다([ADR-0020](../../../records/adr/0020-path-prefix-action-and-seed-generation.md)).

| 접두 | `ACTION_CD` |
|---|---|
| `get` · `search` · `find` · `retrieve` | `READ` |
| `save` · `insert` · `update` · `delete` | `SAVE` |
| `export` | `EXPORT` |
| 그 외 전부 | `EXECUTE` |

- **조회는 네 접두 중 하나로 시작해야 한다.** `list` · `detail` · `count` 만 쓰면 `EXECUTE`
  로 떨어진다 — `getList` · `getDetail` 로 쓴다
- 접두가 실제 동작과 어긋나면 **`@ApiActionType` 이 우선한다**(레거시 이관·예외용).
  이 애노테이션은 **시드 생성 입력**이며 런타임 판정에 참여하지 않는다
- 동작 마디의 표기는 **`getList`(camelCase)로 확정**됐다([72](./api-conventions.md) §2.2) — **소스의 메서드명이 그대로 경로**이며, 케밥이면 접두가 `get` 인지 `get-` 인지 규칙이 한 겹 는다

### 6-1.2 에러 메시지는 서버가 완성한다 — 프론트는 그대로 표시한다

`message` 에는 **번역이 끝난 문자열**을 담는다. 프론트는 `code` 로 문구를 조립하지 않고
받은 값을 그대로 보여준다. **프론트에 에러 메시지 카탈로그를 두지 않는다.**

| 근거 | 내용 |
|---|---|
| **로그 추적성** | 예외의 `getMessage()` 가 그대로 `SYS_LO_EXCEPTION` 과 애플리케이션 로그에 남는다. 코드만 남으면 *"`err.password.reuse` 가 무슨 뜻인가"* 를 매번 되찾아야 한다. **코드와 완성된 문구가 함께 남는 것이 운영 대응의 값**이다 |
| **파라미터를 서버만 안다** | *"최근 3개와 같습니다"* 의 `3`, *"9자 이상"* 의 `9` 는 `SYS_CONFIG` 값이다([43](../../../knowledge/sys/code.md) §6.3). 프론트가 조립하려면 파라미터까지 내려받아야 하고, 그러면 조립 규칙이 두 곳에 생긴다 |
| **번들이 가벼워진다** | 에러 문구는 프론트가 쓰지 않으므로 공개 메시지 번들에서 빼도 된다(화면 흐름 §3.2). **`SYS_MESSAGE_KEY.USE_SCOPE`** 가 그 경계다([43](../../../knowledge/sys/code.md) §7.1 · [ADR-0023](../../../records/adr/0023-message-key-sync-from-source.md)) — *프론트가 쓰는가* 다 |
| 캐시할 이유가 없다 | 에러는 발생 시점에 한 번 표시되고 끝난다. 미리 받아 둘 대상이 아니다 |

- 언어는 **서버가 판정한다** — 세션이 있으면 `SYS_USER.LOCALE_CD`, 없으면 요청의 언어
  힌트를 쓴다. **그 힌트는 프론트가 정해 `Accept-Language` 에 실어 보낸 값**이다
  (2026-08-29 — 화면 흐름 §3.2). 브라우저의 원래 헤더를 그대로 쓰면 **프론트가 고른 언어와
  갈린다** — 화면은 영어인데 실패 문구만 한국어로 나온다. 비동기·배치 경로의
  `LocaleContextHolder` 전파([30](../crosscutting.md) §3)는 그 경로가 생기는 슬라이스의 것이다
- **로그의 언어와 응답의 언어를 가른다**(2026-08-29). 예외가 나르는 문구(`getMessage()`)는
  **서버 언어**이고 그대로 로그에 남는다. 응답에 나가는 문구는 `code()` 를 키로 다시 읽은
  **사용자 언어**다. 합치면 **같은 사건이 사람마다 다른 문자열로** 쌓여 묶어 셀 수 없다
- **`code` 는 그대로 유지한다.** 프론트가 분기해야 하는 소수의 경우가 있다 —
  `err.duplicate-request` 무음 통과([24](../../frontend/_study/frontend-stack.md) §9) 처럼. 분기는 코드로, 표시는 메시지로 한다
- 문구의 단일 원본은 `SYS_MESSAGE` 이며 관리 화면에서 바꾼다(`MESSAGE_MGMT`).
  **서버가 완성한다는 것이 "코드에 박는다"는 뜻이 아니다**

## 7. 미결 사항

현재 없다.

### 해소된 미결

| 항목 | 결정 | 해소일 |
|---|---|---|
| `PARAMETERS` **절단 상한 1MB** 의 벤더 실동작 | **통과. 벤더 제약이 아니다** — 4벤더에서 1MB 전문이 무손실 왕복한다([22](./db-portability.md) §6 해소 표). MySQL 계열 `max_allowed_packet` 기본값은 64MB · 16MB 로 충분하다. **대신 상한의 단위가 문제였다** — 문자가 아니라 바이트로 잰다(§6.2) | 2026-08-28 |
| `PARAMETERS` 컬럼 타입 | **`@Nationalized` + `@JdbcTypeCode(LONG32NVARCHAR)`, changelog 는 `nclob`** — `@Lob` 은 MySQL `tinytext`(255B) 가 되어 사용 불가. [22](./db-portability.md) §3.1 | 2026-08-24 |
| 로그 보존 기간 기본값 및 아카이브 주기 | `SYS_LO_ACCESS` 90일 · `SYS_LO_EXCEPTION` 180일. 아카이브 후 삭제 2단계 — [32-data-retention](../../../knowledge/retention.md) §3 | 2026-08-24 |
| 감사 이력 구현 방식 (Envers vs 직접 구현) | **감사 이력 자체를 만들지 않는다** → [ADR-0010](../../../records/adr/0010-request-logging-without-audit-trail.md) | 2026-08-23 |
| 사용 이력 `MENU_CD` 채우기 규칙 | **클라이언트가 매 요청 `X-Menu-Code` 헤더로 부착** (공통 API 포함) — §6.3. 인가에는 불사용 | 2026-08-23 |
