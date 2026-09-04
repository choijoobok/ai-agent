---
id: LLM-PHS-001
title: "P1 발견 — 프로세스와 요구사항"
category: phase
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: []
author: Bong Jong Hyeon
tier: 1
tags: [discovery, requirement]
---

# P1 발견 — 업무 프로세스와 요구사항

> 목표: **업무 흐름**을 먼저 그리고, 거기서 요구사항을 **뽑아낸다**. 기능 목록에서 시작하지 않는다.
> 산출물: `documents/spec/03-glossary.yaml`, `documents/spec/11-processes.yaml`, `documents/spec/10-requirements.yaml`
> 소요: 사용자 대화 2~4회

## 1. 순서가 중요하다

```
용어사전 → To-Be 프로세스 → 요구사항
```

**용어를 먼저 확정하는 이유**: "입고"가 사람마다 다른 걸 뜻하면 이후 모든 문서가 어긋난다.
**프로세스를 요구사항보다 먼저 그리는 이유**: 요구사항을 먼저 받으면 빠진 단계를 알 수 없다.
프로세스 위에 얹어야 "이 단계엔 요구사항이 없네?"가 보인다.

## 2. 용어사전 만들기

사용자 발화에서 업무 명사를 전부 뽑아 정의를 **확인받는다**. AI가 짐작해서 정의하지 않는다.

```yaml
# documents/spec/03-glossary.yaml
- id: TRM-001
  term: 입고예정
  definition: "협력사가 납품하기로 통보한 품목·수량·예정일. 실물 도착 전 상태."
  aliases: ["예정", "ASN"]
  not: "실제 도착한 물량(→ 입고검수)과 구분한다"     # ★ 헷갈리는 것을 명시
  owner: ACT-003
- id: TRM-004
  term: 로트
  definition: "동일 생산단위 묶음. 유통기한 관리 및 추적 단위."
  not: "팔레트(물리적 적재 단위)와 다르다"
```

`not:` 필드가 핵심이다. **혼동되는 개념을 명시적으로 배제**해야 AI가 나중에 헷갈리지 않는다.

## 3. To-Be 프로세스 그리기

### 절차
1. **As-Is를 먼저 듣는다** — "지금은 어떻게 하세요?" 단계별로.
2. 각 단계에서 **아픈 곳**을 표시한다 (시간·오류·재작업).
3. To-Be를 제안한다 — 아픈 곳이 해소되는 흐름으로.
4. **각 단계에 담당 액터를 붙인다.** 담당자 없는 단계는 미완성이다.

```yaml
# documents/spec/11-processes.yaml
- id: PRC-01
  name: 입고 프로세스
  trigger: "협력사가 납품 예정을 통보"
  steps:
    - id: PRC-01-01
      name: 입고 예정 등록
      actor: ACT-004        # 협력사담당자
      input: "발주번호, 품목, 수량, 예정일"
      output: "입고예정(상태=예정)"
      rules: ["발주 잔량 초과 등록 불가"]
      as_is_pain: "전화/메일로 받아 담당자가 수기 입력, 누락 주 2~3건"
    - id: PRC-01-02
      name: 도착 접수
      actor: ACT-001
      exceptions:
        - "예정 없이 도착한 경우 → 예정 즉시 생성 후 진행"
        - "예정 수량과 실물 수량 불일치 → 차이 사유 입력 필수"
  outcome: "재고 수량 증가, 협력사에 입고 완료 통보"
```

**`exceptions:` 를 각 단계마다 최소 1개 받아낸다.** "그게 안 되면 어떻게 되나요?"를 반복한다.

## 4. 요구사항 도출

### 문장 규칙 (ISO/IEC 29148 준용)
```
[액터]는 [조건일 때] [무엇]을 [할 수 있어야 한다 / 해야 한다].
```
- ✅ "창고작업자는 입고 검수 시 예정 수량과 실물 수량이 다르면 차이 사유를 입력해야 한다."
- ❌ "입고 검수를 편리하게 한다." (검증 불가)
- ❌ "PDA에서 바코드를 스캔한다." (해결책이지 요구사항이 아님 → "품목을 3초 내에 식별할 수 있어야 한다")

### `documents/spec/10-requirements.yaml`
```yaml
- id: REQ-011
  type: functional            # functional | nonfunctional
  category: 입고
  statement: "창고작업자는 입고 검수 시 예정 수량과 실물 수량이 다르면 차이 사유를 입력해야 한다"
  rationale: "차이 원인 분석 및 협력사 평가 근거"
  actors: [ACT-001]
  process_step: PRC-01-03
  priority: must              # must | should | could | wont  (MoSCoW)
  acceptance: "차이가 있는 상태로 사유 없이 저장 시도하면 저장되지 않고 오류 표시"
  source: "2026-09-04 인터뷰 / 창고팀장"
```

### NFR은 카테고리 체크리스트로 빠짐없이
```yaml
- id: REQ-101
  type: nonfunctional
  category: performance
  statement: "재고 조회는 10만 건 데이터에서 p95 응답 2초 이내여야 한다"
  measurable: { metric: "p95 응답시간", target: "2000ms", condition: "재고 10만 행, 동시 20명" }
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
| 사용자가 대신 답한다 (현장 목소리 부재) | "이건 창고작업자분께 확인이 필요합니다" 로 ASM 등록 |
| AI가 일반적인 요구사항을 창작한다 | `source:` 필드를 비울 수 없게 한다. 출처 없으면 ASM |

## 7. G1 게이트
체크리스트 실행 → 레드팀 반박 → 승인 요청 → `current.phase: P2`
