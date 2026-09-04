---
id: LLM-REC-001
title: "RAW 로그 템플릿"
category: "10-records"
type: operation
created: "2026-04-30"
updated: "2026-09-03"
status: active
sources: [".claude/hooks/log-raw.mjs"]
author: Bong Jong Hyeon
tier: 3
tags: [records, log, raw, template]
---
# RAW 로그 템플릿

> USER/AI 메시지 원문 그대로. **훅([`log-raw.mjs`](../../.claude/hooks/log-raw.mjs))이 append 하고, AI 는 쓰지 않는다.**
> 정책(누가 언제·무엇을 남기지 않나)은 [04-memory/logs.md](../harness/memory/logs.md).

## 저장 위치

```
chat-history/YYYY-MM/raw/YYYY-MM-DD.md
```

## 형식

```md
## [YYYY-MM-DD HH:mm:ss]

### USER

<사람의 말 그대로 — 마스킹만 적용된다>

### AI

<AI 의 말 그대로 — thinking · tool_use 는 빠진다>

---
```

## 핵심 규칙

1. **요약 금지** — 압축은 [summary](./summary-log.md) 에서 한다. 원문이 압축되면 되돌릴 곳이 없다
2. **시각은 USER 에만** — `UserPromptSubmit` 이 선 시각. AI 블록은 그 턴에 이어 붙으므로 다시 찍지 않는다
3. **순서 보존** — 시간 오름차순 append only
4. **마스킹 적용** — 규칙에 걸린 줄은 **통째로** `***MASKED***`
5. **구분선** — USER/AI 한 쌍이 끝나면 `---`

## 무엇이 빠지나

| 빠지는 것 | 왜 |
|---|---|
| `thinking` | 원문은 대화다 — 생각은 대화가 아니다 |
| `tool_use` 의 인자 | 파일 내용이 통째로 실려 **로그가 저장소 사본이 된다** |
| 서브에이전트(`isSidechain`)의 말 | 사람과의 대화가 아니다 |

## 작성자

- **AI 가 아니다** — [`log-raw.mjs`](../../.claude/hooks/log-raw.mjs) 가 `UserPromptSubmit` 과 `Stop` 에서 append 한다.
- AI 는 **읽기만** 한다(맥락 복구·검증).
- **AI 가 직접 쓰면 같은 턴이 두 벌 남는다** — 그때부터 어느 쪽이 원문인지 알 수 없다.

## 예

```md
## [2026-09-03 19:23:22]

### USER

llm-guide 05-harness 둘부터 써줘

### AI

`05-harness` 를 닫았습니다. 커밋 dd6b541.

hooks.md — 훅 하나하나가 무엇을 보고 무엇을 말하는가.
skills.md — 스킬 둘의 카탈로그와 작성 규약.

---
```

## 마스킹

규칙은 [`.claude/hooks/log-mask.patterns`](../../.claude/hooks/log-mask.patterns) 하나가 갖는다 — 한 줄에 정규식 하나, 대소문자를 가리지 않는다.

```
(?:password|passwd|pwd|비밀번호)\s*[:=]
authorization\s*:\s*bearer\s
\b\d{6}\s*-\s*[1-4]\d{6}\b
```

- **줄을 통째로 가린다.** 값만 지우면 앞뒤 문맥이 그 값을 되살린다.
- **규칙은 넓게 잡는다** — 가려서 잃는 것은 로그 한 줄이고, 못 가려서 잃는 것은 자격증명이다.
- **이것으로 충분하지 않다.** 무엇을 애초에 넣지 않는가는 [04-memory/logs.md](../harness/memory/logs.md).

## summary 와의 관계

- raw 는 **원문**, summary 는 **요약**. 요약은 raw 를 근거로 쓴다.
- raw 는 훅이, summary 는 **AI 가** 쓴다 — 무엇이 결정이고 무엇이 미결인지는 판단이다.
- 형식: [summary-log.md](./summary-log.md)

## 관련

- [10-records INDEX](./INDEX.md)
- [04-memory/logs.md](../harness/memory/logs.md) — 정책
- [05-harness/hooks.md](../harness/hooks.md) — 훅의 상세
