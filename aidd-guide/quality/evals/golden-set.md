---
id: LLM-EVL-001
title: "골든셋 포맷·관리 정책"
category: quality/evals
type: operation
created: 2026-05-04
updated: 2026-09-06
status: active
sources: [Hamel Husain Evals]
tier: 3
tags: [evals, golden-set, fixture]
---

# 골든셋 포맷·관리 정책

> 골든셋 = (입력, 기대 출력, 평가 기준) 쌍의 모음. 본 시스템에선 **routing / generation / safety** 3종을 운영.

## 포맷

YAML 1건 = 1 케이스:

```yaml
- id: GS-ROUTE-001
  category: routing
  input: "공통코드 마스터 화면 만들어줘"
  expected_category: playbook
  rationale: "마스터 화면 만들기 = 실전 레시피"
  added_at: 2026-05-04
  source: master-prompt
```

## 필드 정의

| 필드 | 필수 | 설명 |
|------|------|------|
| id | ✓ | `GS-{CAT}-{NNN}` 고유 |
| category | ✓ | routing / generation / safety |
| input | ✓ | AI 에게 보낼 입력 (사용자 발화) |
| expected_category | routing 만 | 정답 카테고리 |
| expected_output | generation 만 | 정답 산출물 (또는 정규식·구조 조건) |
| expected_action | safety 만 | "refuse" / "ask-for-confirmation" / "redact" |
| rationale | ✓ | 왜 이게 정답인가 (1줄) |
| added_at | ✓ | YYYY-MM-DD |
| source | ✓ | "master-prompt" / "user-feedback" / "incident-{날짜}" |

## 저장 위치

`aidd-guide/quality/evals/fixtures/` 하위에 카테고리별 1 YAML:

```
07-evals/
└── fixtures/                  ← (선택) 골든셋 데이터
    ├── routing.yaml
    ├── generation.yaml
    └── safety.yaml
```

> 본 단계에선 정의만 하고 fixture 폴더는 향후 운용 단계에서 채운다.

## 추가 절차

1. 실 운용에서 라우팅 실패·생성 실패·안전 실패 발견.
2. 케이스를 fixture YAML 에 append.
3. PR/commit 메시지에 골든셋 추가 사유 기록.
4. 다음 회귀 실행에서 자동 검증.

## 변경 룰

- **삭제 금지** — 잘못된 케이스는 `status: invalid` 로 표시하고 보존.
- **수정 시 id 유지** — 기대 출력만 갱신하고 added_at 그대로.
- **30개 이상 누적** 시 분기별 정리 — 중복·구식 검토.

## 관련

- [regression.md](./regression.md) — 회귀 시 골든셋 사용법
- [ab-testing.md](./ab-testing.md) — A/B 시 같은 골든셋 쓰기
- [quality/observability/routing-accuracy.md](../observability/routing-accuracy.md) — routing 골든셋 측정
