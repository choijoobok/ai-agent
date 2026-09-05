---
id: LLM-PMT-IDX
title: "03-prompt — 요건서를 받아내는 절차 INDEX"
category: artifact/screen
type: operation
created: 2026-04-30
updated: 2026-09-03
status: active
sources: ["aidd-guide/artifact/template/02-requirements.md", "documents/screen/README.md", "CLAUDE.md"]
tier: 1
tags: [prompt, requirements, overlay, index]
---

# 03-prompt — **요건서를 받아내는 절차**

> **화면을 만드는 일은 요건서에서 시작한다**(CLAUDE.md §6.3). 이 카테고리는 *요청을 받아
> 승인된 `requirements.md` 에 도달하기까지* 의 절차와, **화면 특성별로 빠뜨리면 안 되는
> 질문**(Overlay)을 갖는다.
>
> **형식은 여기 없다.** `requirements.md` 의 섹션 구성과 작성 원칙은
> [`aidd-guide/artifact/template/`](../template/02-requirements.md)) 가 갖는다 —
> 여기서 재정의하면 형식이 둘이 된다.

## 세 카테고리의 경계

```
03-prompt      요건서에 무엇을 적나 · 무엇을 물어야 하나   ← 승인 전
11-playbook    승인된 요건서로 어떻게 만드나              ← 구현
06-framework   무엇이 표준인가                            ← 늘
09-knowledge   표가 무엇을 담나                           ← 늘
```

**여기는 창의 영역이다** — 같은 의도에 표현이 여럿일 수 있다. 반대편(결정론)은
[standard](../../standard/INDEX.md) 와 [knowledge](../../knowledge/INDEX.md) 이며
**거기서는 변형하지 않는다.**

## 진입 결정 트리

```
요청이 왔다
  │
  ├─ "화면 하나 만들어줘"                  → screen.md   (절차 일곱 단계)
  ├─ "이 표로 조회·저장 화면"              → crud.md     (가장 흔한 요청의 실제 대화)
  ├─ 요건서를 쓰다 빈 칸을 만났다          → auto-completion.md (채울 수 있나 물어야 하나)
  ├─ **요건서에서 목업을 만든다**           → `.claude/skills/mockup/SKILL.md` (`/mockup`)
  └─ 화면에 이 특성이 있다                 → overlay/INDEX.md
```

**목업은 이 폴더가 아니라 스킬이 만든다.** 골격은 `scaffold.mjs` 가 요건서에서 뽑고
**그림만 AI 가 그린다**(CLAUDE.md §5-11) — 여기로 들어온 사람이 그 사실에 닿지 못해
2026-09-06 재현이 스킬을 스스로 찾아가야 했다.

## 파일

| ID | 파일 | 역할 | 상태 |
|----|------|------|------|
| LLM-PMT-001 | [screen.md](./screen.md) | 요청 → 승인까지 **일곱 단계** | ✅ |
| LLM-PMT-002 | [crud.md](./crud.md) | 단일 그리드 CRUD — **대화의 실물** | ✅ |
| LLM-PMT-003 | [auto-completion.md](./auto-completion.md) | 채워도 되는 것 / 물어야 하는 것 | ✅ |
| LLM-PMT-005 | [few-shot-policy.md](./few-shot-policy.md) | 예시를 몇 개 어디에 두나 | ✅ |
| LLM-PMT-OVR-IDX | [artifact/screen/overlay/INDEX.md](./overlay/INDEX.md) | Overlay **일곱** — 트리거 표 | ✅ |

## 핵심 규칙 넷

1. **사용자 입력은 그대로 보존한다.** 보완·검증만 하고 **임의로 바꾸지 않는다.**
2. **컬럼명·테이블명·코드그룹·응답 구조를 추측하지 않는다** — 확인하거나 묻는다.
3. **보완한 항목은 표시한다.** 표시하지 않은 보완은 **사용자가 검토할 수 없다.**
4. **승인 전에는 BE·FE·시드를 착수하지 않는다**(CLAUDE.md §6.3).

## Overlay 트리거 — 요약

| 화면에 이것이 있으면 | Overlay |
|---|---|
| 상단 조회조건 폼 | [search-condition.md](./overlay/search-condition.md) |
| 부모-자식 두 그리드 | [master-detail.md](./overlay/master-detail.md) |
| 자식 표가 둘 이상 · 화면 전체 탭 | [tabs.md](./overlay/tabs.md) |
| 엑셀 내려받기·올려받기 | [excel.md](./overlay/excel.md) |
| 창을 띄운다(인자·참조·배열·장문) | [modal.md](./overlay/modal.md) |
| **확정·재계산 같은 실행 버튼** | [execution.md](./overlay/execution.md) |
| 대용량 이력 조회 | [history-pattern.md](./overlay/history-pattern.md) |

상세와 **각 Overlay 가 요건서의 어느 절을 요구하는지**는
[artifact/screen/overlay/INDEX.md](./overlay/INDEX.md).

## 관련

- [INDEX](../../INDEX.md) — 마스터
- [`documents/screen/README.md`](../../../documents/screen/README.md) — 화면 문서의 형식과 시작 방법
- [playbook](../../playbook/INDEX.md) — 승인 뒤의 절차
- [CLAUDE.md §6](../../../CLAUDE.md) — 화면 문서 게이트
