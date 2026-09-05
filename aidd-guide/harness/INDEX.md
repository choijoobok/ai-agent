---
id: LLM-HRN-IDX
title: "05-harness — 훅·스킬·자동화 INDEX"
category: harness
type: operation
created: "2026-04-30"
updated: "2026-09-03"
status: active
sources: ["wms5/orchestration/00-meta (외부 프로젝트 — 이 저장소에 없다)"]
tier: 2
tags: [harness, hooks, skills, automation, index]
---
# 05-harness — 훅·스킬·자동화

> Claude Code 의 외부 도구 (훅·스킬·플래그) 카탈로그와 **자동화 vs AI 책임** 분리 매트릭스.

## 진입 조건

- 훅이 실패했거나 동작을 의심할 때
- 새 스킬을 만들거나 기존 스킬을 수정할 때
- 자동화로 처리할지 AI 가 직접 처리할지 판단할 때

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-HRN-001 | [hooks.md](./hooks.md) | 훅 하나하나의 상세 · 공통 계약(`lib.mjs`) · 새 훅 추가 |
| LLM-HRN-002 | [skills.md](./skills.md) | 스킬 둘의 카탈로그 + 작성 규약 · 훅/플레이북 경계 |
| LLM-HRN-003 | [automation-matrix.md](./automation-matrix.md) | 자동화 vs AI 책임 매트릭스 |
| LLM-HRN-005 | [sub-agents.md](./sub-agents.md) | 서브에이전트 위임 정책 — **넷 다 Claude Code 기본 제공**. 프로젝트 정의는 없다 |
| LLM-HRN-006 | [tool-curation.md](./tool-curation.md) | 도구 추가 게이트 (MCP·skill·sub-agent 추가 시) |
| LLM-HRN-007 | [sensors-guides.md](./sensors-guides.md) | Sensors vs Guides 자동화 분류 |

## 자동화 vs AI 핵심 원칙

> **기계가 지킬 수 있는 것을 사람에게 외우게 하지 않는다.**

| 훅 | 강도 | 무엇 |
|------|------|------|
| `guard-generated` | **차단** | 생성 시드 CSV 손편집 |
| `guard-commit` | **차단** | 경로 없는 커밋 · `-a` · 큰따옴표 메시지 |
| `normalize-encoding` | **교정** | BOM · CRLF |
| `doc-drift` | **경고** | 화면 소스 ↔ 화면 문서(정본 둘) |
| `log-raw` | **기록** | 대화 원문 → `chat-history/`(CLAUDE.md §10) |

상세: [automation-matrix.md](./automation-matrix.md)

## 스킬 카탈로그 (요약)

| 스킬 | 용도 |
|------|------|
| `/kickoff` · `/interview` · `/phase-gate` · `/pm-status` | 단계를 세우고 묻고 넘고 보고한다 |
| `/slice` · `/change-request` · `/adr` | 구현 · 변경 요청 · 결정 기록 |
| `/doc-gen` | spec YAML → `documents/generated/` |
| `/menu-doc` | 화면 문서(요건서·메뉴얼) 생성·현행 대조 |
| `/mockup` | 요건서 → `mockup.html` (파생) |
| `/manual-site` | 메뉴얼 열람 페이지 + 고객사 제출본(`build/manual/`) 생성 |
| `/trace` · `/redteam` | 추적성 검사 · 적대적 검토 |

## 관련 카테고리

- [INDEX](../INDEX.md)
- [harness/memory](./memory/INDEX.md) — 메모리 갱신 정책
