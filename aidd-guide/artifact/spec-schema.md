---
id: LLM-ART-001
title: "spec 스키마 — 파일과 작성 단계"
category: artifact
type: operation
created: 2026-09-04
updated: 2026-09-28
status: active
sources: []
tier: 1
tags: [spec, ssot, yaml]
---

# documents/spec/ 스키마 안내

`documents/spec/` 은 이 프로젝트의 **유일한 진실(SSOT)** 이다. `documents/generated/` 는 여기서 생성된 뷰다.

## 논리 문서와 작성 단계

각 행은 파일 하나가 아니라 **논리 spec 문서**다. 정식 저장 형태는
`documents/spec/{이름}/_index.yaml`과 번호 조각(`NNN-이름.yaml`)으로 구성한 spec-set이며,
호출자·링크·생성기는 `_index.yaml` 또는 논리 폴더를 가리킨다. 이관 중에만 같은 이름의
단일 YAML 하나를 읽을 수 있고, 단일 YAML과 spec-set은 함께 두지 않는다.

| 논리 문서 (`_index.yaml`) | 단계 | 내용 | 형식 참조 |
|---|---|---|---|
| `00-charter/_index.yaml` | P0 | 목적·문제·성공기준·범위·트랙 | `aidd-guide/phase/P0-inception.md` §3 |
| `01-actors/_index.yaml` | P0 | 액터(사용자/외부시스템) | 〃 |
| `02-constraints/_index.yaml` | P0 | 제약사항 | 〃 |
| `03-glossary/_index.yaml` | P1 | 용어사전 (유비쿼터스 언어) | `aidd-guide/phase/P1-discovery.md` §2 |
| `10-requirements/_index.yaml` | P1 | 요구사항 FR/NFR + 정련 카드 | 〃 §4 · §5 |
| `11-processes/_index.yaml` | P1 | 업무 프로세스 To-Be | 〃 §3 |
| `20-architecture/_index.yaml` | P2 | 기술스택·인프라·사이징 | `aidd-guide/phase/P2-architecture.md` §4 |
| `21-nfr/_index.yaml` | P2 | 비기능 목표치·측정방법 | 〃 §3 |
| `22-authz/_index.yaml` | P2 | 권한 모델·역할 | 〃 §5 |
| `30-usecases/_index.yaml` | P3 | 유즈케이스 (기본/대안/예외 흐름) | `aidd-guide/phase/P3-design.md` §2 |
| `31-features/_index.yaml` | P3 | 기능 목록 + 메뉴 트리 | 〃 §3 |
| `40-domain/_index.yaml` | P3 | 엔티티·속성·인덱스·상태전이 | 〃 §4 |
| `50-api/_index.yaml` | P3 | API 명세 | 〃 §5 |
| `51-interfaces/_index.yaml` | P3 | 외부 시스템 연동 | 〃 |
| `60-screens/_index.yaml` | P3 | 화면 정의 | 〃 §6 |
| `70-testcases/_index.yaml` | P3~ | 테스트 케이스 | `aidd-guide/quality/test-design.md` §1 |
| `80-operations/_index.yaml` | P2~P6 | 운영 절차·검증·복구·에스컬레이션 | `aidd-guide/artifact/template/05-runbook.md` |

## spec-set 공통 규칙

1. `_index.yaml`은 `meta`와 `spec_set: { version: 1, parts: [...] }`만 가진다. 본문 값은
   번호 조각에 둔다.
2. `parts`는 실행·문서 생성·검사가 읽는 유일한 순서다. 모든 조각은 목록에 정확히 한 번만
   나오며, 목록 밖 YAML은 허용하지 않는다.
3. 조각은 최상위 키를 중복 정의하지 않는다. 배열은 선언된 순서로 이어 붙이고, 객체는
   충돌 없이 병합한다.
4. 설명에 의미가 있던 YAML 주석은 삭제하지 않고 **그 설명이 걸리는 항목의** 명시적
   `note`·`rationale`로 승격한다. 주석은 검증·생성의 입력이 아니다.
5. **조각은 업무 영역 하나이고, 항목 12건 이하 또는 약 800줄 이하로 둔다.** 넘으면 영역을 둘로
   나눈다 — 요구사항 정련 카드처럼 항목마다 칸이 많은 문서는 금방 수천 줄이 되어 읽히지 않는다.
   조각 첫 줄에 `# 영역: <이름>` 을 두면 생성기가 그 이름으로 생성 파일을 하나씩 만든다(`10-requirements`).
   ID 범위나 영역 이름을 생성기에 다시 적지 않는다. 나눌 때는 병합 결과가 나누기 전과 같은지 대조한다.
6. `meta`는 **문서 수준의 사실만** 갖는다 — 상태·베이스라인·채번 규칙과 문서 전체에 걸리는
   업무 규약이다. 이관 메모·편집 이력·줄번호 같은 작업 흔적은 두지 않는다. `meta`의 값은
   고객 제출 문서로 나가며, 나가는 키는 `doc-gen`의 `META_PUBLIC`이 허용목록으로 정한다.

## 공통 규칙

1. 모든 항목에 `id:` 가 있다. ID 체계 → [05-traceability.md](../process/05-traceability.md) §2
2. ID는 재사용하지 않는다. 삭제해도 번호를 비워 둔다.
3. 상위 산출물을 참조하는 필드가 반드시 있다 (`reqs:`, `usecases:`, `feature:` 등).
4. G3 승인 후 베이스라인 동결. 각 문서의 `meta.baselined`에 날짜를 적는다.
5. 베이스라인 이후 변경은 `/change-request`.
6. **요구사항 사실(업무 규칙·산식·판정 조건)의 정본은 REQ 의 정련 카드다.** `FEAT`·`SCR` 은 기능 범위와 표시를 적고 규칙은 그 REQ 를 가리킨다 — 두 곳에 적으면 한쪽만 고쳐진다.

## 검증

```bash
node .claude/hooks/trace-check.mjs --all
```
또는 `/trace`.
