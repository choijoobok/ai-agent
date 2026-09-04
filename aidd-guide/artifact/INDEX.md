---
id: LLM-ART-IDX
title: "산출물 지도 — 무엇을 언제 어디에"
category: artifact
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: []
author: Bong Jong Hyeon
tier: 1
tags: [artifact, map, index]
---

# 산출물 지도 — 무엇을, 언제, 어디에

## 1. 전체 산출물 목록

`S` = SSOT(명세, 직접 작성) · `G` = 생성물(spec에서 파생) · `L` = 원장(누적 기록)

| # | 산출물 | 단계 | 종류 | 경로 | Lite | Std | Full |
|---|---|---|---|---|:-:|:-:|:-:|
| 1 | 프로젝트 헌장 (목적·범위·성공기준) | P0 | S | `documents/spec/00-charter.yaml` | ● | ● | ● |
| 2 | 이해관계자 / 액터 정의 | P0 | S | `documents/spec/01-actors.yaml` | ● | ● | ● |
| 3 | 제약사항 · 전제 | P0 | S | `documents/spec/02-constraints.yaml` | ● | ● | ● |
| 4 | 용어사전 (유비쿼터스 언어) | P1 | S | `documents/spec/03-glossary.yaml` | ● | ● | ● |
| 5 | 업무 프로세스 정의 (As-Is / To-Be) | P1 | S | `documents/spec/11-processes.yaml` | ○ | ● | ● |
| 6 | 요구사항 목록 (FR/NFR) | P1 | S | `documents/spec/10-requirements.yaml` | ● | ● | ● |
| 7 | 아키텍처 결정 기록 | P2 | L | `documents/decisions/ADR-{번호}-{제목}.md` | ● | ● | ● |
| 8 | 기술 스택 · 인프라 구성도 | P2 | S+G | `documents/spec/20-architecture.yaml` → `documents/generated/20-아키텍처.md` | ● | ● | ● |
| 9 | 비기능 목표치 (성능·가용성·보안) | P2 | S | `documents/spec/21-nfr.yaml` | ○ | ● | ● |
| 10 | 유즈케이스 명세 (기본/대안/예외 흐름) | P3 | S+G | `documents/spec/30-usecases.yaml` → `documents/generated/30-유즈케이스.md` | △ | ● | ● |
| 11 | 기능 목록 · 메뉴 구조 | P3 | S+G | `documents/spec/31-features.yaml` → `documents/generated/31-기능목록.md` | ● | ● | ● |
| 12 | 기능별 요건 정의서 | P3 | G | `documents/generated/32-요건정의서/FEAT-{###}.md` | ● | ● | ● |
| 13 | 도메인/데이터 모델 · ERD | P3 | S+G | `documents/spec/40-domain.yaml` → `documents/generated/40-ERD.md` (Mermaid) | ● | ● | ● |
| 14 | 물리 스키마 | P3 | S | `documents/spec/40-domain.yaml` → **Liquibase changeset** `sources/backend/bootstrap/src/main/resources/db/changelog/` | ● | ● | ● |
| 15 | API 명세 | P3 | S+G | `documents/spec/50-api.yaml` (OpenAPI) → `documents/generated/50-API.md` | ● | ● | ● |
| 16 | 화면 목록 · 화면 정의서 | P3 | S+G | `documents/spec/60-screens.yaml` → `documents/generated/60-화면정의서.md` | ● | ● | ● |
| 17 | 시퀀스 다이어그램 | P3 | G | `documents/generated/33-시퀀스/UC-{###}.md` (Mermaid) | △ | ● | ● |
| 18 | 인터페이스 정의서 (외부 연동) | P3 | S | `documents/spec/51-interfaces.yaml` | ○ | ● | ● |
| 19 | 권한 매트릭스 | P3 | S+G | `documents/spec/22-authz.yaml` → `documents/generated/22-권한매트릭스.md` | ○ | ● | ● |
| 20 | 슬라이스 백로그 | P4 | L | `documents/project.state.yaml` `slices:` | ● | ● | ● |
| 21 | 소스 코드 | P4 | - | `sources/` | ● | ● | ● |
| 22 | 단위/통합 테스트 코드 | P4 | - | `sources/backend/*/src/test/` · `sources/frontend/src/**/*.test.ts` | ● | ● | ● |
| 23 | 테스트 케이스 | P3~P5 | S+G | `documents/spec/70-testcases.yaml` → `documents/generated/70-테스트케이스.md` | ● | ● | ● |
| 24 | 테스트 수행 결과서 | P5 | G | `documents/generated/71-테스트결과서.md` | ● | ● | ● |
| 25 | 결함 관리 대장 | P5 | L | `documents/generated/72-결함대장.md` | ○ | ● | ● |
| 26 | 추적성 매트릭스 | P3~P5 | G | `documents/generated/90-추적성매트릭스.md` | ○ | ● | ● |
| 27 | 가정 원장 | 상시 | L | `documents/decisions/ASSUMPTIONS.md` | ● | ● | ● |
| 28 | 변경 요청 대장 | P3~ | L | `documents/decisions/CHANGES.md` | ○ | ● | ● |
| 29 | 배포/운영 런북 | P6 | S | `documents/generated/80-운영런북.md` | ○ | ● | ● |
| 30 | 사용자 매뉴얼 | P6 | G | `documents/generated/81-사용자매뉴얼.md` | ● | ● | ● |
| 31 | 데이터 이행 계획 | P6 | S | `documents/generated/82-데이터이행.md` | ○ | ○ | ● |
| 32 | 인수 확인서 | P6 | G | `documents/generated/99-인수확인서.md` | ○ | ● | ● |
| 33 | **화면 요건 정의서** | P3~P4 | S | `documents/screen/{페이지경로}/requirements.md` | ● | ● | ● |
| 34 | **화면 목업 + 테스트케이스** | P3~P4 | S | `documents/screen/{페이지경로}/mockup.html` | ● | ● | ● |
| 35 | **화면 사용자 메뉴얼** | P4 | S | `documents/screen/{페이지경로}/manual.md` | ● | ● | ● |
| 36 | 〃 파생 · 화면 그림 · 구현 기록 | P4 | G | `documents/screen/{페이지경로}/manual.html` · `screen.png` · `impl.md` | ○ | ● | ● |
| 37 | 메뉴 없는 화면의 문서 | P3~P4 | S | `documents/screen/_standalone/{화면이름}/` | ○ | ● | ● |
| 38 | 화면 문서 셋 템플릿·열람 페이지 | 상시 | S+G | `documents/screen/_TEMPLATE/` · `documents/screen/README.md` · `documents/screen/index.html` | ● | ● | ● |
| 39 | **상세 설계 문서** | P3 | S | `documents/design/{주제}.md` | ○ | ● | ● |
| 40 | 산출물 대장 (이 지도의 현재 상태) | 상시 | S | `documents/INDEX.md` | ● | ● | ● |

● 필수 · △ 축약형 · ○ 선택

### 33~38 — 화면 문서 셋은 왜 `generated/` 가 아닌가

**셋은 spec 에서 생성되지 않는다.** `60-screens.yaml` 은 화면의 *목록과 소속* 을 갖고,
요건서는 그 화면의 *컬럼·검증·영향 테이블* 을 갖는다 — 후자는 spec 에 담기지 않는 분량이며
**설계자가 목업과 함께 보고 승인하는 대상**이다(CLAUDE.md §6.3 ③). 그래서 직접 작성(`S`)이고,
`60-screens.yaml` 의 `SCR-###` 과 폴더가 1:1 로 대응하는 것으로 추적성을 유지한다.

### 39 — 상세 설계 문서는 무엇을 담나

**spec YAML 로 접히지 않는 설계**만 담는다 — 상태 기계의 전이 규약, 오케스트레이션 흐름,
프로토콜처럼 *구조화된 행* 이 아니라 *규범적 산문* 인 것. 담을지 판단하는 기준은 하나다:
**ID 를 가진 항목의 목록으로 표현되면 spec 이고, 그렇지 않으면 여기다.**
여기에 적은 것도 상위 spec 의 ID 를 헤더에 명시해 추적성 체인에 붙인다.

## 2. 이 지도가 곧 문서 예산이다

**`documents/` 에는 위 표에 있는 자리만 만든다.** `guard-write` 훅이 이 파일의 경로 칸을
읽어 **그 밖의 새 문서를 차단한다** — CLAUDE.md §4 의 집행 지점이 여기다.

- 새 종류가 정말 필요하면 **이 표에 행을 먼저 더하고** 사용자에게 왜 필요한지 보고한다.
  번호는 40부터 이어 붙이며, 지운 행의 번호는 재사용하지 않는다.
- **경로 칸의 `{…}` 는 자리표시자다** — 훅이 `[^/]+` 로 읽는다. 새 행을 더할 때 실제 경로에
  가변 부분이 있으면 반드시 `{…}` 로 적는다. 아니면 그 자리가 열리지 않는다.
- **정리 내역·현황·근거를 적는 문서는 이 표에 없다.** 그것들은 커밋 메시지와 ADR 과
  `project.state.yaml` 이 갖는다. 여기에 행을 더해 달라는 요구가 그 셋으로 답할 수 있는
  것이면 **행을 더하지 않는다.**

## 3. 산출물 생성 원칙

### 원칙 A — SSOT를 먼저, 문서는 나중에
`S` 표시 산출물만 손으로(=AI가 직접) 만든다. `G` 는 `/doc-gen` 스킬이 spec에서 생성한다.
사람이 `documents/generated/` 를 고치면 다음 생성 때 덮어써진다. 훅이 경고한다.

### 원칙 B — 문서는 "AI가 다시 읽을 것"을 전제로 쓴다
- 파일 하나가 너무 크면 AI가 다음 세션에 통째로 못 읽는다. **기능별로 파일을 쪼갠다** (`documents/generated/32-요건정의서/FEAT-012.md`).
- 각 디렉터리에 `_index.md` 를 두고 ID와 한 줄 요약만 나열한다. AI는 인덱스를 먼저 읽고 필요한 것만 연다.
- 산문보다 **표와 목록**. AI가 부분 수정하기 쉽다.

### 원칙 C — 다이어그램은 Mermaid로
ERD, 시퀀스, 상태도, 플로우차트 전부 Mermaid 코드블록. 텍스트라서 diff·검색·부분 수정이 된다.
이미지 파일은 만들지 않는다.

### 원칙 D — 산출물마다 헤더 블록 필수
```markdown
---
id: FEAT-012
title: 입고 예정 등록
traces_to: [UC-004, REQ-011]
status: baselined      # draft | reviewed | baselined | changed
generated_from: documents/spec/31-features.yaml
last_sync: 2026-09-04
---
```
`generated_from` 이 있으면 생성물이다. 직접 수정 금지 표시이기도 하다.

## 4. 산출물 생성 시점 (게이트 기준)

```
P0 게이트 통과 조건 → 1, 2, 3 완료
P1 게이트 통과 조건 → 4, 5, 6 완료 + 요구사항이 액터/프로세스에 모두 연결됨
P2 게이트 통과 조건 → 7, 8, 9 완료 + 모든 NFR에 측정 가능한 수치
P3 게이트 통과 조건 → 10~19, 39 완료 + 추적성 체인 무결 + ★spec 베이스라인 동결★
P4 (슬라이스별) → 21, 22, 33~36 + 해당 TC 통과. 슬라이스 미니게이트.
P5 게이트 통과 조건 → 23, 24, 25, 26 완료 + 잔여 결함이 합의된 수준 이하
P6 게이트 통과 조건 → 29~32 완료 + 사용자 인수
```
