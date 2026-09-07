---
id: LLM-FWK-BE-004
title: "백엔드 구조 — 모듈 · 패키지 · 이름 · 트랜잭션"
category: standard/backend
type: operation
class: policy
created: 2026-05-04
updated: 2026-09-07
status: active
sources: ["sources/backend/", "aidd-guide/standard/backend/packages.md"]
tier: 2
tags: [backend, module, package, naming, transaction]
---

# 백엔드 구조 — 모듈 · 패키지 · 이름 · 트랜잭션

> **무엇을 어디에 두고 무엇이라 부르는가.** 새 기능을 만들 때 가장 먼저 정해지고,
> 한 번 틀리면 가장 늦게 드러나는 것들이다.

## 1. 모듈 다섯

```
sources/backend/
├── core/       도메인 비종속 커널 — 응답·에러·검색 규약·감사 엔티티
├── support/    기술 어댑터 — 엑셀·락·로깅·시각·설정
├── domain/     백오피스 공통 도메인 — 엔티티·리포지터리·서비스
├── api/        REST 컨트롤러 · 요청 DTO · Security 설정 · 예외 핸들러
└── bootstrap/  실행 모듈 — main · application.yml · Liquibase · 프론트 임베드
```

| 모듈 | 의존 |
|---|---|
| `core` | — |
| `support` | `core` |
| `domain` | `core` · `support` |
| `api` | `core` · `support` · `domain` |
| `bootstrap` | 전부 |

**의존 방향은 `LayerDependencyTest`(ArchUnit)가 강제한다.** 역방향·순환은 빌드가 깨진다.

> **왜 헥사고날이 아닌가.** 백오피스 CRUD 가 대부분인 템플릿에서 포트/어댑터를 전면
> 도입하면 **파일 수가 3배**가 된다. 교체 가능성이 실제로 있는 지점(락·엑셀·스토리지)만
> 인터페이스로 갈라 `support` 에 두고, 나머지는 계층형으로 단순하게 간다.
> 이 프로젝트의 제1 목표는 **짧고 공통화된 소스**다(CLAUDE.md §1).

## 2. 패키지 — `com.aiagent`

```
core        domain · error · grid · message · response · search
support     config · excel · lock · logging · time
domain      {애그리거트}/
              entity/  repository/
              {기능}/          ← 화면 하나가 쓰는 것들이 여기 모인다
              service/         ← 공통 계층이 쓰는 서비스만
api         {화면·도메인}/
              controller · request/ · (필요 시) response/
```

애그리거트 열여덟: `auth` `authz` `batch` `code` `config` `favorite` `gridpref` `lock`
`log` `menustat` `message` `notification` `progress` `retention` `sample` `search`
`searchcond` `user`

### 레이어가 아니라 기능으로 묶는다

`controller/` · `service/` · `entity/` 를 최상위에 두지 않는다. **업무 화면 하나를 추가할 때
건드리는 파일이 한 디렉터리에 모이는 편**이 유지보수에 유리하다.

`dto/` 는 두지 않는다. 애그리거트 안은 **엔티티·리포지터리 둘과 기능 서브패키지**로 갈리고,
한 화면이 쓰는 것들(`*Service` · `*QueryService` · `*Row` · `*SaveRow` · `*Spec` · `*Params` ·
`*ErrorCode`)이 그 서브패키지에 모인다 — `code/admin` · `user/detail` · `authz/menu` ·
`batch/schedule` 이 그 모양이다.

## 3. 이름

| 무엇 | 이름 |
|---|---|
| **조회 서비스** | **`<기능>QueryService`** — 예외 없다. `Admin` 을 넣지 않는다(패키지가 이미 말한다) |
| **명령 서비스** | **`<기능>Service`** — 기본이다 |
| 〃 이름이 부딪힐 때 | **`<기능>AdminService`** — 같은 도메인에 공통 계층 서비스가 있어 이름을 쓸 수 없는 경우**뿐**이다. 실제로 둘이다: `CodeAdminService`(↔ `CodeService`) · `MessageAdminService`(↔ `MessageService`) |
| 컨트롤러 | 같은 규칙이다. `CodeAdminController` · `MessageAdminController` 만 `Admin` 을 단다 |
| 목록 행 | **`<도메인><무엇>Row`** |
| 저장 입력 | **`*SaveRow`** |
| 단건 키 | **`*Params`** |
| 화이트리스트 | **`*Spec`** |
| api 층 요청 | **`*Request`** (`api/{도메인}/request/`) |
| api 층 응답 | **`*Response`** — API 전용 응답이 필요할 때만. **도메인 레코드를 그대로 내보내는 것이 기본** |

### 메서드 이름 — **URL 마지막 마디와 같다**

```
POST /api/service/code/saveGroup
                       ↑
   CodeAdminController.saveGroup()  →  CodeAdminService.saveGroup()
                       ↑
   endpoints.ts        saveGroup: '/service/code/saveGroup'
```

**넷이 한 낱말이다** — URL 마디 · 컨트롤러 메서드 · 서비스 메서드 · `endpoints.ts` 키.
[api.md](./api.md) 가 앞의 셋을 이미 묶어 두었고, **서비스까지 같게** 하는 것이 이 줄이다.

- **행을 여럿 받아도 단수다.** `saveGroups` 가 아니라 `saveGroup` 이다 — 일괄 저장은 이
  저장소의 기본이라 이름에 적을 것이 없고, 적으면 **URL 과 갈린다**. *무엇을 몇 개 받나*
  는 시그니처가 말한다.
- **`/service/` 와 `/public/` 에서만 그렇다.** 실측: `/service/` **81개 전부
  일치** · `/public/` 4개 전부 일치 · **`/common/` 은 17개 중 8개가 갈린다**(`favorite/save`
  → `add()` · `noti/saveRead` → `markRead()`). 갈리는 것이 옳다 — 공통 경로는 **URL 접두가
  인가 액션을 정하므로**([api.md](./api.md)) 접두를 바꿀 수 없고, 그 제약을 자바 메서드
  이름까지 끌고 가면 `markRead` 가 `saveRead` 가 된다.
- **왜 못박나.** 규칙이 없으면 자연스러운 답이 갈린다 — 여럿을 받으니 `saveCodes` ·
  `saveGroups` 로 쓰는 쪽이 그만큼 자연스럽다. 갈리면 화면을 따라 읽는 사람이 **URL 에서
  서비스로 건너갈 때마다 이름을 다시 찾는다.**

> **`Admin` 을 이름의 장식으로 쓰지 않는다.** 한때 조회 열일곱 중 여섯이
> `*AdminQueryService` 였고 그 여섯은 **모두 `<도메인>/admin/` 패키지 안에 있었다** —
> 같은 말을 두 번 하면서 나머지 열하나와 갈렸다. **새 화면을 만드는 사람은 둘 중 무엇을
> 따라야 할지 알 수 없다.** 이름은 패키지가 못 하는 말만 해야 한다.
>
> **그래서 `<기능>` 은 마디 둘을 가른다.** `detail`·`menu`·`schedule` 은 **기능**이라 이름에
> 들어가고(`UserDetailService`·`BatchScheduleService`), `admin`·`service` 는 **역할**이라
> 들어가지 않는다(`user/admin/UserService`·`code/service/CodeService`). **역할 마디는 이름이
> 부딪힐 때만 드러나며, 그때도 명령만 그렇다** — `code/admin` 이 `CodeAdminService`(↔공통
> `CodeService`)이면서 조회는 `CodeQueryService` 다.
>
> **위 표만으로는 읽히지 않는 자리다** — `user/detail` 이 마디를 붙이니 `user/admin` 도
> 붙일 것처럼 보이고, 그러면 `UserAdminService` 가 나온다.

### `ErrorCode` 상수 — 술어 어휘를 고정한다

**같은 뜻이면 같은 이름을 쓴다.** 파일마다 새로 지으면 문구 시드의 키(`err.{도메인}.{상수}`)가
갈리고, 같은 상황을 두 이름으로 부르게 된다.

| 뜻 | 상수 |
|---|---|
| 그 행이 없다 | `NOT_FOUND` |
| 이미 있다 | `DUPLICATE` — 대상이 여럿인 파일은 **`{대상}_DUPLICATE`**(`CODE_DUPLICATE` · `IP_DUPLICATE`) |
| 값이 비었다 | `REQUIRED` — 〃 **`{대상}_REQUIRED`**(`NAME_REQUIRED` · `PERIOD_REQUIRED`) |
| 지울 수 없다 | `NOT_DELETABLE` |
| 기간이 뒤집혔다 | `PERIOD_REVERSED` · 값 자체가 틀렸으면 `{대상}_INVALID` |
| 모르는 값 | `{대상}_UNKNOWN` |
| 이력 조회 기간 | `RANGE_REQUIRED` · `RANGE_TOO_WIDE` · `PURGED` |

**`DUPLICATED` 는 쓰지 않는다** — `SampleErrorCode` 하나가 그렇게 쓰고 나머지 열여덟이
`DUPLICATE` 다.

### 두 화면이 한 패키지를 쓸 때 — 조회는 모으고 명령은 가른다

`/role`(역할 관리)와 `/role-auth`(역할 권한)가 `domain/authz/role/` 하나를 쓴다.

- **조회는 `RoleQueryService` 하나**다 — 두 화면이 같은 표를 같은 조인으로 읽으므로,
  가르면 `holderCount` 를 세는 질의가 두 벌이 되고 한쪽만 고쳐진다.
- **명령은 `RoleService`(역할의 생애)와 `RoleAuthService`(권한 부여)로 가른다** —
  트랜잭션 경계도 인가 액션도 다르다([knowledge/sys/menu.md](../../knowledge/sys/menu.md)).
- **`{화면}QueryService` 를 새로 만들지 않는다.** 이름이 화면을 가리키면 두 번째 화면이
  왔을 때 갈 곳이 없다 — 이름은 **패키지가 담는 것**을 가리킨다.

## 4. 트랜잭션 — 모양이 셋이다

**서비스가 무엇인가에 따라 다르다.**

| 서비스 | 클래스 레벨 | 메서드 레벨 |
|---|---|---|
| **순수 조회** (`*QueryService`) | `@Transactional(readOnly = true)` | **없음** |
| **순수 명령** (관리 화면 저장 — `*Service`) | **없음** | 쓰기 메서드마다 `@Transactional` |
| **혼합** (공통 계층 — 읽기와 쓰기를 함께) | `readOnly = true` | **+** 쓰기 메서드마다 `@Transactional` |

- **경계는 `Service` 메서드다.** 컨트롤러에 트랜잭션을 두지 않는다.
- **트랜잭션 안에서 HTTP·메일을 호출하지 않는다.** 커밋 후
  `@TransactionalEventListener(AFTER_COMMIT)` 로 뺀다.
- **트랜잭션·`EntityManager` 를 다른 스레드로 전파하지 않는다.** 비동기 작업은 자기
  트랜잭션을 시작한다.
- 이력 기록처럼 본 트랜잭션의 롤백과 갈라야 하는 것은 `REQUIRES_NEW`.
- **목록을 처리할 때는 경계가 선택이다** — 전체에 하나냐 행마다 하나냐. **저장이냐 실행이냐가
  가르지 않는다**: 실패했을 때 무엇이 남아야 하는가가 가른다 →
  [row-transaction.md](./row-transaction.md).

> **①만 기계가 강제한다**(`ServiceConventionTest`). ②는 **붙이지 않는 것이 맞는 경우**가
> 있어 — `MenuService` 는 이미 락의 트랜잭션 안이다 — 기계로 셀 수 없다.

## 5. 기계가 지키는 것

| 테스트 | 무엇 |
|---|---|
| `LayerDependencyTest` | 모듈 의존 방향 (core ← support ← domain ← api) |
| `ServiceConventionTest` | 조회 서비스는 클래스 레벨 `readOnly` · 메서드 레벨 없음 · 이름에 `Admin` 없음 / 컨트롤러에 트랜잭션 없음 |
| `SampleIsolationTest` | 밖에서 샘플 참조 금지 · 샘플은 `SMPL_` 테이블만 |
| `RestrictedSessionPathTest` | 세션 제한 경로 |
| `ApiOperationSummaryTest` | API 요약 |

전부 `sources/backend/bootstrap/src/test/java/com/aiagent/architecture/` 에 있고
`./gradlew check -PskipFrontend` 가 돌린다.

**샘플은 통째로 삭제 가능해야 한다** — 고객사에 넘길 때 지우는 것이 `sample` 하나이도록.
그래서 공통 코드가 샘플을 참조하면 빌드가 깨진다.

## 관련

- [persistence.md](./persistence.md) — JPA / QueryDSL / MyBatis 경계
- [api.md](./api.md) — 경로·응답·액션 판정
- [INDEX.md](./INDEX.md) — 백엔드 카테고리 진입
- [CLAUDE.md §8](../../../CLAUDE.md) — 기계가 막는 것 / 사람이 지키는 것
