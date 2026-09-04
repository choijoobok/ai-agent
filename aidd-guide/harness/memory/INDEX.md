---
id: LLM-MEM-IDX
title: "04-memory — 메모리 시스템 INDEX"
category: "04-memory"
type: operation
created: "2026-04-30"
updated: "2026-09-04"
status: active
sources: [orchestration/]
author: Bong Jong Hyeon
tier: 1
tags: [memory, logs, index]
---
# 04-memory — 메모리 시스템

> 세션을 넘어 영속되는 것의 정책 — **무엇을 어디에 남기고, 읽을 때 얼마나 믿는가.**
>
> **결정은 여기 없다.** 2026-09-04 에 DEC 레지스트리를 접었다(아래 “결정은 어디 있나”).

## 진입 조건

- 세션을 마치며 요약을 남길 때 · 이전 대화의 맥락을 되찾아야 할 때
- 로그에 무엇을 적어도 되는지 갈릴 때
- **결정을 남기려 할 때** → 여기가 아니다. 아래 “결정은 어디 있나”

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-MEM-004 | [logs.md](./logs.md) | raw / summary 로그 정책 — 책임 · 남기지 않을 것 · 신뢰 수준 |

> **`LLM-MEM-001`(decisions) · `LLM-MEM-002`(project-memory) 는 2026-09-04 에 폐기했다.**
> ID 는 재사용하지 않는다.

## 결정은 어디 있나 — 여기가 아니다

**DEC 레지스트리를 접었다**(2026-09-04). 두 파일이 `docs/decisions.md` · `docs/memory.md` ·
`docs/stack.md` 를 *실제 데이터* 로 지목했는데 **셋 다 없었고**, `DEC-` 는 한 건도 등록된
적이 없다. 정책만 있고 데이터가 없는 레지스트리는 **다음 세션을 없는 파일로 보낸다.**

| 무엇 | 어디 |
|---|---|
| **그보다 가벼운 결정** | **커밋 메시지**. `CLAUDE.md` §5-3 이 *왜* 를 본문에 적게 한다 |
| **불변 진실** | Claude Code auto-memory(`~/.claude/…/memory/`) — 세션 진입에 자동으로 실린다 |

> **레지스트리를 하나 더 만들지 않는 것이 결정이다.** 결정을 적는 자리가 둘이면
> 언젠가 갈리고, 갈렸을 때 어느 쪽이 참인지 알 방법이 없다.

## Memory Hierarchy (4 분류)

> 학계·Anthropic 표준 분류를 본 시스템에 매핑.

| 분류 | 정의 | 위치 |
|------|------|-------------|
| **Short-term** | 현재 컨텍스트 윈도우 | Claude Code 세션 |
| **Episodic** | 시간 순 로그 | `chat-history/YYYY-MM/{raw,summary}/` — 형상 관리 제외 (CLAUDE.md §10) |
| **Semantic** | 개념·관계 지식 | `09-knowledge/`, `06-framework/`, `11-playbook/` |

## Structured Note-Taking (Anthropic)

> 외부 메모리(파일)를 컨텍스트의 **연장**으로 활용. 이 저장소에서 그 구현은 **`logs`(원문·요약)와
> 그리고 커밋 메시지** 둘이다.

## 신뢰 우선순위 (충돌 시)

```
1. 현재 소스 코드             ← 가장 신뢰 (CLAUDE.md §2)
3. docs/menu · docs/screen   ← 화면 문서 셋
4. chat-history 요약 · 기억   ← 검증 후 사용
```

## 갱신 조건 요약 (보편 정책)

| 메모리 | 갱신 조건 |
|-------|----------|
| logs (raw) | 훅이 남긴다. 사람도 AI 도 손대지 않는다 (CLAUDE.md §10) |
| logs (summary) | AI 가 세션 끝에 작성 — 결정·산출물·미결만 남긴다 |
| ADR | 아키텍처 판단에서 **버린 안이 생겼을 때**. 형식은 adr/INDEX.md |

> 실제 저장 경로는 [logs.md](./logs.md) 에 정의. 로그 폴더는 **형상 관리 대상이 아니다**(CLAUDE.md §10).

## 관련 카테고리

- [INDEX](../../INDEX.md)
- [05-harness](../INDEX.md) — 자동화 vs AI 책임 매트릭스
