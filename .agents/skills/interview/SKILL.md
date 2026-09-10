---
name: interview
description: 현재 단계에서 사용자에게 물어야 할 것을 질문 배치로 만들어 제시한다. 각 질문에 권장안·영향범위·되돌리기비용을 붙인다. 정보가 부족해 진행이 막혔을 때 사용.
---

<!-- generated_from: aidd-guide/harness/skill-src/interview.md; do not edit -->

# 질문 배치 생성

## 절차

### 1. 규약 확인
`aidd-guide/process/03-interview.md` 를 읽는다.

### 2. 무엇이 부족한지 판정
현재 단계의 `aidd-guide/phase/P?-*.md` 의 산출물 요건과 현재 `documents/spec/` 을 대조해
**비어 있거나 근거 없는 항목**을 찾는다.

### 3. 걸러내기 (중요)
아래는 질문 목록에서 **제거**한다.
- 이미 `documents/decisions/ADR-*.md` 로 답이 정해진 것
- 이미 `documents/spec/` 에 있는 것
- `aidd-guide/process/03-interview.md` §3 "물어보면 안 되는 것"
- AI가 합리적 기본값을 정할 수 있는 Low/Medium 결정

### 4. 우선순위로 7개 자르기
`되돌리기 비용 High` → `다른 결정을 막고 있는 것` → `나머지` 순.

### 5. 배치 작성
`aidd-guide/process/03-interview.md` §1 포맷 그대로. 각 질문에 반드시:
- 배경 (왜 묻는지, 업무 언어로)
- 선택지 2~3개 + **권장안 표시**
- 권장 이유
- 영향 (바뀌면 다시 만들 산출물 ID)
- 되돌리기 비용 (높음/중간/낮음)
- `[필수]` 또는 `[기본값 가능]`

### 6. OQ 등록
발행한 질문을 `documents/project.state.yaml` 의 `open_questions:` 에 등록한다.
답변을 받으면 제거하고 documents/spec/ADR/ASM에 반영한다.

## 답변 수신 시
1. 답을 한 줄로 되풀이 확인
2. OQ 제거
3. 즉시 기록: 결정→ADR / 사실→spec / 잠정→ASM
4. 이 답으로 생긴 후속 질문을 다음 배치에

**기록하지 않은 답변은 다음 세션에 사라진다.**
