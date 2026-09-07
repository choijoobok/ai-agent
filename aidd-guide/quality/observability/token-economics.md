---
id: LLM-OBS-002
title: "토큰 비용 관측"
category: quality/observability
type: operation
created: 2026-05-04
updated: 2026-09-07
status: active
sources: []
tier: 3
tags: [observability, token, cost, cache, hit-rate]
---

# 토큰 비용 관측

> 작업 유형별 토큰 사용량과 prompt cache hit rate 를 추적. **비용 폭증·캐시 미스**를 조기 감지.

## 측정 지표

| 지표 | 정의 | 목표 |
|------|------|------|
| 작업당 평균 input 토큰 | 한 작업(요청-응답 사이클) 평균 | ≤ 50K |
| 작업당 평균 output 토큰 | 응답 토큰 평균 | ≤ 5K |
| Cache hit rate | 캐시된 prefix 재사용 비율 | ≥ 60% |
| 세션당 비용 ($) | 세션 종료 시점 누적 | ≤ $5 일반 작업 |
| 작업당 컨텍스트 평균 % | `/context` 평균값 | ≤ 50% |

## 측정 도구

- **Claude Code 내장**: `/cost` 명령 — 세션 누적 비용·토큰
- **수동 기록 (옵션)**: 세션 종료 시 `/cost` 출력을 그날 요약에 한 줄로 남긴다
- **수동 점검**: 큰 작업 후 `/cost` 한 번 — 예상 대비 차이 확인

## 캐시 hit rate 향상 패턴

| 좋음 | 나쁨 |
|------|------|
| 시스템 프롬프트·CLAUDE.md 변경 안 함 (5분 이내 재호출) | 매 호출마다 다른 prefix |
| Reading Map 으로 같은 파일 같은 offset 재사용 | 매번 다른 offset 으로 Read |
| INDEX 결정 트리 변경 자제 (자주 변경 시 캐시 미스 증가) | INDEX 매일 수정 |

## 비용 폭증 시나리오 + 대응

| 시나리오 | 신호 | 대응 |
|---------|------|------|
| 대용량 Read 반복 | input 토큰 평균 > 100K | seek-read 적용 — [harness/context/reading.md](../../harness/context/reading.md) |
| 무한 루프 | 같은 도구 호출이 N회 반복 | 사용자에 알리고 즉시 중단 |
| 캐시 미스 | hit rate < 40% | prefix 안정화 (CLAUDE.md 안 건드림) |
| 컨텍스트 포화 | `/context` ≥ 80% | `/compact` 또는 `/clear` |

## 보고 형식

```
=== 세션 비용 (예시) ===
Total: $1.23 (45,231 input · 3,201 output 토큰)
Cache: 62% hit (28,043/45,231)
Context @ end: 47%
경고: 없음
```

## 관련

- [harness/context/budget.md](../../harness/context/budget.md) — 컨텍스트 측정 정책
- [standard/safety/rate-limit.md](../../standard/safety/rate-limit.md) — 외부 API rate limit
- **근거** — Anthropic 의 prompt cache TTL 문서와 하네스의 `/cost`. **저장소 안에 없다**(그래서 `sources:` 가 비어 있다)
