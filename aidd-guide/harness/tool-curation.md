---
id: LLM-HRN-006
title: "Tool Curation 정책"
category: 05-harness
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [Anthropic "Effective context engineering"]
author: Bong Jong Hyeon
tier: 2
tags: [harness, tool, mcp, curation, gate]
---

# Tool Curation 정책

> Anthropic 권장: **"최소한의 자기완결적 도구 세트"**. 도구가 많을수록 LLM 의 라우팅·선택이 어려워진다. 도구 추가는 게이트를 통과해야 한다.

## 핵심 원칙

1. **자기완결적** — 한 도구로 한 의도가 끝나야 함. 두 도구의 조합 강제 X.
2. **이름이 의도** — 도구 이름과 description 으로 충분히 무엇을 하는지 분명.
3. **중복 금지** — 비슷한 일을 두 도구가 하면 라우팅 모호.
4. **삭제 우선** — 의심스러우면 추가 X. 도구는 삭제보다 추가가 쉽다.

## 추가 게이트 (모두 yes 여야 추가)

| 질문 | 통과 조건 |
|------|----------|
| 이 도구가 없으면 작업이 어려운가? | 명확한 yes |
| 기존 도구 조합으로 못 하는가? | yes |
| 이름·description 만 보고 의도 추론 가능? | yes |
| 다른 도구와 의도가 겹치지 않는가? | yes |
| 실패 시 결과가 안전한가? | yes (rollback 가능) |

## 도구 분류

| 분류 | 예 | 추가 신중도 |
|------|---|------------|
| 기본 (Read/Edit/Write/Bash) | Claude Code 내장 | 항상 활성 |
| 검색 (Grep/Glob) | 내장 | 항상 활성 |
| 외부 통신 (WebFetch/WebSearch) | 내장 | 트리거 룰로 제한 |
| MCP 서버 | Notion/Slack 등 | **높음** — 추가 시 게이트 통과 |
| Skill | 본 프로젝트 my-skill 등 | 중간 — 사용자 트리거 명확 |
| Sub-agent | Explore 등 | 중간 — 위임 정책 명확 |

## MCP 추가 시 추가 검증

MCP 서버는 **외부 인젝션 벡터**라서 더 엄격:

1. 13-safety/prompt-injection.md 를 만족하는가
2. 인증·rate-limit 가 명확한가
3. 응답 데이터에 PII 가 섞일 가능성은
4. 차단·삭제·게시 같은 위험 동작이 있는가 → explicit_permission 처리

## 본 프로젝트 도구 인벤토리 관리

- 추가된 MCP/skill 은 [hooks.md](./hooks.md), [skills.md](./skills.md) 에 등록
- 90일간 미사용 도구는 검토 후 제거
- 사용 빈도는 [08-observability](../quality/observability/INDEX.md) 추후 확장

## 안티 패턴

- "도구 많을수록 능력 향상" → 거짓. 라우팅 비용이 능력 이득보다 큼.
- "비슷한 도구 둘 다 두면 AI 가 알아서 고름" → 잘못 고름. 모호함이 곧 오류.
- "한 번 추가 후 신경 안 씀" → 도구는 stale 됨. 분기 검토.

## 관련

- [INDEX.md](./INDEX.md)
- [sub-agents.md](./sub-agents.md)
- [13-safety/](../standard/safety/INDEX.md) — 외부 도구 안전 검증
