---
id: LLM-OBS-IDX
title: "08-observability — 관측·텔레메트리 INDEX"
category: quality/observability
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [Hamel Husain Evals, Anthropic 비용 가이드]
tier: 3
tags: [observability, telemetry, routing-accuracy, token, monitoring, index]
---

# 08-observability — 관측·텔레메트리

> 본 메타-시스템 자체의 **건강 상태**를 측정. AI 가 이 카테고리를 잘 따르고 있는가, 어디서 새는가.

## 진입 결정 트리

```
관측 의문?
  ├─ "라우팅 잘 되고 있나"     → routing-accuracy.md
  ├─ "토큰 비용 급증·캐시 미스" → token-economics.md
  ├─ "세션 길어질수록 정확도 ↓" → context-rot-monitor.md
  └─ "어떤 카테고리·파일이 자주 안 읽히지" → routing-accuracy.md (사용 빈도 표)
```

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-OBS-001 | [routing-accuracy.md](./routing-accuracy.md) | 10개 골든 메시지로 INDEX 결정 트리 정확도 측정 |
| LLM-OBS-002 | [token-economics.md](./token-economics.md) | 작업 유형별 토큰 비용 · 캐시 hit rate |
| LLM-OBS-003 | [context-rot-monitor.md](./context-rot-monitor.md) | 세션 길이별 정확도 트래킹 (Chroma 연구 기반) |

## 측정 주기

| 지표 | 주기 | 트리거 |
|------|------|------|
| Routing accuracy | 매주 1회 + 카테고리 변경 직후 | INDEX 수정 시 |
| Token economics | 매일 자동 (훅) | `/cost` 명령 또는 세션 종료 시 |
| Context rot | 세션 50% 도달 시 자동 측정 | `/context` 호출 트리거 |

## 임계 (Threshold)

| 지표 | 정상 | 주의 | 위험 |
|------|------|------|------|
| Routing accuracy | ≥ 95% | 90~94% | < 90% |
| Cache hit rate | ≥ 60% | 40~59% | < 40% |
| Avg context @ session end | < 60% | 60~79% | ≥ 80% |

## 관련 카테고리

- [quality/evals](../evals/INDEX.md) — 골든셋 정의 (관측 데이터의 입력)
- [harness/context/budget.md](../../harness/context/budget.md) — 컨텍스트 측정의 정책
