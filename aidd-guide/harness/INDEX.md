---
id: LLM-HRN-IDX
title: "harness — 훅·스킬·자동화 INDEX"
category: harness
type: operation
created: "2026-04-30"
updated: "2026-09-10"
status: active
sources: []
tier: 2
tags: [harness, hooks, skills, automation, index]
---
# harness — 훅·스킬·자동화

> Claude Code와 Codex가 함께 쓰는 훅·스킬 카탈로그와 **자동화 vs AI 책임** 분리 매트릭스.

## 진입 조건

- 훅이 실패했거나 동작을 의심할 때
- 새 스킬을 만들거나 기존 스킬을 수정할 때
- 자동화로 처리할지 AI 가 직접 처리할지 판단할 때

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-HRN-001 | [hooks.md](./hooks.md) | 훅 하나하나가 무엇을 보고 무엇을 말하나 |
| LLM-HRN-008 | [hooks-contract.md](./hooks-contract.md) | 배선 · `lib.mjs` 계약 · 새 훅을 더할 때 |
| LLM-HRN-002 | [skills.md](./skills.md) | 스킬 둘의 카탈로그 + 작성 규약 · 훅/플레이북 경계 |
| LLM-HRN-009 | [providers/claude-code.md](./providers/claude-code.md) | Claude Code 발견 경로·컨텍스트 경고 |
| LLM-HRN-010 | [providers/codex.md](./providers/codex.md) | Codex 배선·`apply_patch` adapter·압축 재주입 |
| LLM-HRN-003 | [automation-matrix.md](./automation-matrix.md) | 자동화 vs AI 책임 매트릭스 |
| LLM-HRN-005 | [sub-agents.md](./sub-agents.md) | 서브에이전트 위임 정책 — provider 기능을 쓰되 같은 tree 동시 쓰기는 금지 |
| LLM-HRN-006 | [tool-curation.md](./tool-curation.md) | 도구 추가 게이트 (MCP·skill·sub-agent 추가 시) |
| LLM-HRN-007 | [sensors-guides.md](./sensors-guides.md) | Sensors vs Guides 자동화 분류 |

## 자동화 vs AI 핵심 원칙

> **기계가 지킬 수 있는 것을 사람에게 외우게 하지 않는다.**

| 훅 | 강도 | 무엇 |
|------|------|------|
| `guard-generated` | **차단** | 생성 시드 CSV 손편집 |
| `guard-commit` | **차단** | 경로 없는 커밋 · `-a` · 본문을 못 보는 메시지 · 잘못된 `Agent:` trailer |
| `normalize-encoding` | **교정** | BOM · CRLF |
| `doc-drift` | **경고** | 화면 소스 ↔ 화면 문서(정본 둘) |
| `log-raw` | **기록** | 대화 원문 → `chat-history/`(AGENTS.md §10) |

상세: [automation-matrix.md](./automation-matrix.md)

## 스킬 카탈로그 (요약)

| 스킬 | 용도 |
|------|------|
| `/kickoff` · `/interview` · `/phase-gate` · `/pm-status` | 단계를 세우고 묻고 넘고 보고한다 |
| `/slice` · `/integrate-main` · `/change-request` · `/adr` | 구현 · main 통합 · 변경 요청 · 결정 기록 |
| `/doc-gen` | spec YAML → `documents/generated/` |
| `/menu-doc` | 화면 문서(요건서·메뉴얼) 생성·현행 대조 |
| `/mockup` | 요건서 → `mockup.html` (파생) |
| `/manual-site` | 화면별 메뉴얼 + 목업/캡처 → 사용자 매뉴얼 사이트 |
| `/runbook` | 운영 런북 정본 작성·완결성 검사 |
| `/deliverable-site` | 설계·사용자·운영 오프라인 고객 제출 사이트 생성 |
| `/trace` · `/doc-consistency` · `/redteam` | 추적성 검사 · 문서 정합성 점검 · 적대적 검토 |
| `/harness-sync` · `$harness-sync` | 공통 명세부터 양쪽 스킬·훅을 추가·복구 |

## 정본과 생성물

`AGENTS.md`가 공통 헌법이고 `AGENTS.md`는 import adapter다. 스킬 원본은 `skill-src/*.md`,
Claude/Codex 발견 경로의 `SKILL.md`는 생성물이다. 훅 동등성은 `hooks-contract.md`, 기계가 읽는
경로 매핑은 `capabilities.yaml`이 갖는다. 세션 시작과 CI에서 아래 검사를 실행한다.

```bash
node aidd-guide/harness/runtime/harness-check.mjs
```

## 관련 카테고리

- [INDEX](../INDEX.md)
- [harness/memory](./memory/INDEX.md) — 메모리 갱신 정책
