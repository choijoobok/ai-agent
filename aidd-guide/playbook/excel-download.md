---
id: LLM-PLY-005
title: "엑셀 내려받기 — 갈래 넷"
category: playbook
type: operation
created: 2026-05-04
updated: 2026-09-06
status: active
sources: ["sources/frontend/src/shared/grid/excel/", "sources/frontend/src/features/sample/mdvertical/pages/SampleMdVerticalPage.tsx", "sources/backend/support/excel/"]
tier: 2
tags: [playbook, excel, download]
---

# 엑셀 내려받기 — 갈래 넷

> **실물**: 서버 생성은 `features/sample/mdvertical/`(③), 공통물은 `shared/grid/excel/`.
>
> **올려받기는 [excel-upload.md](./excel-upload.md) 가 갖는다.** 한 파일이었다가 200줄
> 상한에 닿아 갈랐다 — 갈리는 축은 문서가 스스로 적어 둔 그대로 *내려받기/올려받기* 다.

## 1. 선언하지 않는 것이 기본이다

**아무것도 적지 않으면 프론트가 만든다.** 그리드가 그리는 표가 곧 내려받을 표이므로
왕복이 **0** 이다. ①②는 그래서 엑셀 선언이 아예 없다.

| 갈래 | 언제 | 선언 |
|---|---|---|
| **프론트 생성**(기본) | 화면의 표 = 파일의 표 | 없음 |
| **서버 생성** | 화면의 표 ≠ 파일의 표 | `excel.page` · `excel.all` |
| **화면 고유 항목** | 조회로는 낼 수 없는 표 | `excel.extra[]` |
| **아예 없다** | 이 표는 파일로 나가면 안 된다 | **`excel={false}`** |

**넷째는 메뉴의 `EXPORT_YN` 과 다른 자리다.** 저쪽은 *이 메뉴에서 내려받을 수 있나* 라
메뉴 하나에 하나뿐인데, **마스터-디테일은 한 메뉴에 그리드가 둘**이라 하단만 막을 자리가
없었다 — *"요건서가 없어야 한다는데 끄는 수단이 없다"* 로 막히는 자리였다.

**쓸 자리는 좁다** — 개인정보처럼 *화면으로 보는 것은 되지만 파일로 나가면 안 되는* 표에
쓴다. **마스터에 딸린 목록이라는 이유로는 끄지 않는다**: 그것은 내려받으면 안 되는
이유가 아니고, 지금 저장소의 마스터-디테일 화면 중 하단을 막아야 하는 것은 하나도 없다.

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

## 2. 커밋 전 체크리스트

- [ ] 프론트 생성으로 충분한데 서버 경로를 만들지 않았는가
- [ ] 서버 생성이면 `body` 가 **그 API 가 아는 것만** 싣는가
- [ ] 프론트 생성만 쓰는 화면에 `menu-tree.yaml` 의 `export: true` 가 있는가

## 관련

- [excel-upload.md](./excel-upload.md) — 올려받기 탭. **양식이 곧 전체 다운로드다**
- [crud-screen.md](./crud-screen.md) · [master-detail.md](./master-detail.md)
- [standard/frontend/grid.md](../standard/frontend/grid.md) — 크롬의 자리
