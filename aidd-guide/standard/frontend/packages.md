---
id: LLM-FWK-FE-004
title: "프론트엔드 구조 — 폴더 · 공통화 · 상태 경계"
category: standard/frontend
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/", "sources/frontend/eslint.config.js", "aidd-guide/standard/frontend/packages.md"]
tier: 2
tags: [frontend, structure, shared, state, zustand]
---

# 프론트엔드 구조 — 폴더 · 공통화 · 상태 경계

> **두 번째 화면이 같은 것을 쓰는 순간 `shared/` 로 올린다**(CLAUDE.md §8).
> ESLint 는 **경로를 넘는 import 를 막을 뿐 복붙은 통과시킨다** — 그래서 이것은
> 리뷰 규칙이다.
>

## 1. 폴더

```
src/
├── app/          진입 · 라우터 · 프로바이더(QueryClient · AntdConfig · I18n · Auth)
├── layouts/      앱 셸 — ShellLayout(헤더·사이더·탭바·브레드크럼·콘텐츠) · BlankLayout
├── shared/       도메인 비종속 공통 — 아래 §2
├── features/     화면 기능 단위 — api/ · components/ · pages/ · types.ts
└── locales/      번들 로드 실패 시의 문구 몇 개만 (전체 폴백이 아니다)
```

`locales/` 의 키들은 **`MSG` 에도 `SYS_MESSAGE` 에도 없다** — 서버가 없을 때 쓰는 것이라
서버에 두면 뜻이 없다.

**`features/` 는 백엔드 애그리거트와 대체로 대응하되 1:1 이 아니다** —
`auth` · `dashboard` · `errorlog` · `settings` 는 프론트에만 있다.

### 기능 하나의 모양

```
features/user/
├── api/endpoints.ts     호출 URL — 이것이 인가 시드의 입력이다
├── api/userApi.ts       HTTP 호출을 감싼 함수들
├── components/          이 화면만 쓰는 것
├── pages/UserMgmtPage.tsx
├── detailRules.ts       화면 고유 규칙
└── types.ts
```

### 화면 컴포넌트 이름

| 화면 | 이름 | 실물 |
|---|---|---|
| 조회 전용 | **`{기능}Page`** | `LoginLogPage` · `AccessLogPage` · `ErrorLogPage` · `ApiCatalogPage` · `BatchHistoryPage` |
| 관리(CRUD) | **`{기능}MgmtPage`** | `UserMgmtPage` · `CodeMgmtPage` · `NoticeMgmtPage` · `RoleAuthMgmtPage` |
| 판이 그리드가 아니다 | **판을 이름에 적는다** | `MenuTreePage` |

- **파일 이름이 곧 컴포넌트 이름이고, `screenRegistry.ts` 가 그 이름으로 import 한다.**
- **관측된 예외 하나 — `BatchSchedulePage`.** 저장이 있는데 `Mgmt` 가 없다.
  고치지 않는다(경로가 아니라 이름이라 파급은 없으나 되돌릴 이유도 없다).
  **새 화면은 위 표를 따른다.**

## 2. `shared/` — 관심사마다 폴더 하나

| 폴더 | 무엇 |
|---|---|
| `api` | HTTP 배럴 · 인터셉터 · request-id · 다운로드 |
| `grid` | `useGridController` · `DataGrid` · 컬럼 계약 · 셀 에디터 · 엑셀 · 개인설정 |
| `searchform` | `useSearchFormHeader` · `SearchForm` · 저장된 조건 |
| `authz` | 권한 판정 · 메뉴 트리 색인 |
| `i18n` | `MSG` 상수 · 번들 캐시 · `label()` |
| `screentabs` · `tree` · `popup` · `formmodal` | 셸·공통 UI |
| `code` · `user` · `favorite` · `menustat` | 공통 조회 |
| `batch` · `progress` · `excelupload` | 긴 작업 — `batch` 는 **화면 둘이 나눠 쓰는** 코드값·`tone` 맵·이력 컬럼([../backend/batch.md](../backend/batch.md)) |
| `stores` | `authStore` · `tabStore` · `uiStore` · `messageStore` |
| `theme` · `routes` · `hooks` · `components` | 나머지 |

> **`shared/components/` 한 폴더가 아니다.** 설계 문서의 트리는 그렇게 적혀 있지만
> 실물은 **관심사별 폴더 21개**로 자랐다. 그리드 하나가 65파일이라 한 폴더에 두면
> 찾을 수 없다.

## 3. 공통화 — 언제 올리나

| 시점 | 무엇을 한다 |
|---|---|
| 화면 **하나**가 쓴다 | `features/{그 화면}/components/` 에 둔다 |
| **두 번째 화면**이 같은 것을 쓰려 한다 | **그때 올린다. 복사하지 않는다** |
| 세 번째부터 | 이미 올라가 있다 |

> **두 번째가 기준인 이유** — 하나일 때 올리면 *공통으로 쓸 것 같은* 추측으로 인터페이스가
> 정해지고, 셋을 기다리면 그 사이에 **복사본 둘이 서로 다르게 자란다.**
> 두 번째가 나타난 순간이 **요구가 둘 다 드러난 유일한 시점**이다.

### 올릴 때 지키는 셋

| | |
|---|---|
| **도메인 용어를 지운다** | `shared/` 는 도메인 비종속이다. `<UserRoleGrid>` 는 올라갈 수 없고 `<DataGrid>` 는 올라간다 — **업무 이름이 남아 있으면 아직 `features/` 의 것**이다 |
| **공통물 목록에 등재한다** | **목록에 없는 공통 컴포넌트는 없는 것과 같다** — 다음 사람이 찾지 못해 또 만든다 |
| **복사본을 지운다** | 올리는 커밋에서 **원래 자리의 것을 삭제**한다. 남겨 두면 어느 것이 진짜인지 알 수 없다 |

> **`shared/` 가 쓰레기통이 되는 반대 실패도 있다.** 한 화면만 쓰는 것을 *언젠가 쓸지도*
> 로 올리면 목록이 길어지고 아무도 다 읽지 않는다. **조건은 *두 번째 사용* 이지
> *공통일 것 같음* 이 아니다.**

### 이름을 바꿀 때 — `@deprecated` 가 인용처를 열거하게 한다

공통물의 선언 이름을 바꾸면 **그것을 인용하는 문서가 여럿**이다. 표준만 고치고 레시피를
놓치면, 레시피대로 만든 다음 화면이 **낡은 통로로 만들어진다**(2026-09-06 에 다섯이 그랬다).

```ts
/** @deprecated {@link toSaveRow} 를 쓴다. 이 통로로는 … */
toSavePayload?: (rows: GridRow<T>[]) => unknown;
```

- **`{@link 대안}` 을 반드시 댄다.** 대안이 없으면 `lint.mjs` 가 **그 자체를 위반**으로 낸다 —
  게이트의 판별식이 *대안을 함께 말하는가* 이기 때문이다.
- 그러면 `lint.mjs` 가 **옛 이름을 아직 가르치는 가이드 문서를 전부 열거한다.** 사람이
  관리하는 면제 명단은 없다: 대안을 함께 말하는 문서는 *옮겨 가는 길을 설명하는* 것으로
  보고 넘어간다.
- **옛 이름을 바로 지우지 않는다.** 화면이 스물이면 한 커밋에 다 옮길 수 없고, 지우면
  중간 상태에서 빌드가 깨진다. 게이트가 초록인 채로 화면을 하나씩 옮긴 뒤 마지막에 지운다.

## 4. 기계가 막는 것

| ESLint 규칙 | 무엇 |
|---|---|
| `import-x/no-restricted-paths` | **`features/*` 끼리 직접 import 금지** |
| `no-restricted-imports` | `@/shared/api/*` **딥 임포트 금지** — 배럴 하나 |
| `no-restricted-syntax` | 문자열·JSX 텍스트·템플릿 문자열 **속 한글** · `label()` 리터럴 · `/api`·계층 경로 리터럴 |

> **존은 기능마다 하나씩이다.** `target` 과 `from` 을 둘 다 `./src/features` 로 두면
> **`auth` 안에서 `auth` 를 import 하는 것까지 막힌다** — 규칙이 뜻하는 것은 *기능 사이*
> 이지 *기능 안*이 아니다. 기능 목록은 **`src/features` 를 읽어 만든다.** 손으로 적으면
> 새 기능을 빠뜨리고, **빠진 기능은 규칙의 대상이 아니므로 아무 경고 없이** 다른 기능을
> import 할 수 있다.

**복사를 막을 수단은 ESLint 에 없다.** 그래서 §3 은 리뷰 규칙이다 — *"이거 다른 화면에도
있지 않나"* 를 묻는 자리를 만든다.

## 5. 상태 — 무엇을 어디에

| 상태 | 도구 |
|---|---|
| 서버 데이터 (목록·상세) | **react-query** |
| 공통 코드 · 시스템 설정 · 메시지 | **`localStorage`** + 전용 스토어 (로그인 시 버전 비교) |
| 로그인 사용자 / 권한 | zustand `authStore` — 로그인 시 1회 |
| 탭 목록 / 활성 탭 | zustand `tabStore` |
| 테마 · 접힘 · 밀도 | zustand `uiStore` + `persist` — **기기의 속성** |
| **즐겨찾기** | **서버** — 명시적 선언이고 자리를 바꿔도 따라와야 한다 |
| **최근 사용 메뉴** | `localStorage` — 파생·휘발. 팔레트가 타이핑마다 반응해야 한다 |
| **자주 쓰는 메뉴** | **서버** — 계정 단위 누적이라 기기별로 나뉘면 부정확하다 |
| **그리드 컬럼 순서·표시여부** | **서버** — 화면 크기와 무관한 사람의 속성 |
| **그리드 컬럼 너비** | `localStorage` — 해상도·비율에 딸린 값 |
| 폼 입력값 | antd Form 로컬 상태 |

**전역 스토어에 서버 데이터를 복사해 넣지 않는다.**

> **UI 설정을 계정에 묶지 않는다.** PC 마다 해상도가 달라 레이아웃 설정을 서버에 두면
> 다른 자리에서 로그인할 때마다 어긋난다. 즐겨찾기가 서버인 것은 모순이 아니다 —
> **레이아웃이 아니라 사용자가 명시적으로 선언한 목록**이다.

> **언어만 서버인 이유는 서버가 알아야 하기 때문이다.** 메일·알림을 어느 언어로 보낼지
> 결정하는 것은 서버이고 `localStorage` 는 서버가 볼 수 없다.

### 스토어 넷 — zustand 이며 브라우저 저장소가 아니다

| 스토어 | 담는 것 | 비우는 시점 | `persist` |
|---|---|---|---|
| `authStore` | `user` · `permissions` · `menus` | **로그아웃만** — 세션 만료는 비우지 않는다 | **안 쓴다** |
| `tabStore` | 탭 목록 · 활성 탭 | 로그아웃 · 로고 클릭 · F5 | **안 쓴다** |
| `uiStore` | 테마 · 접힘 · 밀도 | **비우지 않는다** | **쓴다** |
| `messageStore` | 번들 · 언어 · 버전 | 비우지 않는다 | **안 쓴다** — 아래 |

- **`authStore` 에 `persist` 를 붙이지 않는 것이 결정이다.** 붙이면 로그아웃 뒤에도 그 PC 에
  **이전 사용자의 메뉴 구조가 남는다.** F5 당 왕복 하나를 대가로 감수한다.
- **`authStore` 와 `tabStore` 는 같은 메모리 수명을 갖는다.** 그래서 *"탭이 살아 있으면
  로그인 ID 도 있다"* 가 항상 참이고, **재인증 모달의 판정이 별도 플래그 없이** 성립한다.
- **`messageStore` 는 `persist` 대신 `localStorage` 를 직접 다룬다** — 저장 키에 **언어
  축**이 붙는데(`backoffice.message:ko`) `persist` 는 스토어 하나에 키 하나라, 언어를
  바꿀 때마다 옛 언어의 번들이 덮여 **다음 접속에 전량을 다시 받는다.**
- **폼 입력값·스크롤은 스토어에 없다.** 비활성 탭을 **언마운트하지 않고 숨기므로**
  컴포넌트 안에 그대로 남는다. `tabStore` 는 *"어떤 탭이 열려 있는가"* 만 안다.

> **`authStore` 가 예외처럼 보이지만 아니다.** `menus`·`permissions` 는 **조회 결과가
> 아니라 세션의 속성**이며 화면이 아니라 셸이 쓴다.

## 관련

- [http.md](./http.md) — `endpoints.ts` · 배럴 하나
- [grid.md](./grid.md) — 화면 뼈대
- [CLAUDE.md §8](../../../CLAUDE.md) — 공통물 승격 · 기계가 막는 것
