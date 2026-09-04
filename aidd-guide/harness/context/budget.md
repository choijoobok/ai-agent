---
id: LLM-CTX-001
title: "컨텍스트 예산 관리"
category: "02-context"
type: operation
created: "2026-04-30"
updated: "2026-04-30"
status: active
sources: 
author: Bong Jong Hyeon
tier: 1
tags: [context, budget, compact, clear]
---
# 컨텍스트 예산 관리

> AI 품질은 컨텍스트의 20~40% 부터 저하 (Lost in the Middle). 명시적 관리로 품질을 유지한다.

## 측정 — `/context` 실측

- 수식·가중치 추정은 사용하지 않는다
- **`/context` 명령의 실제 수치**만 신뢰
- 매 턴마다 호출하지 않는다 (호출 자체도 토큰 소비)

## 호출 타이밍

### 자동 호출 (직후 1회)

- 대용량 Read·Grep (500줄 이상 파일, 다수 파일 일괄 조회) 이후
- 에러 로그·스택트레이스·장문 출력 붙여넣기 이후
- 서브에이전트 결과 수신 이후
- **10~15턴마다 1회** 정기 체크

### 수동 호출 (사용자 요청 시)

- 긴 작업 시작 전
- `/compact` 판단 시

## 게이지 형식 (응답 마지막 필수)

```
CTX [█████░░░░░░░░░░░░░░░] 11% — 정상
```

- **수치 산출**: 마지막 `/context` 실측값 기준. 호출 간 턴은 직전 값 유지(소폭 가산 추정 가능)
- 새 `/context` 결과 들어오면 즉시 보정

## 구간별 행동

| 구간 | 상태 | 행동 |
|-----|------|------|
| 0~59% | `정상` | 게이지만 표시 |
| 60~79% | `주의 — /compact 권장` | 경고 메시지 추가 |
| 80~99% | `위험 — /compact 또는 /clear 강력 권장` | **굵은** 경고 |
| 100%+ | `포화 — 즉시 /clear 필요` | **굵은** 경고 + 작업 중단 제안 |

## /compact

- 보존 대상을 사용자에게 확인
- **한 세션 최대 2회**
- 3회째 필요 시 → `/clear` 또는 새 세션 권장 (요약의 요약은 핵심 손실)

## /clear

- 새 세션 시작
- 맥락 복구는 [chat-history 요약](../../../CLAUDE.md) 로 — 본 카테고리는 정책만 정의

## 컨텍스트 보호 습관

| 상황 | 도구 |
|-----|------|
| 사소한 확인 | `/btw` (컨텍스트에 남지 않음) |
| 코드베이스 탐색 | 서브에이전트 위임 (메인 보호) |
| 잘못된 방향 | `Esc+Esc` 되감기 (교정 메시지 자체가 오염) |
| 작업 복잡도 조절 | `/effort low\|high\|max` |

## 게이지 추정 (`/context` 안 한 턴)

- 직전 실측값 + 큰 도구 호출 1회당 +1~3% 가산
- 큰 Read (500줄+) 1회 +3~5%
- 서브에이전트 결과 +5~10%
- 정확한 수치는 다음 `/context` 호출 시 보정

## 위반 신호

- 게이지 미출력 → 헌법 위반
- 60% 도달인데 `/compact` 권장 누락 → 즉시 보강
- 100% 도달했는데 작업 계속 시도 → 즉시 멈춤 + `/clear` 안내

## JIT Context (Just-in-Time)

> Anthropic "Effective context engineering": 모든 컨텍스트를 미리 적재하지 않고 **필요한 순간에 fetch**. Reading Map · seek-read 의 이론적 근거.

- 큰 문서는 통째 Read 금지 — `Grep` 으로 찾고 `Read(offset, limit)` ([reading.md](./reading.md)).
- 도메인 지식은 사용 시점에만 진입 (`09-knowledge/` 결정 트리).
  *규칙은 알겠는데 왜 그런가* 가 남을 때만 들어간다. **금지가 아니라 순서다** —
  근거를 못 읽으면 다음 사람이 규칙을 뒤집는다.

## Cache-Aware (5분 TTL)

> Anthropic prompt cache 는 5분 TTL. 안정적 prefix 우선 배치로 hit rate 향상.

- 시스템 프롬프트·CLAUDE.md 변경 자제 — 변경하면 캐시 무효화.
- 같은 구간을 다시 읽을 때는 같은 offset 을 쓴다 — 매번 다른 offset 은 캐시 미스.
- Bash sleep 정책: 270s 미만 (캐시 보존) 또는 1200s+ (한번 미스로 감당) — 300s 는 worst-of-both.

## 관련 카테고리

- [CLAUDE.md](../../../CLAUDE.md) — 헌법·응답 규칙
- [02-context/reading.md](./reading.md) — 토큰 절약 읽기 전략
- [02-context/failure-modes.md](./failure-modes.md) — Context Rot 등 실패 모드
- [08-observability/token-economics.md](../../quality/observability/token-economics.md) — 캐시 hit rate 측정
