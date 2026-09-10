---
name: harness-sync
description: Claude Code와 Codex가 함께 쓰는 스킬·훅을 추가하거나 수정하고 양쪽 구현의 누락·불일치를 복구한다. "새 스킬", "새 훅", "Claude와 Codex에 같이 추가", "하네스 동기화", "하네스 불일치" 요청이나 SessionStart parity 경고가 있을 때 쓴다.
---

# 하네스 동기화

공통 명세를 먼저 바꾸고 provider 구현과 검증을 같은 변경으로 완성한다. 한 AI 구현을 다른
AI 디렉터리에 그대로 복사하는 것이 아니라, 공통 결과와 각 runtime 입력을 분리한다.

## 1. 추가 가치와 경계를 판정한다

[`aidd-guide/harness/tool-curation.md`](../../../aidd-guide/harness/tool-curation.md)의 추가 게이트를
통과한다. 자동 이벤트 검사면 훅, 사용자가 시작하는 여러 단계 절차면 스킬, 사람이 읽는 설명이면
가이드다. 같은 규칙을 둘에 중복하지 않는다.

## 2. 공통 명세부터 고친다

- 스킬: `aidd-guide/harness/skill-src/{name}.md`를 먼저 추가·수정한다.
- 훅: `aidd-guide/harness/hooks-contract.md`에 이벤트, 입력, 판정, 강도, 출력, 실패 정책,
  test fixture를 먼저 적는다.
- 능력 매핑: `aidd-guide/harness/capabilities.yaml`에 공통 목적과 provider 전략을 반영한다.
- 목록: `aidd-guide/harness/skills.md`, `hooks.md`, `INDEX.md`의 해당 카탈로그를 갱신한다.

## 3. provider별로 구현한다

- Claude Code: `.claude/settings.json`, `.claude/hooks/`, `/스킬명` 문법을 따른다.
- Codex: `.codex/hooks.json`, `.codex/hooks/`, `$스킬명` 문법을 따른다.
- 공통 정책 엔진을 공유하되 runtime 입력은 adapter가 정규화한다.
- chain 순서는 `aidd-guide/harness/runtime/chains.mjs` 한 곳에서만 고친다.
- 사전 훅 진입부를 바꾸면 정상 policy fixture뿐 아니라 **adapter import 실패 fixture**도 돌린다.
- 컨텍스트는 예외다. Claude는 실측 usage 경고, Codex는 자동 압축 후 재주입으로 구현한다.
- 대상 runtime에서 지원하지 않는 기능은 흉내 내지 말고 provider 문서에 `미검증` 또는
  `미지원`으로 기록한다.

## 4. 생성하고 검증한다

```bash
node aidd-guide/harness/runtime/sync-skills.mjs --write
node aidd-guide/harness/runtime/codex-hook-revision.mjs --sync
node aidd-guide/harness/runtime/harness-check.mjs
node .codex/hooks/self-test.mjs
node .claude/hooks/harness-doc.mjs --write
node aidd-guide/meta/_meta/lint.mjs
```

스킬 폴더의 `SKILL.md`를 직접 고치지 않는다. 검사가 불일치를 찾으면 공통 원본 또는 생성기를
고친 뒤 다시 생성한다. 실제 Claude와 Codex 세션에서 각각 대표 trigger 하나와 차단/경고 하나를
smoke test하고, 실행하지 못한 쪽은 완료로 가장하지 않고 남은 검증을 보고한다.
하네스 파일을 pull하거나 고친 세션은 이미 읽은 진입 문서·hook hash를 새 것으로 간주하지 않는다.
Codex는 실행 확인이 없어도 **수리 차선**으로 이 절차를 끝까지 밟는다 — 위 검증과 **해당
변경만 경로 지정한 커밋 한 번**까지다(AGENTS.md §2). 그 밖의 일반 업무는 보류한다. 커밋 뒤 새
실행이 필요하다. Claude Code는 새 세션을 연다. Codex 데스크톱 앱은 사용자에게 완료된 대화를
복사한 새 task로 이동할지 묻고, 승인되면 현재 턴을 끝낸 뒤 같은 작업 폴더로 fork해 child task로
이동한다. Codex CLI는 같은 task 재개 여부를 묻고, 승인되면 `/hooks`에서 현재 정의를 승인하고
현재 실행을 끝낸 뒤 `codex resume <SESSION_ID>`(가장 최근 task면 `codex resume --last`)로 돌아와
smoke test한다. client가 불명확하면 어느 쪽인지 먼저 묻는다. 사용자 승인은 낡은 훅을 현재
실행에서 우회하는 허가가 아니다.
