---
id: LLM-ART-001
title: "spec 스키마 — 파일과 작성 단계"
category: artifact
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: []
author: Bong Jong Hyeon
tier: 1
tags: [spec, ssot, yaml]
---

# documents/spec/ 스키마 안내

`documents/spec/` 은 이 프로젝트의 **유일한 진실(SSOT)** 이다. `documents/generated/` 는 여기서 생성된 뷰다.

## 파일 목록과 작성 단계

| 파일 | 단계 | 내용 | 형식 참조 |
|---|---|---|---|
| `00-charter.yaml` | P0 | 목적·문제·성공기준·범위·트랙 | `aidd-guide/phase/P0-inception.md` §3 |
| `01-actors.yaml` | P0 | 액터(사용자/외부시스템) | 〃 |
| `02-constraints.yaml` | P0 | 제약사항 | 〃 |
| `03-glossary.yaml` | P1 | 용어사전 (유비쿼터스 언어) | `aidd-guide/phase/P1-discovery.md` §2 |
| `10-requirements.yaml` | P1 | 요구사항 FR/NFR | 〃 §4 |
| `11-processes.yaml` | P1 | 업무 프로세스 To-Be | 〃 §3 |
| `20-architecture.yaml` | P2 | 기술스택·인프라·사이징 | `aidd-guide/phase/P2-architecture.md` §4 |
| `21-nfr.yaml` | P2 | 비기능 목표치·측정방법 | 〃 §3 |
| `22-authz.yaml` | P2 | 권한 모델·역할 | 〃 §5 |
| `30-usecases.yaml` | P3 | 유즈케이스 (기본/대안/예외 흐름) | `aidd-guide/phase/P3-design.md` §2 |
| `31-features.yaml` | P3 | 기능 목록 + 메뉴 트리 | 〃 §3 |
| `40-domain.yaml` | P3 | 엔티티·속성·인덱스·상태전이 | 〃 §4 |
| `50-api.yaml` | P3 | API 명세 | 〃 §5 |
| `51-interfaces.yaml` | P3 | 외부 시스템 연동 | 〃 |
| `60-screens.yaml` | P3 | 화면 정의 | 〃 §6 |
| `70-testcases.yaml` | P3~ | 테스트 케이스 | `aidd-guide/quality/INDEX.md` §1 |

## 공통 규칙

1. 모든 항목에 `id:` 가 있다. ID 체계 → `aidd-guide/process/traceability.md` §2
2. ID는 재사용하지 않는다. 삭제해도 번호를 비워 둔다.
3. 상위 산출물을 참조하는 필드가 반드시 있다 (`reqs:`, `usecases:`, `feature:` 등).
4. G3 승인 후 베이스라인 동결. 각 파일 헤더에 `baselined: YYYY-MM-DD` 를 적는다.
5. 베이스라인 이후 변경은 `/change-request`.

## 검증

```bash
python .claude/hooks/trace-check.mjs --all
```
또는 `/trace`.
