---
id: LLM-FWK-FE-009
title: "테마 — 토큰 한 곳 · 다크 모드 · 개인 설정"
category: "06-framework/frontend"
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/shared/theme/", "sources/frontend/src/shared/stores/uiStore.ts"]
author: Bong Jong Hyeon
tier: 2
tags: [frontend, theme, dark-mode, antd, ag-grid]
---

# 테마 — 토큰 한 곳 · 다크 모드 · 개인 설정

> **그리드가 자기 테마를 따로 갖지 않는다.** 갖게 하면 셸의 회색과 그리드의 회색이
> 어긋나고, 사용자가 톤을 바꿨을 때 **화면의 절반만 따라온다.**

## 1. 설정에서 토큰 세트 하나를 만든다

```
   설정 (모드 · Primary · 색 톤 · 글꼴 · 그리드 높이)
                     ↓
            themeTokens.ts — 한 곳
          ┌──────────┴──────────┐
        AntD                  AG Grid
   ConfigProvider           theme parts
```

**AG Grid 는 antd 토큰을 자동으로 따라오지 않는다** — 어댑터가 모드를 직접 골라야 하는데,
**그 판정이 한 곳이 아니면 셸은 다크인데 그리드만 라이트**인 화면이 나온다.

## 2. 모드 셋 — `light` · `dark` · `system`

```ts
const dark = useResolvedDark();   // system 이면 OS 를 따른다
```

> **`system` 에 구독을 건다.** 최초 값만 읽으면 사용자가 로그인한 채로 OS 를 다크로 바꿔도
> 앱은 라이트로 남는다 — *"시스템 따름"* 이 *"앱을 켤 때의 시스템"* 이 되어 버린다.

**기본값은 `system`** 이다.

## 3. 축 다섯

| 축 | 값 |
|---|---|
| `themeMode` | `light` · `dark` · **`system`**(기본) |
| `colorPrimary` | 씨앗 색 하나 |
| `colorTone` | `neutral`(기본) · `warm` · `cold` · `green` |
| 글꼴 | `fontFamily` · `fontSize`(14) · `fontWeight` |
| 그리드 | 행 높이 · 배경 밀도 |

> **톤은 씨앗 하나로 양쪽에 간다.** 판이 주는 `colorSchemeLightWarm`·`LightCold` 는
> **바탕을 바꾸지 않는다** — 테두리 알파와 머리 배경만 손대고 흰색은 흰색 그대로다.
> 화면의 대부분이 그리드이므로 결과는 *"톤을 바꿔도 달라지는 게 없다"* 였다.
> 지금은 **모드별 중립 스킴만 쓰고 온도는 우리가 만든다.**

## 4. 색을 직접 정하지 않는다

**Primary 에서 파생한다.** 화면이 `#1677ff` 같은 값을 적으면 사용자가 Primary 를 바꿨을 때
그 자리만 남는다.

행·셀의 색이 겹칠 때의 우선순위는 정해져 있다 — **헤더가 컬럼을 말하고, 셀이 그 셀을
말한다**([grid-advanced.md](./grid-advanced.md)).

## 5. `uiStore` 는 기기의 속성이다

- **`persist` 를 쓰는 유일한 스토어**다(`backoffice.ui`) — 로그아웃해도 남아야 한다.
- **계정에 묶지 않는다.** PC 마다 해상도·화면 비율이 달라 서버에 저장하면 **다른 자리에서
  로그인할 때마다 어긋난다.**
- **언어만 예외로 서버에 있다** — 메일·알림을 어느 언어로 보낼지 결정하는 것은 서버이고
  `localStorage` 는 서버가 볼 수 없다([i18n.md](./i18n.md)).

## 6. 그리드 개인 설정은 갈라 둔다

| | 어디 | 왜 |
|---|---|---|
| **컬럼 순서·표시여부** | **서버** | 화면 크기와 무관한 *"나는 이 컬럼을 이 순서로 본다"* |
| **컬럼 너비** | `localStorage` | 해상도·비율에 딸린 값 |

**한 그리드의 설정이 두 곳에 나뉘는 것은 감수한다.** 시그니처 무효화의 본체는 **DB 쪽**이다 —
순서가 깨지면 화면이 어긋나지만, **모르는 컬럼의 너비는 무시하면 된다.**

## 관련

- [packages.md](./packages.md) — 스토어 넷과 `persist`
- [grid-advanced.md](./grid-advanced.md) — 셀·행의 색
- [tabs.md](./tabs.md) — 셸 레이아웃
