---
id: LLM-CTX-001
title: "컨텍스트 예산 관리"
category: harness/context
type: operation
created: "2026-04-30"
updated: "2026-09-10"
status: active
sources: []
tier: 1
tags: [context, budget, compact, clear]
---
# 컨텍스트 예산 관리

> 공통 목표는 수치 표시가 아니라 압축 전후에도 현재 상태·결정·다음 행동을 잃지 않는 것이다.

## 공통 원칙

- 수식·도구 횟수로 사용량을 추정하지 않는다.
- runtime이 안정된 입력으로 준 실제 token usage만 수치로 사용한다.
- 매 응답에 게이지를 붙이지 않는다. 경고 자체가 문맥과 주의를 소비한다.
- 압축 뒤 다시 읽어야 할 정본은 `AGENTS.md`, `project.state.yaml`, 현재 phase 문서다.

## Claude Code

`context-gauge.mjs`가 `UserPromptSubmit`에서 직전 assistant usage를 읽는다. 60%부터 5%p
구간마다 한 번 `/compact`를 권한다. transcript 형식이나 context window가 바뀌면 Claude
runtime에서 다시 실측해 분모와 임계값을 고친다.

`/compact` 전에는 현재 작업·확정 결정·미결·검증 결과가 정본에 반영됐는지 본다. 압축을
반복 횟수로 기계적으로 제한하지 않는다. 손실 징후가 보이면 새 세션을 제안한다.

## Codex

Codex에는 백분율 게이지를 구현하지 않는다. 자동 압축 뒤
`SessionStart(source=compact)`가 같은 턴의 다음 model request 전에 실행되며 `session-brief`가
상태와 하네스 정합성을 재주입한다. 자동 압축은 경고 대상이 아니다.

PreCompact/PostCompact는 실제로 저장할 별도 상태가 생길 때만 추가한다. 단지 "압축됐다"는
알림을 내려고 훅을 만들지 않는다.

## 압축 전후 보존 목록

- 현재 phase와 gate 상태
- 사용자가 확정한 결정과 아직 답하지 않은 질문
- 지금 수정 중인 파일과 남은 검증
- 실패한 명령의 원인과 재시도 조건

## 컨텍스트 보호 습관

| 상황 | 도구 |
|-----|------|
| 사소한 확인 | 본 작업과 분리된 도구가 provider에 있으면 사용 |
| 코드베이스 탐색 | 독립·범위가 명확할 때만 서브에이전트 위임 |
| 잘못된 방향 | 더 읽기 전에 가정과 목표를 다시 고정 |
| 긴 출력 | 파일에 이미 있는 내용은 경로와 필요한 부분만 문맥에 넣기 |

## JIT Context (Just-in-Time)

> Anthropic "Effective context engineering": 모든 컨텍스트를 미리 적재하지 않고 **필요한 순간에 fetch**. Reading Map · seek-read 의 이론적 근거.

- 큰 문서는 통째로 읽지 않고 검색 뒤 필요한 범위만 읽는다([reading.md](./reading.md)).
- 도메인 지식은 사용 시점에만 진입 (`knowledge/` 결정 트리).
  *규칙은 알겠는데 왜 그런가* 가 남을 때만 들어간다. **금지가 아니라 순서다** —
  근거를 못 읽으면 다음 사람이 규칙을 뒤집는다.

## Cache-Aware (5분 TTL)

> Anthropic prompt cache 는 5분 TTL. 안정적 prefix 우선 배치로 hit rate 향상.

- 시스템 프롬프트·`AGENTS.md` 변경 자제 — 변경하면 캐시가 무효화될 수 있다.
- 같은 구간을 다시 읽을 때는 같은 offset 을 쓴다 — 매번 다른 offset 은 캐시 미스.

## 관련 카테고리

- [AGENTS.md](../../../AGENTS.md) — 헌법·응답 규칙
- [../providers/claude.md](../providers/claude.md) · [../providers/codex.md](../providers/codex.md)
- [harness/context/reading.md](./reading.md) — 토큰 절약 읽기 전략
- [harness/context/failure-modes.md](./failure-modes.md) — Context Rot 등 실패 모드
- [quality/observability/token-economics.md](../../quality/observability/token-economics.md) — 캐시 hit rate 측정
