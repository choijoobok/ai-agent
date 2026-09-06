---
id: LLM-PLY-002
title: "마스터-디테일 화면 — 상하 · 좌우"
category: playbook
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/features/sample/mdvertical/", "sources/frontend/src/features/sample/mdhorizontal/", "aidd-guide/playbook/INDEX.md"]
tier: 2
tags: [playbook, master-detail, splitpane]
---

# 마스터-디테일 화면 — 상하 · 좌우

> **실물 둘**: `features/sample/mdvertical/`(③ 상하) · `features/sample/mdhorizontal/`(④ 좌우).
> 갈리는 것은 **축과 마스터 컬럼 수**뿐이고 나머지는 같다.
>
> 단일 그리드의 모든 규칙이 그대로 적용된다 — [crud-screen.md](./crud-screen.md) 를 먼저 읽는다.

## 1. 축은 데이터가 정한다 — 고르는 것이 아니다

| 마스터 컬럼 | 축 | 실물 |
|---|---|---|
| 대여섯 이상(③은 아홉) | **상하** | `mdvertical/` |
| 서넛(④는 셋) | **좌우** | `mdhorizontal/` |

**토글로 두지 않는다.** 한 화면에서 축을 바꾸면 **같은 마스터가 두 축을 오간다.** 좁은
마스터를 상하에 두면 넓은 빈칸이 남고, 넓은 마스터를 좌우에 두면 **왼쪽이 가로 스크롤되어
나눈 이유가 사라진다.**

## 2. 컨트롤러가 둘이다 — 저장 단위도 둘이다

```ts
const master = useGridController<SampleOrder>({ menuCd, columns: masterColumns, api: masterApi,
                                                params: collectConditions, addRow, toSaveRow });
const detail = useGridController<SampleOrderItem>({ menuCd, columns: detailColumns, api: detailApi,
                                                    searchParams: detailSearchParams, addRow, toSaveRow,
                                                    saveEnvelope: (rows) => ({ ordId, rows }) });
```

- **저장 버튼이 그리드마다 따로다.** 묶으면 *품목만 고쳤는데 주문도 갱신됨* 이 되어 **감사
  컬럼이 거짓말을 한다.**
- **디테일의 대상은 `searchParams` 다 — `conditions` 가 아니다.** 부모 키는 *구조* 이지
  *사용자가 좁힌 것* 이 아니다.
- **부모 키는 `useRef` 로 든다.** 선택이 바뀌는 것과 조회가 나가는 것 사이에 렌더가 끼면
  `useState` 값은 아직 옛것이다.

## 3. 선택 — 거부할 수 있어야 한다

```ts
const selectOrder = async (row) => {
  if (detail.dirty && !(await confirmDiscard())) return false;   // ← 판의 선택이 되돌아간다
  setSelected(row);
  if (!row || row.state === 'C') { selectedOrdId.current = null; detail.setRows([]); return true; }
  selectedOrdId.current = row.data.ordId;
  await detail.read(true);
  return true;
};
```

| 규칙 | 없으면 |
|---|---|
| **화면이 묻는다** — 그리드가 아니다 | 물음의 결과를 화면이 알 수 없어 **선택을 받아들일지 정하지 못한다** |
| **거부권이 있다**(`false` 를 돌려준다) | *보고 있는 것* 과 *고른 것* 이 갈리고, 그 상태로 저장하면 **A 의 품목이 B 로 나간다** |
| **신규 행(`C`)은 빈 상태다** | 부모 키가 아직 DB 에 없다 — 붙이려 하면 **FK 위반** |
| **마스터 조회는 아래를 리셋한다** | 이전에 보던 행이 결과에 없을 수 있다 — **다른 주문의 품목을 그 주문 것으로 본다** |

**디테일의 행 추가에도 게이트가 있다** — `addRow.canAdd` 가 부모 선택을 요구한다.

## 4. 마스터 삭제 게이트 — 근거는 마스터 응답에 있어야 한다

```ts
const masterDeletable = useMemo<DeleteColumnSpec<SampleOrder>>(() => ({
  enabled: (row) => row.data.itemCnt === 0 && !row.data.lockYn,
  reason: (row) => row.data.lockYn ? label(MSG.SAMPLE_LOCKED)
                                   : label(MSG.SAMPLE_DELETE_BLOCKED, { count: row.data.itemCnt }),
}), []);
```

**게이트가 건수 컬럼에서 나온다** — 마스터 응답이 자식 건수를 실으므로 **행마다 답할 수
있다.** 아래를 조회해야만 아는 것이면 게이트가 아니다.

> **건수를 싣는 것이 늘 옳지는 않다.** ①은 싣지 않고 **서버가 사유를 담아 거절한다** —
> 컬럼 서른짜리 조회에 `group by` 가 한 벌 더 붙기 때문이다. **화면의 주제가 무엇이냐**로
> 갈린다: 레이아웃이면 건수를 싣고, 컬럼이면 서버에 맡긴다.

## 5. `SplitPane` — 선언 넷

```tsx
<SplitPane
  storageKey="smplMdVert"                          {/* 개인화의 키 */}
  first={(collapsed, expand, axis) => (
    <DataGrid gridId="master" controller={master} deletable={masterDeletable}
              onSelect={selectOrder} collapsed={collapsed} collapsedAxis={axis} onExpand={expand} />
  )}
  second={(collapsed, expand, axis) => (
    <DataGrid gridId="detail" controller={detail} titleSuffix={detailSuffix}
              disabled={selectedOrdId.current === null} ... />
  )}
/>
```

| prop | 왜 |
|---|---|
| **`gridId`** | 개인화의 키다. **같으면 위아래 설정이 서로를 덮는다** |
| **`titleSuffix`** | 디테일은 **자기가 누구의 것인지 말하지 못한다** — 부모 컨트롤러에서 온다 |
| **`disabled`** | 대상이 없으면 버튼이 통째로 잠긴다. 탭이 아니라 **버튼**이다 |
| **`collapsed`·`collapsedAxis`·`onExpand`** | 접힘은 `SplitPane` 이 갖고 그리드는 **전달만** 한다 |

**축은 `SplitPane` 이 판단한다** — 화면이 `direction` 을 적지 않는다. 세로 제목
(`writing-mode`) · 접힘 세로 띠는 **좌우에서만** 나는 것이라 그 축의 화면이 상시 렌더되어야
회귀가 잡힌다(④가 존재하는 이유의 절반이다).

## 6. 디테일에만 조회 버튼을 붙이는 자리 — ④

```tsx
onRead={() => void detail.read(true)}
```

왼쪽 조회를 누르면 **고른 주문을 잃는다.** *품목만 새로 보고 싶다* 는 그것과 다른 일이라
아래에 자기 조회를 준다. ③에는 없다 — 상하는 마스터가 넓어 다시 고르는 비용이 낮다.

## 7. 갈리지 않아야 하는 것

- **디테일의 컬럼 선언을 공유한다** — ③④가 `features/sample/itemColumns.ts` 하나를 쓴다.
  갈려야 하는 것은 **마스터와 축**이지 자식의 정의가 아니다.
- **부분집합이면 엔드포인트를 새로 열지 않는다**(④는 ③의 아홉 중 셋만 그린다).
- **조회조건도 같다** — ③④가 같은 넷이다.

## 8. 커밋 전 체크리스트

- [ ] `gridId` 가 둘 다 있고 서로 다른가
- [ ] 선택 핸들러가 **`Promise<boolean>`** 을 돌려주는가(거부권)
- [ ] 마스터 조회가 디테일을 리셋하는가
- [ ] 신규 마스터 행에서 디테일이 **빈 상태**가 되는가
- [ ] [crud-screen.md §7](./crud-screen.md) 의 체크리스트

## 관련

- [master-tabs.md](./master-tabs.md) — 자식 표가 둘 이상이면
- [standard/frontend/grid-advanced.md](../standard/frontend/grid-advanced.md) §6
- [excel-download.md](./excel-download.md) — ③이 서버 생성 엑셀의 실물이다
