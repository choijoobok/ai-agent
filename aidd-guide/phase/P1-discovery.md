---
id: LLM-PHS-001
title: "P1 발견 — 프로세스와 요구사항"
category: phase
type: operation
created: 2026-09-04
updated: 2026-09-21
status: active
sources: []
tier: 1
tags: [discovery, requirement]
---

# P1 발견 — 업무 프로세스와 요구사항

> 목표: **업무 흐름**을 먼저 그리고, 거기서 요구사항을 **뽑아낸다**. 기능 목록에서 시작하지 않는다.
> 산출물: `documents/spec/03-glossary/_index.yaml`, `documents/spec/11-processes/_index.yaml`, `documents/spec/10-requirements/_index.yaml`
> 소요: 사용자 대화 2~4회

## 1. 순서가 중요하다

```
용어사전 → To-Be 프로세스 → 요구사항
```

**용어를 먼저 확정하는 이유**: "조회"가 사람마다 다른 걸 뜻하면 이후 모든 문서가 어긋난다.
**프로세스를 요구사항보다 먼저 그리는 이유**: 요구사항을 먼저 받으면 빠진 단계를 알 수 없다.
프로세스 위에 얹어야 "이 단계엔 요구사항이 없네?"가 보인다.

## 2. 용어사전 만들기

사용자 발화에서 업무 명사를 전부 뽑아 정의를 **확인받는다**. AI가 짐작해서 정의하지 않는다.

```yaml
# documents/spec/03-glossary/_index.yaml
- id: TRM-001
  term: 턴
  definition: "사용자 질의 1건과 그에 대한 최종 응답까지의 처리 단위."
  aliases: ["질의", "요청"]
  not: "세션(대화창 하나)과 구분한다 — 한 세션이 여러 턴을 갖는다"   # ★ 헷갈리는 것을 명시
  owner: ACT-003
- id: TRM-004
  term: 스키마 카탈로그
  definition: "테이블·컬럼에 업무 의미를 붙여 등록한 목록. AI 가 조회 계획을 세우는 입력."
  not: "DB 의 물리 스키마 자체가 아니다 — 사람이 뜻을 붙인 것만 들어간다"
```

`not:` 필드가 핵심이다. **혼동되는 개념을 명시적으로 배제**해야 AI가 나중에 헷갈리지 않는다.

## 3. To-Be 프로세스 그리기

### 절차
1. **As-Is를 먼저 듣는다** — "지금은 어떻게 하세요?" 단계별로.
2. 각 단계에서 **아픈 곳**을 표시한다 (시간·오류·재작업).
3. To-Be를 제안한다 — 아픈 곳이 해소되는 흐름으로.
4. **각 단계에 담당 액터를 붙인다.** 담당자 없는 단계는 미완성이다.

```yaml
# documents/spec/03-glossary/_index.yaml
- id: PRC-01
  name: 조회 요청 처리
  trigger: "현업 담당자가 자연어로 질의한다"
  steps:
    - id: PRC-01-01
      name: 조회 계획 제시
      actor: ACT-001        # 현업 담당자
      input: "자연어 질의"
      output: "어느 시스템의 어느 테이블을 어떻게 읽을지 — 실행 전 사람이 본다"
      rules: ["카탈로그에 없는 테이블은 계획에 넣지 않는다"]
      as_is_pain: "시스템 셋을 열어 엑셀로 붙여 맞춘다, 건당 20분"
    - id: PRC-01-02
      name: SQL 생성·검증·실행
      actor: ACT-001
      exceptions:
        - "계획이 틀렸다고 사람이 판단 → 되돌아가 질의를 다시 받는다"
        - "권한 밖 테이블이 계획에 섞임 → 실행 전 차단하고 사유를 보인다"
  outcome: "결과 그리드 표시, 조회 이력 기록"
```

**`exceptions:` 를 각 단계마다 최소 1개 받아낸다.** "그게 안 되면 어떻게 되나요?"를 반복한다.

## 4. 요구사항 도출

### 문장 규칙 (ISO/IEC 29148 준용)
```
[액터]는 [조건일 때] [무엇]을 [할 수 있어야 한다 / 해야 한다].
```
- ✅ "현업 담당자는 개인정보 컬럼이 포함된 조회 결과를 받을 때 마스킹된 값을 봐야 한다."
- ❌ "조회를 편리하게 한다." (검증 불가)
- ❌ "결과 그리드에 마스킹 컬럼을 둔다." (해결책이지 요구사항이 아님 → "권한 없는 컬럼의 원본이 화면에 닿지 않아야 한다")

### `documents/spec/03-glossary/_index.yaml`
```yaml
- id: REQ-011
  type: functional            # functional | nonfunctional
  category: 조회
  statement: "현업 담당자는 개인정보 컬럼이 포함된 조회 결과를 받을 때 마스킹된 값을 봐야 한다"
  rationale: "조회 경로로 개인정보가 새면 감사에서 추적할 자리가 없다"
  actors: [ACT-001]
  process_step: PRC-01-02
  priority: must              # must | should | could | wont  (MoSCoW)
  acceptance: "권한 없는 컬럼을 포함한 질의를 실행하면 원본이 응답·로그 어디에도 남지 않는다"
  source: "2026-09-04 인터뷰 / 보안담당"
```

### NFR은 카테고리 체크리스트로 빠짐없이
```yaml
- id: REQ-101
  type: nonfunctional
  category: performance
  statement: "자연어 조회는 100만 행 테이블에서 p95 응답 2초 이내여야 한다"
  measurable: { metric: "p95 응답시간", target: "2000ms", condition: "대상 100만 행, 동시 20명" }
```
카테고리 최소 세트: `performance` · `availability` · `security` · `usability` · `operability` · `compliance` · `scalability` · `data_retention`
각 카테고리에 최소 1개씩. **"해당 없음"도 명시적으로 기록**한다.

## 5. 요구사항 품질 검사 (게이트 전 필수)

| 검사 | 방법 |
|---|---|
| 모호어 검사 | `빠르게 · 편리하게 · 안정적으로 · 적절히 · 등등 · 필요시` → 전부 수치/조건으로 치환 |
| 검증 가능성 | 각 REQ에 `acceptance:` 가 있는가 |
| 중복 | 같은 말 다른 표현 병합 |
| **모순** | 서로 충돌하는 쌍 탐지 (예: "모든 변경 이력 보존" vs "3개월 후 삭제") → 사용자 결정 요청 |
| 용어 준수 | REQ 문장의 업무 명사가 전부 glossary에 있는가 |
| Must 비율 | 70% 초과면 우선순위 재조정 요청 |
| 프로세스 커버리지 | 모든 PRC 단계에 최소 1개 REQ가 있는가 (빈 단계 = 놓친 요구사항) |

## 6. P1 흔한 실패와 방어

| 실패 | 방어 |
|---|---|
| 요구사항이 화면 설명이 되어 있다 | "그 화면이 없어도 되는 방법이 있다면?" → 목적으로 되돌린다 |
| 예외 흐름이 없다 | 프로세스 단계마다 "실패하면?"을 강제로 묻는다 |
| NFR이 없다 | 카테고리 체크리스트를 훑는다. "해당없음"도 기록 |
| 사용자가 대신 답한다 (현장 목소리 부재) | "이건 실제로 조회하시는 분께 확인이 필요합니다" 로 ASM 등록 |
| AI가 일반적인 요구사항을 창작한다 | `source:` 필드를 비울 수 없게 한다. 출처 없으면 ASM |

## 7. G1 게이트
체크리스트 실행 → 레드팀 반박 → 승인 요청 → `current.phase: P2`
