---
id: LLM-PHS-001
title: "P1 발견 — 프로세스와 요구사항"
category: phase
type: operation
created: 2026-09-04
updated: 2026-09-28
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
# documents/spec/11-processes/_index.yaml
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

### `documents/spec/10-requirements/_index.yaml`
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

## 5. 요구사항 정련 카드 — 요구사항 하나를 확정하는 절차

> **왜**: 문장 하나와 수용 기준만으로는 설계에서 *"아, 잘못 생각했네"* 가 난다. 그때 요구사항을
> 고치면 영향 범위를 셀 근거가 없어 많은 곳을 한꺼번에 다시 본다. 카드는 그 발견을 P1 로
> 당기고, 늦게 바뀌어도 **영향 목록을 추정이 아니라 연계에서 뽑게** 한다. 완전히 막지는 못한다.

§4 의 문장·`acceptance`·`source` 에 아래 칸을 더한다. **기존 칸을 옮겨 적지 않는다** —
`detail`·`hard_rule` 은 그대로 두고 카드는 그 위에 쌓는다.

### 5.1 핵심 칸 — 모든 FR

| 칸 | 담는 것 | 규칙 |
|---|---|---|
| `summary` | 두세 줄 개요 | |
| `intent` | `problem`(해결할 문제·현재의 불편) · `goal` · **`not`**(오해하기 쉬운 것의 명시 배제) | `not` 이 가장 값이 크다 — 용어사전 `not:` 과 같은 이유다 |
| `goal_trace` | 기여하는 헌장 항목(`GOAL`·`SUC`·`MET`·`IN`) | 닿는 곳이 없으면 그 사실이 발견이다 |
| `decider` | 이 요구사항을 확정할 수 있는 사람·역할 | `actors`(쓰는 사람)와 다르다 |
| `preconditions` | 성립해야 할 전제 — `REQ`·`CON`·`ASM`·`FEAT` 를 가리킨다 | |
| `relations` | `depends_on` · `constrains` · `conflicts_with` · `nfr` · `interfaces` | **양방향이다**: A 가 B 를 `constrains` 하면 B 의 `depends_on` 에 A 가 있다. `conflicts_with` 는 서로 적는다 |
| `realization` | `features` · `screens` — 있으면 ID, 없으면 후보 이름 | `FEAT.reqs` 와 서로 맞아야 한다. 화면은 후보 목록까지 — 상세는 화면 요건서가 갖는다 |
| `examples` | 실제 값이 든 사례. **정상 1건 + 예외 1건 이상** (`kind: 정상`·`예외`) | P3 에서 `TC` 의 씨앗이 된다 |
| `volatility` | `level`(high·medium·low) · `what`(바뀔 수 있는 부분) | **고객사마다 달라질 수 있으면 high** — 설계에서 설정·확장 지점으로 뺀다 |
| `open` | 아직 모르는 것. 항목마다 `@defer <기한>` | 없으면 `open: []` |
| `maturity` | `level`(draft·elaborated·confirmed) · `at` · `by` · `confirmed_by` | 아래 §5.3 |

### 5.2 조건부 칸 — 해당하면 쓰고, 아니면 한 줄로 "해당 없음"

| 칸 | 해당할 때 |
|---|---|
| `data` | 데이터를 다룬다 — `{ item, origin, sensitivity, retention }` |
| `business_rules` · `exceptions` | 계산식·판정 조건이 있다. 공정 단계 예외는 `PRC` 가 갖고 여기서는 가리킨다 |
| `lifecycle` | 상태를 가진 대상이다 — `{ state, next, note? }`. **늦게 발견된 상태 하나가 ENT·API·SCR·TC 를 한꺼번에 흔든다** |
| `permissions` | 행위별로 권한이 갈린다 (`actors` 와 달리 **행위 단위**) |
| `audit` | 남길 이력·불변 여부·보존 |
| `volume` | 빈도·건수·동시성 — 수치 목표는 `NFR` 이 갖고 여기는 업무 규모 사실만 |
| `config` | 운영자가 바꿀 값 — 고정값으로 둘지 설정으로 둘지를 설계 뒤에 뒤집으면 비싸다 |
| `risk` | 기술 불확실성 — 사전 검증(spike)이 필요한가 |

**`Must`·`Should` 는 조건부 칸의 키를 모두 둔다** — 해당 없으면 `"해당 없음 — <이유>"` 또는 `[]`.
빠뜨린 것과 해당이 없는 것을 구분하기 위해서다. **`Could` 는 `summary`·`intent`·`relations`·
`maturity` 만 둔다.** 칸이 많으면 빈칸 채우기가 되어 중요한 칸의 품질이 떨어진다.

### 5.3 확정 절차

1. AI 가 영역별로 **5~7건씩** 카드를 채운다(`maturity: elaborated`). 근거가 없는 칸은 지어내지 않고
   `open` 에 질문으로 남긴다. 규칙이 `FEAT` 에만 있던 것을 찾으면 카드의 `business_rules` 로 올리고
   `FEAT` 는 그 REQ 를 가리키게 고친다 — **요구사항 사실의 정본은 REQ 다.**
2. `open` 의 질문을 `interview` 형식(권장안·영향·되돌리기 비용)으로 묻는다.
3. 답을 반영하고 **G1·P1 기한의 `open` 이 남지 않으면** `maturity: confirmed` 와 `confirmed_by` 를 적는다.
   G1 전에 풀 필요가 없는 것(`@defer P2` 이후)은 남아도 된다.
4. 묶음을 마칠 때마다 `/trace` 로 연계 양방향·`realization` 정합을 본다(T14).

> **이미 G1 을 승인받은 작업흐름**은 카드를 소급해 쓰되 G1 을 다시 받지 않는다 — T14 가 경고로 센다.
> 카드를 쓰다 규칙이 바뀌면, 그 작업흐름이 G3 전이면 spec 을 고치고 G3 뒤면 `change-request` 다.

## 6. 요구사항 품질 검사 (게이트 전 필수)

| 검사 | 방법 |
|---|---|
| 모호어 검사 | `빠르게 · 편리하게 · 안정적으로 · 적절히 · 등등 · 필요시` → 전부 수치/조건으로 치환 |
| 검증 가능성 | 각 REQ에 `acceptance:` 가 있는가 |
| 중복 | 같은 말 다른 표현 병합 |
| **모순** | 서로 충돌하는 쌍 탐지 (예: "모든 변경 이력 보존" vs "3개월 후 삭제") → 사용자 결정 요청 |
| 용어 준수 | REQ 문장의 업무 명사가 전부 glossary에 있는가 |
| Must 비율 | 70% 초과면 우선순위 재조정 요청 |
| 프로세스 커버리지 | 모든 PRC 단계에 최소 1개 REQ가 있는가 (빈 단계 = 놓친 요구사항) |
| **카드 완전성** | §5 의 칸이 있고 `Must`·`Should` 가 `confirmed` 인가 — `/trace --g1` (T14) |
| **연계 정합** | `depends_on`↔`constrains` · `conflicts_with` 양방향, `realization`↔`FEAT.reqs` — T14 |

## 7. P1 흔한 실패와 방어

| 실패 | 방어 |
|---|---|
| 요구사항이 화면 설명이 되어 있다 | "그 화면이 없어도 되는 방법이 있다면?" → 목적으로 되돌린다 |
| 예외 흐름이 없다 | 프로세스 단계마다 "실패하면?"을 강제로 묻는다 |
| NFR이 없다 | 카테고리 체크리스트를 훑는다. "해당없음"도 기록 |
| 사용자가 대신 답한다 (현장 목소리 부재) | "이건 실제로 조회하시는 분께 확인이 필요합니다" 로 ASM 등록 |
| AI가 일반적인 요구사항을 창작한다 | `source:` 필드를 비울 수 없게 한다. 출처 없으면 ASM |
| 규칙은 있는데 사례가 없어 경계가 비어 있다 | `examples` 에 실제 값을 넣는다 — *"월 중간 신규 사용자의 첫 달"* 처럼 문장에서 안 보이던 빈칸이 값에서 드러난다 |
| 업무 규칙이 FEAT·화면 쪽에만 적혀 있다 | 카드의 `business_rules` 로 올리고 아래쪽은 링크한다 |
| 공식이 일부 분포에서만 의도대로 동작한다 | `examples` 에 **분포를 뒤집은 사례**를 하나 넣어 검산한다 |

## 8. G1 게이트
체크리스트 실행 → 레드팀 반박 → 승인 요청 → `current.phase: P2`
