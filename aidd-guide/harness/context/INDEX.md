---
id: LLM-CTX-IDX
title: "02-context — 컨텍스트 엔지니어링 INDEX"
category: harness/context
type: operation
created: 2026-04-30
updated: 2026-05-04
status: active
sources: [Anthropic "Effective context engineering", Chroma Context Rot]
author: Bong Jong Hyeon
tier: 1
tags: [context, rag, reading-map, budget, attention-budget, jit, index]
---

# 02-context — 컨텍스트 엔지니어링

> 무엇을 언제 읽고, 토큰 예산을 어떻게 관리할지에 대한 규약. **AI attention 은 무한이 아니라 유한 예산** (Chroma Context Rot, Anthropic Effective Context Engineering) — 컨텍스트의 20~40% 부터 정확도가 저하된다. 명시적 관리가 필수.

## 진입 조건

- 큰 문서(새 프로젝트의 대용량 가이드 등)를 읽기 직전
- `/context` 출력 결과를 처리할 때
- 외부 참조 문서 위치를 찾을 때
- 컨텍스트 포화도가 60% 이상 도달했을 때

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-CTX-001 | [budget.md](./budget.md) | `/context` 게이지·`/compact`·`/clear` 정책 |
| LLM-CTX-002 | [reading.md](./reading.md) | seek-read 원칙·Reading Map 사용법 |
| LLM-CTX-005 | [failure-modes.md](./failure-modes.md) | 실패 모드 카탈로그 (Rot/Distraction/Clash/Poisoning) |

## 핵심 규칙

1. **대용량 문서 통째 로드 금지** — `Grep` 으로 찾고 `Read(offset, limit)`
2. **포화도 게이지 매 응답 마지막 줄에 출력** — `CTX [█...] %`
3. **`/context` 호출 타이밍**: 대용량 Read 직후, 에러 로그 붙여넣기 직후, 서브에이전트 결과 후, 10~15턴마다
4. **60% 도달 시 `/compact` 권장**, 80% 위험, 100% 즉시 `/clear`

## 관련 카테고리

- [INDEX](../../INDEX.md) — 마스터
- [CLAUDE.md](../../../CLAUDE.md) — 헌법·신뢰 순서
- [artifact/screen/overlay](../../artifact/screen/overlay/INDEX.md) — Overlay 트리거 (읽기보다 먼저)
