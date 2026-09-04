# ADR-0020. 액션은 경로 접두가 정하고, 인가 시드는 생성해 CI 가 검증한다

- 상태: 채택
- 일자: 2026-08-26
- 관련: [ADR-0016](./0016-api-master-table.md) · [23-security-design](../../standard/backend/_study/security-design.md) §4 · [21-backend-architecture](../../standard/backend/_study/architecture.md) §6-1 · [42-data-model-authz](../../knowledge/sys/menu.md) §5 · [10-feature-inventory](../../knowledge/features.md) AUTHZ-14 · SYS-05 · [20-tech-stack](../../standard/stack.md)

## 맥락

[23](../../standard/backend/_study/security-design.md) §4 가 인가 사실을 **데이터**로 확정했다 — `SYS_API` 가 *"이 URL 은 이 액션이다"*, `SYS_MENU_API` 가
*"이 메뉴가 이 URL 을 쓴다"* 를 갖고, 판정은 그 둘만 본다. 그리고 **매핑은 시드로만 바뀐다**
— 매핑 행 추가가 곧 접근 범위 확장이므로 코드 리뷰를 거쳐 배포되는 Liquibase 시드여야 한다.

**그 시드를 누가 어떻게 만드는지가 비어 있었다.**

`SYS_API` 한 행에 필요한 것은 `API_URL` 과 `ACTION_CD` 다. URL 은 컨트롤러에 있다.
문제는 액션이다 — *"이 API 가 조회인가 저장인가"* 는 **개발 시점에 이미 정해진 사실**인데
어디에도 기록되지 않는다. 사람이 시드를 손으로 쓰면 그 사실이 두 번째로 표현되며 어긋날 수
있고, 관리 화면에서 고르게 하면 [23](../../standard/backend/_study/security-design.md) §4 가 *"코드가 결정하는 사실"* 이라고 한 것을 운영
데이터로 만드는 것이다.

> **`API_NM` · `API_DESC` 는 이 ADR 이 처음 쓰일 때 입력이 비어 있었다**(2026-08-27 보완).
> 바로 위 문단이 *"필요한 것은 `API_URL` 과 `ACTION_CD`"* 라고 좁게 잡은 탓이며,
> [42](../../knowledge/sys/menu.md) §5 의 네 컬럼 중 **둘을 아무도 만들지 않고 있었다.**
> 결정 2 의 마지막 항이 그 자리를 메운다.

또 하나 — 시드를 사람이 만들면 **잊을 수 있다.** 컨트롤러를 추가하고 시드를 빠뜨린 채
배포하면 운영에서 403 이 난다. fail-closed 이므로 사고는 아니지만, 발견 시점이 운영이다.

## 결정

**세 가지를 함께 정한다.**

### 1. 액션은 경로 접두가 정한다 — 애노테이션이 우선한다

업무 API 경로는 `/api/service/{도메인}/{동작}` 이며([21](../../standard/backend/_study/architecture.md) §6-1), **`{동작}` 이 무엇으로
시작하는가**가 `ACTION_CD` 를 결정한다.

| 접두 | `ACTION_CD` |
|---|---|
| `get` · `search` · `find` · `retrieve` | `READ` |
| `save` · `insert` · `update` · `delete` | `SAVE` |
| `export` | `EXPORT` |
| 그 외 전부 | `EXECUTE` |

**우선순위는 애노테이션 > 경로다.**

```java
@PostMapping("/api/service/order/getList")          // 접두 get → READ
public ApiResponse<PageResponse<OrderDto>> getList(@RequestBody OrderSearchReq req) { … }

@ApiActionType(ActionType.READ)                     // 명시가 접두를 이긴다
@PostMapping("/api/service/order/deleteCheck")      // 접두로는 SAVE 로 잡힌다
public ApiResponse<Boolean> deleteCheck(@RequestBody OrderKeyReq req) { … }
```

`@ApiActionType` 은 **규약을 지킬 수 없는 경로를 위한 예외 선언**이다. 레거시 이관처럼
경로를 바꿀 수 없는 경우와, 접두가 실제 동작과 어긋나는 경우에 쓴다. 새로 쓰는 API 는
경로로 표현하는 것이 기본이다.

> **조회 API 는 네 접두 중 하나로 시작해야 한다.** `list` · `detail` · `count` 만 쓰면
> `EXECUTE` 로 떨어진다. `getList` · `getDetail` · `getCount` 로 쓴다. 이것이 규칙을
> 네 줄로 유지하는 대가다.

### 2. 시드는 생성한다 — `generateApiSeed`

```
./gradlew generateApiSeed
```

| 입력 | 어디서 | 무엇을 |
|---|---|---|
| `API_URL` | 백엔드 `@RequestMapping` 스캔 (`/api/service/**` 만) | API 의 존재 |
| `ACTION_CD` | `@ApiActionType` → 없으면 경로 접두 | 인가 등급 |
| **`API_NM`** | **`@Operation.summary`** — 아래 | 사람이 읽는 이름 |
| **`API_DESC`** | **`@Operation.description`** — 선택 | 무슨 일을 하는가 |
| `MENU_CD` ↔ `API_URL` | 프론트 `features/*/api/endpoints.ts` + 메뉴 시드 | 매핑 |

```
003-init-menu.yaml        MENU_CD ↔ MENU_URL          ← 52 가 소유
프론트 라우트 정적 맵      MENU_URL → Component
features/*/api/endpoints  Component → API_URL[]
백엔드 @RequestMapping     API_URL · ACTION_CD
       @Operation          API_NM · API_DESC
                            ↓  generateApiSeed
006-init-api.csv          SYS_API
007-init-menu-api.csv     SYS_MENU_API
       └ 둘 다 006-init-api.yaml 의 changeSet 하나가 적재한다 (아래)
```

> **생성물이 CSV 이고 changeSet 은 하나다**(2026-08-29 — 구현). 위 그림은 처음에 changelog
> 둘이었다. **둘 다 틀렸다.**
>
> **CSV 인 이유는 [33](../../standard/_study/seed-generation.md) §2.2 가 메시지 키에서 말한 것과 같다** — changelog 는 고정된
> 껍데기이고 생성되는 것은 데이터 쪽뿐이라 *"재생성 결과 == 커밋본"* 비교가 파일 하나로 끝난다.
> **감사 컬럼을 담지 않는 이유**도 같다: 재생성마다 시각이 바뀌면 그 비교가 성립하지 않는다.
>
> **changeSet 을 나누면 깨진다.** `runOnChange` 는 changeSet 의 체크섬으로 재실행을 판정하고
> `loadData` 의 체크섬은 **그 CSV 하나만** 본다. 006 만 바뀌면 006 의 changeSet 이 재실행되어
> FK 때문에 `SYS_MENU_API` 를 먼저 지워야 하는데, **007 은 체크섬이 그대로라 재실행되지 않는다** —
> 매핑이 통째로 빈 채 남고 증상은 *"권한을 줬는데 403"* 이다. 그래서 삭제 둘과 적재 둘을
> 한 changeSet 에 둔다. **파일이 갈린 이유는 테이블이 둘이기 때문이지 changeSet 이 둘이어야
> 해서가 아니었다.**

**생성물은 커밋한다.** 자동 생성해서 자동 반영하지 않는다 — 그러면 접근 범위 확장이
리뷰 없이 배포된다([23](../../standard/backend/_study/security-design.md) §4 *"이 API 를 이 메뉴에 여는 것이 맞는가"*).

`/api/public/**` · `/api/common/**` 은 스캔 대상이 아니다. `SYS_API` 판정을 받는 것은
업무 API 뿐이며, 그 분류는 **프리픽스에 이미 새겨져 있다**([23](../../standard/backend/_study/security-design.md) §4).

#### 이름과 설명은 **사람이 쓴 한 문장**이다 — `@Operation` 을 재사용한다

앞의 셋과 달리 `API_NM` · `API_DESC` 는 **코드 어디에도 없다.** 스캐너가 보는 것은 경로와
메서드 시그니처뿐이고, 거기서 만들어 낸 이름은 **`API_URL` 을 다시 쓴 것**이라 컬럼을
하나 더 두는 값이 `0` 이다.

**그러니 사람이 한 문장을 써야 하는데, 그 문장은 이미 쓰기로 되어 있다.** springdoc 이
스택에 있고([20](../../standard/stack.md)) SYS-05 가 비운영 API 문서를 요구한다([10](../../knowledge/features.md)) — 같은 사실을
두 군데에 적게 하지 않는다.

```java
@Operation(summary     = "사용자 목록 조회",
           description = "검색 조건에 맞는 사용자를 페이지 단위로 반환한다.")
@PostMapping("/api/service/user/getList")
public ApiResponse<PageResponse<UserDto>> getList(@RequestBody UserSearchReq req) { … }
```

| | |
|---|---|
| `API_NM` | **`@Operation.summary`** — **필수** |
| `API_DESC` | `@Operation.description` — **선택.** 없으면 빈 값이다 |
| 읽는 방법 | `@Operation` 은 **런타임 유지**라 `@RequestMapping` 과 **같은 스캔 한 번**에 잡힌다 |

- **`summary` 누락은 빌드가 막는다.** 스택에 이미 있는 **ArchUnit** 이 *"`/api/service/**`
  핸들러는 `@Operation.summary` 를 갖는다"* 를 검사한다([20](../../standard/stack.md) *레이어 위반 시 빌드 실패*).
  `checkApiSeed` 가 아니라 여기인 이유는 **시드 어긋남이 아니라 코드 규약**이기 때문이다 —
  시드를 재생성하지 않아도 어겨질 수 있다
- **`description` 까지 필수로 하지 않는 이유** — 이름이 비면 카탈로그의 컬럼이 쓸모없어지지만
  설명이 비어도 화면은 제 일을 한다([62](../../../documents/screen/menu/requirements.md) §5.2 의 세 갈래는 URL 과 매핑 수로 가른다).
  **필수 항목을 늘리면 채우려고 쓴 문장이 들어온다**
- **`@ApiActionType` 과 같은 층이다** — 둘 다 런타임 판정에 참여하지 않는 **시드 생성 입력**이며,
  판정 원본은 여전히 `SYS_API` 데이터 하나다

> **springdoc 이 문서 도구에서 *빌드 입력* 으로 바뀐다.** `@Operation` 은 비운영에서만
> **노출**될 뿐 **모든 프로필에서 컴파일된다**([25](../../standard/build-deploy.md)). 운영 빌드에서 springdoc 의존성을
> 빼면 **시드의 이름이 조용히 사라지므로** 의존성을 프로필로 가르지 않는다.

### 3. 잊는 것은 CI 가 막는다 — `checkApiSeed`

```
./gradlew checkApiSeed        # check 태스크에 연결한다
```

재생성 결과와 커밋된 시드를 비교해 **다르면 실패한다.** 생성을 자동화하는 대신
**누락 탐지를 자동화한다.**

| 층 | 언제 | 잡는 것 |
|---|---|---|
| `check` | 로컬 `build` | 커밋 전 |
| **CI** | PR | **머지 차단 — 운영 누락이 구조적으로 불가능** |
| 런타임 403 | 화면 진입 | 그래도 새면 fail-closed 가 받는다 |

실패 방향이 맞다 — 잊으면 **빌드가 시끄럽게 깨지고**, 운영에 조용히 누락되지 않는다.
검증을 사람에서 장치로 옮긴 것이며 원칙 P1 그대로다.

## 개발자 작업 순서

새 업무 화면 하나를 추가할 때의 전 과정이다.

| # | 하는 일 | 산출물 |
|---|---|---|
| 1 | **컨트롤러 작성** — 경로를 `/api/service/{도메인}/{동작}` 규약으로 쓴다. 접두가 실제 동작과 다르면 `@ApiActionType` 을 붙인다. **`@Operation(summary=…)` 은 필수**다 | `.java` |
| 2 | **프론트 화면 작성 + `endpoints` 선언** — 호출하는 URL 을 `features/{도메인}/api/endpoints.ts` 에 모은다. 화면은 **반드시 이 상수를 경유**해 호출한다([24](../../standard/frontend/_study/frontend-stack.md) §9) | `.tsx` · `endpoints.ts` |
| 3 | **메뉴 등록** (신규 메뉴인 경우) — `003-init-menu.yaml` 에 `MENU_CD` · `MENU_URL` 행 추가. 목록은 [52](../../knowledge/sys/menu.md) 가 소유한다 | `003-init-menu.yaml` |
| 4 | **시드 생성** — `./gradlew generateApiSeed` | `006-init-api.csv` · `007-init-menu-api.csv` |
| 5 | **로컬 확인** — 재기동하면 Liquibase 가 개발 DB 에 반영한다. 화면에 들어가 403 이 없는지 본다 | — |
| 6 | **커밋 · PR** — 컨트롤러 · 프론트 · 시드를 **한 커밋**에 담는다. 리뷰어는 시드 diff 로 *"이 API 를 이 메뉴에 여는 것이 맞는가"* 를 판단한다 | PR |
| 7 | **CI** — `checkApiSeed` 가 재생성 결과와 커밋본을 대조한다. 4 를 잊었으면 여기서 막힌다 | — |
| 8 | **배포** — 같은 changelog 가 운영 DB 에 적용된다 | — |

기존 화면에 API 만 추가하면 3 이 빠지고, 액션만 바뀌면 1 · 4 · 6 · 7 만 돈다.

> **이 표는 인가 시드까지다.** [ADR-0023](./0023-message-key-sync-from-source.md) 이 메시지 키 시드를 더하면서 순서에 두 단계가
> 끼어들었다. **합친 절차와 배포 전 검증은 [33](../../standard/_study/seed-generation.md)** 이 갖는다 — 개발자가 읽는 자리는
> 그 하나이며, 여기 남는 것은 **인가 부분의 근거**다.

> **6 이 한 커밋인 것이 중요하다.** 컨트롤러와 시드가 갈라진 커밋에 있으면 리뷰어가
> *"이 API 가 무엇을 하는가"* 와 *"이것을 어느 메뉴에 여는가"* 를 따로 보게 되는데,
> 그 둘을 함께 봐야 접근 확장을 판단할 수 있다.

### 선언과 호출이 어긋나면

`endpoints.ts` 는 시드의 입력이므로 실제 호출과 어긋나면 시드가 접근 범위를 잘못 말한다.

| 어긋남 | 결과 |
|---|---|
| 선언하지 않고 호출 | **403** — fail-closed 가 잡는다. 5 에서 발견된다 |
| 선언했으나 쓰지 않음 | 불필요한 매핑 = **접근 범위가 조용히 넓어진다** |

둘째를 막기 위해 **URL 문자열 리터럴을 금지하고 `endpoints` 상수만 쓰게 한다** (ESLint).
[24](../../standard/frontend/_study/frontend-stack.md) §2 가 `import/no-restricted-paths` 로 feature 간 import 를 막은 것과 같은 방식이며,
이러면 **선언 = 사용**이 구조적으로 보장된다.

## 기각한 대안

| 기각 | 이유 |
|---|---|
| **관리 화면에서 액션을 고른다** | *"이 API 가 무엇을 하는가"* 는 개발 시점에 정해진 사실이다. 운영 화면에서 바꿀 수 있게 하면 매핑을 시드로 제한한 결정과 어긋난다 — 같은 이유로 화면은 조회만 한다(AUTHZ-14) |
| **시드를 자동 생성·자동 반영** | 접근 범위 확장이 코드 리뷰를 건너뛴다. 잊는 문제는 생성이 아니라 **검증**을 자동화해 푼다 |
| **기동 시 애노테이션↔데이터 정합 검증** | [23](../../standard/backend/_study/security-design.md) §4 가 기각한 그대로다. 이 ADR 의 애노테이션은 **시드 생성 입력**이며 런타임에 읽히지 않으므로 검증할 상대가 없다 |
| **마디 전체 매칭** (`list` · `save` 처럼 정확히 일치) | 동작 마디의 표기(`getList` / `get-list`)를 먼저 확정해야 한다. 접두 매칭은 표기 규약과 독립적이라 그 결정을 미룰 수 있다 |
| **경로만 쓰고 애노테이션을 두지 않음** | 레거시 이관에서 경로를 바꿀 수 없는 경우가 있다. 접두가 어긋난 채 굳으면 고칠 수단이 없다 |
| **Javadoc 을 파싱한다** | Javadoc 은 **`SOURCE` 유지**라 바이트코드 스캔이 못 본다 — 소스 파서나 애노테이션 프로세서를 따로 들여야 한다. 더 나쁜 것은 **springdoc 이 어차피 같은 문장을 요구한다**는 점이다. 둘을 다 두면 갈라지고, 갈라지면 어느 쪽이 맞는지 알 수 없다 |
| **경로·메서드명에서 이름을 만든다** (`getList` → *"목록 조회"*) | **`API_URL` 을 다시 쓴 것**이라 정보가 `0` 인데 **빈 칸을 채워진 것처럼 보이게 한다.** 이 설계가 반복해서 기각한 실패다 |
| **프론트 `endpoints.ts` 에 라벨을 단다** | 이름은 **API 의 성질**이다. 화면에 두면 같은 API 를 두 화면이 쓸 때 이름이 둘이 된다 — [ADR-0016](./0016-api-master-table.md) 이 `ACTION_CD` 를 `SYS_API` 에 둔 것과 같은 이유다 |
| **URL ↔ 이름 대응표를 손으로 관리한다** | 시드를 손으로 쓰는 것을 되살리는 것이다. 파일이 코드와 따로 있으니 **지운 API 의 줄이 남고**, 그것을 막으려면 게이트가 또 하나 필요하다 |

## 결과

- **[10](../../knowledge/features.md) 의 확정 결정 *"코드 어노테이션·기동 검증은 두지 않는다"* 중 앞 절반이 개정된다.**
  기동 검증은 그대로 두지 않으며, 애노테이션은 **런타임 판정에 참여하지 않는 생성 입력**으로만 도입된다.
  판정 원본은 여전히 `SYS_API` 데이터 하나다
- 코드 리뷰에서 인가 등급이 **경로로 보인다** — `/api/service/order/save` 는 읽는 순간 `SAVE` 다.
  [23](../../standard/backend/_study/security-design.md) §4 가 시드 리뷰에 맡겼던 *"`ACTION_CD` 가 맞는가"* 의 부담이 준다
- 접두 오타(`svae` → `EXECUTE`)는 남는다. 권한이 맞지 않아 **개발 중 403 으로 드러나며**,
  생성 도구가 `EXECUTE` 분류분을 따로 보여준다
- AUTHZ-14 관리 화면은 **조회 전용**으로 확정된다 — 생성이 빌드 태스크로 빠졌으므로
  화면에 **편집·생성** 기능을 두지 않는다.
  **엑셀 내보내기는 예외다**(2026-08-27 개정) — 쓰기가 아니며, 화면이 계산하는
  **매핑 수와 접근 가능 인원은 시드 파일에 없다**([62](../../../documents/screen/menu/requirements.md) §5.6)
- 동작 마디의 표기 규약(`getList` / `get-list`)은 **여전히 미결**이다. 접두 매칭이
  그 결정에 의존하지 않으므로 Phase 5 로 미룰 수 있다
- **springdoc 이 *문서 도구* 에서 *빌드 입력* 으로 바뀐다.** `@Operation` 없이는 `API_NM` 이
  만들어지지 않으므로 운영 빌드에서 의존성을 뺄 수 없다 — [20](../../standard/stack.md) 의 *"비운영 환경만 노출"* 은
  **노출**에 관한 말이지 **컴파일**에 관한 말이 아니다
- **모든 업무 API 가 한글 이름을 하나씩 갖게 된다.** 값이 큰 쪽은 카탈로그가 아니라
  **시드 diff 리뷰**다 — `+ /api/service/order/cancel` 옆에 *"주문 취소"* 가 함께 늘어나면
  *"이 API 를 이 메뉴에 여는 것이 맞는가"* 를 코드로 들어가지 않고 판단할 수 있다
- **결정 1 의 액션 넷 중 `EXPORT` 만 원천이 둘이 된다**(2026-08-30 · [ADR-0027](./0027-menu-declared-export-action.md)).
  접두 규칙은 그대로 살아 있지만(임의 API 경로의 엑셀이 그것을 쓴다), **프론트가 만드는
  엑셀에는 컨트롤러가 없어** 스캔이 볼 것이 없다 — 그 경우에만 `SYS_MENU.EXPORT_YN` 이
  말한다. `READ`·`SAVE`·`EXECUTE` 는 이 ADR 이 정한 그대로다
- **두 번째 실행부터의 규약은 [ADR-0022](./0022-generated-seed-full-sync.md) 가 갖는다** — 같은 파일을 다시 쓰고
  `runOnChange` 로 **전건 삭제 → 전건 삽입**한다. `checkApiSeed` 의 *"재생성 결과 ==
  커밋본"* 비교가 **전체 스냅샷을 전제하고 있었으며**, 그 전제를 명시한 것이다
