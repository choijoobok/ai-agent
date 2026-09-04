---
id: LLM-KNW-SYS-004
title: "개인화 넷 — 즐겨찾기 · 그리드 · 조회조건 · 통계"
category: "09-knowledge/sys"
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/domain/src/main/java/com/ordinary/backoffice/domain/favorite/entity/", "sources/backend/domain/src/main/java/com/ordinary/backoffice/domain/gridpref/entity/", "sources/backend/domain/src/main/java/com/ordinary/backoffice/domain/searchcond/entity/", "sources/backend/domain/src/main/java/com/ordinary/backoffice/domain/menustat/entity/"]
author: Bong Jong Hyeon
tier: 3
tags: [knowledge, personalization, preference]
---

# 개인화 넷 — 즐겨찾기 · 그리드 · 조회조건 · 통계

> 표 넷: `SYS_USER_FAVORITE` · `SYS_USER_GRID_PREF` · `SYS_USER_SEARCH_COND` ·
> `SYS_USER_MENU_STAT`.
>
> **넷 다 `USER_ID` 로 시작하고 감사 넷이 없다** — 주체가 곧 행위자라 `REG_ID` 가 `USER_ID`
> 와 늘 같은 값이 된다.

## 1. 어디에 두나 — 서버냐 브라우저냐

| | 어디 | 왜 |
|---|---|---|
| 즐겨찾기 · 그리드 설정 · 저장 조회조건 · 메뉴 통계 | **서버** | **사람의 속성**이다 — 어느 PC 에서 로그인해도 따라와야 한다 |
| **컬럼 너비** | **`localStorage`** | **기기의 속성**이다 — 27인치에서 맞춘 폭이 노트북에서는 틀리다 |
| 다크 모드 · 언어 선택 UI | `localStorage` | 〃 |
| **언어(`SYS_USER.LOCALE_CD`)** | **서버** | **서버가 알아야 한다** — 메일·알림을 어느 언어로 보내나 |

## 2. `SYS_USER_FAVORITE` — 즐겨찾기가 권한을 주지 않는다

| 컬럼 | |
|---|---|
| `USER_ID` + `MENU_CD` | PK |
| `SORT_NO` · `CRE_DTM` | |

- **목록에 남아 있어도 권한이 없으면 API 는 403 이다.** 등록 시점의 권한이 저장되는 것이
  아니다.
- **권한을 잃으면 표시만 멈춘다 — 행은 남는다.** 권한이 돌아오면 다시 나타나야 한다.

## 3. `SYS_USER_GRID_PREF` — `GRID_ID` 가 키에 있다

| 컬럼 | |
|---|---|
| `USER_ID` + `MENU_CD` + **`GRID_ID`** | PK |
| `PREF_JSON` | 컬럼 순서 · 숨김 등 |
| `SIGNATURE` | 화면의 컬럼 목록을 나타내는 값 |

- **화면 하나에 그리드가 둘일 수 있다.** `MENU_CD` 까지만 키로 두면 **위아래 그리드의
  설정이 서로를 덮는다.**
- **`SIGNATURE` 가 폐기 기준이다.** 화면의 컬럼 목록이 바뀌면 저장된 설정을 버린다 —
  **없어진 컬럼을 숨김으로 들고 있거나 새 컬럼이 순서 없이 끼는 상태**를 만들지 않는다.
  **판정은 서버 한 곳**이며 화면은 지금의 시그니처를 들고 물을 뿐이다.
- **`PREF_JSON` 을 서버가 열어 보지 않는다.** 무엇이 유효한 컬럼인지 아는 것은 **화면
  선언**이고, 서버가 검증하려면 선언을 서버에도 한 벌 두어야 한다 — **그것이 미러링이다.**
- **양식 그리드는 개인화를 열지 않는다** — [11-playbook/excel.md §8](../../playbook/excel.md).

## 4. `SYS_USER_SEARCH_COND` — 담는 것은 **폼 값**이지 봉투가 아니다

| 컬럼 | |
|---|---|
| `USER_ID` + `MENU_CD` + `COND_NM` | PK |
| `COND_JSON` | **폼 값** |
| `DFLT_YN` · `SORT_NO` | |

- **봉투(`conditions`·`params`)는 파생물이다.** 연산자·파라미터 키·스케일은 **화면 선언에
  있다** — 함께 저장하면 미러링이고, 선언을 고쳤을 때 **저장된 쪽이 낡은 형태를 되살린다.**
  폼 값만 담으면 사라진 필드는 **그 키만 버리면** 된다.
- **기본값과 같은 칸은 아예 들어오지 않는다.** 그래서 *최근 7일* 로 저장한 조건은 열
  때마다 최근 7일이며 **절대값으로 굳지 않는다** — 그것이 **저장된 조건의 가장 흔한
  배신**이다.
- **`MENU_CD` 가 PK 에 있다.** 조건은 화면에 매인다 — 화면이 다르면 필드가 다르므로 **같은
  이름이라도 다른 물건**이다.
- **공유하지 않는다.** 공유하면 *남의 조건을 내가 고칠 수 있나* 가 따라오고 그것은
  소유권·권한이라 **화면 하나가 아니라 관리 기능**이 된다.

## 5. `SYS_USER_MENU_STAT` — 세는 것은 **메뉴를 선택하는 행위** 하나다

| 컬럼 | |
|---|---|
| `USER_ID` + `MENU_CD` + `STAT_YM` | PK |
| `USE_CNT` · `LAST_USE_DTM` | |

| 세지 않는 것 | 왜 |
|---|---|
| 탭바에서 탭 고르기 | 이미 열려 있어 **찾는 수고가 없다** |
| 화면 안의 기능 버튼 | *사용 강도* 이지 여는 횟수가 아니고, **화면마다 버튼 수가 달라 화면 설계가 순위를 왜곡한다** |

- **월 버킷이다.** 일 버킷 + 30일 창은 창이 정확한 대신 **행이 30배**인데, 이 기능이 내는
  답은 *상위 N개와 그 순서* 라 **창 경계가 며칠 흔들려도 답이 거의 바뀌지 않는다.**

## 6. 넷의 공통 규칙

- **감사 넷이 없다.** 있으면 `REG_ID` 가 `USER_ID` 와 늘 같아 **그 컬럼 자체를 신뢰할 수
  없게 된다.**
- **계정을 지우면 함께 지운다** — 이력과 반대다. 개인화는 *일어난 일* 이 아니라 *그 사람의
  설정* 이라 남길 이유가 없다.
- **서버가 JSON 을 열어 보지 않는다**(`PREF_JSON` · `COND_JSON`). 검증하려면 화면 선언을
  서버에 한 벌 더 두어야 한다.

## 관련

- [menu.md](./menu.md) — 즐겨찾기가 가리키는 메뉴
- [06-framework/frontend/theme.md](../../standard/frontend/theme.md) — 기기의 속성
- [11-playbook/crud-screen.md](../../playbook/crud-screen.md) — 조회조건 선언
