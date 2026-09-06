---
id: LLM-CTX-005
title: "컨텍스트 실패 모드 카탈로그"
category: harness/context
type: operation
created: 2026-05-04
updated: 2026-09-06
status: active
sources: []
tier: 1
tags: [context, failure-mode, rot, distraction, clash, poisoning]
---

# 컨텍스트 실패 모드 카탈로그

> LLM 컨텍스트가 길어지거나 잡음이 섞일 때 발생하는 4 가지 대표 실패 모드. 각 모드별 신호 + 즉시 대응을 정의.

## 4 가지 모드 (Drew Breunig 분류)

| 모드 | 정의 | 대표 신호 | 대응 |
|------|------|----------|------|
| **Context Rot** | 컨텍스트가 길어질수록 정확도 선형 이상으로 저하 | 같은 질문에 일관된 답을 못 함 | `/compact` 또는 `/clear` |
| **Clash** | 모순된 정보가 섞여 잘못된 정답 채택 | 기억과 현재 답이 다름 | SSoT 우선순위 명시, 결정적 출처만 |
| **Poisoning** | 잘못된 사실이 한번 들어가면 이후 응답 전염 | 존재하지 않는 함수·파일 인용 | 즉시 `/clear` + 검증 후 재시작 |

## Context Rot

- **선형이 아니다** — 50% 부터 가파르게 저하. 70% 넘으면 단순 반복도 틀림.
- 측정: [quality/observability/context-rot-monitor.md](../../quality/observability/context-rot-monitor.md)
- 예방: 200줄 운용 파일 룰, JIT Context (필요할 때만 fetch).

## Distraction

- **무관한 자료가 적재되면** 핵심 신호가 attention 에서 밀림.
- 예: `guide.md` 1394줄을 통째로 적재하면 Distraction. Reading Map 필수.

## Clash

- 두 출처가 모순될 때 LLM 은 **마지막에 들어온 것** 또는 **가장 강한 어조**를 채택.
- 대응: SSoT 우선순위 ([CLAUDE.md §3](../../../CLAUDE.md)) 강제 — 충돌 시 우선순위 표 따른다.
- 운영 룰: 문서·기억과 코드가 다르면 **코드를 신뢰한다**(CLAUDE.md §3).

## Poisoning

- AI 가 한 번 hallucinate 한 함수명·파일경로가 이후 응답에 살아남음.
- 대응:
  1. 발견 즉시 사용자에 알림.
  2. `/clear` 로 컨텍스트 폐기.
  3. 검증 절차(grep, 파일 존재 확인) 후 재시작.
- 예방: 메모리에서 파일·함수명을 인용할 때 **반드시 grep 으로 현존 검증** ([CLAUDE.md §3](../../../CLAUDE.md) — 검증 없이 과거 기록을 현재 사실로 쓰지 않는다).

## 진단 절차

1. AI 응답이 이상하면 어느 모드인지 분류.
2. 같은 입력 재실행 → flaky (모드 무관) vs persistent (4모드 중 하나).
3. 모드별 대응 즉시 실행.
4. 사례를 `quality/observability/context-rot-monitor.md` 데이터에 1줄 기록.

## 관련

- [budget.md](./budget.md) — 컨텍스트 측정·관리
- [reading.md](./reading.md) — JIT 읽기 전략
- [quality/observability/context-rot-monitor.md](../../quality/observability/context-rot-monitor.md)
