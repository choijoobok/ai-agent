---
id: LLM-FWK-BE-IDX
title: "Backend Framework INDEX"
category: standard/backend
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/"]
author: Bong Jong Hyeon
tier: 2
tags: [backend, index]
---

# 06-framework/backend — 백엔드 표준

> **`CLAUDE.md` §8 의 표가 요지이고, 여기가 상세와 근거다.**
> 요지와 상세가 어긋나면 **소스를 확인하고 둘 다 고친다** — 요지만 고치면 근거가 남고,
> 상세만 고치면 매 세션 읽히는 쪽이 낡는다.

## 진입 결정 트리

```
백엔드 작업
  │
  ├─ "새 서비스·패키지를 어디에 두나 · 뭐라 부르나 · 트랜잭션은"
  │                                        → packages.md
  ├─ "경로를 어떻게 짓나 · 응답 모양 · 헤더 · 시간"
  │                                        → api.md
  ├─ "조회조건 · 정렬 · 페이징 · 화이트리스트"
  │                                        → search.md
  ├─ "JPA 냐 QueryDSL 이냐 MyBatis 냐 · DB 중립"
  │                                        → persistence.md
  ├─ "예외를 어떻게 던지나 · 메시지 키"      → exception.md
  ├─ "누가 부를 수 있나 · 계층 · 세션"       → security.md · session.md
  ├─ "캐시를 언제 비우나"                    → caching.md
  ├─ "필터·인터셉터 순서 · 요청 로깅"        → crosscutting.md · logging.md
  ├─ "비동기 · Virtual Thread · 중복 요청"    → crosscutting.md
  ├─ "어떤 락을 쓰나"                        → persistence.md
  ├─ "개인정보를 어떻게 담나"                → pii-vault.md
  └─ "시드를 언제 어떻게 다시 만드나"        → ../seed.md
```

## 파일

| ID | 파일 | 역할 | 상태 |
|----|------|------|------|
| LLM-FWK-BE-002 | [api.md](./api.md) | 경로 · 봉투 · 헤더 · 시간 · 액션 판정 | ✅ |
| LLM-FWK-BE-004 | [packages.md](./packages.md) | 모듈 · 패키지 · 이름 · 트랜잭션 | ✅ |
| LLM-FWK-BE-001 | [persistence.md](./persistence.md) | JPA / QueryDSL / MyBatis 경계 · DB 중립 | ✅ |
| LLM-FWK-BE-003 | [search.md](./search.md) | 조회 요청 · 화이트리스트 · 빌더 | ✅ |
| LLM-FWK-BE-005 | [exception.md](./exception.md) | `ErrorCode` · `BusinessException` · 핸들러 | ✅ |
| LLM-FWK-BE-006 | [security.md](./security.md) | 계층 셋 · 인가 모델 · 접근 제어 체인 | ✅ |
| LLM-FWK-BE-007 | [session.md](./session.md) | 세션 스토어 · 담는 것 · 만료 | ✅ |
| LLM-FWK-BE-008 | [caching.md](./caching.md) | 대상마다 다른 백엔드 · `SysCacheVersion` | ✅ |
| LLM-FWK-BE-009 | [crosscutting.md](./crosscutting.md) | 필터·인터셉터 순서 · **비동기 · 중복 요청** | ✅ |
| LLM-FWK-BE-014 | [pii-vault.md](./pii-vault.md) | 개인정보 분리보관 — **아직 없다. 제약만 있다** | ✅ |
| LLM-FWK-BE-010 | [logging.md](./logging.md) | 요청 전문 · SQL 로그 · 마스킹 | ✅ |
| LLM-FWK-BE-011 | [progress.md](./progress.md) | 진행률 — 맡기고 돌아온다 · 실행기 · 청소 | ✅ |
| LLM-FWK-BE-012 | [batch.md](./batch.md) | 배치 — 등록이 곧 스케줄 · 락 · 유령 | ✅ |
| LLM-FWK-004 | [../seed.md](../seed.md) | 생성 시드 — 절차와 검증 (백엔드 밖) | ✅ |

## 기계가 지키는 것

| 테스트 | 무엇 |
|---|---|
| `LayerDependencyTest` | 모듈 의존 방향 |
| `ServiceConventionTest` | 조회 서비스 규약 · 컨트롤러 트랜잭션 금지 |
| `SampleIsolationTest` | 샘플 격리 |
| `checkSeeds` | 메뉴·API·메시지 시드가 소스와 일치 |

```bash
./gradlew check -PskipFrontend
```

## 관련

- [../INDEX.md](../INDEX.md) — 프레임워크 카테고리
- [../frontend/INDEX.md](../frontend/INDEX.md) — 프론트엔드 표준
- [../../11-playbook/INDEX.md](../../playbook/INDEX.md) — 화면 레시피
- [../../09-knowledge/INDEX.md](../../knowledge/INDEX.md) — 도메인 지식
