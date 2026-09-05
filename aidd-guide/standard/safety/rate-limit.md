---
id: LLM-SAF-004
title: "외부 API 호출 Rate Limit 가드"
category: standard/safety
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [Anthropic API 문서, Bash sleep 정책]
tier: 4
tags: [safety, rate-limit, api, cost-guard]
---

# 외부 API 호출 Rate Limit 가드

> LLM API · 검색 API · OAuth · MCP 외부 서버 호출에서 **무한 루프·요금 폭증·차단**을 방지.

## 위험 시나리오

| 시나리오 | 결과 |
|---------|------|
| 자동화 스크립트가 LLM 호출을 무한 반복 | 요금 폭증, 토큰 burn |
| WebFetch 폴링 1초 간격 | 사이트가 IP 차단 |
| MCP 서버에 동일 요청 1초마다 | 서버 다운 또는 인증 차단 |
| 실패 시 백오프 없이 즉시 재시도 | 장애 증폭 |

## 가드 룰

1. **루프 사전 종료 조건 설정** — `for/while` 안에서 외부 호출 시 max iteration · max cost · timeout 명시.
2. **백오프**: 실패 시 기하급수 백오프 (1s → 2s → 4s → 8s, 최대 60s).
3. **간격 최소값**: 외부 API 폴링은 최소 5초 간격. 본 시스템 `Bash sleep` 정책과 일치 (300s 미만은 캐시 보존).
4. **비용 인식**: 작업당 예상 호출 수 × 비용 ≥ $1 면 사용자에 사전 안내.
5. **idempotency**: 같은 입력으로 동일 결과여야 — 재시도 시 부작용 없음 확인.

## 폴링 패턴 가이드

```
나쁨: while true; do curl ...; sleep 1; done
좋음: for i in $(seq 1 10); do curl ...; sleep $((10 + RANDOM % 5)); done
```

- jitter (random ±20%) 추가로 thundering herd 회피
- 매 호출 결과를 검사 후 조기 종료 조건 평가

## 도구별 권장 간격

| 도구 | 최소 간격 | 비고 |
|------|----------|------|
| WebFetch / WebSearch | 5초 | 서버 부하 방지 |
| LLM API 호출 (외부) | 1초 + 토큰별 비용 사전 추정 | 캐시 5분 TTL 활용 |
| MCP 도구 polling | 10초 | 서버 차단 방지 |
| Claude Code Bash sleep | 60s 이상 권장 | 캐시 윈도우 |

## 비용 모니터링

- 08-observability 의 [token-economics.md](../../quality/observability/token-economics.md) 와 연동
- 작업 종료 시 사용한 토큰 수를 사용자에 보고 (긴 자동화 시)
- 캐시 hit rate 가 50% 미만이면 prefix 안정화 검토

## 관련

- [harness/context/budget.md](../../harness/context/budget.md) — Cache-Aware 5분 TTL
- [harness/tool-curation.md](../../harness/tool-curation.md) — 외부 도구 추가 게이트
- [quality/observability/token-economics.md](../../quality/observability/token-economics.md) — 비용 측정
