---
id: LLM-HRN-010
title: "Codex 하네스 어댑터"
category: harness
type: operation
created: "2026-09-10"
updated: "2026-09-11"
status: active
sources: ["AGENTS.md", ".codex/hooks.json", ".codex/hooks/", ".agents/skills/"]
tier: 2
tags: [harness, codex, adapter]
---

# Codex 하네스 어댑터

> 공통 의미는 [`hooks-contract.md`](../hooks-contract.md)가 갖는다. 여기는 Codex에서만
> 달라지는 발견 경로·입출력·검증 방법이다.

## 진입

- 공통 헌법: 저장소 루트 `AGENTS.md`
- 스킬 발견 경로: `.agents/skills/{name}/SKILL.md`
- 훅 배선: `.codex/hooks.json`
- 어댑터: `.codex/hooks/*.mjs`
- 정책 엔진: `.claude/hooks/*.mjs` — 경로 이름만 역사적이며 로직은 공용 Node 모듈이다

프로젝트 훅은 저장소를 신뢰한 뒤 `/hooks`에서 현재 hash를 검토·승인해야 실행된다. 훅 파일이나
배선을 바꾸면 hash가 달라져 다시 검토해야 한다.
현재 실행은 새 `AGENTS.md`와 hook 설정을 중간에 갈아 끼우지 못하므로 하네스를 pull·수정한
뒤 그 자리에서 업무를 계속하지 않는다. 대신 사용자에게 **대화 기록을 유지한 채 같은 task를
새 실행으로 재개할지** 묻는다. 승인되면 `/hooks`에서 현재 hash를 검토·승인하고 현재 실행을
끝낸 뒤 `codex resume <SESSION_ID>`(가장 최근 task면 `codex resume --last`)로 돌아온다.
Codex 공식 문서도 `resume`이 기존 대화를 그대로 잇고, 그때 `SessionStart`의 source가
`resume`이라고 명시한다([CLI 명령](https://learn.chatgpt.com/docs/developer-commands?surface=cli),
[Hooks](https://learn.chatgpt.com/docs/hooks)). 새 빈 task는 사용자가 원할 때만 연다.

`aidd-guide/harness/runtime/codex-hook-revision.mjs`는 Codex adapter와 공통 정책의 실행면을
SHA-256 revision으로 묶는다. 훅 작성자는 `--sync`로 그 값을 `.codex/hooks.json`의 startup
실행 명령 인자에 반영한다. 그러면 공통 정책만 바뀌어도 실제 명령이 바뀌어 팀원별 재승인을
요구한다. `harness-check`와 CI가 revision 갱신 누락을 막는다.

승인된 `SessionStart`만 `[Codex 훅 실행 확인] revision=…`을 문맥에 넣는다. `AGENTS.md`의
Codex 전용 검사는 매 요청에서 그 값과 현재 실행면을 대조하며, 없거나 다르면 일반 작업을
보류한다. 이는 Codex 엔진의 보안 경계가 아니라 저장소 절차의 강제 장치다. 승인되지 않은 훅은
스스로 실행될 수 없다는 부트스트랩 한계는 남으며, 우회용 trust 플래그는 사용하지 않는다.

### 수리 차선 — 확인이 없어도 고칠 수는 있어야 한다

**무엇이 열리는지는 [`AGENTS.md`](../../../AGENTS.md) §2 의 표가 갖는다** — Codex가 매 세션
읽는 것이 거기이므로 집행문도 거기 있어야 한다. 여기는 **왜** 다.

**보류가 수리까지 막으면 교착이다.** 확인이 오지 않는 원인은 하네스 안에 있는데, 확인이
없다는 이유로 조사와 `harness-sync`까지 막으면 **그 원인을 고칠 방법이 사라진다.**

2026-09-11에 실제로 그랬다. 옛 규칙에는 **작성 task만을 위한 좁은 종료 예외**가 있었고
*"시작부터 불일치했거나 pull로 변경을 받은 task에는 적용하지 않는다"*고 못박았다 — 그런데
**표식 없이 시작한 task가 바로 원인을 조사해야 할 task다.** 예외가 필요한 자리를 정확히
비켜 간 것이며, 그래서 그 좁은 예외를 수리 차선이 대신한다.

**이 저장소가 이미 한 번 푼 문제의 같은 해법이다** — `allowHookRepair`는 훅이 죽었을 때
*훅 파일만* 열고 나머지는 닫는다(`ee6ee49`: *"훅 하나가 깨지면 그 훅을 고칠 도구까지 함께
잠겼다 — 길을 알리고 수리 자리만 연다"*). **차단의 반대말은 전면 개방이 아니라 좁은 수리
자리다.** 커밋 뒤에는 사용자 승인 → `/hooks` 검토 → 같은 task 재개가 필요하다.

## 입력 차이

Codex shell은 hook에서 `Bash`로 보이고 명령은 `tool_input.command`에 온다. 파일 편집은
`tool_name: apply_patch`이며 patch 전체가 같은 `command`에 온다. `.codex/hooks/file-chain.mjs`가
patch의 Add/Update/Delete/Move 대상들을 꺼내 Claude 정책 엔진이 이해하는 `file_path` 입력으로
바꾼다. 여러 파일이면 각 파일을 순서대로 검사하고 deny 하나라도 있으면 전체 patch를 막는다.
파일 사전 chain은 `pretool-bootstrap`을 거쳐 adapter import 전 오류도 deny로 바꾸되,
`.claude/hooks/*.mjs`·`.codex/hooks/*.mjs`만 수리 쓰기로 연다.
Windows fail-closed wrapper는 JSON 문자열을 명령에 직접 넣지 않고 PowerShell 객체를
`ConvertTo-Json -Compress`로 직렬화한다 — `cmd.exe` 경계에서 따옴표가 벗겨지는 것을 막는다.

## 세션 시작

`SessionStart`를 두 그룹으로 나눈다. `startup`은 `session-start.mjs`(`git-sync` → `session-brief`),
`resume|clear|compact`는 `session-brief.mjs`만 돈다. Codex는 `SessionStart.source`와 matcher를
정식 계약으로 제공한다. **matcher에서 먼저 가르는 이유**는 `git-sync`를 `startup` 경로에서만
실행해 압축·재개 중 파일을 바꾸지 않기 위해서다. Claude는 같은 결과를 adapter 안에서 입력의
`source`로 판정한다. 같은 task를 `codex resume`로 다시 열면 두 번째 그룹이 현재 revision 실행
확인과 프로젝트 상태를 새 문맥에 넣는다. 그 확인이 들어오기 전에는 일반 업무를 재개하지 않는다.

**출력은 JSON이다** — `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":…}}`.
Claude는 같은 자리에서 날 것의 텍스트를 쓰며, 두 갈래는 `emitHookResults` 한 곳에서
`provider()`로 갈린다. **어댑터가 따로 stdout에 쓰지 않는다** — 두 곳에서 쓰면 형태가 섞여
Codex가 훅 전체를 실패로 잡는다. 낼 것은 `outputs` 배열에 넣어 같은 emitter로 보낸다.
2026-09-11에 이것 때문에 실행 확인이 문맥에 닿지 못했고, 훅은 셸·`commandWindows`·
`codex sandbox` 어디서 직접 돌려도 `exit 0`이라 **직접 실행으로는 보이지 않았다.**

## 컨텍스트

Codex에는 사용량 백분율 훅을 만들지 않는다. 자동 압축 뒤
`SessionStart(source=compact)`가 다시 실행되므로 `session-brief`가 프로젝트 상태와 하네스
정합성을 즉시 재주입한다. stable hook 입력에 실제 token usage가 추가되기 전에는 추정치를
경고로 내보내지 않는다.

## 커밋

메시지 끝에 한 줄을 붙인다.

```
Agent: Codex
```

Windows에서는 PowerShell here-string을 `git commit -F - -- <경로…>`에 pipe한다. 훅은 이 본문을
읽어 `Agent: Codex`가 마지막 줄인지 확인한다.

**이 값은 저장소가 정한 것이다.** Codex 자체의 커밋 표기 관례를 확인하지 못했고, 확인하지
못한 것을 표준인 양 적지 않는다 — 특히 남의 도구 이름으로 된 이메일 주소를 지어내지 않는다.
Codex 쪽에 문서화된 trailer 가 있으면 그것으로 바꾸고 이 절을 고친다.
@defer ? — Codex 공식 커밋 표기 확인

## 확인과 제약

```bash
node aidd-guide/harness/runtime/codex-hook-revision.mjs --sync
node aidd-guide/harness/runtime/harness-check.mjs
node .codex/hooks/self-test.mjs
```

`codex features list`에서 `hooks stable true`인지 확인한다. 지원하지 않는 버전이면 정적 검사와
adapter self-test까지만 검증되고, 지원 버전으로 올린 뒤 `/hooks` 신뢰 승인과 실제
SessionStart/PreToolUse/PostToolUse smoke test가 남는다. 훅은 유용한 guardrail이지 모든 도구를
포괄하는 보안 경계가 아니므로 CI의 동일 검사를 제거하지 않는다.

재개 smoke test는 `/hooks` 승인 뒤 현재 실행을 끝내고 `codex resume <SESSION_ID>`로 돌아와
첫 요청에서 `[Codex 훅 실행 확인] revision=…`이 주입되는지, 직전 대화 내용을 물었을 때 기존
기록을 근거로 답하는지를 함께 본다. 둘 중 하나라도 실패하면 새 빈 task로 폴백하고 재개 지원을
완료로 쓰지 않는다.

관리형 Windows sandbox가 hook 안의 자식 `node --check`를 `EPERM`으로 거절하면 `hook-syntax`는
이를 구문 오류로 부르지 않고 **검사 불가**로 알린다. 그때 AI가 최상위 shell에서 같은 명령을
실행하며, 다음 사전 쓰기는 bootstrap이 실제 import 오류를 차단한다.
