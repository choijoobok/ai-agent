---
id: LLM-PLY-005
title: "엑셀 — 내려받기 세 갈래 · 올려받기 탭"
category: playbook
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/shared/grid/excel/", "sources/frontend/src/shared/excelupload/", "sources/frontend/src/features/sample/excel/", "sources/frontend/src/features/sample/mdvertical/pages/SampleMdVerticalPage.tsx"]
author: Bong Jong Hyeon
tier: 2
tags: [playbook, excel, upload, download]
---

# 엑셀 — 내려받기 세 갈래 · 올려받기 탭

> **실물**: 내려받기 서버 생성은 `features/sample/mdvertical/`(③), 올려받기는
> `features/sample/excel/`(⑥). 공통물은 `shared/grid/excel/` · `shared/excelupload/`.
>
> **파일 이름이 `excel-download.md` 였다** — 실제로 갈리는 축은 *다운로드/업로드* 이지
> 다운로드 안이 아니라서 이름을 바꿨다(ID 는 그대로).

## 1. 내려받기 — 선언하지 않는 것이 기본이다

**아무것도 적지 않으면 프론트가 만든다.** 그리드가 그리는 표가 곧 내려받을 표이므로
왕복이 **0** 이다. ①②는 그래서 엑셀 선언이 아예 없다.

| 갈래 | 언제 | 선언 |
|---|---|---|
| **프론트 생성**(기본) | 화면의 표 = 파일의 표 | 없음 |
| **서버 생성** | 화면의 표 ≠ 파일의 표 | `excel.page` · `excel.all` |
| **화면 고유 항목** | 조회로는 낼 수 없는 표 | `excel.extra[]` |

```ts
const excel = useMemo<ExcelSpec>(() => ({
  page: { url: E.exportOrderPage, body: () => ({ ordNos: master.rows.map((r) => r.data.ordNo) }) },
  all:  { url: E.exportOrderAll,  body: () => ({ conditions: searchForm.current?.collect() ?? [],
                                                 sorts: [], page: { page: 0, size: 1000 } }) },
  extra: [{ key: 'noItem', label: MSG.SAMPLE_EXCEL_NO_ITEM, server: { url: E.exportOrderNoItem } }],
}), [master.rows]);
```

- **이름은 그대로 두고 경로만 서버로 돌린다.** 사용자에게는 여전히 *현재 페이지* · *전체*
  이며 **어느 경로인지 알 필요가 없다.**
- **`body` 는 화면이 만든다.** 조회조건을 자동으로 싣지 않는다 — 이 갈래의 정의가 *그리드와
  다른 조회* 라 무엇이 조건인지는 **그 API 만 안다.** 짐작해 실으면 서버가 모르는 필드가
  가고 그 요청은 **조용히 조건 없이** 처리된다.
- **`page` 를 서버로 돌리는 일은 드물다.** 현재 페이지는 이미 브라우저에 있다. 자리를 두는
  것은 **상단-하단을 조인해 한 장으로 내리는 화면** 때문이다.
- **`extra` 는 서버 생성만 받는다.** 프론트에서 만들 수 있는 것은 기본 둘이 이미 덮으며,
  여기에 프론트 갈래를 열면 *고른 행만* 같은 항목이 생기는데 **다운로드 이력의 `scope` 가
  그것을 표현하지 못한다**(`PAGE`·`ALL` 둘뿐이다).
- **`extra` 는 구분선 아래에 선언 순서로 선다** — 기본 둘과 섞이지 않는다.
- **가공이 곧 실행인 항목은 `actionCd: 'EXECUTE'`** 다. `EXPORT` 로 묶으면 *내려받기만
  되는 사람* 이 그 계산을 돌린다.

> **화면 고유 버튼(`controls`)으로 엑셀을 하나 더 두지 않는다.** 사용자가 **같은 뜻의
> 버튼을 두 자리에서** 만나고, 차이는 **파일을 열고 나서** 드러난다.

### `EXPORT` 권한은 메뉴가 선언한다

프론트 생성이면 서버 경로가 없어 **인가 시드가 만들어질 입력이 없다.** `menu-tree.yaml` 의
`export: true` 가 그 자리다 — 적지 않으면 **아무도 그 권한을 갖지 못한다.**

## 2. 올려받기 — 업로드가 아니라 읽기다

**파일이 서버에 올라가지 않는다.** 브라우저가 읽어 **그리드에 붓는다.**

| 그래서 | |
|---|---|
| 업로드 엔드포인트 | **없다** |
| `SYS_FILE` | 아무것도 남지 않는다 |
| 저장 | **업무 탭과 같은 `save`** — 새 경로를 만들지 않는다 |

## 3. 최상단 탭 둘이 **같은 것 셋**을 나눠 쓴다

```tsx
<ExcelUploadTab<SampleOrderItem>
  columns={columns} keyFields={ITEM_KEY_FIELDS}
  read={readApi} save={saveApi} toSavePayload={toSavePayload} handleRef={upload} />
```

| 공유하는 것 | 갈리면 |
|---|---|
| **컬럼 배열** | *전체 다운로드* 가 **양식이 아니게 된다** |
| **조회 API** | *화면이 보는 표* 와 *대조하는 표* 가 달라져 **이미 있는 행이 신규로** 잡힌다 |
| **저장 API + `toSavePayload`** | 같은 표에 규칙이 둘 생기고, **그 둘은 반드시 갈린다** |

**`toSavePayload` 를 인자로 받는 것이 결정이다.** 컴포넌트가 스스로 만들면 서버가 **파생
컬럼과 감사 컬럼까지** 받게 되어 업무 탭이 보내는 것과 갈린다 — 같은 경로에 두 가지 요청이
도착한다. **넘기지 않으면 저장이 조용히 아무 일도 하지 않는다.**

## 4. 미리보기가 곧 행 상태다

읽은 뒤 **같은 조회 API 를 한 번** 불러 기존 행과 대조한다.

| 대조 결과 | 상태 |
|---|---|
| DB 에 없다 | `C` |
| 있고 값이 다르다 | `U` |
| 있고 같다 | **상태 없음** — 나가지 않는다 |
| 파일에서 줄이 빠졌다 | **`D` 가 생기지 않는다** |

- **412행에서 세 줄만 고쳤으면 나가는 것도 세 줄이어야 한다.** 전량을 보내면 감사 컬럼이
  전부 갱신되어 *누가 언제 무엇을 고쳤나* 를 잃는다.
- **삭제는 업무 탭의 삭제 컬럼이다.** 파일에서 줄을 지운 것과 *"지워라"* 를 구별할 방법이
  없다.
- **키는 `keyFields` 를 유닛 구분자(`U+001F`)로 이어 붙인다.** 콤마·하이픈이면 `A,B`+`C` 와
  `A`+`B,C` 가 같은 키가 되어 **다른 두 행이 하나로 대조된다.**

## 5. 거절은 통째로 한다

헤더가 다르거나 행이 상한을 넘으면 **읽지 않는다.**

- **조용히 자르면** 사용자는 *올린 것이 다 들어간 줄* 안다.
- **열이 밀린 채 읽으면** 수량 자리에 단가가 들어간 파일이 **저장까지 통과한다.**

## 6. 업로드 탭에 조회 버튼이 없다

행이 서버가 아니라 **파일**에서 오므로 부를 곳이 없고, 눌리면 **읽어들인 412행이 통째로
날아간다.** 그래서 `read` 를 컨트롤러의 `api` 가 아니라 **컴포넌트의 인자**로 받는다 —
`api.read` 에 선언하면 버튼이 선다.

## 7. 화면 안 최상단 탭 — 옮기기 전에 묻는다

```ts
const dirtyOf = (key) => key === TAB_UPLOAD ? (upload.current?.dirty() ?? false) : business.dirty;
// <ScreenTabs menuCd={MENU_CD} items={items} value={tab} onChange={setTab} dirty={dirtyOf} />
```

- **하단 디테일 탭과 규칙이 다르다** — 저기는 한 화면 안의 부분이 갈리고 여기는 **화면
  전체**가 갈린다([master-tabs.md §8](./master-tabs.md)).
- **물음은 `ScreenTabs` 가 낸다.** 화면은 *지금 어느 쪽이 미저장인가* 만 답한다.
- **`dirty` 가 함수인 것은 *지금* 을 물어야 하기 때문이다** — 불리언으로 올리면 매 편집마다
  화면 전체가 다시 그려진다.
- **탭 항목에 `actionCd` 를 준다.** 업로드 탭의 액션이 저장 하나뿐이라 `S` 가 없으면 항목이
  아예 없다. **남는 항목이 하나면 컨트롤 자체를 내지 않는다.**
- **조회조건 폼은 탭 *안*에 둔다.** 밖에 두면 **쓰지 않는 탭에서도 보인다.**

## 8. 양식 그리드는 개인화를 열지 않는다

```tsx
<DataGrid ... settings={false} />
```

이 그리드의 컬럼은 사용자의 표가 아니라 **양식**이다. 하나를 감추거나 순서를 바꾸면 *전체
다운로드* 가 그 상태로 나가고 **자기가 방금 내려받은 파일을 업로드가 거절한다.**

## 9. 커밋 전 체크리스트

- [ ] 프론트 생성으로 충분한데 서버 경로를 만들지 않았는가
- [ ] 서버 생성이면 `body` 가 **그 API 가 아는 것만** 싣는가
- [ ] 프론트 생성만 쓰는 화면에 `menu-tree.yaml` 의 `export: true` 가 있는가
- [ ] 업로드 탭과 업무 탭이 **컬럼·조회·저장·페이로드 넷을 공유**하는가
- [ ] 양식 그리드에 `settings={false}` 가 있는가

## 관련

- [crud-screen.md](./crud-screen.md) · [master-detail.md](./master-detail.md)
- [master-tabs.md §8](./master-tabs.md) — 두 탭의 규칙 차이
- [standard/frontend/grid.md](../standard/frontend/grid.md) — 크롬의 자리
