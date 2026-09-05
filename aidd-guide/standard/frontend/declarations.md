---
id: LLM-FWK-FE-008
title: "선언 어휘 — 컬럼 · 검색 필드 · api · prop 전량"
category: standard/frontend
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: ["sources/frontend/src/shared/grid/types.ts", "sources/frontend/src/shared/grid/useGridController.ts", "sources/frontend/src/shared/grid/DataGrid.tsx", "sources/frontend/src/shared/searchform/types.ts"]
tier: 1
tags: [frontend, grid, column, searchform, vocabulary, reference]
---

# 선언 어휘 — 쓸 수 있는 이름의 전량

> **이 문서의 일은 *빠짐없음* 하나다.** 뜻의 상세와 *왜 그렇게 정했나* 는
> [grid.md](./grid.md) · [grid-advanced.md](./grid-advanced.md) ·
> [search-form.md](./search-form.md) 가 갖는다.
>
> **여기 없는 이름은 없는 것이다.** 선언 키를 추정해 새로 만들지 않는다 —
> 필요한 것이 없으면 `shared/` 를 고치고 이 표를 함께 고친다.
>
> **기본값의 정본은 소스다**(`CLAUDE.md` §2). 아래 *없으면* 칸이 소스와 어긋나면
> 소스가 이기고 이 표를 고친다 — `lint.mjs` 가 키 누락을 센다(§6).

## 1. `ColumnDef` — 36 키

**자리**

| 키 | 없으면 | 한마디 |
|---|---|---|
| `field` | **필수** | 행 객체의 속성명. 서버 `Row` 와 1:1 |
| `header` | **필수** | **`MSG` 키다** — 문자열이 아니다 |
| `type` | **필수** | 유형 13종([grid-advanced.md](./grid-advanced.md) §2) |
| `width` | `0` | 픽셀 |
| `pinned` | `null` | `'left'` · `'right'` |
| `fill` | 없다 | 남는 폭을 이 컬럼이 먹는다 |
| `visible` | `true` | 초기 표시. 꺼도 설정 창에서 켠다 |
| `hidden` | `false` | 설정 창에도 없다 — 켤 수 없다 |
| `sortable` | **`false`** | **명시해야 열린다** |
| `filter` | `true` | 유형이 종류를 정한다. `false` 로 끈다 |

**표시**

| 키 | 없으면 | 한마디 |
|---|---|---|
| `renderer` | 없다 | 표시만 바꾼다. 값은 원본 |
| `tone` | 없다 | 배지·강조의 색 갈래 |
| `badge` | 없다 | **값 *옆* 에 붙는 배지** — `renderer:'badge'`(값 자리)와 다르다 |
| `emphasis` | 없다 | 굵게·흐리게 |
| `icons` | 없다 | 값 → 아이콘 |
| `display` | 없다 | 표시 문자열만 바꾼다 |
| `precision` | 유형이 정한다 | 소수·시각 자릿수 |
| `headerTooltip` | 없다 | 헤더에 붙는 설명(`MSG` 키) |
| `cellTooltip` | 없다 | **셀에 붙는 설명** — 긴 값을 켜지 않고 읽는다 |

**값의 출처**

| 키 | 없으면 | 한마디 |
|---|---|---|
| `options` | 없다 | 고정 목록 |
| `grpCd` | 없다 | **공통코드 그룹** — 목록을 데이터가 준다 |
| `derive` | 없다 | 셀 값을 파생시킨다(엑셀에도 그 값이 나간다). `(row) => unknown` |
| `dynamic` | `false` | **컬럼 자체가 데이터에서 온다** — 계약은 [grid-advanced.md](./grid-advanced.md) §5-1 |
| `patch` | 없다 | 동적 컬럼의 **쓰기** 경로. `(row, value) => Partial<T>` — 빠지면 없는 필드에 얹힌다 |

**편집**

| 키 | 없으면 | 한마디 |
|---|---|---|
| `pk` | `false` | 신규만 · 필수 · 헤더 `*` |
| `editable` | **`false`** | **편집은 명시해야 열린다** |
| `required` | `false` | |
| `editor` | 유형이 정한다 | |
| `maxLength` | 유형이 정한다 | |
| `validate` | 없다 | `(value, row) => msg \| null` — **인자는 둘이다**(`shared/grid/types.ts`) |
| `afterEdit` | 없다 | 값 변경 후 연쇄 |

**여는 것**

| 키 | 없으면 | 한마디 |
|---|---|---|
| `popup` | 없다 | 참조 팝업 |
| `listModal` | 없다 | 배열 편집 창 |
| `viewer` | 없다 | 장문 보기(`nclob`) |
| `onClick` · `onDoubleClick` | 없다 | 셀 클릭 |

## 2. `SearchField` — 15 키

| 키 | 한마디 |
|---|---|
| `field` · `label` · `type` | 필수. `label` 은 **`MSG` 키** · `type` 은 컬럼 유형 어휘를 그대로 쓴다 |
| `op` · `ops` | 기본 연산 · 사용자가 고를 후보. **`ops` 를 적으면 그것만** |
| `options` · `grpCd` | 고정 목록 · **공통코드 그룹** |
| `defaultValue` | 초기값. 초기화가 되돌리는 자리 |
| `required` | 조건부 필수는 서버가 함께 본다 |
| `precision` · `scale` | 자릿수 · 화면 단위와 저장 단위가 다를 때 |
| `rangeDays` | 기간 상한. **생략하면 시스템 값**(`authStore.searchRange`) |
| `popup` · `popupValue` · `popupText` | 팝업으로 고르는 칸 |

## 3. `api` — `useGridController` 가 받는 계약

```ts
api: {
  read:    { url, emptyNotice? },
  save:    { url, confirm?, reloadAfter?, validate?, warn?,
             locateFieldErrors?, onSuccess? },
  actions: [{ key, label, url, target?, eligible?, toTargets?, params?,
              confirm?, hint?, reloadAfter?, validate?, progress?, onSuccess? }],
}
```

- **`url` 은 `endpoints.ts` 의 값을 넣는다** — 리터럴을 적으면 ESLint 가 막는다(`CLAUDE.md` §8).
  그 값에 **`/api` 를 붙이지 않는다** — 배럴이 붙인다([http.md](./http.md)).
- `read` 가 없으면 **전량 모드**다 — 조회 버튼이 서지 않는다.
- `warn` 은 저장 전 확인 문구, `locateFieldErrors` 는 서버 필드 오류를 셀에 꽂는 자리다.

## 4. `useGridController` 옵션 — 9

| 키 | 한마디 |
|---|---|
| `menuCd` | 인가·설정 저장의 키 |
| `columns` · `api` | §1 · §3 |
| `params` | **조회조건** — `() => Promise<SearchCondition[] \| null>`. `null` 이면 조회하지 않는다 |
| `searchParams` | 조건이 아닌 **고정 인자**(마스터의 선택값 등) |
| `addRow` | `{ canAdd?, defaults? }` |
| `toSavePayload` | 저장 본문을 화면이 만든다 |
| `pageSize` · `editable` | |

> **`params` 와 `read.params` 를 혼동하지 않는다** — 조회조건은 컨트롤러 옵션이고
> `read` 는 `url` 과 `emptyNotice` 둘뿐이다.

## 5. `<DataGrid>` prop — 22

| 묶음 | 키 |
|---|---|
| 필수 | `title`(**`MSG` 키**) · `controller` |
| 판 | `height` · `settings` · `gridId` · `menuCd` · `disabled` |
| 머리 | `controls` · `titleSuffix` · **`excel`**(`ExcelSpec` \| **`false`** — `false` 면 ②를 안 세운다) |
| 발 | `pageSizes` · `footerNote` · **`emptyText`**(0건 문구를 화면이 바꾼다) |
| 선택 | `selection` · `onSelect` · `onSelectionChange` · `onRowDoubleClick` |
| 편집 | `deletable` · `onRead` |
| 접기 | `collapsed` · `collapsedAxis` · `onExpand` |

## 6. 이 표를 낡지 않게 하는 것

- `node aidd-guide/meta/_meta/lint.mjs` 가 `types.ts` 의 키와 이 문서를 대조한다.
  **소스에 있고 여기 없으면 위반**이다 — 키를 더했으면 이 표를 함께 고친다.
- **기본값은 세지 않는다**(주석·조건부가 섞여 기계가 읽을 수 없다). 그래서
  *없으면* 칸은 사람이 지킨다 — 어긋남을 발견하면 소스를 믿고 여기를 고친다.

## 관련

- [grid.md](./grid.md) — 뼈대 · 저장 흐름 · `api` 를 언제 쓰나
- [grid-advanced.md](./grid-advanced.md) — 유형 13종 · 편집 · 검증 · 마스터-디테일
- [search-form.md](./search-form.md) — 필드 하나를 고르는 판단
- [`frontend/grid.md`](./grid.md) — 컬럼 계약 원문
- [`frontend/search-form.md`](./search-form.md) — 검색 폼 계약 원문
