---
name: trace
description: 추적성 체인을 검사한다. REQ→UC→FEAT→ENT/API/SCR→TC 연결이 끊긴 곳, 고아 산출물, 미실현 요구사항, dangling ID를 찾아 보고하고 추적성 매트릭스를 생성한다.
---

<!-- generated_from: aidd-guide/harness/skill-src/trace.md; do not edit -->

# 추적성 검사

인자: 없음(검사만) / `--g1`(G1 청구 — 정련 카드 완전성을 오류로) / `--workstream <키>`(작업흐름 G3 범위) /
`--report`(매트릭스 생성) / `--impact ID`(변경 영향 분석)

## 검사 실행
`.claude/hooks/trace-check.mjs` 를 실행한다. 없으면 documents/spec/*.yaml 을 직접 파싱해
`aidd-guide/process/05-traceability.md` §3 의 T1~T14 규칙을 검사한다.

```bash
node .claude/hooks/trace-check.mjs --all
node .claude/hooks/trace-check.mjs --all --workstream admin
node .claude/hooks/trace-check.mjs --g1
node .claude/hooks/trace-check.mjs --impact REQ-116
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
`documents/generated/90-추적성매트릭스.md` 생성. `aidd-guide/process/05-traceability.md` §6 포맷.
미실현 REQ가 하나라도 있으면 표 상단에 경고를 붙인다.

## `--impact ID` 변경 영향 분석
`trace-check.mjs --impact <REQ|FEAT>` 가 정련 카드의 연계를 따라 REQ 를 연쇄로 모으고 그 실현 산출물을 낸다.
그 결과를 뼈대로 **직접 영향**과 **간접 영향**(ADR·인접 화면·구현된 슬라이스)을 나열한다.
카드 없는 REQ 가 걸렸다는 경고가 나오면 목록이 불완전하다고 함께 보고한다.
`aidd-guide/process/05-traceability.md` §5 포맷. 이미 구현된 슬라이스가 걸리면 재작업 규모를 함께 낸다.

**영향 분석 결과는 보고만 하고 자동 수정하지 않는다.** 사용자 판단 후 CR 절차로.
