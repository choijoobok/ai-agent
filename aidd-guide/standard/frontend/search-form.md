---
id: LLM-FWK-FE-003
title: "조회조건 — useSearchFormHeader · 필드 하나의 선언"
category: standard/frontend
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/shared/searchform/", "aidd-guide/standard/frontend/search-form.md"]
tier: 1
tags: [frontend, search, form, condition]
---

# 조회조건 — `useSearchFormHeader` · 필드 하나의 선언

> **검색 폼이 있으면 동적형, 없으면 고정형.** 그 선이 곧 폼의 유무다
> ([../backend/search.md §1](../backend/search.md)).
>
> **화면에 남는 폼은 이것 하나다** — 편집 폼도 등록 모달도 없다([grid.md §1](./grid.md)).

## 1. 필드 하나 — 키를 넷으로 묶는다

```ts
{ field: 'creDtm', type: 'dateTime', op: 'between',   // ① 무엇을 묻나
  label: 'log.field.period', span: 8,                 // ② 어떻게 보이나
  defaultValue: { relative: -7, unit: 'day' },
  required: true, maxRange: { days: 31 } }            // ③ 어떻게 검증하나
                                                       // ④ 어떻게 나가나 — 기본이라 생략
```

| 묶음 | 키 | 필수 |
|---|---|---|
| **① 무엇을 묻나** | `field` · `type` · `op` · `ops` | **`field` · `type`** |
| **② 어떻게 보이나** | `label` · `span` · `options` · `codeGroup` | `label` |
| **③ 어떻게 검증하나** | `required` · `maxRange` | — |
| **④ 어떻게 나가나** | `to` · `paramKey` · `scale` | — |

**키를 늘리기 전에 파생을 먼저 본다** — 필요해 보이는 것의 상당수는 **조건의 번역**이며
서버가 갖는다.

**`type` 은 컬럼 계약의 어휘를 그대로 쓴다**([grid-columns.md §2](./grid-columns.md)) —
**새로 만들지 않는다.**

## 2. 서버가 주는 것과 화면이 적는 것

| **생성된다** — `QuerySpec` 에서 | **화면이 적는다** |
|---|---|
| `field` 가 **존재하는가** | `field` 를 **고르는 것** |
| 자바 타입 → **허용 `type` 의 범위** | `type` 을 **그중에서 고르는 것** |
| `nullable` · `sortable` | `op` · `label` · 기본값 · 필수 · 폭 · 순서 · `to` |

> **타입을 생성이 정하지 않고 *제한* 만 하는 이유** — `String` 컬럼 하나가 `text` 일 수도
> `code` 일 수도 `ynFlag` 일 수도 있다. **그것은 화면의 판단**이며 서버가 알 수 없다.
> 다만 `OffsetDateTime` 필드에 `type: 'number'` 를 적으면 **생성물이 막는다.**

## 3. `op` — 사용자가 고른다

**연산자 선택은 검색 폼의 핵심 기능이다.** 화면이 고정하는 것은 **예외**다.

| | |
|---|---|
| **여기는 템플릿이다** | 시스템 화면은 개발자가 필요를 다 알지만, 그 위에 업무 화면을 얹는 프로젝트는 *"이 컬럼을 포함으로 찾고 싶다"* 를 매번 만난다 — 고정이면 **선언을 고쳐 재배포**해야 한다 |
| **서버는 이미 열려 있다** | *"연산자가 타입을 제한한다"* 로 닫혔고 **열셋을 다 받는다.** 좁힌 것은 폼뿐이었다 |
| **화이트리스트가 이미 막는다** | 연산자를 바꿔도 **필드·타입 판정은 그대로**다. 열어서 생기는 위험은 **성능뿐**이다 |

```ts
{ field: 'userNm', type: 'text' }                     // 타입이 허용하는 전부에서 고른다
{ field: 'userNm', type: 'text', op: 'contains' }     // 처음 선택된 것만 지정
{ field: 'userNm', type: 'text', ops: ['contains'] }  // 고정 — 예외
```

> **폼이 지금 낼 수 있는 것은 여덟이다** — `eq`·`ne`·`in`·`startsWith`·`contains`·
> `endsWith`·`isNull`·`isNotNull`. **`in` 은 콤보에만 난다**(다중 선택 컨트롤이라야 값
> 여럿을 받는다). `between` 과 부등호 넷은 **달력·숫자 범위 컨트롤이 함께 와야 한다.**
> **서버는 열셋을 다 받는다.**

## 4. 폼이 하는 일 / 하지 않는 일

### 검증은 폼이 한다 — 그리드는 값을 요청할 뿐이다

| 순서 | |
|---|---|
| ① | 그리드가 폼에 파라미터를 요청 |
| ② | **폼이 검증** — 필수 · `maxRange` · 타입 |
| ③ | 실패면 **폼이 오류를 표시하고 조회하지 않는다** |
| ④ | 성공이면 **봉투를 만들어 넘긴다** |

- 오류 표시는 **칸 아래**다 — 셀 오류와 같은 어휘.
- **서버가 400 을 주면 `fields` 배열이 칸에 다시 붙는다** — 폼이 놓친 것(관계 검증)이
  그 경로로 온다.

### 빈 칸은 보내지 않는다

- **`value: null` 을 보내지 않는다** — *"NULL 인 것을 찾아라"* 와 섞이면 안 된다.
- **Oracle 은 `'' = NULL`** 이다 — 빈 문자열을 보내면 벤더마다 다르게 해석된다.
- **`between` 은 한쪽만 채워도 보낸다** — 단측 조건이다.

### 정렬 필드는 없다

**정렬 기준은 언제나 컬럼이므로 컬럼 위가 맞는 자리다 — 폼에는 컬럼이 없다.**

봉투 넷 중 폼이 만드는 것은 **`conditions` 와 `params` 둘**이고, `sorts` 는 헤더가,
`page` 는 그리드 푸터가 만든다.

### 버튼은 초기화 하나

| | |
|---|---|
| 조회 · 검색 | **없다** — 그리드가 갖는다 |
| **초기화** | 기본값으로 되돌리고 **컬럼 필터도 함께 지운다** |
| **`Enter`** | **조회가 돈다** — 폼을 채우고 손을 옮기지 않는 것이 가장 흔한 동선이다 |

## 5. `to` — `conditions` 인가 `params` 인가

기본은 `conditions` 다. **`params` 로 뺄 때는 키를 함께 적는다**(폼 필드명과 다를 수 있다).
경계는 [../backend/search.md §2.1](../backend/search.md) —
**파생은 값 하나가 들어가고 조각 하나가 나온다. 그 관계가 깨지면 `params`.**

## 6. 저장된 조회조건

**저장하는 것은 와이어가 아니라 폼 값이다.** 와이어를 저장하면 필드 선언이 바뀔 때
**사용자 데이터가 깨진다.** `params` 도 **함께** 저장한다 — 빠지면 복원이 반쪽이 된다.

## 7. 폼처럼 생겼지만 폼이 아닌 것

트리의 *찾아가기* 는 검색 폼이 아니다 — **서버를 부르지 않고 이미 로드된 트리에서
찾아 이동한다.** 같은 컨트롤을 쓰지 않는다.

> **선언 키의 전량은 [declarations.md](./declarations.md) §2 가 갖는다** — 이 문서는
> *어느 키를 왜 고르나* 를 적고 *무엇이 있나* 를 적지 않는다. `grpCd` 처럼 여기 표에
> 없는 키가 있다.

## 관련

- [grid.md](./grid.md) — 조회 버튼이 그리드에 있는 이유
- [grid-validation.md](./grid-validation.md) — 컬럼 필터와의 역할 차이
- [../backend/search.md](../backend/search.md) — 봉투 · 연산자 열셋 · 페이징
