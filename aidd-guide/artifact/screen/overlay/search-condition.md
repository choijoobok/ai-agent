---
id: LLM-PMT-OVR-001
title: "Overlay — 조회조건 폼"
category: artifact/screen/overlay
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/features/sample/singleoffset/pages/SampleSingleOffsetPage.tsx", "sources/frontend/src/shared/searchform/types.ts"]
tier: 1
tags: [prompt, overlay, search]
---

# Overlay — 조회조건 폼

**트리거**: 화면 상단에 검색 폼이 있다.
**필수가 되는 절**: §2 조회조건 · §3-2 고정 조건·기본 정렬.

## 칸 하나마다 적어야 하는 여덟

| | 예 | 비면 |
|---|---|---|
| 조건 이름 | 등록일 | |
| **대상 컬럼** | `REG_DTM` | **어느 컬럼을 거는지 모른다** — 이름만으로는 추측이다 |
| 입력방식 | 날짜(기간) · 셀렉트 · 텍스트 · 팝업 | |
| **연산** | BETWEEN · EQ · IN · LIKE | 기본값을 구현이 정한다 |
| 필수 | 선택 / 필수 | |
| 기본값 | 최근 7일 · 전체 | |
| 선택 출처 | 코드그룹 `{...}` | **그룹을 모르면 콤보가 빈다** |
| 라벨 키 | `MSG.{...}` | |

## 반드시 묻는 것

1. **사용자가 연산자를 바꿀 수 있나** — 바꿀 수 있으면 **후보 목록**까지 정해야 한다.
   연산자는 열셋이고 전부 열지 않는다.
2. **날짜 칸의 정밀도** — `DATE` 컬럼인가 `TIMESTAMP` 인가, 년월(`VARCHAR(6)`)인가.
   **적지 않으면 시각까지 보내고 서버 비교가 언제나 빗나간다** — 그 조건은 *걸었는데 0건*
   이 된다.
3. **기간 상한** — 며칠까지 허용하나. 대용량 표면 필수다.
4. **기본 정렬** — 규칙에서 안 나온다.
5. **고정 조건** — 사용자가 못 바꾸는 `WHERE`(예: `USE_YN='Y'`)가 있나.

## 흔한 누락

| 빠뜨린 것 | 일어나는 일 |
|---|---|
| **정밀도** | 년월 칸이 ISO 시각을 보내 **비교가 언제나 실패한다** |
| **코드그룹 이름** | 셀렉트에 고를 것이 없다 |
| **팝업 칸인지** | 직접 칠 수 있게 두면 **목록에 없는 키**가 만들어지고, 사용자가 자기 오타를 의심할 근거가 없다 |
| **기본값이 있는 칸** | 진입 시 자동 조회와 맞물린다 — 기본값이 없으면 전건이 나간다 |
| **조회조건이 아닌 것을 조회조건에 넣음** | *표시 범위* 같은 것은 컨트롤이다. 폼에 두면 **접혀 있을 때 보이지 않는 곳에서 그리드의 뜻이 바뀐다** |

## 적지 않는 것

검색 폼의 접힘·초기화 버튼·활성 조건 개수 배지·저장된 조회조건 — **전부 표준이다.**

## 실물

`sources/frontend/src/features/sample/singleoffset/` — 조회조건 **열둘**로 연산자와 입력방식이
전부 나온다.

## 구현은

[playbook/crud-screen.md](../../../playbook/crud-screen.md) ·
[standard/frontend/search-form.md](../../../standard/frontend/search-form.md).
