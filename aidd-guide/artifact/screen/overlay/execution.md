---
id: LLM-PMT-OVR-007
title: "Overlay — 실행 (확정 · 재계산 · 일괄 처리)"
category: "03-prompt/overlays"
type: operation
created: 2026-09-03
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/features/sample/singleoffset/pages/SampleSingleOffsetPage.tsx", "sources/frontend/src/features/sample/mdvertical/pages/SampleMdVerticalPage.tsx", "aidd-guide/artifact/template/02-requirements.md"]
author: Bong Jong Hyeon
tier: 1
tags: [prompt, overlay, execution, progress]
---

# Overlay — 실행 (확정 · 재계산 · 일괄 처리)

**트리거**: 조회도 저장도 아닌 버튼이 있다 — 확정 · 승인 · 재계산 · 발송 · 일괄 변경.
**필수가 되는 절**: §5 버튼 · **§6-2 영향 테이블** · **§6-3 상태 전이**.

> **요건서에서 가장 자주 비는 자리가 §6-2 와 §6-3 이다.** 버튼 이름만 적고 넘어가면
> *그래서 무엇이 바뀌는가* 를 **구현이 정하게 된다** — 그리고 그 판단은 되돌릴 지점이 없다.

## 반드시 묻는 것 여덟

1. **대상이 무엇인가** — 고른 행인가, 조회된 묶음인가, **화면과 무관한 전량**인가.
   > *전량* 을 *조회된 묶음* 으로 적으면 서버가 **읽지도 않을 판 하나**를 매번 받는다.
2. **어떤 행이 대상이 될 수 있나** — 상태·잠금 조건. 화면이 거르는 것은 UX 이고
   **판정은 서버가 다시 한다.**
3. **인자를 받나** — 받으면 [modal.md](./modal.md) 를 함께 켠다.
4. **오래 걸리나** — 응답이 곧 끝인가, 진행률을 봐야 하나.
5. **§6-2 무엇이 바뀌나** — **표와 컬럼 단위로** 적는다. 자식까지 바뀌면 자식도 적는다.
6. **§6-3 상태가 어떻게 옮겨 가나** — `RCV → CFM` 같은 전이와 **각 전이의 조건**.
7. **일부만 실패하면** — 전건 롤백인가, 성공한 것만 반영인가.
8. **사용자에게 무엇을 돌려주나** — 건수 요약인가, 실패 목록인가.

## §6-2 · §6-3 은 이렇게 적는다

```md
### 6-2. 영향 테이블
| 표 | 무엇이 바뀌나 | 조건 |
|---|---|---|
| `SMPL_ORDER` | `ORD_STAT_CD` = `CFM`, 감사 넷 | `ORD_STAT_CD='RCV'` 이고 `LOCK_YN='N'` |
| `SMPL_ORDER_ITEM` | `AMT` 재계산 | 그 주문의 전 품목 |

### 6-3. 상태 전이
RCV --확정--> CFM --출고--> SHP --완료--> DON
· 확정: LOCK_YN='N' 인 RCV 만. 확정 이후 금액 컬럼이 잠긴다
· 되돌리기: 없음 (있으면 그것도 실행이며 여기 적는다)
```

## 흔한 누락

| 빠뜨린 것 | 일어나는 일 |
|---|---|
| **되돌리기가 있나** | 없다고 적지 않으면 *나중에 붙이면 되지* 로 넘어가고, 그때는 이미 데이터가 한쪽으로 갔다 |
| **부분 실패** | 절반만 반영된 금액은 **되돌릴 지점이 없다** |
| **진행률이 필요한 길이인가** | 짧은 일에 진행률을 붙이면 창이 떴다 바로 닫혀 *무언가 잘못됐나* 로 읽힌다 |
| **대상 0건일 때** | 버튼이 꺼지나, 눌리고 *0건입니다* 인가 |
| **확인을 묻나** | 인자 모달이 있으면 **묻지 않는다**(두 번 묻게 된다) |
| **`ACTION_CD`** | 접두가 정한다 — 실행 API 를 `get*`·`save*` 로 지으면 **액션이 틀어진다** |

## 적지 않는 것

폴링 주기 · 중단 조건 · 진행률 창의 모양 · 버튼 비활성 규칙 — **전부 표준이다.**
요건서에는 **`진행률: 있음/없음`** 한 줄이면 된다.

## 실물

| | |
|---|---|
| 응답이 곧 끝 | `features/sample/singleoffset/` 의 *확정* |
| 인자 모달 + 진행률 | 〃 의 *일괄 재계산* |
| 행 × 자식 진행률 | `features/sample/mdvertical/` 의 *품목 금액 재계산* |

## 구현은

[11-playbook/crud-screen.md §5](../../../playbook/crud-screen.md) ·
[06-framework/backend/progress.md](../../../standard/backend/progress.md) ·
[06-framework/frontend/progress.md](../../../standard/frontend/progress.md).
