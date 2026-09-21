---
id: LLM-HRN-010
title: "Codex 하네스 어댑터"
category: harness
type: operation
created: "2026-09-10"
updated: "2026-09-21"
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

위임 판단·승인·사전 고지의 공통 정책은 [`sub-agents.md`](../sub-agents.md)가 정한다. Codex에서는
`.codex/config.toml`이 이 프로젝트의 주·기본 하위 모델과 동시 수를, `.codex/agents/`가 역할별
모델·추론 강도를 정한다.

`autonomous-quick-scan.toml`과 `autonomous-reviewer.toml`은 읽기 전용 자율 역할이다.
`autonomous-design-challenger.toml`은 여러 모듈 경계와 불확실한 제약이 얽힌 고난도 설계를 Sol High로
독립 반박하는 읽기 전용 자율 역할이다. `autonomous-implementation-worker.toml`은 상위 세션 권한을
상속하는 자율 구현 역할이고, `approval-specialist.toml`은 사용자 명시 승인을 받은 호출에만 쓴다.

## 세션 시작

`SessionStart`의 `startup` 그룹은 `session-start.mjs`로 `git-sync` → `session-brief`를 실행하고,
`resume|clear|compact` 그룹은 `session-brief.mjs`로 상태를 재주입한다. startup adapter는 아래 주의
문구를 CLI용 JSON `systemMessage`로 내고, 첫 사용자 응답 첫 줄에 같은 문구를 표시하라는 지시와
브리핑을 모델용 `additionalContext`로 낸다. 재개 adapter는 대화 중간 반복을 피하려고 브리핑만 넣는다.
두 `SessionStart` 그룹의 `statusMessage`는 Windows 앱에 `Codex 훅 승인 상태 확인`으로 표시한다.

> **[Codex 주의]** 훅은 Codex CLI에서 승인해야 작동합니다. CLI의 `/hooks`에서 승인 여부를 반드시 확인하세요. 새로 승인했다면 기존 Windows 앱 세션에는 적용되지 않으므로 새 세션 창을 여세요.

승인 상태·revision·재시작 표식을 저장하거나 자동 확인하지 않는다. `PreToolUse`도 훅 승인 여부 때문에
차단하지 않는다. 문서 규칙은 현재 작업에서 다시 읽어 적용할 수 있지만, CLI에서 훅을 새로 승인했거나
훅 배선이 바뀌면 Windows 앱의 기존 세션에는 활성화되지 않으므로 새 세션 창을 연다.

## 입력 차이

Codex shell은 hook에서 `Bash`로 보이고 명령은 `tool_input.command`에 온다. 파일 편집은
`tool_name: apply_patch`이며 matcher도 그 이름을 명시한다. patch 전체가 같은 `command`에 온다.
`.codex/hooks/file-chain.mjs`가 patch의 Add/Update/Delete/Move 대상들을 꺼내 Claude 정책 엔진이
이해하는 `file_path` 입력으로 바꾼다. 여러 파일이면 각 파일을 순서대로 검사하고 deny 하나라도 있으면
전체 patch를 막는다.

파일 사전 chain은 `pretool-bootstrap`을 거쳐 adapter import 전 오류도 deny로 바꾸되,
`.claude/hooks/*.mjs`·`.codex/hooks/*.mjs`만 수리 쓰기로 연다. Windows fail-closed wrapper는 JSON
문자열을 명령에 직접 넣지 않고 PowerShell 객체를 `ConvertTo-Json -Compress`로 직렬화한다.

## 출력과 컨텍스트

Codex가 읽는 출력은 사용자에게 경고를 표시하는 `systemMessage`와 모델 문맥을 보강하는
`hookSpecificOutput.additionalContext`를 함께 가진 JSON 하나다. adapter가 emitter 밖에서 stdout에 쓰면
출력 형태가 섞이므로, 항상 `outputs` 배열을 `emitHookResults` 한 곳으로 보낸다. `PreToolUse` 허용은
결정 없는 중립 JSON을 낸다.

공식 훅 계약은 `systemMessage`를 UI 또는 이벤트 스트림에 경고로 노출한다고 정의한다. CLI에서는
보이지만 현재 Windows 앱은 대화 화면에 표시하지 않는다. Windows 앱의 사용자 가시성은 startup의
모델 지시로 보완하며, 실제 새 세션 첫 응답에서 확인한다.

Codex에는 수치 사용량 경고 훅을 연결하지 않는다. 자동 또는 수동 압축 뒤
`SessionStart(source=compact)`가 다시 실행되어 `session-brief`가 프로젝트 상태와 하네스 정합성을
재주입한다.

## 커밋과 검증

커밋 메시지 마지막 줄은 `Agent: Codex`다. Windows에서는 PowerShell here-string을
`git commit -F - -- <경로…>`에 pipe한다.

```bash
node aidd-guide/harness/runtime/harness-check.mjs
node .codex/hooks/self-test.mjs
```

`codex features list`에서 `hooks stable true`인지 확인한다. 지원하지 않는 버전이면 정적 검사와
adapter self-test까지만 검증하고, 가능한 runtime에서 `SessionStart` 주의 문구와 기존 파일·셸 보호
hook의 대표 경로를 smoke test한다.
