---
name: slice
description: 수직 슬라이스 하나를 구현한다. 소유 작업흐름과 스펙 확인 → 테스트 먼저 → 필요한 층 구현 → 계약·테스트 통과 → 미니게이트 순으로 진행한다. P4 구현 단계에서 기능 하나를 만들 때 사용.
---

<!-- generated_from: aidd-guide/harness/skill-src/slice.md; do not edit -->

# 슬라이스 구현

인자: `SLICE-###` 또는 생략(백로그의 다음 todo)

## 전제 조건 확인
- `slices[]`의 `workstream`과 `features`가 있어야 하고 기능의 `workstream:` 또는 `module:`과
  일치해야 한다. 공통 기능은 `integration`이 소유한다.
- `workstreams.<키>.gates.P3_design.status == approved` 여야 한다. 작업흐름 구조가 없는
  기존 프로젝트만 전역 `gates.P3_design`을 쓴다. 아니면 **거부하고 이유를 보고**한다.
- 이 슬라이스의 `pending_rechecks`가 있으면 새 구현과 함께 실행할지 먼저 확인한다.
- 의존 슬라이스가 `done` 인지 확인.

## 절차 — `aidd-guide/process/07-slice.md` §3

### ① 스펙 재확인 (기억에 의존 금지)
해당 `FEAT-###`의 spec을 **실제로 읽는다**: UC / ENT / API / SCR / TC 전부.
변경 전 `trace-check --impact`와 `--source`로 공통 소비자·정본을 찾고, 완료 전 API 실제 목록/계약과 변경 후 영향을 대조한다. 연결이 없다는 결과를 영향 없음으로 간주하지 않는다.

### ② 설계 확인
구현 방식이 spec과 어긋나면 코드가 아니라 **CR을 먼저** 낸다.

### ③ TEST-FIRST (강제)
논리 문서 `documents/spec/70-testcases`의 TC를 실행 가능한 테스트 코드로 옮기고
**실패하는 것을 확인**한 뒤 구현을 시작한다.
> 코드를 먼저 쓰면 AI는 그 코드에 맞는 테스트를 쓴다. 그건 검증이 아니라 자기 확인이다.

### ④ 필요한 층
DB → 서비스/API → UI 중 기능에 존재하는 층만 구현한다. 마이그레이션이 있으면 롤백을,
API·화면이 있으면 각 spec 계약과 권한·예외를 확인한다. 없는 UI를 agent 기능에 만들지 않는다.

### ⑤ 계약·통합
외부에서 관찰 가능한 API·이벤트·응답 블록을 확인한다. 모듈 간 계약 변경은 `integration`
계약 슬라이스를 먼저 닫고 제공자·소비자 슬라이스가 그 버전을 따른다.

### ⑥ 통과 확인
전 테스트 통과. **skip / xfail 0건.** 실패를 우회하지 않는다.

### ⑦-1 규칙 뒤집기 검사 (필수)
테스트가 **실제로 업무 규칙을 검증하는지** 확인한다. AI 코드의 핵심 실패 모드가
"테스트는 통과하는데 규칙에서 표류"이기 때문이다.

해당 UC의 `business_rules` 각각에 대해:
1. 규칙을 코드에서 의도적으로 뒤집는다 (부등호 반전, 검사 제거 등)
2. 테스트를 돌린다 → **최소 1개가 실패해야 한다**
3. 되돌린다
4. 아무것도 실패하지 않으면 그 규칙은 **검증되지 않고 있다** → TC 추가 후 재확인

결과를 표로 보고한다. **미검증 규칙이 남으면 G4를 통과할 수 없다.**
→ `aidd-guide/quality/INDEX.md` §4

### ⑦-2 기계 품질 검사 (필수)
```bash
node .claude/hooks/quality-check.mjs
```
중복률 ≤5% · 예외 삼킴 0건 · `@feat` 미태깅 0개.
중복이 걸리면 **추출한다.** 임계값을 올리지 않는다.
→ `aidd-guide/quality/INDEX.md` §5

### ⑧ 미니게이트 G4
`aidd-guide/process/04-gates.md` G4 체크리스트 + `aidd-guide/quality/INDEX.md` §6 코드 품질 기준.
사용자에게 실행 결과(스크린샷/실행 방법)를 제시한다.

### ⑨ 상태 갱신
`documents/project.state.yaml`: slice status = done, 다음 슬라이스 제시. 완료 슬라이스가 통합
영향을 받아도 status를 되돌리지 않고 `pending_rechecks`만 등록·해제한다. 다른 팀원이 넘긴
재시험도 실행 명령과 결과를 남기면 누구나 닫을 수 있다.
완료 보고는 `aidd-guide/process/07-slice.md` §6 포맷.

## 첫 슬라이스(SLICE-001)는 골격이다
기능이 아니라 **관통 골격(Walking Skeleton)**: 로그인 → 권한 → 화면 → DB → 로그 → 테스트 → 배포.
→ `aidd-guide/phase/P4-build.md` §3

## 구현 중 spec 오류 발견 시
- 오타/누락(Low) → spec 수정 + 통지 후 계속
- 설계 결함(Medium) → 영향분석 + CR 등록 + 통지 후 계속
- 요구사항 모순(High) → **구현 중단**, 사용자 결정 요청, 다른 슬라이스로 이동

**절대 금지**: spec과 다르게 구현하고 나중에 spec을 맞추기.
