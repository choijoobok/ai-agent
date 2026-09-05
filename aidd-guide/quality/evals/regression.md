---
id: LLM-EVL-002
title: "회귀 검출 절차"
category: quality/evals
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [Hamel Husain Evals]
author: Bong Jong Hyeon
tier: 3
tags: [evals, regression, before-after]
---

# 회귀 검출 절차

> 시스템 프롬프트·CLAUDE.md·INDEX 결정 트리·모델 버전을 변경했을 때 **기존 골든셋 통과율이 떨어지지 않았는가** 확인.

## 트리거 (반드시 회귀 실행)

| 변경 | 회귀 범위 |
|------|----------|
| `aidd-guide/INDEX.md` 결정 트리 변경 | routing 골든셋 전체 |
| `CLAUDE.md` 또는 `.claude/CLAUDE.md` 수정 | routing + safety |
| 카테고리 추가/이동/삭제 | routing 전체 + 영향 카테고리 generation |
| 모델 교체 (Opus 4.6 → 4.7 등) | 3종 전체 |
| 시스템 프롬프트 (skill SKILL.md 등) 수정 | 영향 받는 카테고리만 |

## 절차

```
Phase 1 — 변경 전 베이스라인
  1. /clear (새 세션)
  2. 현재 골든셋으로 측정 → baseline.txt 에 저장
  3. baseline pass rate 기록

Phase 2 — 변경 적용
  4. 변경 commit (단, 미배포 상태)

Phase 3 — 변경 후 측정
  5. /clear
  6. 같은 골든셋 측정 → after.txt
  7. baseline 대비 비교

Phase 4 — 판단
  pass rate ≥ baseline-2%p  → 통과 (병합)
  pass rate < baseline-2%p  → 회귀. 변경 보류 또는 보강
  새로 실패하는 케이스 발견 → 원인 분석 후 INDEX/CLAUDE 보강
```

## 결과 해석

| 결과 | 의미 | 행동 |
|------|------|------|
| pass rate 동일 | 안전 | 머지 |
| pass rate ↑ | 개선 | 머지 + 새 baseline 갱신 |
| pass rate -1~2%p | 의심 | 어떤 케이스가 빠졌는지 검사. 단발 노이즈면 머지 가능 |
| pass rate ≥ -3%p | 회귀 | 변경 롤백 또는 INDEX 보강 |

## 모델 회귀 (model upgrade)

새 모델이 이전 모델 대비 골든셋에서 다르게 동작하면:
1. **개선 케이스** — 새 정답이 더 좋다면 expected 갱신, baseline 새로 잡기.
2. **악화 케이스** — 같은 입력에 더 나쁜 응답. 시스템 프롬프트 보강 또는 골든셋 정답 재검토.
3. **flaky 케이스** — temperature·sampling 차이. 3회 실행 평균.

## 자동화 가능성

매주 일정 시간에 `routing-accuracy` 자동 실행 가능 (스케줄). 단, 토큰 비용·시간 비용 있음. 본 단계에선 **수동 실행**, 데이터 누적 후 자동화 검토.

## 관련

- [golden-set.md](./golden-set.md)
- [ab-testing.md](./ab-testing.md)
- [quality/observability/routing-accuracy.md](../observability/routing-accuracy.md)
