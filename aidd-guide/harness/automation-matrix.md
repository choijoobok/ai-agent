---
id: LLM-HRN-003
title: "자동화 vs AI 책임 매트릭스"
category: harness
type: operation
created: "2026-04-30"
updated: "2026-09-03"
status: active
sources: [".claude/settings.json", ".claude/hooks/"]
tier: 1
tags: [harness, hooks, automation]
---

# 자동화 vs AI 책임 매트릭스

> **기계가 지킬 수 있는 것을 사람에게 외우게 하지 않는다.** 구현 주체가 AI 이므로
> 표준은 문서와 **게이트**로 존재해야 한다(CLAUDE.md §8).
>
> 훅은 다섯이고 [`.claude/hooks/`](../../.claude/hooks) 에 있다. `node` 하나로 돌며 의존성이 없다 — **폐쇄망에서도 돈다.**

## 훅 다섯 — 무엇을 언제

| 훅 | 시점 | 대상 | 강도 |
|---|---|---|---|
| [`guard-generated.mjs`](../../.claude/hooks/guard-generated.mjs) | `PreToolUse` | `Write`·`Edit` | **차단** — 생성 시드 CSV 손편집 |
| [`guard-commit.mjs`](../../.claude/hooks/guard-commit.mjs) | `PreToolUse` | `Bash`·`PowerShell` | **차단** — 경로 없는 커밋 · `-a` · 큰따옴표 메시지 |
| [`normalize-encoding.mjs`](../../.claude/hooks/normalize-encoding.mjs) | `PostToolUse` | `Write`·`Edit` | **교정** — BOM · CRLF 를 쓰기 직후 고친다 |
| [`doc-drift.mjs`](../../.claude/hooks/doc-drift.mjs) | `PostToolUse` | `Write`·`Edit` | **경고** — 화면 소스 ↔ 화면 문서 |
| [`log-raw.mjs`](../../.claude/hooks/log-raw.mjs) | `UserPromptSubmit` · `Stop` | 턴 전체 | **기록** — 대화 원문을 `chat-history/` 에 append |

배선은 [`.claude/settings.json`](../../.claude/settings.json) 이 한다.

## 강도가 넷인 이유

| 강도 | 언제 쓰나 | 왜 |
|---|---|---|
| **차단** | 되돌리기가 비싼 것 | 시드 CSV 를 손으로 고치면 다음 생성에서 조용히 사라지고, `-a` 커밋은 한 트리의 다른 세션 것을 되돌린다 |
| **교정** | 답이 하나뿐인 것 | BOM·CRLF 에 판단의 여지가 없다. 물을 이유가 없으면 그냥 고친다 |
| **경고** | **판단이 필요한 것** | *문서를 고쳐야 하는가* 는 판단이다 — 일치하면 고치지 않는다(CLAUDE.md §6.4). 기계가 대신 결정할 수 없다 |
| **기록** | 말할 것이 없는 것 | 매 턴 도는 훅이 한 마디라도 내면 그 말이 **모든 턴에 쌓인다.** 특히 `UserPromptSubmit` 의 표준 출력은 모델의 문맥에 그대로 들어간다 — 기록이 문맥을 갉아먹으면 안 된다 |

> **차단을 남발하지 않는다.** 판단해야 할 것을 차단으로 막으면 우회하는 습관이 생기고,
> 그때부터 진짜 차단도 우회 대상이 된다.

## AI 가 하는 것 — 훅이 못 하는 것

| 영역 | 담당 | 지침 |
|---|---|---|
| 시드 CSV **생성** | AI (`./gradlew generate*Seed`) | 손편집은 훅이 막는다. **태스크를 돌려 생성물을 같은 커밋에 담는다**(CLAUDE.md §5-8) |
| 화면 문서 현행화 | AI | `doc-drift` 는 *어느 화면인지* 만 가리킨다. 고칠지 말지는 AI 와 사람이 정한다 |
| 목업 생성 | AI (`/mockup`) | 요건서에서 만든다. 골격은 기계가 내고 **그림만 AI 가 그린다** |
| 공통물 승격 | AI | 두 번째 사용을 알아채는 검사가 없다 — 리뷰에서 *이거 다른 화면에도 있지 않나* 를 묻는다 |
| `chat-history` 요약 | AI | **원문은 `log-raw` 가 남긴다.** 요약은 결정·산출물·미결만(CLAUDE.md §10 · [harness/memory/logs.md](./memory/logs.md)) |
| 결정 기록 | AI | **커밋 메시지에 *왜* 를 적는다**(CLAUDE.md §9). 버린 안이 있으면 ADR 을 더한다 |

## 위반 패턴

```
❌ 생성 시드 CSV 를 손으로 고친다            → guard-generated 가 막는다
❌ git commit -a / git commit -m "..."       → guard-commit 이 막는다
❌ 소스만 고치고 화면 문서를 그대로 둔다      → doc-drift 가 가리키지만 막지는 않는다
❌ 이미 적재된 changeset 을 수정한다          → 남의 로컬이 checksum 으로 죽는다 (검사 없음)
```

## 관련

- [INDEX.md](./INDEX.md)
- [hooks.md](./hooks.md) — 훅 하나하나의 상세
- [skills.md](./skills.md) — 스킬 카탈로그
- [CLAUDE.md §8](../../CLAUDE.md) — 기계가 막는 것 / 사람이 지키는 것
