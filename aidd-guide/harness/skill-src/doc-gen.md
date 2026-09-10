---
name: doc-gen
description: documents/spec/ 의 YAML에서 사람이 읽는 산출물 문서를 생성한다. 요건정의서, 유즈케이스 명세, ERD, API 문서, 화면정의서, 권한 매트릭스, 테스트 케이스, 사용자 매뉴얼 등을 documents/generated/ 아래에 만든다.
---

# 문서 생성 (spec → docs)

인자: 없음(전체) / `아키텍처` `기능목록` `화면` `권한` `요건정의서` `유즈케이스` `ERD` `DDL` `API`
`시퀀스` `테스트` `매뉴얼` `추적성`

**목록의 정본은 아래 「생성 대상」 표다.** 이 줄은 그 표의 첫 칸을 줄인 것이며,
**표에 행을 더하면 이 줄도 함께 고친다** — 갈리면 표가 이긴다.

## 먼저 스크립트를 돌린다 — 손으로 쓰지 않는다

```bash
node .claude/skills/doc-gen/gen.mjs                    # 스크립트가 아는 대상 전부
node .claude/skills/doc-gen/gen.mjs 요구사항정의서 화면정의서
node .claude/skills/doc-gen/gen.mjs --check            # 생성물이 spec 을 다 담았나
```

**왜 스크립트인가** — 파생물의 값은 *정본에서 언제든 **같은 것**이 다시 나온다* 는 데
있다. 산문 지시로만 두면 부를 때마다 결과가 흔들리고 그 값이 사라진다.

- **`gen.mjs` 가 만드는 대상**은 아래 표에서 **`gen`** 으로 표시된 것이다. 그 대상은
  **손으로 쓰지 않는다** — 서식을 바꿀 일이 있으면 `gen.mjs` 를 고친다.
- **`prose` 로 표시된 것만 이 문서의 지시를 읽고 AI 가 쓴다.** 쓰고 나면
  **`gen.mjs` 에 대상으로 옮긴다** — 두 번째 생성부터 흔들리지 않게 하기 위함이다.
- **의존성을 갖지 않는다.** YAML 은 `hooks/lib.mjs` 의 `parseYaml` 로 읽는다. 새 런타임을
  들이지 않는 것이 폐쇄망 전제다 — 이 저장소의 도구는 전부 Node 다.
- **`--check` 가 완전성을 센다** — spec ID · 스칼라 값 · 상대 링크 셋을 대조해
  *생성물에서 조용히 사라진 것* 을 찾는다. **P3 spec 이 채워지면 빨개지는 것이 정상이다**
  (새 대상이 필요하다는 신호이며, 초록으로 만들려고 검사를 좁히지 않는다).

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

`gen` = `gen.mjs` 가 만든다(손대지 않는다) · `prose` = 아직 이 문서를 읽고 AI 가 쓴다

| 대상 | 누가 | 출력 | 원본 |
|---|---|---|---|
| **요구사항정의서** | `gen` | `documents/generated/10-요구사항정의서/{장}.md` + `_index.md` | 00-charter · 01-actors · 02-constraints · 03-glossary · 10-requirements · 11-processes · 21-nfr · 51-interfaces |
| 아키텍처 | `gen` | `documents/generated/20-아키텍처.md` (Mermaid) | 20-architecture + ADR |
| 기능목록·메뉴 | `gen` | `documents/generated/31-기능목록.md` | 31-features |
| 화면정의서 | `gen` | `documents/generated/60-화면정의서.md` | 60-screens |
| 권한매트릭스 | `gen` | `documents/generated/22-권한매트릭스.md` | 22-authz |
| 추적성 | `gen` | `documents/generated/90-추적성매트릭스.md` | `trace-check --report` |
| 요건정의서 | `prose` | `documents/generated/32-요건정의서/FEAT-###.md` + `_index.md` | 31-features + 30-usecases + 10-requirements |
| 유즈케이스 | `prose` | `documents/generated/30-유즈케이스.md` | 30-usecases |
| ERD | `prose` | `documents/generated/40-ERD.md` (Mermaid erDiagram) | 40-domain |
| DDL | `prose` | `db/ddl/*.sql` | 40-domain + conventions |
| API | `prose` | `documents/generated/50-API.md` + `documents/generated/50-openapi.yaml` | 50-api |
| 테스트케이스 | `prose` | `documents/generated/70-테스트케이스.md` | 70-testcases |
| 시퀀스 | `prose` | `documents/generated/33-시퀀스/UC-###.md` (Mermaid sequenceDiagram) + `_index.md` | 30-usecases + 50-api |
| 사용자매뉴얼 | `prose` | `documents/generated/81-사용자매뉴얼.md` | 31-features menu + 60-screens + 30-usecases |

**`prose` 여덟이 아직 `gen` 이 아닌 이유는 하나다 — 원본 spec 이 비어 있다**(30·40·50·70).
서식을 지어 코드로 박으면 그 서식이 실물을 만나 보기 전에 굳는다. **spec 을 채운 뒤
한 번 손으로 내고, 그 결과를 `gen.mjs` 로 옮긴다.** `gen.mjs` 의 `NOT_YET` 이 같은
목록을 갖고 있어 부르면 *왜 아직 아닌지* 를 말한다 — 조용히 빠지지 않게 하기 위함이다.

## 요구사항 정의서 — 지도 43행 (`요구사항정의서`)

**요건정의서(32)와 다른 것이다.** 32 는 *기능 하나* 를 구현하려는 AI 가 읽고, 이것은
**P0~P2 정본 여덟을 사용자(고객·의사결정자)가 순서대로** 읽는다 — 판단하는 것은
*이대로 만들어도 되는가* 이고, 그 판단이 곧 게이트 승인이다.

- **왜 자리를 갖나** — spec 여덟이 `S` 라 파생 뷰가 없었고, **게이트 승인의 대상을
  YAML 로 내밀고 있었다.** AGENTS.md §5-12(이해하지 못한 승인을 받아내지 않는다)가
  요구하는 것을 이 문서가 뒷받침한다.
- **소유** — **파생(`G`)이다.** `.gitignore` 대상이며 커밋하지 않는다. 고칠 것은 spec 이다.
- **장 나눔** (원칙 B — 한 장이 한 파일이다)

| 파일 | 원본 | 담는 것 |
|---|---|---|
| `_index.md` | — | 장 목록 + 한 줄 요약 + 승인 상태 |
| `00-개요.md` | 00-charter | 문제 · 경제성 · 목적 · 목표 · 비목표 · 성공 기준 · 로드맵 |
| `01-이해관계자.md` | 01-actors | 액터 · 모듈 |
| `02-제약과-원칙.md` | 02-constraints | 설계 원칙 · 기술 제약 · 배포 전제 · 착수 시 확정 항목 |
| `03-용어.md` | 03-glossary | 용어 · 턴 상태 · 프레임워크 어휘 · **헷갈리는 짝** |
| `04-요구사항.md` | 10-requirements | 기능 요구사항 (FR) |
| `05-업무프로세스.md` | 11-processes | As-Is / To-Be |
| `06-비기능요구.md` | 21-nfr | 성능 · 비용 · 안정성 |
| `07-외부인터페이스.md` | 51-interfaces | 나가는 · 들어오는 연동 |

- **비어 있는 spec 은 빈 장으로 낸다** — *왜 비어 있고 무엇에 막혀 있는지* 를 그 장에
  적는다. 장을 빼면 읽는 사람이 **그 주제를 다룬 줄 알게 된다.**
- **`meta.status` 와 `baselined` 를 각 장 머리에 싣는다.** `migrated` 는 승인 전이라는
  뜻이며, 그 표시가 없으면 파생 뷰가 합의된 것처럼 읽힌다.

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
