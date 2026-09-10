---
id: LLM-HRN-010
title: "Codex 하네스 어댑터"
category: harness
type: operation
created: "2026-09-10"
updated: "2026-09-10"
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

## 입력 차이

Codex shell은 hook에서 `Bash`로 보이고 명령은 `tool_input.command`에 온다. 파일 편집은
`tool_name: apply_patch`이며 patch 전체가 같은 `command`에 온다. `.codex/hooks/file-chain.mjs`가
patch의 Add/Update/Delete/Move 대상들을 꺼내 Claude 정책 엔진이 이해하는 `file_path` 입력으로
바꾼다. 여러 파일이면 각 파일을 순서대로 검사하고 deny 하나라도 있으면 전체 patch를 막는다.

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

## 확인과 제약

```bash
node aidd-guide/harness/runtime/harness-check.mjs
node .codex/hooks/self-test.mjs
```

`codex features list`에서 `hooks stable true`인지 확인한다. 지원하지 않는 버전이면 정적 검사와
adapter self-test까지만 검증되고, 지원 버전으로 올린 뒤 `/hooks` 신뢰 승인과 실제
SessionStart/PreToolUse/PostToolUse smoke test가 남는다. 훅은 유용한 guardrail이지 모든 도구를
포괄하는 보안 경계가 아니므로 CI의 동일 검사를 제거하지 않는다.
