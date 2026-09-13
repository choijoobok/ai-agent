---
id: LLM-PLY-001
title: "단일 그리드 화면 — 조회 · 저장 · 실행"
category: playbook
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/modules/sample/features/singleoffset/", "sources/frontend/src/modules/sample/features/singlecursor/", "sources/backend/modules/sample/src/main/java/com/aiagent/sample/api/singleoffset/", "aidd-guide/playbook/INDEX.md"]
tier: 2
tags: [playbook, crud, grid, paging]
---

# 단일 그리드 화면 — 조회 · 저장 · 실행

> **실물 둘**: `modules/sample/features/singleoffset/`(①) · `modules/sample/features/singlecursor/`(②).
> **여는 것부터 한다** — 이 문서는 그 파일에서 *무엇을 왜 그렇게 골랐는지* 만 적는다.
>
> 컴포넌트 계약은 [standard/frontend/grid.md](../standard/frontend/grid.md) 가 갖는다.

## 1. 먼저 정하는 것 — 페이징 모드

| 묻는다 | 답 | 모드 |
|---|---|---|
| 사용자가 **몇 건인지** 알아야 하나 | 그렇다 | **`offset`** — 기본이다 |
| 표가 **대용량 이력**이라 `COUNT` 가 부담인가 | 그렇다 | **`cursor`**(§6) |
| 코드·설정처럼 **전건이 한 화면**인가 | 그렇다 | `all` — 디테일 그리드가 주로 쓴다 |

**모드는 엔드포인트가 정한다.** 같은 표를 오프셋으로도 커서로도 읽을 수 있고, ①②가 바로
**같은 `SMPL_ORDER` 에 모드가 다른 엔드포인트 둘**을 둔 시연이다. 표를 나누지 않는다 —
나누면 *모드가 데이터의 성질* 처럼 읽힌다.

## 2. 백엔드 — 화면이 무엇을 그리는지가 엔드포인트를 가른다

```
SmplOrderFullRow          응답 행 — 화면이 그리는 컬럼만
SampleOrderSpec           화이트리스트 — 조회조건이 걸 수 있는 필드
SampleQueryService        조회 (클래스 readOnly)
SampleOrderService        명령 (쓰기 메서드마다 @Transactional)
SampleSingleOffsetController  /api/service/sample/getOrderOffsetList
```

- **같은 표라도 투영이 다르면 경로를 나눈다.** ①은 서른을 그리고 ③은 아홉을 그린다 —
  하나로 합치면 **아홉만 그리는 화면의 저장이 나머지 스물하나를 지운다.**
- **부분집합이면 나누지 않는다.** ④는 ③이 싣는 아홉 중 셋만 그리므로 ③의 경로를 그대로
  쓴다. 새 경로의 근거는 *투영이 다름* 또는 *대상이 다름* 이지 *화면이 다름* 이 아니다.
- **자식 표는 조인하지 않고 한 번에 따로 읽어 붙인다.** ①의 태그가 그렇다 — 조인하면
  행이 태그 수만큼 불어나 `LIMIT` 이 주문이 아니라 **태그를 센다.**

## 3. 화면 — 조각 다섯

```tsx
<FillColumn>
  <SearchForm handleRef={searchForm} fields={searchFields}
              onSubmit={() => void controller.read()}
              onReset={controller.clearFilters}
              onActiveCountChange={header.onActiveCountChange}
              collapsed={header.collapsed} />
  <div style={{ flex: 1, minHeight: 0 }}>
    <DataGrid controller={controller} controls={controls} deletable={deletable} />
  </div>
</FillColumn>
```

| 조각 | 선언 | 두는 곳 |
|---|---|---|
| 조회조건 | `buildSearchFields()` | 파일 아래쪽 함수 |
| 컬럼 | `buildColumns()` | 〃 (`useMemo` 로 한 번만) |
| `api` | `read` · `save` · `actions` | `useMemo` |
| 컨트롤러 | `useGridController({ menuCd, columns, api, params, addRow, toSaveRow })` | |
| 컨트롤 | `controls` — `beforeRead` 좌 · `beforeTools` 우 | `useMemo` |

**`useMemo` 를 습관으로 두지 않는다 — 근거가 있다.** 컬럼 선언과 `deletable` 이 매 렌더
새 객체가 되면 셸이 다시 그릴 때마다 선언이 재계산되어 **사용자가 끌어 놓은 컬럼 폭이
흔들린다.**

### 조회조건이 아닌 것을 조회조건에 두지 않는다

①의 *표시 범위*(전체/내 것)는 `controls` 의 `beforeRead` 셀렉트다. 조회조건 칸으로 두면
**검색 폼이 접혀 있을 때 보이지 않는 곳에서 그리드의 뜻이 바뀐다.**

**컨트롤이 컨트롤러를 직접 부르지 않는다.** 고른 값은 `searchParams` 로 흘려보낸다 —
부르면 셀렉트 하나가 그리드의 미저장 편집을 말없이 버릴 수 있다.

## 4. 저장 — `toSaveRow` 가 인가 경계다

```ts
toSaveRow: (row) => ({
  rowState: row.state,
  ordId: row.data.ordId,
  ...(row.state === 'D' ? {} : { /* 고칠 수 있는 컬럼만 */ }),
})
```

**행 하나만 바꾸고 배열은 배관이 만든다.** 화면이 배열을 만들면 서버가 준 행 순번을
믿을 수 없어 **서버 오류가 셀에 꽂히지 않는다**
([standard/frontend/save-errors.md](../standard/frontend/save-errors.md) §3).

| 보내지 않는다 | 왜 |
|---|---|
| **파생**(`ordAmt` · `vatAmt`) | 서버가 계산한다. 보낼 경로를 두면 **화면이 금액을 스스로 정한다** |
| **운영·시스템**(`lockYn` · `srcSysCd` · `errMsg`) | **잠긴 주문이 스스로 잠금을 푸는 요청**이 성립한다 |
| **감사 넷** | 서버가 쓴다 |
| 삭제 행의 본문 | 대상만 가리킨다 — 보내면 서버가 **쓰지 않을 값을 검증**한다 |

**화면에서 읽기 전용인 것과 요청이 조작될 수 없는 것은 다르다.** 컬럼 선언에 `editable`
이 없는 것으로는 요청을 막지 못한다.

**신규 행의 키는 `null` 이다** — 채번은 서버가 한다. 화면이 정하면 두 사람이 같은 번호를
만든다.

**커밋 경계를 함께 고른다** — 열 건 중 셋이 걸렸을 때 일곱도 되돌릴 것인가. 되돌리지
않기로 했으면 `perRow: { after: … }` 를 선언하며 **기본값이 없다**: 고르지 않으면
컴파일이 안 된다 → [standard/backend/row-transaction.md](../standard/backend/row-transaction.md) §7.
①의 저장이 그 실물이다(`keepFailed` — 고쳐 낼 것이 화면에 남는다).

**건별이면 채번은 그 행의 검증을 통과한 뒤다.** 앞에서 돌리면 틀린 행이 번호를 먹고, 그
번호는 행이 되돌아가도 살아나지 않아 **아무 주문도 갖지 못한 채 버려진다** — 그렇게 생긴
구멍은 정상이다: 키는 **식별자이지 연번이 아니다**.

## 5. 실행 — 두 갈래로 갈린다

| | 응답이 곧 끝 | 오래 걸린다 |
|---|---|---|
| 예 | ①의 *확정* | ①의 *일괄 재계산* |
| `target` | `'selected'` | `'none'` 또는 `'all'` |
| 인자 | 없다 | `params: () => openParams({...})` — [modal.md](./modal.md) |
| 응답 | 결과 요약(토스트) | `jobId` |
| 선언 | — | **`progress: true` 한 줄** |
| 커밋 경계 | 고른다 — `perRow`(①의 *확정* 은 `reload`) | **선언하지 못한다** — 돌려줄 결과가 없다 |

- **화면이 폴링 코드를 쓰지 않는다.** 주기·중단 조건·실패 처리가 화면마다 갈리면 **같은
  기능이 화면 수만큼** 생긴다 — 계약은 [standard/frontend/progress.md](../standard/frontend/progress.md).
- **짧은 일에 진행률을 붙이지 않는다.** 창이 떴다가 바로 닫혀 *무언가 잘못됐나* 로 읽힌다.
- **건별과 진행률을 함께 켜지 못한다.** 켜면 진행률이 이기고 `perRow` 는 무시된다 →
  [standard/backend/row-transaction.md](../standard/backend/row-transaction.md) §7.
- **`eligible` 로 거르는 것은 UX 이고 판정은 서버다.** 화면에서 걸러도 서버 게이트는 남는다.
- **`target: 'all'` 은 *전체* 가 아니라 *지금 그리드에 들어 있는 행* 이다.** 대상이 화면과
  무관하면 `'none'` 이다 — `'all'` 로 두면 서버가 **읽지도 않을 판 하나**를 매번 받는다.
- **모달이 있으면 `confirm` 을 함께 두지 않는다** — 같은 것을 두 번 묻는다.
- **`toTargets` 는 모양만 바꾼다.** 봉투의 이름은 `targets` 로 고정이며, 여기서
  `{ ordIds: [...] }` 를 돌려주면 몸통이 이중으로 감싸여 서버의 `@NotEmpty` 에 걸리고
  화면에는 **고른 행이 분명히 있는데** *입력값을 확인하세요* 만 뜬다.

## 6. 커서형이 갈리는 것 넷 — ②

| | 오프셋 | **커서** |
|---|---|---|
| 총 건수 | 있다 | **없다** — `COUNT` 를 돌지 않는 것이 이 모드의 값이다 |
| 네비 | 페이지 번호 | **`‹ 이전 · 다음 ›`** — 몇 장인지 셀 수 없고 *마지막* 도 말하지 않는다 |
| 정렬 | 여럿 | **한 컬럼만** — 둘 이상이면 서버가 400 이다. 바꾸면 커서를 버리고 첫 장 |
| 기간 | 선택 | **필수** — 대용량 이력의 규약 |

**푸터의 빈 자리를 `footerNote` 가 메운다**(*최근 N일*). 무엇을 물어서 나온 N건인지가 함께
있어야 *전부가 N건* 으로 읽히지 않는다.

## 7. 커밋 전 체크리스트

- [ ] `endpoints.ts` 의 이름이 **컨트롤러 메서드명 그대로**인가
- [ ] `screenRegistry.ts` 와 `menu-tree.yaml` 에 **경로가 양쪽 다** 있는가
- [ ] `./gradlew generateSeeds` 를 돌리고 CSV 를 **같은 커밋**에 담았는가
- [ ] 한글 문자열이 소스에 없는가(ESLint 가 막지만 `MSG` 키의 **값**은 changeset 이다)
- [ ] `documents/screen/{경로}/` 셋이 소스와 일치하는가

## 관련

- [standard/frontend/grid.md](../standard/frontend/grid.md) · [grid-columns.md](../standard/frontend/grid-columns.md) · [search-form.md](../standard/frontend/search-form.md)
- [standard/backend/search-spec.md](../standard/backend/search-spec.md) — 화이트리스트와 빌더
- [standard/backend/progress.md](../standard/backend/progress.md) · [standard/frontend/progress.md](../standard/frontend/progress.md) — 진행률
- [modal.md](./modal.md) — 실행 인자 모달 · 참조 팝업
- [changeset.md](./changeset.md) — 문구와 코드를 넣는다
