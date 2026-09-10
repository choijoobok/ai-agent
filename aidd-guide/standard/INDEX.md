---
id: LLM-FWK-IDX
title: "standard — 프레임워크 가이드 INDEX"
category: standard
type: operation
class: none
created: 2026-05-04
updated: 2026-09-07
status: active
sources: ["sources/backend/", "sources/frontend/", "sources/gradle/libs.versions.toml"]
tier: 2
tags: [framework, index]
---

# standard — 개발 표준의 정본

> **`AGENTS.md` §8 의 표가 요지이고 여기가 상세와 근거다.**
> 개발 절차(레시피)는 [playbook](../playbook/INDEX.md), 도메인 지식은
> [knowledge](../knowledge/INDEX.md) 가 갖는다. 여기는 **무엇이 어디에 있고
> 어떤 규칙을 따르는가** 다.

## 결정론 영역

**같은 질문에 같은 답이 나와야 한다.** 스택 버전·패키지 구조·API 계약은 **추론·변형의
대상이 아니다** — 사실을 검증하고 소스를 그대로 인용한다.

| 영역 | 어디 | 규약 |
|---|---|---|
| **결정론** | **standard**(여기) · knowledge | 사실 검증 · 창의적 변형 금지 |
| 창의 | artifact/screen · playbook | 변형·추론 가능 |

**여기서 추정이 발견되면 즉시 사용자에게 보고한다.**

## 진입 결정 트리

```
요청
  ├─ "버전이 뭐지 · 라이브러리를 더해도 되나"      → stack.md
  ├─ "어떻게 빌드·배포하나 · CI 가 뭘 도나"        → build-deploy.md
  ├─ "이름을 어떻게 짓나 · 인코딩 · 게이트 · 커밋"  → conventions.md
  ├─ "시드를 언제 어떻게 다시 만드나"              → seed.md
  ├─ 백엔드 —— 구조 · API · 영속 · 조회 · 보안 …   → backend/INDEX.md
  ├─ 프론트 —— 뼈대 · 그리드 · 조회조건 · 문구 …   → frontend/INDEX.md
  ├─ PII · 프롬프트 인젝션 · 비밀값 · 호출 제한    → safety/INDEX.md
  ├─ "이런 공통물이 이미 있나"                     → registry.md (생성물)
  ├─ "이미 있는 공통물을 고친다"                   → 아래 「이미 있는 것을 고칠 때」
  └─ Hub 를 얹을 때만 더해지는 규약                → hub-conventions.md
```

## 이미 있는 것을 고칠 때

> **화면이 아닌 것의 진입이다.** 화면이면 `AGENTS.md` §6.3 으로 되돌아간다 — 요건서 ·
> 목업 · 승인이 앞에 선다. 여기는 **공통물과 횡단 정책**, 즉 `shared/` · `core/` ·
> `support/` 와 프레임워크 설정이다. 목록은 [registry.md](./registry.md) 가 갖는다 —
> **거기서 `CMP-###` 을 받아 ⑦ 에서 그 이름으로 보고한다**(폴더 경로는 바뀌고 ID 는 남는다).

```
① 부류를 가른다   계약형인가 정책형인가 — 아래 표. 방어선이 다르므로 ④가 달라진다
② 사용처를 센다   기계가 답한다. 추정하지 않는다
③ 계약이 바뀌나   안 바뀌면 그냥 고친다. 바뀌면 사용처를 전부 함께 고친다
④ 잠근다          부류에 맞는 검사를 돌리고, 없으면 그 검사를 먼저 만든다
⑤ 문서를 고친다   guide-drift 가 가리킨 문서의 그 절. 일치하면 고치지 않는다
⑥ 한 커밋         소스 · 문서 · 생성된 목록을 함께
⑦ 보고            사용처가 화면 둘 이상이면 무엇이 함께 바뀌는지 사용자에게 먼저
```

**②는 이렇게 센다** — 사용처는 **소스가 갖는다**(`AGENTS.md` §3). 목록이 아니라 참조를 센다:

```bash
cd sources/frontend && npx tsc -b --noEmit   # 계약이 깨지면 여기서 전부 뜬다
```

### 부류 둘 — 가르는 것은 「어겼을 때 무엇이 막나」다

| 부류 | 메타 | 어기면 | ④에서 무엇을 돌리나 |
|---|---|---|---|
| **계약형** | `class: contract` | **컴파일이 막는다** — 계약이 타입과 시그니처에 있다 | `npx tsc -b --noEmit` · `./gradlew check` · 그 공통물의 단위 테스트 |
| **정책형** | `class: policy` | **아무 일도 안 일어난다** — 어겨도 돈다. 나중에 조용히 열리거나 느려진다 | ArchUnit(`bootstrap/src/test/…/architecture/`) · 선언 검사(`scripts/check-*.mjs`) · **없으면 만든다** |
| 부류 밖 | `class: none` | — 공통물의 계약을 말하지 않는 문서(라우팅 · 버전 · 절차) | 해당 없음 |

**어느 부류인지는 문서가 스스로 밝힌다** — 머리말의 `class:` 다([meta-block.md](../meta/meta-block.md)).
여기에 영역을 나열하지 않는 이유는 하나다: **나열은 문서를 더할 때 함께 고쳐지지 않는다.**
`lint.mjs` 가 값이 달렸는지 본다.

**한 문서가 둘에 걸치면 `policy` 다.** 예컨대 [backend/api.md](./backend/api.md) 는 봉투가
타입이지만 경로 규약은 어겨도 돈다. 위험한 쪽을 택하는 이유는 이 표기의 목적이 **조용한
실패를 드러내는 것**이라서다 — 절반이 컴파일로 막힌다고 나머지 절반의 침묵을 덮으면
표기가 안심의 근거로 쓰인다.

**정책형이 위험한 쪽이다.** 계약형은 틀리면 빨간 줄이 뜨고, 정책형은 **초록인 채로 틀린다.**
그래서 정책형을 고칠 때 ④를 건너뛰면 *돌아갔다* 가 *맞다* 의 증거가 되지 않는다
(`AGENTS.md` §5-10 · [quality/redteam.md](../quality/redteam.md) 의 규칙 뒤집기).

### 「보장하는 것」 절 — 정책형이 갖는다

정책형은 계약이 **코드에 없다.** 그러면 부르는 쪽은 계약을 *추측* 하고, 추측은 낙관 쪽으로
틀린다 — 메일의 `true` 를 도달로 읽고, 마스킹이 모든 것을 덮는다고 믿고, 캐시가 곧
새로워진다고 가정한다. 셋 다 **틀린 순간에 아무 일도 일어나지 않는다.**

그래서 정책형 문서는 절 하나를 갖는다:

```
## N. 보장하는 것 — <한 줄>

| 부르는 쪽이 기대해도 되는 것 | 근거 |
| 기대하면 안 되는 것 | 대신 무엇을 하나 |
```

- **오른쪽 칸이 본체다.** *무엇을 보장하지 않는가* 가 사고를 막고, 보장 목록은 대개
  본문에 이미 흩어져 있다.
- **문장이 아니라 표다.** 산문은 읽는 사람이 자기가 필요한 줄만 못 찾는다.
- **`lint.mjs` 가 `policy` 문서에서 이 절을 찾는다.** 아직 없는 문서는 그 안의 명단에
  있고 **개수가 매 실행에 찍힌다** — 줄어들기만 해야 한다.

## 파일

| ID | 파일 | 역할 | 상태 |
|----|------|------|------|
| LLM-FWK-003 | [stack.md](./stack.md) | 버전과 **그 버전이 강요한 것** | ✅ |
| LLM-FWK-005 | [build-deploy.md](./build-deploy.md) | 단일 JAR · 프로파일 · CI — **워크플로가 가리키는 원본** | ✅ |
| LLM-FWK-002 | [conventions.md](./conventions.md) | 이름 · 인코딩 · 주석 · 게이트 · 커밋 | ✅ |
| LLM-FWK-004 | [seed.md](./seed.md) | 생성 시드 — 절차와 검증 | ✅ |
| LLM-FWK-010 | [hub-conventions.md](./hub-conventions.md) | **Hub 를 얹을 때만** 더해지는 규약 — 템플릿 표준이 먼저다 | ✅ |
| LLM-FWK-011 | [registry.md](./registry.md) | **공통물 목록 — 생성물.** 이미 있는 것과 **문서가 없는 것** | ✅ |
| LLM-FWK-IDX-BE | [standard/backend/INDEX.md](./backend/INDEX.md) | 백엔드 표준 15 | ✅ |
| LLM-FWK-IDX-FE | [standard/frontend/INDEX.md](./frontend/INDEX.md) | 프론트엔드 표준 10 | ✅ |
| LLM-FWK-IDX-SF | [standard/safety/INDEX.md](./safety/INDEX.md) | 안전 넷 — PII · 인젝션 · 비밀값 · 호출 제한 | ✅ |

## 스택 한눈에

| 영역 | 기술 |
|---|---|
| Backend | **Spring Boot 4.1** · JDK 25 · Gradle 9 (Kotlin DSL) |
| ORM/DB | JPA(Hibernate 7) + **QueryDSL(OpenFeign 포크)** · **Liquibase**. MyBatis 는 **아직 없다**(통계·KPI 가 오는 날) |
| DB | PostgreSQL · Oracle · MSSQL · MySQL · MariaDB **다섯** |
| Frontend | **React 19** · TypeScript **6.0.3** · Vite 8 |
| UI | **AntD 6** · **AG Grid Community 36** |
| 상태 | react-query 5(서버) · zustand 5(클라이언트) |
| 배포 | **단일 JAR** — 프론트 임베드 |

상세와 함정은 [stack.md](./stack.md).

## 모듈 · 폴더 한눈에

```
sources/backend/
  core       도메인 비종속 커널      ← 아무것도 참조하지 않는다
  support    기술 어댑터             ← core
  domain     백오피스 공통 도메인    ← core · support
  api        REST · Security         ← core · support · domain
  bootstrap  실행 · yml · Liquibase  ← 전부

sources/frontend/src/
  app        진입 · 라우터 · 프로바이더
  layouts    앱 셸
  shared     도메인 비종속 공통 (관심사별 폴더 — 개수는 registry.md 가 센다)
  features   화면 기능 단위
```

**의존 방향은 `LayerDependencyTest`(ArchUnit)가 강제한다.**

## 기계가 지키는 것

```bash
./gradlew check -PskipFrontend
cd frontend && npm run lint && npx tsc -b --noEmit && npm run test
```

`LayerDependencyTest` · `ServiceConventionTest` · `SampleIsolationTest` ·
`RowTxConventionTest` · `TimeSourceConventionTest` · `ProjectionCoverageTest` ·
`checkSeeds` · ESLint 셋. 목록은 [conventions.md §5](./conventions.md).

## 관련 카테고리

- [INDEX](../INDEX.md) — 마스터
- [playbook](../playbook/INDEX.md) — 화면 레시피 (**이 카테고리 위에 선다**)
- [knowledge](../knowledge/INDEX.md) — 도메인 지식
- [AGENTS.md §8](../../AGENTS.md) — 요지
