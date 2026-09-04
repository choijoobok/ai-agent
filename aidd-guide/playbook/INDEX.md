---
id: LLM-PLY-IDX
title: "11-playbook — 화면 레시피 INDEX"
category: "11-playbook"
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/features/sample/", "sources/backend/api/src/main/java/com/ordinary/backoffice/api/sample/", "aidd-guide/playbook/INDEX.md"]
author: Bong Jong Hyeon
tier: 2
tags: [playbook, recipe, index]
---

# 11-playbook — 화면 하나를 만드는 절차

> **[06-framework](../standard/INDEX.md) 는 *무엇이 표준인가* 이고 여기는 *어떤 순서로
> 하는가* 다.** 표준을 여기에 다시 적지 않는다 — 절차가 표준을 **가리킨다**.
>
> **모든 레시피에 실물이 있다.** 대개 `sources/frontend/src/features/sample/` 의 여섯 화면이 그것이며,
> 실물 없는 레시피는 여기 두지 않는다. 막히면 **문서가 아니라 그 화면을 연다**.
>
> **예외 하나 — 트리.** 샘플 여섯이 그리드 화면을 덮고 트리는 덮지 않아, `tree-screen.md` 의
> 실물은 업무 화면 셋(`menu` · `roleauth` · `userauth`)이다. 샘플을 더하는 날 그 줄이 바뀐다.

## 진입 결정 트리

```
화면을 만든다
  │
  ├─ 그리드 하나 —— 조회·저장·실행                → crud-screen.md
  │     └─ 총 건수가 없어야 한다(대용량 이력)      → crud-screen.md §6 커서형
  ├─ 부모 하나에 자식 표 하나                      → master-detail.md
  │     └─ 마스터가 넓다(컬럼 대여섯 이상)         →   §2 상하
  │     └─ 마스터가 좁다(컬럼 서넛)                →   §3 좌우
  ├─ 부모 하나에 자식 표 **둘 이상**               → master-tabs.md
  ├─ 엑셀 —— 내려받기 · 올려받기                   → excel.md
  ├─ 창을 띄운다 —— 인자 · 참조 · 배열 · 장문      → modal.md
  ├─ 계층을 보여주거나 고친다 —— 트리              → tree-screen.md
  └─ DB 에 무엇을 넣어야 한다 —— 표 · 코드 · 문구  → changeset.md
```

## 파일

| ID | 파일 | 레시피 | 실물 |
|----|------|--------|------|
| LLM-PLY-001 | [crud-screen.md](./crud-screen.md) | 단일 그리드 — 조회·저장·실행·페이징 | ①② |
| LLM-PLY-002 | [master-detail.md](./master-detail.md) | 마스터-디테일 — 상하 · 좌우 | ③④ |
| LLM-PLY-003 | [master-tabs.md](./master-tabs.md) | 하단 디테일 탭 — 자식 표 둘 이상 | ⑤ |
| LLM-PLY-005 | [excel.md](./excel.md) | 엑셀 다운로드 세 갈래 · 업로드 탭 | ③⑥ |
| LLM-PLY-006 | [modal.md](./modal.md) | 실행 인자 · 참조 팝업 · 배열 · 장문 | ①④⑤ |
| LLM-PLY-007 | [tree-screen.md](./tree-screen.md) | 트리 — 계층 표시·권한 부여·드래그 | **샘플 없음** · 업무 셋 |
| LLM-PLY-004 | [changeset.md](./changeset.md) | Liquibase — 표를 만들고 시드를 더한다 | changelog |

## 샘플 여섯 — 무엇이 어디에만 있나

| # | `MENU_CD` | 경로 | 폴더 | **이 화면에만 있는 것** |
|---|---|---|---|---|
| ① | `SMPL_SINGLE_OFFSET` | `/sample/single-offset` | `singleoffset/` | 컬럼 서른 · 에디터 전부 · `params` 모달 · 진행률 |
| ② | `SMPL_SINGLE_CURSOR` | `/sample/single-cursor` | `singlecursor/` | **커서 페이징** · 자동 새로고침 |
| ③ | `SMPL_MD_VERT` | `/sample/md-vertical` | `mdvertical/` | **상하 분할** · 마스터 삭제 게이트 · 서버 생성 엑셀 |
| ④ | `SMPL_MD_HORZ` | `/sample/md-horizontal` | `mdhorizontal/` | **좌우 분할** |
| ⑤ | `SMPL_MD_TABS` | `/sample/md-tabs` | `mdtabs/` | **하단 디테일 탭** |
| ⑥ | `SMPL_EXCEL` | `/sample/excel` | `excel/` | **화면 안 최상단 탭** · **엑셀 업로드** |

**여섯이 나눠 갖는 것이 규약이다.** 하나에 다 넣으면 그 화면이 *레이아웃의 예* 가 아니라
*어휘의 창고* 가 되고, 지울 때 무엇이 함께 사라지는지 아무도 모른다.

## 화면 하나 — 순서는 하나다

```
0. requirements.md · mockup.html   함께 쓰고 **사용자 승인을 받는다** (CLAUDE.md §5.3 ①②③)
                                   ─── 승인 전에는 아래를 하나도 시작하지 않는다 ───
1. changeset.md             표가 없으면 만든다 · 코드·문구를 넣는다
2. 백엔드                   entity → repository → Spec → QueryService/Service → Controller
3. endpoints.ts             컨트롤러의 메서드명 그대로
4. 화면                     레시피 하나를 골라 그 샘플을 열고 따라 만든다
5. screenRegistry · menu-tree.yaml   경로 하나를 양쪽에 — 한쪽만이면 시드 생성이 막힌다
6. ./gradlew generateSeeds  생성물을 **소스와 같은 커밋**에
7. manual.md                화면이 선 뒤에 쓴다 — 그 전의 사용법은 추측이다
8. 게이트                   CLAUDE.md §7 — 초록을 보지 않은 변경은 완료가 아니다
```

**0 과 7 은 건너뛸 수 없다.** 나머지는 순서를 바꿔도 결과가 같지만, 요건서 없이 시작한
화면은 *무엇이 맞는지* 를 물을 곳이 없고 메뉴얼 없이 커밋한 화면은 **다음 사람이 소스를
읽어야만** 쓸 수 있다.

**목업이 0 에 있는 것이 이 목록에서 가장 자주 틀리는 자리다.** 목업은 *구현 결과를 그린
그림* 이 아니라 **승인의 절반**이다 — 뒤로 미루면 승인이 두 번 필요해진다.

## 표준을 추정하지 않는다

| 물음 | 어디 |
|---|---|
| 컴포넌트·prop 의 계약 | [06-framework/frontend/](../standard/frontend/INDEX.md) |
| 서비스 이름 · 트랜잭션 · API 경로 | [06-framework/backend/](../standard/backend/INDEX.md) |
| 생성 시드를 언제 다시 만드나 | [06-framework/seed.md](../standard/seed.md) |
| 코드·메시지·메뉴가 무엇인가 | [09-knowledge/](../knowledge/INDEX.md) |
| **이 자리를 실제로 어떻게 썼나** | **샘플 여섯의 소스** |

## 관련

- [INDEX](../INDEX.md) — 마스터
- [CLAUDE.md §3 · §5](../../CLAUDE.md) — 진입 카테고리와 문서 셋 게이트
- [03-prompt](../artifact/screen/INDEX.md) — 화면 프롬프트(이 레시피들을 가리킨다)
