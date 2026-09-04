---
id: LLM-FWK-IDX
title: "06-framework — 프레임워크 가이드 INDEX"
category: "06-framework"
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/", "sources/frontend/", "sources/gradle/libs.versions.toml"]
author: Bong Jong Hyeon
tier: 2
tags: [framework, index]
---

# 06-framework — 개발 표준의 정본

> **`CLAUDE.md` §6 의 표가 요지이고 여기가 상세와 근거다.**
> 개발 절차(레시피)는 [11-playbook](../playbook/INDEX.md), 도메인 지식은
> [09-knowledge](../knowledge/INDEX.md) 가 갖는다. 여기는 **무엇이 어디에 있고
> 어떤 규칙을 따르는가** 다.

## 결정론 영역

**같은 질문에 같은 답이 나와야 한다.** 스택 버전·패키지 구조·API 계약은 **추론·변형의
대상이 아니다** — 사실을 검증하고 소스를 그대로 인용한다.

| 영역 | 어디 | 규약 |
|---|---|---|
| **결정론** | **06-framework**(여기) · 09-knowledge | 사실 검증 · 창의적 변형 금지 |
| 창의 | 03-prompt · 11-playbook | 변형·추론 가능 |

**여기서 추정이 발견되면 즉시 사용자에게 보고한다.**

## 진입 결정 트리

```
요청
  ├─ "버전이 뭐지 · 라이브러리를 더해도 되나"      → stack.md
  ├─ "어떻게 빌드·배포하나 · CI 가 뭘 도나"        → build-deploy.md
  ├─ "이름을 어떻게 짓나 · 인코딩 · 게이트 · 커밋"  → conventions.md
  ├─ "시드를 언제 어떻게 다시 만드나"              → seed.md
  ├─ 백엔드 —— 구조 · API · 영속 · 조회 · 보안 …   → sources/backend/INDEX.md
  └─ 프론트 —— 뼈대 · 그리드 · 조회조건 · 문구 …   → sources/frontend/INDEX.md
```

## 파일

| ID | 파일 | 역할 | 상태 |
|----|------|------|------|
| LLM-FWK-003 | [stack.md](./stack.md) | 버전과 **그 버전이 강요한 것** | ✅ |
| LLM-FWK-005 | [build-deploy.md](./build-deploy.md) | 단일 JAR · 프로파일 · CI — **워크플로가 가리키는 원본** | ✅ |
| LLM-FWK-002 | [conventions.md](./conventions.md) | 이름 · 인코딩 · 주석 · 게이트 · 커밋 | ✅ |
| LLM-FWK-004 | [seed.md](./seed.md) | 생성 시드 — 절차와 검증 | ✅ |
| LLM-FWK-IDX-BE | [sources/backend/INDEX.md](./backend/INDEX.md) | 백엔드 표준 10 | ✅ |
| LLM-FWK-IDX-FE | [sources/frontend/INDEX.md](./frontend/INDEX.md) | 프론트엔드 표준 8 | ✅ |

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
  shared     도메인 비종속 공통 (관심사별 폴더 21)
  features   화면 기능 단위
```

**의존 방향은 `LayerDependencyTest`(ArchUnit)가 강제한다.**

## 기계가 지키는 것

```bash
./gradlew check -PskipFrontend
cd frontend && npm run lint && npx tsc -b --noEmit && npm run test
```

`LayerDependencyTest` · `ServiceConventionTest` · `SampleIsolationTest` · `checkSeeds` ·
ESLint 셋. 목록은 [conventions.md §5](./conventions.md).

## 관련 카테고리

- [INDEX](../INDEX.md) — 마스터
- [11-playbook](../playbook/INDEX.md) — 화면 레시피 (**이 카테고리 위에 선다**)
- [09-knowledge](../knowledge/INDEX.md) — 도메인 지식
- [CLAUDE.md §6](../../CLAUDE.md) — 요지
