---
id: LLM-FWK-FE-001
title: "그리드 컬럼 — 하나의 계약 · 유형 13종 · 동적 컬럼"
category: standard/frontend
type: operation
created: 2026-05-04
updated: 2026-09-06
status: active
sources: ["sources/frontend/src/shared/grid/", "sources/frontend/src/features/sample/"]
tier: 2
tags: [frontend, grid, column, type]
---

# 그리드 컬럼 — 하나의 계약 · 유형 13종 · 동적 컬럼

> **컬럼을 선언할 때** 읽는다. 화면 뼈대와 `api` 선언은 [grid.md](./grid.md),
> **선언 어휘의 전량**(기본값까지)은 [declarations.md](./declarations.md) 가 갖는다.
>
> 정렬·필터·편집·검증은 [grid-validation.md](./grid-validation.md) 다 — 한 문서였다가
> 200줄 상한에 닿아 갈랐고, 갈린 축은 **무엇을 정하고 있나**: 여기는 *칸이 무엇인가*,
> 저기는 *그 칸에 무슨 일이 일어나나* 다.

## 1. 컬럼 하나

```ts
{
  field:    'productId',
  header:   'col.product.id',      // 메시지 키 — 문자열이 아니다
  type:     'popupRef',
  width:    120,
  pinned:   'left',

  visible:  true,                  // 초기 표시. 꺼도 설정 창에서 켤 수 있다
  hidden:   false,                 // true 면 설정 창에도 없다 — 켤 수 없다

  pk:       true,                  // 신규만 · 필수 · 헤더 `*`
  sortable: true,                  // 기본 false — 정렬도 명시해야 열린다
  filter:   'set',                 // 생략하면 타입이 정한다

  renderer: 'badge',               // 표시만 바꾼다. 값은 원본
  editor:   'popupRef',            // 생략하면 타입이 정한다
  editable: (row) => …,            // 기본 false — 편집은 명시해야 열린다
  required: true,
  afterEdit: (row) => ({ … }),
  validate:  (v, row, ctx) => msg | null,
}
```

> **위 예시는 자주 쓰는 열둘이고 컬럼 키는 서른여섯이다.**
> **쓸 수 있는 이름과 기본값의 정본은 [declarations.md](./declarations.md) §1 이다** —
> 여기서 다시 적지 않는다(2026-09-04: 이 자리에 있던 표가 `sortable` 의 기본값을
> `true` 로 적고 있었고 소스는 `?? false` 였다. 같은 사실을 두 곳에 두면 한 곳이 낡는다).

**명시해야 열리는 것 둘**: `editable` 과 `sortable` 은 **없으면 꺼진다.**

**숨김이 두 층인 이유**: `visible` 은 *지금 안 보인다*(사용자가 켤 수 있다)이고
`hidden` 은 *이 사용자에게 없는 컬럼이다*(설정 창에도 없다).

## 2. 컬럼 유형 — 13종

**AG Grid 내장 9종을 전부 쓰고 커스텀 넷을 더한다.**

| 타입 | 기본 에디터 | 비고 |
|---|---|---|
| `text` | `text` | **긴 텍스트는 에디터로 가른다** — `largeText` · `textModal` |
| `number` | `number` | |
| `bigint` | `text` | **API 가 문자열로 내려야 의미가 있다** |
| `boolean` | — | **직접 쓰지 않는다.** `ynFlag` 로 감싼다 |
| `date` · `dateTime`(+`String`) | `date` | **AntD 달력** — 필터와 같은 것 |
| `object` | — | **쓰지 않는다** |
| **`ynFlag`** | **`switch`** | DB 가 `CHAR(1) 'Y'/'N'` 이다. **체크박스가 아니다** |
| **`code`** | `select` · `richSelect` | 표시는 코드명, 저장은 코드값 |
| **`popupRef`** | `popupRef` | 한 번 골라 여러 칸을 채운다 |
| **`list`** | `listModal` | **배열을 담는다** |

> **닫힌 집합이 아니라 *늘리는 조건이 있는* 집합이다.** 여기는 업무 도메인을 가리지 않는
> 베이스이므로 *"지금 화면에 사례가 없다"* 는 막는 근거가 아니다. **늘릴 때 지킬 것은 둘** —
> ① **Enterprise 기능에 기대지 않는다** ② **표시 형식은 타입이 아니라 `renderer` 다**
> (통화·퍼센트·전화번호는 새 타입이 아니다).

> **타입 목록에 미구현을 넣지 않는다.** 선언할 수 있는데 어댑터가 모르는 값이 있으면
> **조용히 무시**되고, 화면 개발자는 **자기가 오타를 냈는지 미구현인지 알 수 없다.**
> 늘리는 자리는 **그것을 처음 요구하는 화면**이다.

**날짜 에디터는 타입이 고른다.** 판의 기본은 텍스트 칸이라 그대로 두면 사람이
`2026-08-31` 을 손으로 치는데 **형식이 틀리면 조용히 값이 되지 않는다.**

## 3. 동적 컬럼 — **컬럼 자체가 데이터에서 온다**

컬럼 집합을 조회 결과가 정하는 표다. 값이 행의 필드가 아니라 **맵의 한 칸**이다.

```ts
{ field: 'ref.PARENT',   // 없는 필드다 — derive·patch 가 메운다
  header: '상위 창고',    // MSG 키가 아니다. 이름의 원본이 데이터라 시드에 키가 없다
  dynamic: true, type: 'text', width: 140, editable: true,
  derive: (row) => row.refs?.PARENT ?? '',
  patch:  (row, v) => ({ refs: { ...row.refs, PARENT: String(v) } }) }
```

- **셋이 다 있어야 한다.** `dynamic` 이 빠지면 `header` 를 메시지 키로 읽어 **키 문자열이
  화면에 나오고**, `derive` 가 빠지면 셀이 비며, **`patch` 가 빠지면 고친 값이 없는
  필드에 얹혀 저장 본문으로 나간다** — 셋 중 이것만 조회에서 안 드러난다.
- **`field` 에 충돌하지 않을 접두를 붙인다**(`ref.`). 실제 필드와 같은 이름이면
  `derive` 없이도 값이 보여 **`patch` 를 잊은 것이 끝까지 숨는다.**
- **폭을 반드시 준다** — 개수가 데이터마다 달라 기본값에 맡기면 표가 다르게 접힌다.
- 실물: `shared/grid/columnDefs.test.ts` 의 `동적 컬럼` · `features/code`.

> **2026-09-05 에 세웠다.** 그전에는 계약이 **테스트에만** 있었고 `types.ts` 가 이 문서를
> 가리키는데 여기 없었다. 재현 **둘 다** 그 테스트를 열어 알아냈다.

## 관련

- [grid-validation.md](./grid-validation.md) — 정렬과 필터 · 편집 · 검증 · 마스터-디테일
- [declarations.md](./declarations.md) — 컬럼 36 · 필드 15 · prop 22 의 전량
- [grid.md](./grid.md) — 화면 뼈대 · `api` 선언 · 저장 흐름
