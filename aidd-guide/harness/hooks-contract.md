---
id: LLM-HRN-008
title: "훅 계약 — 배선 · lib.mjs · 새 훅을 더할 때"
category: harness
type: operation
created: "2026-09-06"
updated: "2026-09-06"
status: active
sources: [".claude/hooks/", ".claude/settings.json"]
tier: 2
tags: [harness, hooks, contract, wiring]
---

# 훅 계약 — 배선 · `lib.mjs` · 새 훅을 더할 때

> **훅을 만들거나 고칠 때** 읽는다. *어떤 훅이 있고 각각 왜 그런가* 는
> [hooks.md](./hooks.md) 가 갖는다 — 한 문서였다가 200줄 상한에 닿아 갈랐고, 갈린 축은
> **읽는 이유**다: 여기는 만드는 사람, 저기는 막힌 사람이 온다.

## 배선 — `.claude/settings.json`

| 이벤트 | matcher | 훅 | timeout |
|---|---|---|---|
| `PreToolUse` | `Write\|Edit` | `guard-generated.mjs` | 10s |
| `PreToolUse` | `Bash\|PowerShell` | `guard-commit.mjs` | 10s |
| `PostToolUse` | `Write\|Edit` | `normalize-encoding.mjs` → `doc-drift.mjs` → `guide-drift.mjs` | 10s · 15s · 15s |
| `UserPromptSubmit` | — | `log-raw.mjs` | 10s |
| `Stop` | — | `log-raw.mjs` | 15s |

- **`PostToolUse` 둘은 순서가 있다.** 인코딩을 먼저 고치고 화면 문서를 대조한다.
- 실행은 `node` 하나다. `package.json` 도 `node_modules` 도 보지 않는다 — **폐쇄망에서 `npm i` 없이 선다**(CLAUDE.md §1).

## 공통 계약 — `lib.mjs`

| 함수 | 무엇 |
|---|---|
| `readHookInput()` | 표준 입력의 JSON 한 덩이. **못 읽으면 빈 객체** — 훅이 조용히 통과한다 |
| `REPO` | 저장소 뿌리. **작업 디렉터리를 믿지 않고** 훅 파일 위치에서 `CLAUDE.md` 를 찾아 올라간다 |
| `targetPath(input)` | `tool_input.file_path` ‖ `tool_response.filePath` — `Write`·`Edit` 이 같은 칸을 쓴다 |
| `repoRelative(abs)` | 저장소 기준 상대 경로(슬래시 통일). **바깥이면 빈 문자열** |
| `pass()` · `deny(reason)` · `warn(message)` | 통과 · 차단(`PreToolUse` 전용) · 알림(`PostToolUse` 전용) |

**두 가지가 설계 결정이다** — 고칠 때 되돌리지 않는다:

- **`REPO` 를 `process.cwd()` 로 바꾸지 않는다.** 훅이 어느 경로에서 불릴지는 하네스가 정하고, 그것이 바뀌면 **훅이 조용히 아무것도 안 하게** 된다.
- **`repoRelative` 는 저장소 밖을 빈 문자열로 돌려준다.** `normalize-encoding` 은 파일을 *고치므로* 밖을 상대 경로로 오인하면 남의 파일을 손댄다. **다른 드라이브**가 그 자리다 — 윈도우에서 `relative('D:\repo', 'C:\tmp\x')` 는 `..` 로 시작하지 않고 **절대 경로 그대로**를 돌려준다.

`warn()` 은 `systemMessage`(사람)와 `additionalContext`(모델)를 **둘 다** 보낸다 — *사람이 봤는데 AI 는 모르는* 상태를 만들지 않는다.

## 새 훅을 더할 때

1. **강도를 먼저 정한다** — 차단 · 교정 · 경고 · 기록. 판단이 필요하면 경고이고, 말할 것이 없으면 기록이다([automation-matrix](./automation-matrix.md)).
2. `lib.mjs` 만 import 한다. **의존성을 더하지 않는다** — 훅이 자기 의존성을 갖는 순간 그 설치가 새 사람의 첫 관문이 된다.
3. `.claude/settings.json` 에 이벤트·matcher·timeout·`statusMessage` 를 배선한다.
4. **막기만 하지 않는다.** `deny` 의 문구에 *고칠 곳* 과 *다음에 돌릴 것* 을 함께 적는다.
5. [automation-matrix.md](./automation-matrix.md) 의 훅 표와 이 파일에 행을 더한다. CLAUDE.md §8 의 표도 함께 본다.

## 훅이 의심스러울 때

```bash
echo '{"tool_input":{"file_path":"sources/backend/bootstrap/src/main/resources/db/changelog/data/003-init-menu.csv"}}' | node .claude/hooks/guard-generated.mjs
```

- **출력이 비면 통과한 것이다**(`pass()` 는 아무 말도 하지 않는다).
- 아무 훅도 안 도는 것 같으면 `REPO` 탐색을 먼저 의심한다 — `CLAUDE.md` 를 6단계 위까지 찾는다.
- `doc-drift` 가 한 번 말하고 조용하면 정상이다. 다시 보려면 tmp 의 세션 파일을 지운다.

## 관련

- [hooks.md](./hooks.md) — 훅 하나하나가 무엇을 보고 무엇을 말하나
- [automation-matrix.md](./automation-matrix.md) — 무엇을 언제 · 강도가 왜 넷인가
- [skills.md](./skills.md) — 스킬과의 경계
