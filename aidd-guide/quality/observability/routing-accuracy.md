---
id: LLM-OBS-001
title: "라우팅 정확도 측정"
category: 08-observability
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [본 통합 작업의 성공 기준, Hamel evals]
author: Bong Jong Hyeon
tier: 3
tags: [observability, routing, accuracy, golden-set]
---

# 라우팅 정확도 측정

> AI 가 사용자 메시지를 받고 **올바른 카테고리 INDEX 로 진입**하는 비율. 본 메타-시스템의 1차 KPI.

## 골든 메시지 10개 (마스터 셋)

| # | 메시지 | 정답 카테고리 | 분류 근거 |
|---|--------|-------------|----------|
| 1 | "공통코드 마스터 화면 만들어줘" | 11-playbook | "화면 만들기" = 실전 레시피 |
| 2 | "이 프로젝트 토큰 예산 정책 알려줘" | 02-context | "토큰 예산" = 컨텍스트 엔지니어링 |
| 3 | "{업무 도메인} 상태 코드 뭐였지" | 09-knowledge | 도메인 지식 |
| 4 | "프롬프트 품질을 어떻게 측정해야 해" | 07-evals | 평가 프레임워크 |
| 5 | "AsnMgmtReqRecord 어떤 record DTO 패턴 쓰지" | 06-framework | 프레임워크 컨벤션 |
| 6 | "이 프로젝트 헌법이 뭐야" | CLAUDE.md | 헌법 직접 명시 |
| 8 | "민감한 데이터 다루는 규약" | 13-safety | PII·secrets |
| 10 | "Stop 훅 디버깅 방법" | 05-harness | 하네스·훅 |

## 측정 절차

1. 새 Claude Code 세션을 연다 (`/clear` 후).
2. AI 에게 "각 메시지에 대해 어느 `llm-guide/<NN-cat>/` 로 진입할지만 답하라" 요청.
3. INDEX 결정 트리만 보고 답하게 한다 (실제 작업 금지).
4. 정답 매칭 카운트.

## 채점 기준

- **정답 ≥ 9개 (90%)**: 패스
- **8개 이하 (80%)**: 결정 트리 분기 재검토. 모호한 메시지가 어느 카테고리로 빠졌는지 확인.
- **2개 이상 같은 오답 카테고리**: 그 카테고리의 INDEX 진입 조건 명확화 필요.

## 회귀 테스트

INDEX 또는 카테고리 추가/이동 시 **반드시** 다시 10개 측정. 89% 이하로 떨어지면 변경 보류.

## 확장 셋

운용 중 라우팅 실패 사례를 모아 골든셋을 30개 → 50개 까지 확장. 새 메시지를 추가할 때:
1. 사용자 실 발화에서 가져온다 (인공 메시지 X).
2. 정답 카테고리는 사용자와 합의해 결정.
3. 분류 근거를 한 줄로 기록.

## 사용 빈도 함께 보기

`grep -rh "^category:" aidd-guide --include=*.md | sort | uniq -c` 로 파일 분포 확인. 특정 카테고리만 비대해지면 분할 검토.

## 관련

- [07-evals/golden-set.md](../evals/golden-set.md) — 골든셋 포맷 표준
- [aidd-guide/INDEX.md](../../INDEX.md) — 측정 대상 결정 트리
