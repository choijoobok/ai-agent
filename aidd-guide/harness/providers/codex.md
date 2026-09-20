---
id: LLM-HRN-010
title: "Codex 하네스 어댑터"
category: harness
type: operation
created: "2026-09-10"
updated: "2026-09-14"
status: active
sources: ["AGENTS.md", "aidd-guide/harness/sub-agents.md", ".codex/config.toml", ".codex/agents/", ".codex/hooks.json", ".codex/hooks/", ".agents/skills/"]
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

## 하위 에이전트

위임 판단·승인·사전 고지의 공통 정책은 [`sub-agents.md`](../sub-agents.md)가 정한다. Codex에서는 `.codex/config.toml`이 이 프로젝트의 주·기본 하위 모델과 동시 수를, `.codex/agents/`가 역할별 모델·추론 강도를 정한다.

`autonomous-quick-scan.toml`과 `autonomous-reviewer.toml`은 읽기 전용 자율 역할이다. `autonomous-design-challenger.toml`은 여러 모듈 경계와 불확실한 제약이 얽힌 고난도 설계를 Sol High로 독립 반박하는 읽기 전용 자율 역할이다. `autonomous-implementation-worker.toml`은 상위 세션 권한을 상속하는 자율 구현 역할이고, `approval-specialist.toml`은 사용자 명시 승인을 받은 호출에만 쓴다.

프로젝트 훅은 저장소를 신뢰한 뒤 `/hooks`에서 현재 hash를 검토·승인해야 실행된다. 훅 파일이나
배선을 바꾸면 hash가 달라져 다시 검토해야 한다.
현재 실행은 새 `AGENTS.md`와 hook 설정을 중간에 갈아 끼우지 못한다. 문서·스킬 변경은 필요한
부분을 다시 읽고 계속하며, **실제 Codex 훅 실행면 revision이 바뀐 경우에만** 최신 훅 집행이 필요한
작업을 지금 이어갈지 사용자에게 확인한다. 사용자가 선택하면 현재 client가 지원하는 방식으로
대화를 잇는다.

- **Codex 데스크톱 앱**: 사용자가 최신 훅 집행을 지금 이어가기로 고른 경우, 새 task 이동을 묻기 전에 변경된 훅의 신뢰 승인을 먼저 끝낸다. 앱에
  hook 검토 화면이 있으면 거기서 승인하고, 없으면 저장소 루트에서 Codex CLI를 열어 그 TUI의
  `/hooks`로 승인한다. 사용자가 완료했다고 확인하기 전에는 새 task 이동을 묻거나 만들지 않는다.
  완료 확인 뒤 현재 작업 맥락을 인계한 새 task로 이동할지 묻는다. 승인되면 현재 턴을 끝낸 뒤
  같은 saved project를 직접 쓰는 새 local task를 `thread/start`로 만들고, 완료한 일·남은
  일·원본 task를 읽는 방법을 첫 prompt에 넘긴 뒤 앱 화면을 이동한다. 기존 task는 지우지 않는다.
  `thread/fork`는 기록은 복사하지만 새 hook 실행면을 싣는 수단이 아니었다(아래 실측). 앱의 hook
  검토 화면은 공식 문서에서 확인하지 못했으므로, 화면이 없으면 자동 승인했다고 가장하지 않는다
  ([Hooks](https://learn.chatgpt.com/docs/hooks)). PowerShell에 `/hooks`를 직접 입력하는 것이 아니라
  `codex`로 연 CLI 대화 화면 안에서 실행한다.
- **Codex CLI**: 사용자가 최신 훅 집행을 지금 이어가기로 고른 경우, 같은 task를 새 실행으로 재개할지 묻는다. 승인되면 `/hooks`에서 현재 hash를
  검토·승인하고 현재 실행을 끝낸 뒤 `codex resume <SESSION_ID>`(가장 최근 task면
  `codex resume --last`)로 돌아온다. 공식 문서도 `resume`이 기존 대화를 잇고 그때
  `SessionStart`의 source가 `resume`이라고 명시한다
  ([CLI 명령](https://learn.chatgpt.com/docs/developer-commands?surface=cli),
  [Hooks](https://learn.chatgpt.com/docs/hooks)).
- **client 불명**: 앱인지 CLI인지 사용자에게 한 번 묻고, 확정 전에는 어느 경로도 강제하지 않는다.

일반 요청의 preflight는 제품 컨텍스트를 `--surface desktop|cli`로 명시한다. startup 훅처럼
그 컨텍스트가 없는 자리는 `CODEX_APP_TOOLS_PIPE_PATH` 또는 `CODEX_INTERNAL_ORIGINATOR_OVERRIDE`
의 관측값으로 데스크톱 앱만 보조 판정하고, 아무 표식도 없으면 CLI로 추정하지 않고 `unknown`으로
남긴다. 이 환경변수는 공식 계약으로 확인되지 않았으므로 안전한 기본값은 질문이다.

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
자리다.** 커밋 뒤에는 사용자 승인을 받고, 데스크톱 앱이면 새 local task에 맥락 인계·이동, CLI면
`/hooks` 검토 뒤 같은 task 재개가 필요하다.

## 입력 차이

Codex shell은 hook에서 `Bash`로 보이고 명령은 `tool_input.command`에 온다. 파일 편집은
`tool_name: apply_patch`이며 matcher도 그 이름을 명시한다. patch 전체가 같은 `command`에 온다.
`.codex/hooks/file-chain.mjs`가
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
`source`로 판정한다. CLI에서 같은 task를 `codex resume`로 다시 열면 두 번째 그룹이 현재
revision 실행 확인과 프로젝트 상태를 새 문맥에 넣는다. 데스크톱 앱의 새 local task가 startup
그룹을 실행해 같은 결과를 내는지는 smoke test로 확인한다. revision만으로 사전 훅
실행까지 추정하지 않고 아래 생존 카나리로 사전 명령 훅의 자동 집행 여부를 따로 알린다. 실제 훅
실행면이 아닌 문서·스킬 변경은 새 실행을 요구하지 않는다.

### `PreToolUse` 생존 카나리

새 데스크톱 task에서 revision 검사 직후 아래 명령을 **별도 도구 호출**로 한 번 실행한다.

```bash
node aidd-guide/harness/runtime/codex-hook-revision.mjs --pretool-canary <SessionStart revision>
```

현재 `guard-bash`가 실행 중이면 스크립트 진입 전에 `[Codex PreToolUse 생존 확인]` 사유로 차단한다.
훅이 빠졌거나 실패해 열린 경우에는 스크립트가 실행되어 0이 아닌 종료와 실패 문구를 낸다. 파일이나
외부 상태를 바꾸지 않으므로 실패 경로도 무해하다. **revision 불일치·확인 부재는 업무를 보류하지만,
revision이 맞는 새 실행에서 카나리만 실패하면 자동 집행 결손을 사용자에게 한 번 알리고
`AGENTS.md`·`aidd-guide/`의 동일 규칙을 직접 적용하며 일반 업무를 계속한다.**
[Codex Hooks 공식 문서](https://learn.chatgpt.com/docs/hooks#tool-calls-from-code-mode)는
`exec_command`와 코드 모드의 중첩 호출도 `Bash` matcher를 탄다고 설명하지만, 2026-09-11 실측에서
데스크톱 앱 26.901.6511.0(내장 CLI 0.153.4)과 CLI 0.154.0 모두 코드 모드 안쪽
`exec_command`에 `PreToolUse`를 호출하지 않았다. 같은 결손은
[openai/codex#23411](https://github.com/openai/codex/issues/23411)에서 공개 추적 중이며, 현재 릴리스
실측에서도 재현된다. matcher를 넓혀도 처리기 자체가 시작되지 않았고, 코드 모드 호스트를 끄면
직접 shell로 바뀌지 않고 도구가 닫혔다. **승인한 새 실행에서 revision은 맞는데 카나리만 실행되면
재승인·새 task를 반복하지 않는다.** 이때는 제품의 중첩 호출 결손으로 보고하되 카나리를 별도
게이트로 만들지 않는다. 같은 코드 모드의 `apply_patch`도 2026-09-11 실측에서 파일 사전 가드가
호출되지 않았고, 유효한 패치 뒤의 `PostToolUse`는 호출됐다. 플랫폼 sandbox와 승인 절차는 그대로
두고, 네 사전 가드(`guard-write`·`guard-generated`·`guard-bash`·`guard-commit`)가 집행하던
문서 규칙을 AI가 직접 지킨다.

**출력은 JSON이다** — `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":…}}`.
Claude는 같은 자리에서 날 것의 텍스트를 쓰며, 두 갈래는 `emitHookResults` 한 곳에서
`provider()`로 갈린다. **어댑터가 따로 stdout에 쓰지 않는다** — 두 곳에서 쓰면 형태가 섞여
Codex가 훅 전체를 실패로 잡는다. 낼 것은 `outputs` 배열에 넣어 같은 emitter로 보낸다.
2026-09-11에 이것 때문에 실행 확인이 문맥에 닿지 못했고, 훅은 셸·`commandWindows`·
`codex sandbox` 어디서 직접 돌려도 `exit 0`이라 **직접 실행으로는 보이지 않았다.**

`PreToolUse` 허용도 Codex에서는 결정 없는 중립 JSON을 낸다. 공식 계약상 종료 코드 0의 빈 출력은
성공이지만, CLI 0.154.0의 직접 shell 기록은 안전한 명령마다 `PreToolUse Failed`를 표시한 뒤
명령을 실행했다. 그 기록에는 처리기 stderr가 없어 과거 실패의 단일 원인은 확정할 수 없다.
중립 JSON은 침묵을 실패로 오인하는 실행면을 피하는 호환 조치이며, 위 코드 모드 결손을 고친다고
주장하지 않는다. adapter self-test는 이 실제 출력 바이트까지 고정한다.

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

재연결 smoke test는 client별로 나눈다. CLI는 `/hooks` 승인 뒤 현재 실행을 끝내고
`codex resume <SESSION_ID>`로 돌아온다. 데스크톱 앱은 새 local task에 작업 맥락을 넘겨 이동한다.
양쪽 모두 첫 요청에서 `[Codex 훅 실행 확인] revision=…`이 주입되는지, `PreToolUse` 카나리가
차단되는지, 직전 완료 작업을 인계받았는지를 함께 본다. revision이나 맥락 인계가 실패하면 해당
client의 재연결 지원을 완료로 쓰지 않는다. 카나리만 실패하면 자동 사전 차단은 미지원으로 기록하고
사용자에게 알리되, 문서 규칙을 직접 적용하며 작업은 계속한다.

관리형 Windows sandbox가 hook 안의 자식 `node --check`를 `EPERM`으로 거절하면 `hook-syntax`는
이를 구문 오류로 부르지 않고 **검사 불가**로 알린다. 그때 AI가 최상위 shell에서 같은 명령을
실행하며, 다음 사전 쓰기는 bootstrap이 실제 import 오류를 차단한다.
