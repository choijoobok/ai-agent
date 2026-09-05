---
id: LLM-EVL-003
title: "프롬프트 변형 A/B 테스트"
category: quality/evals
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [Hamel Husain Evals, 일반 A/B 방법론]
author: Bong Jong Hyeon
tier: 3
tags: [evals, ab-testing, variants]
---

# 프롬프트 변형 A/B 테스트

> 같은 입력에 두 프롬프트(A·B)가 어떻게 다르게 동작하는지 비교. 직관적 "이게 더 좋아 보임"을 데이터로 대체.

## 언제 쓰는가

- 시스템 프롬프트 한 섹션을 줄였더니 정확도가 유지되는지
- INDEX 결정 트리의 표현을 바꿨더니 라우팅이 더 깔끔해지는지
- few-shot 예시를 추가/제거했을 때 어떻게 다른지

## 절차

```
1. variant A = 현재 프롬프트
   variant B = 수정안

2. 골든셋(또는 임시 30~50개 케이스) 준비

3. 두 변형으로 같은 입력 각각 실행
   → A_pass, B_pass 카운트

4. 차이 분석
   - B - A ≥ +5%p  → B 채택
   - 차이 < 5%p   → 통계적 유의 미달, 더 큰 표본 또는 보류
   - B - A ≤ -3%p → A 유지

5. 채택 시 baseline 갱신, B 를 master 로
```

## 변형 정의 룰

- **한 번에 한 변수만** — 두 군데 동시 변경하면 원인 모름
- **프롬프트 텍스트는 git 에 보존** — 변형 ID(A/B/C)와 변경 내용 기록
- **평가자(채점)는 동일** — 사람이든 모델이든 양쪽에 같게

## 표본 크기 가이드

| 표본 | 신뢰도 | 사용 |
|------|--------|------|
| 10개 | 매우 낮음 | 빠른 1차 직관 |
| 30개 | 낮음 | 명확한 차이만 보임 |
| 50개 | 적당 | ±5%p 차이 검출 |
| 100개+ | 높음 | ±3%p 차이 검출 |

> 골든셋이 부족하면 차이가 크게 나는 경우만 신뢰.

## 함정

1. **Cherry-picking** — 좋은 케이스만 보지 않기. 실패한 것도 인용.
2. **Prompt overfitting** — 골든셋에서만 좋은 결과. 실 운용 케이스 추가 검증 필요.
3. **Cost asymmetry** — A 가 짧고 B 가 길면 토큰 비용이 다름. 효율도 같이 비교.
4. **Cache 영향** — 짧게 실행하면 둘 다 cold. 정확하려면 같은 캐시 상태에서.

## 결과 보고 형식

```
=== A/B 결과 (예시) ===
Variant A (현행): 27/30 pass (90%)
Variant B (수정): 29/30 pass (97%)
차이: +7%p (B 우세)
실패 케이스 차이:
  A 만 실패: GS-ROUTE-007 (모호 메시지)
  B 만 실패: 없음
결정: B 채택
```

## 관련

- [golden-set.md](./golden-set.md)
- [regression.md](./regression.md)
