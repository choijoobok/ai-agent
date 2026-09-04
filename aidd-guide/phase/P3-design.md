---
id: LLM-PHS-003
title: "P3 설계 — 베이스라인을 만든다"
category: phase
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: []
author: Bong Jong Hyeon
tier: 1
tags: [design, baseline]
---

# P3 설계 — 베이스라인을 만든다 (가장 무거운 단계)

> 목표: 구현에 필요한 모든 것을 확정하고 **spec을 동결**한다.
> 산출물: `documents/spec/30-usecases.yaml` `31-features.yaml` `40-domain.yaml` `50-api.yaml` `51-interfaces.yaml` `60-screens.yaml` `70-testcases.yaml` + `documents/generated/` 생성물
> 소요: 프로젝트의 40% — 여기에 시간을 쓰는 것이 이 방법론의 핵심 베팅이다

## 1. 작업 순서 (의존성 순 — 뒤집으면 재작업)

```
① 유즈케이스        UC-###   (REQ → UC)
② 기능 목록·메뉴     FEAT-### (UC → FEAT, 메뉴 트리)
③ 도메인/데이터 모델  ENT-###  (FEAT가 다루는 개념 → 엔티티)
④ API 명세          API-###
⑤ 화면 정의         SCR-###
⑥ 시퀀스 다이어그램   (핵심 UC)
⑦ 테스트 케이스      TC-###
⑧ 슬라이스 백로그
⑨ 추적성 검사 → 문서 생성 → 게이트
```

**③을 ②보다 먼저 하지 않는다.** 기능을 모르고 만든 테이블은 반드시 다시 만든다.

---

## 2. ① 유즈케이스 (`documents/spec/30-usecases.yaml`)

```yaml
- id: UC-004
  name: 입고 예정 등록
  actors: { primary: ACT-004, secondary: [ACT-003] }
  reqs: [REQ-011, REQ-012]
  process_step: PRC-01-01
  precondition: "협력사담당자로 로그인, 유효한 발주가 존재"
  trigger: "협력사가 납품 일정을 확정"
  main_flow:
    - "1. 발주번호를 선택한다"
    - "2. 시스템이 발주 잔량을 표시한다"
    - "3. 품목별 예정 수량과 예정일을 입력한다"
    - "4. 저장한다"
    - "5. 시스템이 예정번호를 채번하고 창고담당자에게 알림을 보낸다"
  alternative_flows:
    - id: A1
      at_step: 1
      condition: "발주 없이 긴급 납품"
      flow: ["발주 없음 선택 → 사유 입력 → 창고담당자 승인 대기 상태로 저장"]
  exception_flows:                      # ★ 최소 1개 필수
    - id: E1
      at_step: 4
      condition: "예정 수량 > 발주 잔량"
      flow: ["오류 표시 '발주 잔량(N)을 초과했습니다' → 저장 중단"]
    - id: E2
      at_step: 4
      condition: "동일 발주·품목의 예정이 이미 존재"
      flow: ["기존 예정 표시 → 수정 또는 추가 등록 선택"]
  postcondition: "입고예정(상태=예정) 생성, 발주 잔량 차감(예약)"
  business_rules:
    - "예정일은 오늘 이후만 가능"
    - "예정 수량 합계는 발주 수량을 초과할 수 없다"
```

**규칙**: `exception_flows` 가 비면 게이트 미충족. 예외 없는 업무는 없다.

---

## 3. ② 기능 목록과 메뉴 (`documents/spec/31-features.yaml`)

UC는 **업무 관점**, FEAT는 **시스템이 제공하는 것** — 1:N일 수 있다.

```yaml
menu:                                    # 메뉴 트리 = 사용자가 보는 구조
  - id: MNU-01
    name: 입고관리
    children:
      - { id: MNU-01-01, name: 입고예정등록, feature: FEAT-012, roles: [ROLE-004, ROLE-003] }
      - { id: MNU-01-02, name: 입고예정조회, feature: FEAT-013, roles: [ROLE-001, ROLE-003, ROLE-004] }

features:
  - id: FEAT-012
    name: 입고 예정 등록
    usecases: [UC-004]
    reqs: [REQ-011, REQ-012]
    type: transaction                    # transaction | inquiry | master | batch | report | interface
    description: "협력사가 납품 예정을 등록한다"
    entities: [ENT-004, ENT-005]
    apis: [API-031, API-032]
    screens: [SCR-008]
    roles: [ROLE-004, ROLE-003]
    complexity: medium                   # low | medium | high — 슬라이스 크기 산정용
```

**기능 유형별 누락 점검** — 아래 유형이 하나도 없으면 놓친 것이다.
`master`(기준정보 관리) · `batch`(정기 처리) · `report`(집계/출력) · `interface`(연동) · 권한/사용자 관리 · 공통코드 관리 · 감사로그 조회

---

## 4. ③ 데이터 모델 (`documents/spec/40-domain.yaml`)

```yaml
entities:
  - id: ENT-004
    name: inbound_plan
    display_name: 입고예정
    term: TRM-001                        # 용어사전 연결
    features: [FEAT-012, FEAT-013]
    description: "협력사가 통보한 납품 예정"
    attributes:
      - { name: plan_id,      type: "BIGINT",        pk: true,  generated: sequence }
      - { name: plan_no,      type: "VARCHAR(20)",   null: false, unique: true, rule: "IP-YYYYMMDD-NNN" }
      - { name: vendor_id,    type: "BIGINT",        null: false, fk: "ENT-002.vendor_id" }
      - { name: warehouse_id, type: "BIGINT",        null: false, fk: "ENT-001.warehouse_id", note: "권한 범위 축" }
      - { name: status,       type: "VARCHAR(20)",   null: false, enum: [PLANNED, ARRIVED, INSPECTING, COMPLETED, CANCELLED] }
      - { name: plan_date,    type: "DATE",          null: false }
    indexes:
      - { name: ix_plan_wh_date, columns: [warehouse_id, plan_date, status], reason: "FEAT-013 목록 조회 (NFR-002)" }
    audit: standard                      # none | created_only | standard(4컬럼) | full(변경이력 테이블)
    history: separate_table              # none | separate_table | temporal
    delete_policy: soft                  # hard | soft | never
    retention: "5년 후 아카이브"
    state_machine:                       # 상태가 있으면 반드시 전이 정의
      PLANNED:    [ARRIVED, CANCELLED]
      ARRIVED:    [INSPECTING, CANCELLED]
      INSPECTING: [COMPLETED]
      COMPLETED:  []
      CANCELLED:  []
```

### DBA 체크리스트 (엔티티마다)
- [ ] PK가 있는가. 자연키가 따로 있으면 unique 제약이 있는가
- [ ] 권한 범위 축 컬럼(`warehouse_id` 등)이 있는가 ← P2에서 정한 것
- [ ] 상태 컬럼이 있으면 `state_machine` 이 정의되었는가
- [ ] 이력이 필요한가 (`history`), 감사 컬럼은 (`audit`)
- [ ] 삭제 정책은 (`delete_policy`) — soft면 조회에 항상 필터가 필요함을 인지
- [ ] 금액/수량은 `DECIMAL` 인가 (`FLOAT` 금지)
- [ ] 날짜/시각의 타임존 정책이 일관되는가
- [ ] 목록 조회 패턴에 맞는 인덱스가 있고 `reason` 이 적혔는가
- [ ] 코드성 컬럼이 enum인가 공통코드 테이블인가 (일관되게)

### 공통 규칙 (한 번 정하고 전 테이블 적용)
```yaml
conventions:
  naming: snake_case
  pk_strategy: "BIGINT sequence"
  audit_columns: [created_at, created_by, updated_at, updated_by]
  soft_delete_column: deleted_at
  timezone: "UTC 저장, 표시 시 Asia/Seoul 변환"
  money_type: "DECIMAL(18,4)"
```

---

## 5. ④ API (`documents/spec/50-api.yaml` — OpenAPI 3 호환)

```yaml
- id: API-031
  feature: FEAT-012
  method: POST
  path: /api/inbound-plans
  summary: 입고예정 등록
  auth: required
  roles: [ROLE-004, ROLE-003]
  request:
    body:
      vendor_id:    { type: integer, required: true }
      warehouse_id: { type: integer, required: true }
      plan_date:    { type: string, format: date, required: true, rule: "오늘 이후" }
      items:        { type: array, minItems: 1 }
  responses:
    201: { plan_id: integer, plan_no: string }
    400: "VALIDATION_ERROR"
    409: "DUPLICATE_PLAN — UC-004 E2"
    422: "EXCEEDS_ORDER_QTY — UC-004 E1"
  transaction: "예정 생성 + 발주 잔량 예약을 단일 트랜잭션"
  idempotency: "요청 헤더 Idempotency-Key 지원"
```

**모든 UC 예외 흐름이 에러 응답으로 매핑되어야 한다.** 매핑 안 된 예외 흐름이 있으면 게이트 미충족.

---

## 6. ⑤ 화면 (`documents/spec/60-screens.yaml`)

```yaml
- id: SCR-008
  feature: FEAT-012
  name: 입고예정등록
  menu: MNU-01-01
  type: form                             # list | form | list_detail | dashboard | popup | wizard
  roles: [ROLE-004, ROLE-003]
  layout_note: "상단 발주 선택, 하단 품목 그리드(행 추가/삭제)"
  fields:
    - { name: 발주번호,   control: search_popup, required: true, source: API-020 }
    - { name: 예정일,     control: datepicker,   required: true, validation: "오늘 이후" }
    - { name: 품목그리드, control: grid, min_rows: 1,
        columns: [품목코드, 품목명, 발주잔량, 예정수량],
        validation: "예정수량 > 0, 예정수량 ≤ 발주잔량" }
  actions:
    - { name: 저장, api: API-031, confirm: false, on_success: "목록으로 이동 + 예정번호 표시" }
    - { name: 취소, action: "변경분 있으면 확인 후 목록으로" }
  error_display:
    - { code: EXCEEDS_ORDER_QTY, message: "발주 잔량을 초과했습니다", target: "해당 그리드 행" }
  empty_state: "선택한 발주에 잔량이 없습니다"
  loading: "저장 중 버튼 비활성화 (중복 제출 방지)"
```

화면 정의서에는 **행복 경로만 그리지 않는다.** `error_display` · `empty_state` · `loading` · 권한별 차이가 필수다.

---

## 7. ⑥ 시퀀스 다이어그램 (`documents/generated/33-시퀀스/UC-###.md`)

핵심 UC(최소 3개: 가장 복잡한 것, 외부 연동, 트랜잭션 경계가 까다로운 것)에 작성.

```mermaid
sequenceDiagram
  autonumber
  actor V as 협력사담당자
  participant UI as SCR-008
  participant API as API-031
  participant SVC as InboundPlanService
  participant DB as DB
  participant NOTI as 알림

  V->>UI: 발주 선택
  UI->>API: GET /orders/{id}/remaining
  API-->>UI: 잔량
  V->>UI: 수량 입력 후 저장
  UI->>API: POST /api/inbound-plans
  API->>SVC: create(cmd)
  SVC->>DB: BEGIN
  SVC->>DB: SELECT 발주잔량 FOR UPDATE
  alt 잔량 초과
    SVC-->>API: 422 EXCEEDS_ORDER_QTY
    API-->>UI: 오류 (UC-004 E1)
  else 정상
    SVC->>DB: INSERT inbound_plan
    SVC->>DB: UPDATE order_item 예약수량
    SVC->>DB: COMMIT
    SVC->>NOTI: 창고담당자 알림 (비동기)
    API-->>UI: 201 예정번호
  end
```

**시퀀스에는 예외 분기(alt)와 트랜잭션 경계를 반드시 표시한다.**

---

## 8. ⑦ 테스트 케이스

`aidd-guide/quality/INDEX.md` §1 참조. FEAT마다 최소 세트(정상·입력검증·업무예외·권한)를 채운다.
**구현 전에 TC가 존재해야 한다.** 이것이 P4의 TEST-FIRST를 가능하게 한다.

## 9. ⑧ 슬라이스 백로그

`aidd-guide/process/07-slice.md` §2 순서 규칙(의존성 → 리스크 → 가치)으로 정렬해
`documents/project.state.yaml` 의 `slices:` 에 기록한다.

## 10. ⑨ 마무리

```
/trace          → 추적성 오류 0 확인
/doc-gen        → documents/generated/ 전체 생성
/phase-gate G3  → 체크리스트 + 레드팀 + 승인 요청
```

**승인되는 순간 `documents/spec/` 은 베이스라인이다.** 이후 변경은 전부 CR.

## 11. P3 흔한 실패와 방어

| 실패 | 방어 |
|---|---|
| AI가 ERD를 먼저 그린다 | 순서 강제. FEAT 없이 ENT를 만들면 훅이 경고 |
| 예외 흐름이 비어 있다 | 게이트 자동 검사 |
| 관리 기능(사용자/권한/공통코드)을 빠뜨린다 | §3의 기능 유형 체크리스트 |
| 화면 정의가 행복 경로뿐 | `error_display`/`empty_state` 필수 필드 |
| 상태 컬럼에 전이 정의가 없다 | `state_machine` 필수 |
| ASM을 남긴 채 게이트 통과 시도 | G3는 미해결 ASM 0건이 조건 |
| 설계가 너무 길어져 사용자가 지친다 | 도메인 영역별로 쪼개 부분 승인 (입고 영역 먼저, 출고 영역 다음) |
