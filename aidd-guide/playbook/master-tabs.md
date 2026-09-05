---
id: LLM-PLY-003
title: "하단 디테일 탭 — 자식 표가 둘 이상일 때"
category: playbook
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/features/sample/mdtabs/", "sources/frontend/src/shared/grid/DetailTabs.tsx", "aidd-guide/playbook/INDEX.md"]
tier: 2
tags: [playbook, master-detail, tabs]
---

# 하단 디테일 탭 — 자식 표가 둘 이상일 때

> **실물**: `features/sample/mdtabs/`(⑤) — 페이지 하나와 `components/SampleDetailTabs.tsx`.
>
> **③에 탭을 얹은 것이지 ③을 베낀 것이 아니다.** 마스터·조회조건·스플리터는 그대로이며
> 갈리는 것은 **하단**뿐이다. [master-detail.md](./master-detail.md) 를 먼저 읽는다.

## 1. 파일을 나눈다

```
pages/SampleMdTabsPage.tsx        마스터 + SplitPane
components/SampleDetailTabs.tsx   탭 둘 = 컨트롤러 둘
```

**한 파일에 컨트롤러 셋을 두지 않는다** — *어느 `dirty` 가 누구의 것인가* 를 읽는 사람이
세게 된다.

## 2. 훅은 탭 **밖**에 산다

`useGridController` 둘이 `SampleDetailTabs` 에 있다. 탭 컴포넌트가 활성 판만 그리더라도
훅은 부모에 있으므로 **품목을 고치고 태그 탭으로 가도 편집이 살아 있다.**

**탭 안에서 훅을 부르면 언마운트와 함께 미저장 편집이 사라진다.**

## 3. 핸들 둘 — 마스터가 하단에게 묻는 전부

```ts
export interface SampleDetailTabsHandle {
  select: (ordId: string | null) => Promise<void>;
  dirty: () => boolean;
}
```

- **`dirty()` 는 탭 둘을 `||` 로 묶는다.** 마스터가 선택을 바꾸기 전에 **한 번만** 묻는다 —
  탭마다 물으면 사용자는 같은 물음에 두 번 답하면서도 **무엇을 잃는지는 여전히 모른다.**
- **핸들은 `useEffect` 에서 채운다.** 렌더 중에 ref 를 쓰지 않는다(`react-hooks/refs`) —
  마스터가 이것을 부르는 것은 사람이 행을 클릭한 뒤라 효과가 이미 돌아 있다.

## 4. 지연 로딩 — 안 연 탭은 아직 읽지도 않았다

```ts
const loaded = useRef<Set<TabKey>>(new Set());

const loadTab = async (key) => {
  if (!ordId.current || loaded.current.has(key)) return;
  loaded.current.add(key);
  await controllerOf(key).read(true);
};
```

| 규칙 | 왜 |
|---|---|
| 마스터를 고르면 **활성 탭 하나만** 읽는다 | 둘 다 나가면 **목록을 훑는 동작 자체가 부하**다 |
| 한 번 부른 탭은 **주문이 바뀔 때까지** 다시 부르지 않는다 | 탭을 오가는 것은 조회가 아니라 *보는 각도를 바꾸는 것* 이다 |
| 그래도 **조회 버튼은 탭마다 있다** | 남이 고친 것을 다시 읽는 일은 **그 탭만**의 일이다 |
| 주문이 바뀌면 **둘 다 비운다**(`setRows([])`) | 안 연 탭은 **조회로 갈아 끼워지지도 않는다** — 옛 데이터가 그대로 남는다 |

### 저장이 다른 탭을 잊게 하는가 — 근거가 있을 때만

품목과 태그는 **서로를 바꾸지 않는다.** 같은 주문에 매달렸을 뿐 한쪽이 다른 쪽의 입력이
아니므로 저장해도 상대를 잊지 않는다. **근거 없이 잊으면** 사용자가 태그를 저장할 때마다
품목이 조용히 다시 조회된다.

> 반대 사례가 실제로 있다 — `USER_MGMT` 는 역할을 회수하면 유효 권한이 줄므로 한 탭의
> 저장이 다른 탭의 답을 바꾼다. 거기서는 잊는 것이 맞는다.

## 5. 대상이 없을 때 — 탭을 잠그지 않는다

```ts
const idle = picked === null;
// <DataGrid disabled={idle} emptyText={idle ? MSG.SAMPLE_ITEM_NO_MASTER : MSG.SAMPLE_ITEM_EMPTY} />
```

**탭은 살아 있고 버튼이 잠긴다.** 탭을 잠그면 *"이 주문에 태그 탭이 없나"* 로 읽힌다 —
없는 것은 **고를 주문**이지 탭이 아니다.

**빈 문구가 갈린다**: *주문을 고르세요* 와 *품목이 없습니다* 는 다른 사실이다.

## 6. 탭이 나눠 갖는 것과 공유하는 것

| | 탭마다 | 공유 |
|---|---|---|
| `gridId` | **다르다**(`detailItem` · `detailTag`) — 같으면 설정이 서로를 덮는다 | |
| 컨트롤러 · API · 저장 | 다르다 — **저장 단위가 셋**이다(마스터·품목·태그) | |
| `titleSuffix` | | 부모에서 온다 — 탭이 제 이름을 짓지 않는다 |
| 조회조건 폼 | **없다** | 마스터의 것 하나 |
| `disabled` | | 선택 상태 하나 |

**디테일 탭에는 조회조건 폼이 없다.** 대상이 마스터의 선택이며 그것은 `searchParams`(구조)
이지 `conditions`(사용자가 좁힌 것)가 아니다. `params` 는 대상이 없을 때 **`null` 을
돌려주어 조회 자체를 막는다.**

## 7. 판 전체를 봐야 아는 검증은 `save.validate.grid` 다

```ts
validate: { grid: (rows) => [...tooManyTagRows(rows), ...duplicatedSortNo(rows)] }
```

- **여러 규칙을 이어 붙인다.** 앞의 것만 내면 사용자가 고친 뒤에 나머지를 처음 듣는다.
- **순서에 뜻이 있다.** 개수 초과가 앞이다 — 넘은 판에서 할 일은 행을 빼는 것이고, 뺄 행의
  순서를 먼저 고치라고 하면 **두 번 고치게 된다.**
- **서버가 같은 것을 다시 본다.** 화면 검증은 왕복을 아끼는 것이지 판정이 아니다.

## 8. 탭 전환에는 묻지 않는다

**하단 디테일 탭과 화면 안 최상단 탭의 규칙이 다르다.**

| | 하단 디테일 탭(⑤) | 화면 안 최상단 탭(⑥) |
|---|---|---|
| 전환할 때 | **묻지 않는다** — 표시가 바뀔 뿐 데이터를 버리지 않는다 | **묻는다** — [excel.md §5](./excel.md) |
| 갈리는 것 | 한 화면 안의 **부분** | **화면 전체** |

## 9. 커밋 전 체크리스트

- [ ] 훅이 탭 **밖**에 있는가
- [ ] `dirty()` 가 탭 전부를 묶는가 — 마스터가 **한 번만** 묻는가
- [ ] 주문이 바뀔 때 `loaded` 를 비우고 **모든 탭의 행**을 비우는가
- [ ] `gridId` 가 탭마다 다른가
- [ ] [master-detail.md §8](./master-detail.md) 의 체크리스트

## 관련

- [master-detail.md](./master-detail.md) — 마스터와 스플리터
- [excel.md](./excel.md) — 화면 안 최상단 탭은 규칙이 다르다
- [standard/frontend/grid-advanced.md](../standard/frontend/grid-advanced.md) §5 — 검증 세 층
