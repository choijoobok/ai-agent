---
name: kickoff
description: 새 시스템 구축 프로젝트를 시작한다. 사용자가 "○○ 시스템을 만들고 싶다"고 할 때 AI-SDLC 방법론에 따라 P0 착수를 개시하고, 프로젝트 뼈대와 첫 질문 배치를 만든다.
---

<!-- generated_from: aidd-guide/harness/skill-src/kickoff.md; do not edit -->

# 프로젝트 킥오프

## 실행 순서

### 0. 템플릿 마커 확인 (가장 먼저)
`.ai-sdlc-template` 파일이 있으면 **여기는 프레임워크 템플릿이지 프로젝트가 아니다.**
모든 훅이 무동작 상태라 규율이 걸리지 않는다. 사용자에게 이렇게 안내하고 중단한다.

> 여기는 프레임워크 템플릿 폴더입니다. 실제 프로젝트는 복사본에서 시작해야 규율(훅)이 작동합니다.
> 1. 이 폴더를 프로젝트 폴더로 복사
> 2. 복사본에서 `.ai-sdlc-template` 삭제
> 3. 복사본을 지원 AI로 열고 `kickoff` 스킬을 호출
>
> 지금 폴더에서 그대로 진행하길 원하시면 `.ai-sdlc-template` 를 삭제할까요?

### 1. 방법론 숙지
아래를 순서대로 읽는다.
- `AGENTS.md`
- `aidd-guide/process/01-overview.md`
- `aidd-guide/process/03-interview.md`
- `aidd-guide/phase/P0-inception.md`
- `aidd-guide/process/10-cognitive-debt.md` (게이트에서 결정 카드·역질문을 쓰기 위해)

### 2. 사용자 요청 되풀이 (한 문단)
"제가 이해한 것은 ... 입니다. 맞습니까?" — 오해를 여기서 잡는다.

### 3. 통상 구성 제시 (3~5줄)
같은 종류의 시스템이 보통 어떤 영역으로 구성되는지 제시한다.
**백지에서 요구사항을 뽑게 하지 말고, 틀을 주고 깎게 한다.**

예) "WMS는 보통 ①기준정보(창고/로케이션/품목/협력사) ②입고(예정·검수·적치)
③재고(조회·조정·실사) ④출고(지시·피킹·확정) ⑤조회/리포트 ⑥시스템관리(사용자·권한·코드)
로 구성됩니다. 이 중 필요 없는 영역이나 빠진 영역을 알려주세요."

### 4. 뼈대 생성
```
documents/spec/00-charter.yaml  01-actors.yaml  02-constraints.yaml   (템플릿 상태)
documents/decisions/ASSUMPTIONS.md  CHANGES.md
documents/project.state.yaml    (project.name, started_at 채움, phase=P0)
```

### 5. 질문 배치 1 발행
`aidd-guide/phase/P0-inception.md` §2 의 필수 7문을 이 프로젝트 맥락에 맞게 구체화해서 던진다.
일반적인 문구 그대로 복사하지 말고 **사용자가 말한 도메인 용어로 바꿔서** 묻는다.

### 6. 마무리 안내
> 답변 주시면 프로젝트 헌장을 작성하고 G0 게이트로 넘어갑니다.
> 전부 기본값으로 진행하려면 "기본값"이라고만 주세요.
> 진행 상황은 언제든 `$pm-status` 로 확인하실 수 있습니다.

## 금지
- 요구사항을 받기 전에 기술 스택을 정하지 않는다
- 코드나 ERD를 만들지 않는다
- 질문 7개를 넘기지 않는다
