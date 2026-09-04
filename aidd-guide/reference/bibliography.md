---
id: LLM-REF-001
title: "학습 참고문헌 14편"
category: 12-references
type: operation
created: 2026-04-24
updated: 2026-05-04
status: active
sources: [ai-orchestration/references/bibliography.md]
author: Bong Jong Hyeon
tier: 3
---
# 참고문헌 (Bibliography)

본 AI Orchestration 구조의 **근거 자료**. 각 카테고리 `index.md` 의 `참고문헌` 섹션 및 개별 문서의 `references:` 필드에서 번호로 참조.

---

## Primary — 하네스 엔지니어링 3선 (300-harness 근거)

| # | 자료 | 저자 / 발행 | 링크 |
|---|------|-------------|------|
| 1 | Harness Engineering | OpenAI | https://openai.com/index/harness-engineering/ |
| 2 | Harness Engineering for Coding Agent Users | Birgitta Böckeler (Thoughtworks) / 2026-04-02 | https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html |
| 3 | Skill Issue: Harness Engineering for Coding Agents | Kyle (HumanLayer) / 2026-03-12 | https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents |

## Foundation — 에이전트 설계 이론 (500-agents / 600-workflows 근거)

| # | 자료 | 저자 / 발행 | 링크 |
|---|------|-------------|------|
| 4 | Building Effective Agents | Erik Schluntz & Barry Zhang (Anthropic) / 2024-12-19 | https://www.anthropic.com/engineering/building-effective-agents |
| 5 | Effective Context Engineering for AI Agents | Anthropic Applied AI / 2025-09-29 | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| 6 | LLM Powered Autonomous Agents | Lilian Weng / 2023-06-23 | https://lilianweng.github.io/posts/2023-06-23-agent/ |

## Context Engineering — 컨텍스트 관리 심화 (200-context 근거)

| # | 자료 | 저자 / 발행 | 링크 |
|---|------|-------------|------|
| 7 | How Long Contexts Fail | Drew Breunig / 2025-06-22 | https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html |
| 8 | How to Fix Your Context | Drew Breunig / 2025-06-26 | https://www.dbreunig.com/2025/06/26/how-to-fix-your-context.html |
| 9 | Context Rot: How Increasing Input Tokens Impacts LLM Performance | Hong / Troynikov / Huber (Chroma) / 2025-07-14 | https://www.trychroma.com/research/context-rot |
| 10 | The New Skill in AI is Not Prompting, It's Context Engineering | Phil Schmid | https://www.philschmid.de/context-engineering |

## Evals & Practice — 평가·실전 (700-evals / 100-prompts 근거)

| # | 자료 | 저자 / 발행 | 링크 |
|---|------|-------------|------|
| 11 | Your AI Product Needs Evals | Hamel Husain / 2024-03-29 | https://hamel.dev/blog/posts/evals/ |
| 12 | Prompt Engineering Guide | DAIR.AI (지속 업데이트) | https://www.promptingguide.ai/ |
| 13 | Simon Willison's Weblog | Simon Willison (지속 업데이트) | https://simonwillison.net/ |
| 14 | Anthropic Cookbook | Anthropic (GitHub) | https://github.com/anthropics/anthropic-cookbook |

---

## 카테고리 ↔ 참고문헌 매핑

| 카테고리 | 주요 근거 | 보조 근거 |
|----------|----------|----------|
| 000 Foundation | (프로젝트 고유) | 4 |
| 100 Prompts | 12, 14 | 4 |
| 200 Context | 5, 7, 8, 9, 10 | — |
| 300 Harness | **1, 2, 3** | — |
| 400 Tools | 14 | 4 |
| 500 Agents | 4, 6 | — |
| 600 Workflows | 4 | — |
| 700 Evals | **11** | 13 |
| 800 Observability | 13 | — |
| 900 Safety | 14 | — |

---

## 추가 자료 누적 규칙
- 신규 자료 추가 시: 다음 번호(15, 16, ...) 부여
- 그룹 추가 시: 별도 섹션 신설 (예: "Tool Use — 도구 엔지니어링")
- 폐기된 링크: 취소선 + `deprecated: YYYY-MM-DD` 주석

## 열람 우선순위 (입문자 권장 순서)
1. [4] Building Effective Agents — **가장 먼저**
2. [5] Effective Context Engineering
3. [2] Harness Engineering (Thoughtworks)
4. [11] Your AI Product Needs Evals
5. [9] Context Rot — 실험 데이터 중심
6. 나머지 심화

---

## 학습 진행 상태 (LEARNING-LOG 요약)

> 정본 상태 테이블은 [learning-log.md](./learning-log.md) · 본 섹션은 빠른 참조용 요약.

| # | 자료 | 상태 | 요약 파일 |
|---|------|------|----------|
| 1 | OpenAI — Harness Engineering | ⚠️ 완료(간접) | [01-openai-harness](./summary/01-openai-harness.md) |
| 2 | Thoughtworks — Harness Engineering | ✅ 완료 | [02-thoughtworks-harness](./summary/02-thoughtworks-harness.md) |
| 3 | HumanLayer — Skill Issue | 🔲 대기 | — |
| 4 | Anthropic — Building Effective Agents | 🔲 대기 | — |
| 5 | Anthropic — Context Engineering | ✅ 완료 | [05-anthropic-context-engineering](./summary/05-anthropic-context-engineering.md) |
| 6 | Lilian Weng — LLM Autonomous Agents | 🔲 대기 | — |
| 7 | Breunig — How Long Contexts Fail | 🔲 대기 | — |
| 8 | Breunig — How to Fix Your Context | 🔲 대기 | — |
| 9 | Chroma — Context Rot | ✅ 완료 | [09-chroma-context-rot](./summary/09-chroma-context-rot.md) |
| 10 | Schmid — Context Engineering | 🔲 대기 | — |
| 11 | Hamel — Your AI Product Needs Evals | ✅ 완료 | [11-hamel-evals](./summary/11-hamel-evals.md) |
| 12 | DAIR.AI — Prompt Engineering Guide | 🔲 대기 | — |
| 13 | Simon Willison's Weblog | 🔲 대기 | — |
| 14 | Anthropic Cookbook | 🔲 대기 | — |

**상태 표기**: ✅ 완료 · ⚠️ 완료(간접) · 🔲 대기 · ❌ 실패·보류
