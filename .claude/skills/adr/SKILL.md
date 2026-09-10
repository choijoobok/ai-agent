---
name: adr
description: 아키텍처 의사결정 기록(ADR)을 작성한다. 되돌리기 비용이 큰 기술·설계 선택을 대안·근거·포기한 것과 함께 남긴다. 기술 스택, DB, 인증, 아키텍처 스타일 등을 정할 때 사용.
---

<!-- generated_from: aidd-guide/harness/skill-src/adr.md; do not edit -->

# ADR 작성

## 먼저 판정: 이게 ADR 대상인가
`aidd-guide/process/06-decision.md` §1 로 되돌리기 비용을 판정한다.
- **High** → ADR + **사용자 승인 필수**
- **Medium** → ADR + 통지 (승인 불필요)
- **Low** → ADR 불필요. 그냥 결정한다.

## 작성 규칙
1. **대안 최소 2개.** 대안 없는 ADR은 결정이 아니라 통보다.
2. **포기한 것(trade-off)** 을 반드시 적는다.
3. **되돌리기 방법과 비용**을 적는다. 미래의 AI가 이걸 뒤집을 때 필요하다.
4. 번호는 `documents/project.state.yaml` `counters.ADR` + 1.
5. 파일명 `documents/decisions/ADR-###-슬러그.md`. 템플릿은 `aidd-guide/artifact/template/01-adr.md`.

## 상태 관리
`proposed` → 사용자 승인 → `accepted` (또는 `rejected`)
**`proposed` 상태 ADR이 있으면 해당 게이트를 통과할 수 없다.**

결정을 뒤집을 때는 기존 ADR을 **수정하지 않는다.** 새 ADR을 만들고 기존 것에
`superseded_by: ADR-###` 를 추가한다. 결정의 역사가 남아야 같은 실수를 반복하지 않는다.

## 사용자가 AI 권고와 다른 선택을 했을 때
ADR에 `사용자 결정 (AI 권고와 상이)` 로 표시하고,
AI 권고 내용 + 예상 리스크 + 그 리스크가 현실화되면 나타날 증상을 함께 남긴다.
설득을 반복하지 않는다. 한 번 반대하고 진행한다.

## 완료 후
- `documents/project.state.yaml` counters.ADR 증가
- 이 ADR이 무효화하는 `ASM-###` 이 있으면 상태 갱신
- 영향받는 spec 항목을 목록으로 보고 (자동 수정하지 말 것)
