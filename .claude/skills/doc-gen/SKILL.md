---
name: doc-gen
description: documents/spec/ 의 YAML에서 사람이 읽는 산출물 문서를 생성한다. 요건정의서, 유즈케이스 명세, ERD, API 문서, 화면정의서, 권한 매트릭스, 테스트 케이스, 사용자 매뉴얼 등을 documents/generated/ 아래에 만든다.
---

# 문서 생성 (spec → docs)

인자: 없음(전체) / `아키텍처` `기능목록` `화면` `권한` `요건정의서` `유즈케이스` `ERD` `DDL` `API`
`시퀀스` `테스트` `매뉴얼` `추적성`

**목록의 정본은 아래 「생성 대상」 표다.** 이 줄은 그 표의 첫 칸을 줄인 것이며,
**표에 행을 더하면 이 줄도 함께 고친다** — 갈리면 표가 이긴다.

## 원칙
- **`documents/generated/` 는 파생물이다.** 항상 `documents/spec/` 에서 다시 만든다. 손으로 고친 내용은 덮어써진다.
- 생성 전 `documents/spec/` 의 스키마 유효성과 ID 참조 무결성을 먼저 확인한다.
- 모든 생성 문서에 프런트매터를 넣는다:
  ```yaml
  ---
  id: FEAT-012
  traces_to: [UC-004, REQ-011]
  status: baselined
  generated_from: documents/spec/31-features.yaml
  last_sync: 2026-09-04
  ---
  <!-- 이 문서는 생성물입니다. 직접 수정하지 마세요. documents/spec/ 을 수정 후 /doc-gen 하세요. -->
  ```
- 다이어그램은 전부 **Mermaid**. 이미지 파일을 만들지 않는다.
  - **레이블의 괄호는 `#40;`·`#41;` 로 escape 한다.** 원통 노드 `[("…")]` 안의 `)` 가
    셰이프 종료로 읽힐 수 있고, 인용만으로 안전한지는 셰이프마다 다르다. spec 에는
    괄호가 든 레이블이 흔하다(`AI 전용 DB (PostgreSQL)`) — 여기서 escape 하지 않으면
    **그림이 통째로 렌더되지 않고, 생성물이라 아무도 고치지 않는다.**
  - 아키텍처 그림의 노드·간선 원본은 `20-architecture.yaml` 의 `topology.nodes`·`edges` 다.
    **`edge_invariants` 를 함께 싣는다** — 그림만으로는 낡음을 판정할 수 없다.
- **기능별로 파일을 쪼갠다.** 큰 단일 문서는 다음 세션에 AI가 통째로 못 읽는다.
- 각 디렉터리에 `_index.md` (ID + 한 줄 요약)를 만든다. AI는 인덱스를 먼저 읽는다.

## 생성 대상

| 대상 | 출력 | 원본 |
|---|---|---|
| 요건정의서 | `documents/generated/32-요건정의서/FEAT-###.md` + `_index.md` | 31-features + 30-usecases + 10-requirements |
| 유즈케이스 | `documents/generated/30-유즈케이스.md` | 30-usecases |
| 기능목록·메뉴 | `documents/generated/31-기능목록.md` | 31-features |
| ERD | `documents/generated/40-ERD.md` (Mermaid erDiagram) | 40-domain |
| DDL | `db/ddl/*.sql` | 40-domain + conventions |
| API | `documents/generated/50-API.md` + `documents/generated/50-openapi.yaml` | 50-api |
| 화면정의서 | `documents/generated/60-화면정의서.md` | 60-screens |
| 권한매트릭스 | `documents/generated/22-권한매트릭스.md` (역할×기능 표) | 22-authz + 31-features |
| 테스트케이스 | `documents/generated/70-테스트케이스.md` | 70-testcases |
| 시퀀스 | `documents/generated/33-시퀀스/UC-###.md` (Mermaid sequenceDiagram) + `_index.md` | 30-usecases + 50-api |
| 아키텍처 | `documents/generated/20-아키텍처.md` (C4 Mermaid) | 20-architecture + ADR |
| 추적성 | `documents/generated/90-추적성매트릭스.md` | 전체 |
| 사용자매뉴얼 | `documents/generated/81-사용자매뉴얼.md` | 31-features menu + 60-screens + 30-usecases |

## 요건정의서 한 장 포맷 (핵심 산출물)
```markdown
# FEAT-012 입고 예정 등록

| 항목 | 내용 |
|---|---|
| 기능ID | FEAT-012 |
| 메뉴 | 입고관리 > 입고예정등록 (MNU-01-01) |
| 유형 | 트랜잭션 |
| 관련 요구사항 | REQ-011, REQ-012 |
| 유즈케이스 | UC-004 |
| 사용 권한 | 협력사담당자, 창고관리자 |

## 1. 기능 개요
## 2. 처리 흐름  (UC main_flow)
## 3. 업무 규칙  (UC business_rules)
## 4. 예외 처리  (UC exception_flows → API 에러코드 매핑 표)
## 5. 화면       (SCR-008 필드·액션·유효성)
## 6. 데이터     (사용 엔티티, 생성/변경되는 항목)
## 7. API        (API-031, API-032 요약)
## 8. 테스트 케이스 (TC 목록)
```

## 사용자 매뉴얼 생성 규칙
기능 나열이 아니라 **업무 상황 기준 목차**로 만든다. 역할별로 섹션을 나눈다.
각 절차에 "이럴 때는" (오류 상황 대응) 을 붙인다. → `aidd-guide/phase/P6-deliver.md` §3

## 완료 후
생성한 파일 목록과 건수를 보고한다. spec 대비 누락이 있으면 함께 보고한다.
