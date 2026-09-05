---
id: LLM-EVL-IDX
title: "07-evals — Eval-Driven Prompt Dev INDEX"
category: quality/evals
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
author: Bong Jong Hyeon
tier: 3
tags: [evals, golden-set, regression, ab-testing, index]
---

# 07-evals — Eval-Driven Prompt Dev

> 프롬프트를 **코드처럼** 관리. 골든셋 + 회귀 검출 + A/B 테스트로 변경의 안전성을 정량 보장.

## 진입 결정 트리

```
프롬프트·INDEX·시스템 룰을 만지려는가?
  ├─ "새 프롬프트 추가"          → golden-set.md 새 케이스 추가
  ├─ "기존 프롬프트 수정"        → regression.md 회귀 절차
  ├─ "변형 비교 (어느 게 좋은가)" → ab-testing.md
  ├─ "가이드를 고쳤다 — 실제로 닿았나" → screen-reproduction.md
  ├─ "모델 교체 (Opus 4.6→4.7)"  → regression.md (모델 회귀 섹션)
  └─ "정기 회귀"                 → 매주 routing-accuracy + ab 표본
```

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-EVL-001 | [golden-set.md](./golden-set.md) | 골든셋 포맷·관리 정책 |
| LLM-EVL-002 | [regression.md](./regression.md) | 회귀 검출 절차 (변경 전/후 비교) |
| LLM-EVL-003 | [ab-testing.md](./ab-testing.md) | 프롬프트 변형 A/B 비교 방법 |
| LLM-EVL-004 | [screen-reproduction.md](./screen-reproduction.md) | **화면 재현 회귀** — 문서만으로 같은 화면이 나오는가 |

## 골든셋 카테고리 (3종)

1. **Routing 골든셋** — 사용자 메시지 → 정답 카테고리 (10개 마스터, [quality/observability/routing-accuracy.md](../observability/routing-accuracy.md))
2. **Generation 골든셋** — 프롬프트 → 기대 산출물 (예: "공통코드 INSERT SQL 만들어줘" → 형식 검증)
   · 화면 단위의 확장이 [screen-reproduction.md](./screen-reproduction.md) 다
3. **Safety 골든셋** — 인젝션 시도 → AI 가 거절·확인 요청 했는가

## 핵심 원칙 (Hamel)

1. **Look at your data** — LLM 출력을 직접 본다. 수치 메트릭만으로 평가 금지.
2. **Code as eval** — 평가 자체를 git 으로 관리.
3. **Failure mode 누적** — 발견된 실패를 골든셋으로 흡수.
4. **Custom > generic** — 일반 벤치마크보다 본 프로젝트 케이스가 우선.

## 관련

- [quality/observability/routing-accuracy.md](../observability/routing-accuracy.md) — 라우팅 골든셋의 측정
- [standard/safety/prompt-injection.md](../../standard/safety/prompt-injection.md) — 안전 골든셋 입력
