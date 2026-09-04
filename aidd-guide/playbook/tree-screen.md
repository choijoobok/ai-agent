---
id: LLM-PLY-007
title: "트리 화면 — 계층을 보여주고 고치는 판"
category: "11-playbook"
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: ["sources/frontend/src/features/menu/pages/MenuTreePage.tsx", "sources/frontend/src/features/roleauth/", "sources/frontend/src/features/userauth/", "sources/frontend/src/shared/tree/"]
author: Bong Jong Hyeon
tier: 2
tags: [playbook, tree, splitpane, authz, menu]
---

# 트리 화면 — 계층을 보여주고 고치는 판

> **실물 셋** — `features/menu/`(드래그로 계층을 고친다) ·
> `features/roleauth/`(역할에 권한을 준다) · `features/userauth/`(사람에게 권한을 준다).
>
> **샘플이 없다.** 여섯은 그리드 화면을 덮고 트리는 덮지 않는다 — 그래서 이 레시피가
> 다른 여섯보다 길다. 새 트리 화면은 **위 셋 중 가장 가까운 것을 연다.**

## 1. 그리드가 아니다 — 없는 것부터 안다

| 그리드에 있는 것 | 트리에서 | 왜 |
|---|---|---|
| 페이징 | **없다** | 계층은 잘리면 뜻을 잃는다. **전건을 한 번에 받는다** |
| 조회조건 폼 | **없다**(찾아가기 칸은 다르다) | 거르면 부모가 사라져 자식이 뜬다 |
| 컬럼 정렬·필터 | **없다** | 순서가 곧 데이터다 |
| `useGridController` | **`useQuery`** | 컨트롤러의 절반이 죽은 채 붙는다 |

- **`useGridController` 를 쓰지 않는 것이 결정이다.** 조건·정렬·페이징·행 상태가 전부
  해당 없음이라, 쓰면 *왜 여기서만 안 되나* 를 다음 사람이 묻는다.
- **찾아가기 칸(`search`)은 조회가 아니다.** 서버에 가지 않고 **이미 받은 트리에서
  강조하고 펼친다**(`highlighted` · `focusedId`).

## 2. 서버 계약 — 평면으로 준다

```java
public PageResponse<XxxTreeRow> getMenuTree(String roleId, String lang)
```

- **행은 평면이고 부모를 `upMenuCd` 로 가리킨다.** 중첩 JSON 으로 주지 않는다 —
  깊이가 바뀌면 응답 타입이 바뀌고, 부분 갱신이 불가능해진다.
- **`PageResponse` 를 그대로 쓰되 페이징하지 않는다.** 응답 봉투를 화면마다 갈라 두면
  `content` 를 꺼내는 코드가 두 모양이 된다.
- **고아를 감추지 않는다.** `buildTree` 가 부모를 못 찾은 노드를 **뿌리로 올린다**.
  감추면 *데이터에 있는데 화면에 없는 행* 이 생기고, 그것이 가장 찾기 어려운 버그다.

## 3. 행 → 트리 — `shared/tree/treeModel.ts`

| 함수 | 무엇 |
|---|---|
| `buildTree(rows, idOf, parentOf)` | 평면 → `TreeNode[]`. `depth` 는 1부터 |
| `visibleRows(roots, collapsed)` | 접힘을 반영한 표시 순서 |
| `selfAndDescendants(node)` | 자신 ∪ 자손 — **드롭 금지 집합** |
| `heightOf(node)` | 서브트리 높이 — 깊이 한도 검사 |
| `zoneAt(offsetY, height)` | 25% / 50% / 25% → `before` · `inside` · `after` |

**직접 재구현하지 않는다.** 셋이 같은 것을 필요로 해서 여기로 나온 것들이다.

## 4. `<TreeGrid>` 선언

```tsx
<TreeGrid<XxxTreeRow>
  handleRef={tree}                 // collapseAll · expandAll
  title={label(MSG.…)} menuCd={MENU_CD}
  rows={rows} idOf={…} parentOf={…}
  hierarchyHeader={…} hierarchy={(row, node) => …}   // 계층 칸을 화면이 그린다
  columns={columns}                                   // TreeColumn — header·width·cell
  onRead={…} loading={treeQuery.isFetching}
  save={{ dirty, onSave }}                            // 있으면 저장 버튼이 선다
  search={treeSearch} highlighted={matches} focusedId={focused}
  onDrop={canSave ? onDrop : undefined}               // 없으면 끌 수 없다
  canHaveChildren={…} verdict={…}
  excel={{ fileName, build }} />
```

- **`hierarchy` 를 화면이 그린다.** 아이콘·배지·흐리게가 화면마다 다르고,
  공통물이 그것을 알면 도메인 용어가 `shared/` 로 새어 든다.
- **`columns` 는 `ColumnDef` 가 아니라 `TreeColumn` 이다** — `header` · `width` · `cell` 셋이
  기본이고 편집은 `editable` · `editor` 로 연다. 전량은
  [`06-framework/frontend/declarations.md`](../standard/frontend/declarations.md) 가 아니라
  `shared/tree/types.ts` 가 갖는다(트리는 그리드 어휘를 쓰지 않는다).

## 5. 편집 상태를 화면이 든다

컨트롤러가 없으므로 **행 상태 넷도 없다.** 대신 셋이 같은 모양을 쓴다.

```ts
const original = useMemo(() => toGrantMap(rows), [rows]);        // 서버가 준 것
const [edits, setEdits] = useState<ReadonlyMap<…>>(new Map());   // 사용자가 바꾼 것
const granted = useMemo(() => merge(original, edits), […]);      // 지금 보이는 것
const diff  = useMemo(() => countDiff(rows, original, granted), […]);
const dirty = diff.added > 0 || diff.removed > 0;
```

- **`original` 을 지우지 않는다.** *무엇이 바뀌었나* 를 저장 확인 문구가 물으며,
  바뀐 노드 표시(`dirtyMenus` → 계층 칸의 `✎`)도 여기서 나온다.
- **저장은 전체 집합을 보낸다** — *이 역할의 권한을 보낸 집합으로 맞춘다*. 증분(추가·삭제)으로
  보내면 두 사람이 동시에 고쳤을 때 **합쳐진 적 없는 상태**가 만들어진다.
- **저장 뒤에는 다시 조회한다.** 서버가 파생을 얹어 주므로(정의된 액션·유효 인원)
  화면이 계산한 값을 그대로 두면 갈린다.

## 6. 드래그·드롭 — `menu` 만 쓴다

- **막는 층이 넷이다**: ① 자기·자손(`selfAndDescendants`) ② 자식을 가질 수 없는 노드
  (`canHaveChildren` — 화면이 있는 메뉴는 폴더가 아니다) ③ 깊이 한도(`heightOf`)
  ④ 도메인 판정(`verdict` → `DropVerdict`).
- **거부는 이유와 함께 돌려준다.** `DropVerdict` 가 문구를 갖는 이유이며,
  *그냥 안 됨* 은 사용자가 같은 조작을 반복하게 만든다.
- **권한이 없으면 `onDrop` 을 넘기지 않는다** — 끌리기는 하는데 놓으면 403 인 것이 가장 나쁘다.

## 7. 배치 — 좌우 안에 상하

```
┌─────────────┬──────────────────────────┐
│ 고르는 목록 │ 트리 (전건 · 페이징 없음) │
│ (그리드)    ├──────────────────────────┤
│             │ 영향 인원 (그리드)        │
└─────────────┴──────────────────────────┘
```

- 왼쪽은 **보통의 그리드**다 — 조회조건·페이징이 그대로 산다([crud-screen.md](./crud-screen.md)).
- `SplitPane` 중첩은 [master-detail.md](./master-detail.md) §5 와 같은 선언이다.
- **왼쪽에서 고른 것이 바뀌면 편집 중인 트리를 버릴지 먼저 묻는다** —
  마스터-디테일의 *선택을 거부할 수 있어야 한다*(같은 문서 §3)와 같은 규칙이다.

## 8. 커밋 전 체크리스트

- [ ] `useQuery` 를 썼나 — `useGridController` 가 아니다
- [ ] 평면 응답인가 · 고아를 뿌리로 올리나
- [ ] `treeModel` 의 다섯을 다시 짜지 않았나
- [ ] `dirty` · `dirtyMenus` 가 `original` 에서 나오나
- [ ] 저장이 **전체 집합**인가 · 저장 뒤 재조회하나
- [ ] 권한이 없을 때 `onDrop` 이 `undefined` 인가
- [ ] `endpoints.ts` 에 네 경로가 선언됐나(트리 조회는 `R`)

## 관련

- [crud-screen.md](./crud-screen.md) — 왼쪽 그리드의 규칙 전부
- [master-detail.md](./master-detail.md) — `SplitPane` 선언 · 선택 거부
- [../09-knowledge/INDEX.md](../knowledge/INDEX.md) — 인가 · 메뉴 · 액션의 도메인 지식
