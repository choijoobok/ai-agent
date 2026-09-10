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
기존 task는 새 `AGENTS.md`와 hook 설정을 다시 읽지 않으므로 하네스를 pull·수정한 뒤에는
**새 task를 열고 `/hooks` 승인을 다시 확인한다.**

`aidd-guide/harness/runtime/codex-hook-revision.mjs`는 Codex adapter와 공통 정책의 실행면을
SHA-256 revision으로 묶는다. 훅 작성자는 `--sync`로 그 값을 `.codex/hooks.json`의 startup
실행 명령 인자에 반영한다. 그러면 공통 정책만 바뀌어도 실제 명령이 바뀌어 팀원별 재승인을
요구한다. `harness-check`와 CI가 revision 갱신 누락을 막는다.

승인된 `SessionStart`만 `[Codex 훅 실행 확인] revision=…`을 문맥에 넣는다. `AGENTS.md`의
Codex 전용 검사는 매 요청에서 그 값과 현재 실행면을 대조하며, 없거나 다르면 일반 작업을
보류한다. 이는 Codex 엔진의 보안 경계가 아니라 저장소 절차의 강제 장치다. 승인되지 않은 훅은
스스로 실행될 수 없다는 부트스트랩 한계는 남으며, 우회용 trust 플래그는 사용하지 않는다.

변경 전 revision 검사를 통과한 task가 사용자의 요청으로 훅을 작성한 경우에는
`harness-sync`의 검증과 그 변경만 담은 경로 지정 커밋 한 번까지 끝낸다. 시작부터 불일치했거나
pull로 새 훅을 받은 task는 이 종료 예외를 쓸 수 없다. 커밋 뒤에는 `/hooks` 승인과 새 task가
필요하다.

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
`resume|clear|compact`는 `session-brief.mjs`만 돈다. **matcher로 가르는 이유**는 Codex hook 입력의
`source` 필드가 안정 계약에 없기 때문이다 — 필드를 짐작해 분기하면 압축 뒤에 원격을 당기게 되고,
그때 파일이 바뀌면 AI가 방금 읽은 것과 디스크가 어긋난다. Claude는 같은 결과를 입력의 `source`로
판정한다.

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

관리형 Windows sandbox가 hook 안의 자식 `node --check`를 `EPERM`으로 거절하면 `hook-syntax`는
이를 구문 오류로 부르지 않고 **검사 불가**로 알린다. 그때 AI가 최상위 shell에서 같은 명령을
실행하며, 다음 사전 쓰기는 bootstrap이 실제 import 오류를 차단한다.
