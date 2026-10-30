---
id: LLM-PMT-OVR-IDX
title: "Overlay 카탈로그 — 화면 특성별로 빠뜨리면 안 되는 것"
category: artifact/screen/overlay
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["aidd-guide/artifact/template/02-requirements.md", "sources/frontend/src/modules/sample/"]
tier: 1
tags: [prompt, overlay, index]
---

# Overlay 카탈로그 — 화면 특성별로 **빠뜨리면 안 되는 것**

> **Overlay 는 요건서를 쓸 때 켜지는 체크리스트다.** 화면에 그 특성이 있으면
> **요건서의 어느 절이 필수가 되고 무엇을 물어야 하는지**를 준다.
>
> **구현 방법은 여기 없다** — [playbook](../../../playbook/INDEX.md) 이 갖는다.
> Overlay 는 *승인 전*, 플레이북은 *승인 후* 다.

## 트리거 표

| 화면에 이것이 있으면 | Overlay | 필수가 되는 절 |
|---|---|---|
| 상단 조회조건 폼 | [search-condition.md](./search-condition.md) | §2 · §3-2 |
| 부모-자식 두 그리드 | [master-detail.md](./master-detail.md) | §1-1 · §4-1(둘) · §4-5 |
| 자식 표가 둘 이상 · 화면 전체 탭 | [tabs.md](./tabs.md) | §1 · §1-1 · §5 |
| 엑셀 내려받기 · 올려받기 | [excel.md](./excel.md) | §0(`EXPORT_YN`) · §5 · §6-1 |
| 창을 띄운다 | [modal.md](./modal.md) | §1(모달) · §4-4 |
| **확정 · 재계산 같은 실행 버튼** | [execution.md](./execution.md) | §5 · **§6-2 · §6-3** |
| 관리 변경 이력 저장·별도 메뉴 조회 / 대용량 로그 | [history-pattern.md](./history-pattern.md) | 관리: 저장 단위·복사 매핑·상속 SCR / 로그: §0·§2 |

**둘 이상 겹치는 것이 정상이다.** 마스터-디테일 + 조회조건 + 엑셀은 흔한 조합이다.

## 파일

| ID | 파일 | 실물 |
|----|------|------|
| LLM-PMT-OVR-001 | [search-condition.md](./search-condition.md) | ① `/sample/single-offset` |
| LLM-PMT-OVR-002 | [master-detail.md](./master-detail.md) | ③④ |
| LLM-PMT-OVR-003 | [modal.md](./modal.md) | ①④⑤ |
| LLM-PMT-OVR-004 | [excel.md](./excel.md) | ③⑥ |
| LLM-PMT-OVR-005 | [tabs.md](./tabs.md) | ⑤⑥ |
| LLM-PMT-OVR-006 | [history-pattern.md](./history-pattern.md) | ② `/log/access` |
| LLM-PMT-OVR-007 | [execution.md](./execution.md) | ①③ |

> **`popup-edit.md` 를 `modal.md` 로 바꿨다.** *등록/수정 모달* 은 이 템플릿에 **없다** —
> 같은 표에 저장 경로가 둘이 되는 그 모양을 그리드 표준이 없앴다. 실제로 있는 창은 넷이다.

## Overlay 하나의 모양

```
트리거          — 언제 켜지나
필수가 되는 절  — 요건서의 어디를 반드시 채우나
반드시 묻는 것  — 답이 없으면 구현이 임의로 정하게 되는 항목
흔한 누락       — 실제로 빠졌던 것
실물            — 이미 있는 화면
```

**"흔한 누락" 이 Overlay 의 값이다.** 나머지는 템플릿을 읽으면 알 수 있지만, 그것은
**빠뜨린 적이 있어야 알 수 있다.**

## 관련

- [../INDEX.md](../INDEX.md) — 카테고리
- [../screen.md](../screen.md) — 절차 4단계에서 Overlay 를 고른다
- [`aidd-guide/artifact/template/02-requirements.md`](../../template/02-requirements.md) — 절 번호의 원본
