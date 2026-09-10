---
id: LLM-CTX-IDX
title: "harness/context — 컨텍스트 엔지니어링 INDEX"
category: harness/context
type: operation
created: 2026-04-30
updated: 2026-09-10
status: active
sources: []
tier: 1
tags: [context, rag, reading-map, budget, attention-budget, jit, index]
---

# harness/context — 컨텍스트 엔지니어링

> 무엇을 언제 읽고, provider별 압축 lifecycle에서 작업 연속성을 어떻게 지킬지에 대한 규약.

## 진입 조건

- 큰 문서(새 프로젝트의 대용량 가이드 등)를 읽기 직전
- Claude의 실측 context 경고를 처리할 때
- 외부 참조 문서 위치를 찾을 때
- Codex 압축 뒤 상태를 재주입할 때

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-CTX-001 | [budget.md](./budget.md) | Claude 실측 경고·Codex 압축 재주입 정책 |
| LLM-CTX-002 | [reading.md](./reading.md) | seek-read 원칙·Reading Map 사용법 |
| LLM-CTX-005 | [failure-modes.md](./failure-modes.md) | 실패 모드 카탈로그 (Rot/Distraction/Clash/Poisoning) |

## 핵심 규칙

1. **대용량 문서 통째 로드 금지** — 텍스트 검색으로 찾고 필요한 범위만 읽는다.
2. **추정 백분율 금지** — runtime이 제공한 실제 사용량만 수치로 말한다.
3. Claude는 실측 60%부터 `/compact`를 권하고, Codex는 자동 압축을 정상 lifecycle로 둔다.
4. 압축 뒤에는 `SessionStart`가 project state와 하네스 정합성을 다시 넣는다.

## 관련 카테고리

- [INDEX](../../INDEX.md) — 마스터
- [AGENTS.md](../../../AGENTS.md) — 헌법·신뢰 순서
- [artifact/screen/overlay](../../artifact/screen/overlay/INDEX.md) — Overlay 트리거 (읽기보다 먼저)
