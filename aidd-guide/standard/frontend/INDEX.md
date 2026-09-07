---
id: LLM-FWK-FE-IDX
title: "Frontend Framework INDEX"
category: standard/frontend
type: operation
class: none
created: 2026-05-04
updated: 2026-09-07
status: active
sources: ["sources/frontend/src/"]
tier: 2
tags: [frontend, index]
---

# standard/frontend — 프론트엔드 표준

> **어휘는 우리 것이고 판은 어댑터가 고른다.** 화면 선언에 AG Grid·AntD 의 이름이
> 나오지 않는다 — 판을 바꿔도 화면이 바뀌지 않아야 한다.
>
> `CLAUDE.md` §8 의 *화면 뼈대* 한 줄이 요지이고, 여기가 상세와 근거다.

## 진입 결정 트리

```
프론트 작업
  │
  ├─ "선언에 쓸 수 있는 키가 무엇인가 · 기본값이 무엇인가"
  │                                          → declarations.md  ← 어휘의 전량
  ├─ "폴더를 어디에 만드나 · 언제 shared/ 로 올리나 · 상태를 어디에 두나"
  │                                          → packages.md
  ├─ "화면 뼈대 · 버튼 · 저장 흐름"           → grid.md
  ├─ "컬럼 하나를 어떻게 선언하나 · 타입 13종"
  │                                          → grid-columns.md
  ├─ "정렬·필터 · 편집 · 검증 · 마스터-디테일"
  │                                          → grid-validation.md
  ├─ "저장이 거부됐을 때 무엇을 보여주나"     → save-errors.md
  ├─ "조회조건 칸 하나를 어떻게 선언하나"     → search-form.md
  ├─ "API 를 어떻게 부르나 · endpoints.ts"    → http.md
  ├─ "문구 · 메시지 키 · 언어 추가"           → i18n.md
  ├─ "다크 모드 · 색 · 개인 설정"             → theme.md
  ├─ "탭 · 셸 · 라우팅 · 화면 작성 전제"      → tabs.md
  └─ "오래 걸리는 실행 · 진행률 창"           → progress.md
```

## 파일

| ID | 파일 | 역할 | 상태 |
|----|------|------|------|
| LLM-FWK-FE-008 | [declarations.md](./declarations.md) | **선언 어휘 전량** — 컬럼 36 · 필드 15 · prop 22 | ✅ |
| LLM-FWK-FE-004 | [packages.md](./packages.md) | 폴더 · 공통화 · 상태 경계 | ✅ |
| LLM-FWK-FE-002 | [grid.md](./grid.md) | 화면 뼈대 · `api` 선언 · 저장 | ✅ |
| LLM-FWK-FE-001 | [grid-columns.md](./grid-columns.md) | 컬럼 계약 · 유형 13종 · 동적 컬럼 | ✅ |
| LLM-FWK-FE-012 | [grid-validation.md](./grid-validation.md) | 정렬·필터 · 편집 · 검증 세 층 · 마스터-디테일 | ✅ |
| LLM-FWK-FE-011 | [save-errors.md](./save-errors.md) | 붉은 셀 · 실패 표 · 행 순번 보장 | ✅ |
| LLM-FWK-FE-003 | [search-form.md](./search-form.md) | 필드 하나의 선언 | ✅ |
| LLM-FWK-FE-005 | [http.md](./http.md) | `endpoints.ts` · 배럴 하나 · 응답 처리 | ✅ |
| LLM-FWK-FE-006 | [i18n.md](./i18n.md) | `MSG` 키 · `label()` · 언어 추가 | ✅ |
| LLM-FWK-FE-009 | [theme.md](./theme.md) | 토큰 한 곳 · 다크 모드 · 개인 설정 | ✅ |
| LLM-FWK-FE-007 | [tabs.md](./tabs.md) | 멀티탭 · 셸 · 라우팅 | ✅ |
| LLM-FWK-FE-010 | [progress.md](./progress.md) | 진행률 — 폴링 · 창 · 경과 시간 | ✅ |

## 화면 하나를 만들 때 — 읽는 순서

```
1. tabs.md §1     같은 화면이 여러 개 살아 있을 수 있다는 전제
2. grid.md        뼈대와 api 선언
3. search-form.md 조회조건이 있는 화면이면
4. grid-columns.md 컬럼을 선언할 때 — 무엇을 고를까
5. declarations.md 그 선언에 쓸 이름과 기본값 — 곁에 두고 본다
6. http.md        endpoints.ts 와 시드
7. save-errors.md 저장이 거부됐을 때 — toSaveRow 를 쓰는 이유
```

**표준을 추정해 새로 만들지 않는다** — 비슷한 화면의 실물을 읽는다.
샘플 여섯이 `sources/frontend/src/features/sample/` 에 그 목적으로 있다.

## 기계가 막는 것

| ESLint | 무엇 |
|---|---|
| `no-restricted-syntax` | 문자열·JSX 텍스트·템플릿 문자열 **속 한글** · `label()` 리터럴 · `/api`·계층 경로 리터럴 |
| `no-restricted-imports` | `@/shared/api/*` 딥 임포트 금지 |
| `import-x/no-restricted-paths` | `features/*` 끼리 직접 import 금지 |

```bash
cd frontend && npm run lint && npx tsc -b --noEmit && npm run test
```

## 관련

- [../INDEX.md](../INDEX.md) — 프레임워크 카테고리
- [../backend/INDEX.md](../backend/INDEX.md) — 백엔드 표준
- [../seed.md](../seed.md) — `endpoints.ts` 가 시드의 입력이다
- [playbook/INDEX.md](../../playbook/INDEX.md) — 화면 레시피
