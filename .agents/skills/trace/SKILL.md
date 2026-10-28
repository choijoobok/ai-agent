---
name: trace
description: 추적성 체인을 검사한다. REQ→UC→FEAT→ENT/API/SCR→TC 연결이 끊긴 곳, 고아 산출물, 미실현 요구사항, dangling ID를 찾아 보고하고 추적성 매트릭스를 생성한다.
---

<!-- generated_from: aidd-guide/harness/skill-src/trace.md; do not edit -->

# 추적성 검사

인자: 없음(검사만) / `--g1`(G1 청구 — 정련 카드 완전성을 오류로) / `--workstream <키>`(작업흐름 G3 범위) /
`--report`(매트릭스 출력) / `--impact ID`(변경 영향 분석) / `--source 경로`(소스 변경 영향)

## 검사 실행
`.claude/hooks/trace-check.mjs` 를 실행한다. 없으면 documents/spec/*.yaml 을 직접 파싱해
`aidd-guide/process/05-traceability.md` §3 의 T1~T14 규칙을 검사한다.

```bash
node .claude/hooks/trace-check.mjs --all
node .claude/hooks/trace-check.mjs --all --workstream admin
node .claude/hooks/trace-check.mjs --g1
node .claude/hooks/trace-check.mjs --impact API-558
node .claude/hooks/trace-check.mjs --source sources/backend/modules/system/src/main/java/com/aiagent/system/api/config/ConfigController.java
```

작업흐름 지정 시 그 기능과 연결된 REQ·UC·NFR·ENT·API·SCR·TC만 현재 게이트 오류로 센다.
dangling ID와 중복 ID처럼 저장소 전체를 깨뜨리는 오류는 항상 포함한다.

## 결과 보고 포맷
```markdown
## 🔗 추적성 검사 결과

**오류 3건 / 경고 5건**

### ❌ 오류 (게이트 통과 불가)
| 규칙 | 대상 | 내용 |
|---|---|---|
| T2 | REQ-018 | 미실현 요구사항 — UC/FEAT 연결 없음 |
| T5 | FEAT-044 | 테스트 케이스 없음 |
| T11 | UC-009 | 존재하지 않는 REQ-999 참조 |

### ⚠️ 경고
| T8 | ENT-017 | 어떤 FEAT에서도 사용되지 않음 (미사용 테이블 의심) |

### 조치 제안
- REQ-018: 범위 밖으로 뺄지, FEAT를 추가할지 결정 필요 → 사용자 확인
- FEAT-044: TC 작성 (정상 1 + 예외 1)
- UC-009: REQ 참조 오타로 보임 → REQ-019 여부 확인
```

## `--report` 추적성 매트릭스
`--report`는 표를 출력하고 `$doc-gen 추적성`이 `documents/generated/90-추적성매트릭스.md`를 생성한다. `aidd-guide/process/05-traceability.md` §6 포맷.
미실현 REQ가 하나라도 있으면 표 상단에 경고를 붙인다.

## `--impact ID` 변경 영향 분석
`--impact`는 REQ·UC·FEAT·ENT·API·SCR·IF·TC·NFR 식별자, `--source`는 저장소 기준 경로와 선택 `#메서드`를 받는다.
소유 계약·공통 기능/화면의 모든 소비자와 연결 정본·명시 소스·구현 슬라이스를 검토한다.
화면·API가 없는 기능의 빈 칸은 정상이다. 연결 없는 소스는 영향 없음이 아니라 확인 필요다.
규칙은 `aidd-guide/artifact/spec-schema.md`의 「설계 문서의 책임과 연결」을 따른다.
변경 전후를 모두 조회하고 삭제·이름 변경은 이전 연결도 확인한다. 미등록 소비자·실제 API 전수 일치·동적 호출은 별도 대조한다.
**영향 분석 결과는 보고만 하고 자동 수정하지 않는다.** 이미 승인된 범위의 의미 변경은 CR 절차로 처리한다.
