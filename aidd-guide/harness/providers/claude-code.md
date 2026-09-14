---
id: LLM-HRN-009
title: "Claude Code 하네스 어댑터"
category: harness
type: operation
created: "2026-09-10"
updated: "2026-09-11"
status: active
sources: ["CLAUDE.md", ".claude/settings.json", ".claude/hooks/"]
tier: 2
tags: [harness, claude, adapter]
---

# Claude Code 하네스 어댑터

> 공통 의미는 [`hooks-contract.md`](../hooks-contract.md)가 갖는다. 여기는 Claude Code에서만
> 달라지는 발견 경로·입출력·검증 방법이다.

## 진입

- 공통 헌법: `CLAUDE.md` 첫 줄의 `@AGENTS.md` import
- 스킬 발견 경로: `.claude/skills/{name}/SKILL.md`
- 훅 배선: `.claude/settings.json`
- 정책 엔진: `.claude/hooks/*.mjs`

## 스킬

공통 원본은 `aidd-guide/harness/skill-src/*.md`다. Claude용 `SKILL.md`는 생성물이므로 직접
고치지 않는다.

```bash
node aidd-guide/harness/runtime/sync-skills.mjs --write
```

직접 호출 문법은 `/스킬명`이다. 스킬 옆의 실행 스크립트는 기존 경로를 유지한다. 이 파일들은
Node 정책 엔진이며 Claude API에 묶이지 않았으므로 Codex도 같은 실물을 실행할 수 있다.

## 커밋

메시지 끝에 두 줄이 붙는다. **역할이 다르므로 둘 다 남긴다.**

```
Agent: Claude
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

`Agent:`는 **이 저장소의 표식**이고 두 AI 가 같은 형식으로 적는다(AGENTS.md §9) — 하나의
grep 으로 누가 만들었는지 셀 수 있어야 하기 때문이다. `Co-Authored-By:`는 **Claude Code 자체의
관례**이며 forge 가 공동 작성자로 읽는다. 둘은 메시지의 마지막 trailer 묶음이어야 하며,
붙이는 조건은 `CLAUDE.md`가 갖는다.

## 훅

Claude의 Write/Edit 계열 입력은 `tool_input.file_path`와 `content`/`new_string`을 사용한다.
같은 matcher group의 실행 순서에 기대지 않고, 순서가 필요한 검사는 한 chain 안에서 실행한다.
파일 사전 chain은 `pretool-bootstrap`을 거쳐 adapter import 전 오류까지 deny로 바꾼다. bootstrap
자체가 깨지면 쓰기는 닫히고 Bash는 남으므로 그 파일을 Bash로 복구한다.

**사전 훅 둘 다 `args` exec form이며 셸을 거치지 않는다.** Claude는 훅이 *시작조차 못 하면*
차단이 아니라 **통과**시킨다(exit 2만 막는다). 셸 형태로 두면 `bash`가 없는 윈도우 기계에서
게이트가 통째로 열리는데, 그것은 폐쇄망 고객사에서 가장 그럴듯한 환경이다. exec form은 그
경우를 없애고, adapter가 깨지는 경우는 `pretool-bootstrap`이 구조화된 deny로 바꾼다. 셸 chain도
같은 이유로 bootstrap을 거친다. 남는 구멍은 **bootstrap 자신의 구문 오류** 하나이며 `hook-syntax`
사후 훅과 CI의 `node --check`가 그 자리를 본다. Claude에는 `commandWindows`가 없으므로 Codex처럼
provider별 명령을 병기하지 않는다.

**matcher는 도구 이름으로 선다 — 그래서 쓰기 도구를 전부 적는다.** `Write|Edit|NotebookEdit`
외에 `^mcp__.*__(?:write|edit|move|create)`를 함께 건다. MCP 쓰기 도구(`write_file`·`edit_block`)는
`tool_input.path`·`file_path`를 쓰므로 `targetPath()`가 그대로 읽는다. 파일 대상이 없는 MCP 호출은
`guard-write`가 빈 경로로 통과시킨다. 셸 쓰기는 `guard-shell-write`가 같은 chain에 태운다.
`harness-check`가 대표 도구 이름을 이 정규식에 실제로 먹여 확인한다. **Codex의 MCP 쓰기 표면은
미검증이다** — 도구 이름이 다르고 실측하지 못했다.

**셸 matcher도 같은 이유로 MCP를 적는다.** `Bash|PowerShell` 뒤에
`^mcp__.*__(?:start_process|execute_command|run_command|run_shell_command|shell_exec|bash|terminal|exec)`를
건다. 2026-09-14 실측에서 `Bash`로 막힌 `DROP TABLE`이 MCP `start_process`로는 그대로 돌았다 —
**파일 쪽만 MCP를 덮으면 셸 쪽으로 같은 명령이 나간다.** 이 도구들은 `tool_input.command`에 명령을
두므로 chain 셋이 그대로 읽는다. 이름을 넓게 잡은 것은 비용이 비대칭이기 때문이다. 더 잡으면
명령이 없어 즉시 통과하고, 덜 잡으면 게이트가 사라진다. 이어 넣는 입력(`interact_with_process`)은
덮지 않는다 — `hooks-contract.md`가 그 한계를 갖는다.

`SessionStart`는 matcher 없이 `session-start.mjs` 하나를 걸고, **작업 중간(`resume`·`clear`·
`compact`)인지는 훅 입력의 `source`로 판정한다** — matcher 문자열이 어긋나면 브리핑 자체가
사라지는 반면, `source` 판정은 틀려도 브리핑은 남기 때문이다. Codex는 같은 결과를 matcher 분리로
얻는다(`providers/codex.md`).

컨텍스트만 공통 구현에서 제외한다. `context-gauge.mjs`는 Claude transcript의 실제 usage를
측정해 60%부터 5%p 간격으로 `/compact`를 권한다. 분모·입력 형식이 바뀌면 Claude 쪽에서
재측정하고 이 문서와 훅을 함께 고친다.

## 확인

```bash
node aidd-guide/harness/runtime/harness-check.mjs
node .claude/hooks/harness-doc.mjs --check
for f in .claude/hooks/*.mjs; do node --check "$f"; done
```

**`Write`·`Edit`이 전부 막히면** 사전 chain이 죽은 것이다. 차단 사유가 어느 훅인지 말해 주며,
그때는 **Bash로** 고친다 — `.claude/hooks/*.mjs`·`.codex/hooks/*.mjs`를 고치는 쓰기만 열려 있다
([hooks-contract.md](../hooks-contract.md)의 「깨진 보호에서 빠져나오는 길」).

startup pull이 `CLAUDE.md`·`AGENTS.md`·하네스를 바꿨으면 이미 읽은 규칙과 배선은 갱신되지
않는다. 그 세션에서 작업하지 않고 새 Claude Code 세션을 연다.

새로 clone한 환경에서는 Claude Code가 프로젝트 훅 실행 권한을 요청할 수 있다. 배선을 바꾼 뒤
실제 Claude 세션에서 SessionStart와 대표 차단·경고 fixture를 한 번 확인한다.

Codex의 `/hooks` 승인 revision과 `[Codex 훅 실행 확인]` preflight는 Claude Code에 연결하지
않는다. 공통 훅을 수정한 작성자가 검증 단계에서 Codex revision을 갱신할 뿐, Claude의
`SessionStart`·사용자 요청·설정 파일을 자동으로 막거나 바꾸지 않는다.
