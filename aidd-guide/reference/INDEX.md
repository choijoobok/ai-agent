---
id: LLM-REF-IDX
title: "12-references — 학습 자산 INDEX"
category: 12-references
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [ai-orchestration/references/]
author: Bong Jong Hyeon
tier: 4
tags: [references, bibliography, learning, summaries, index]
---

# 12-references — 학습 자산

> 본 LLM 엔지니어링 시스템의 **외부 근거**. AI 라우팅 입구 아님 — 사람이 학습 또는 근거 추적 시 참조.

## 진입 결정 트리

```
외부 문헌 의문?
  ├─ "이 규칙 출처가 뭔데"        → bibliography.md (번호로 추적)
  ├─ "Anthropic Context Eng 요약" → summaries/05-anthropic-context-engineering.md
  ├─ "Hamel Evals 요약"           → summaries/11-hamel-evals.md
  ├─ "Chroma Context Rot"         → summaries/09-chroma-context-rot.md
  ├─ "OpenAI Harness"             → summaries/01-openai-harness.md
  ├─ "Thoughtworks Harness"       → summaries/02-thoughtworks-harness.md
  └─ "학습 진행 로그"              → learning-log.md
```

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-REF-001 | [bibliography.md](./bibliography.md) | 14편 문헌 카탈로그 (번호 + 메타데이터) |
| LLM-REF-S001 | [summaries/01-openai-harness.md](./summary/01-openai-harness.md) | OpenAI Harness Engineering 요약 |
| LLM-REF-S002 | [summaries/02-thoughtworks-harness.md](./summary/02-thoughtworks-harness.md) | Thoughtworks Harness 요약 |
| LLM-REF-S003 | [summaries/05-anthropic-context-engineering.md](./summary/05-anthropic-context-engineering.md) | Anthropic Context Engineering 요약 |
| LLM-REF-S004 | [summaries/09-chroma-context-rot.md](./summary/09-chroma-context-rot.md) | Chroma Context Rot 요약 |
| LLM-REF-S005 | [summaries/11-hamel-evals.md](./summary/11-hamel-evals.md) | Hamel Husain Evals 요약 |
| LLM-REF-S006 | [learning-log.md](./learning-log.md) | LLM 학습 로그 (ai-orch 이주) |

## 인용 규약

다른 카테고리의 메타블록 또는 본문에서 인용할 때:

- 메타블록: `references: [5, 9, 11]` (bibliography 번호)
- 본문: `[Anthropic Context Engineering](./summary/05-anthropic-context-engineering.md)` 형식

## 인용 ↔ 카테고리 매핑

| 외부 문헌 | 어디서 쓰이는가 |
|-----------|---------------|
| [5] Anthropic Context Engineering | 02-context (JIT·Right Altitude·Sub-agent·Tool curation·Canonical examples·Compaction) |
| [9] Chroma Context Rot | 02-context/failure-modes, 08-observability/context-rot-monitor |
| [11] Hamel Husain Evals | 07-evals 전체 |
| [1] OpenAI Harness | 05-harness (자동화·도구) |
| [2] Thoughtworks Sensors-vs-Guides | 05-harness/sensors-guides |

## 추가 룰

- 학습 자산은 _study/ 와 별개 — 본 카테고리는 **외부 출처가 분명한 문헌**만.
- 새 문헌 추가 시 bibliography 번호 발급 → summary 작성 → 본 INDEX 갱신.
- 문헌 내용을 직접 운용 룰로 삼지 않음 — 운용 룰은 항상 다른 카테고리에서 가공 후 단일 정의.

## 관련

- [bibliography.md](./bibliography.md)
- 인용한 운용 카테고리: [02-context](../harness/context/INDEX.md), [05-harness](../harness/INDEX.md), [07-evals](../quality/evals/INDEX.md)
