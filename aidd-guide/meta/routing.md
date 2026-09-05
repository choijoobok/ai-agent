---
id: LLM-MET-003
title: "작업 시작 라우팅 결정 트리"
category: meta
type: operation
created: "2026-04-30"
updated: "2026-04-30"
status: active
sources: ["wms5/orchestration/00-meta (외부 프로젝트 — 이 저장소에 없다)"]
tier: 3
tags: [meta, routing, decision-tree]
---
# 작업 시작 라우팅 결정 트리

> 사용자 메시지가 도착하면 AI 는 가장 먼저 본 문서 (또는 [INDEX.md](../INDEX.md)) 의 결정 트리를 따라 **어떤 카테고리로 진입할지** 판단한다.

## Progressive Disclosure (3 계층)

> UX 의 progressive disclosure 를 LLM 라우팅에 차용. 정보를 **층층이** 노출 — 한 번에 다 보지 않는다.

```
[Layer 1] aidd-guide/INDEX.md     ← 13 카테고리 분기만
[Layer 2] {NN-cat}/INDEX.md      ← 카테고리 진입 조건 + 파일 카탈로그
[Layer 3] 개별 운용 파일          ← 실제 룰 + 예시
```

각 계층은 다음 계층의 진입점만 알려준다. AI 는 한 계층씩 진입하며 컨텍스트를 점진 적재한다.

## 1차 분류 — 작업 성격

```
사용자 요청
  │
  ├─ "문맥 예산 · seek-read"              → harness/context/
  ├─ "요건서·목업·산출물 서식"            → artifact/
  ├─ "결정 저장·대화 기록"                → harness/memory/
  ├─ "훅·스킬·서브에이전트·자동화"        → harness/
  ├─ "스택·패키지·아키텍처·이름 규칙"     → standard/
  ├─ "프롬프트 품질 검증·골든셋·회귀"     → quality/evals/
  ├─ "라우팅 정확도·토큰 비용·관측"       → quality/observability/
  ├─ "도메인 지식(인가·코드·문구·이력)"   → knowledge/
  ├─ "CRUD·마스터디테일·엑셀·모달 레시피" → playbook/
  ├─ "단계·게이트·질문·추적성·변경"       → process/ · phase/
  └─ "PII·민감 데이터·prompt injection"    → standard/safety/
```

> **이 트리는 `CLAUDE.md` §3 의 표를 대신하지 않는다.** 헌법의 표가 *요청 → 진입점* 의
> 정본이고 여기는 **폴더 계층**을 보여 준다. 둘이 어긋나면 헌법이 이긴다.

## 2차 분류 — 도메인

작업이 어느 도메인인지 식별:

| 도메인 | 키워드 | 진입 |
|-------|--------|------|
| SYS | User / Menu / Role / Code / Message | [knowledge/sys](../knowledge/sys/INDEX.md) |
| TODO | 프로젝트 업무 도메인 추가 | `knowledge/{도메인}/INDEX.md` |

## 3차 분류 — 화면 패턴

화면 작업일 때 추가 분기:

| 패턴 | Overlay |
|------|---------|
| 조회조건 폼 | [artifact/screen/overlay/search-condition.md](../artifact/screen/overlay/search-condition.md) |
| 마스터-디테일 | [artifact/screen/overlay/master-detail.md](../artifact/screen/overlay/master-detail.md) |
| 디테일 탭 · 화면 전체 탭 | [artifact/screen/overlay/tabs.md](../artifact/screen/overlay/tabs.md) |
| 창을 띄운다 | [artifact/screen/overlay/modal.md](../artifact/screen/overlay/modal.md) |
| 엑셀 — 내려받기·올려받기 | [artifact/screen/overlay/excel.md](../artifact/screen/overlay/excel.md) |
| **실행 버튼(확정·재계산)** | [artifact/screen/overlay/execution.md](../artifact/screen/overlay/execution.md) |
| 대용량 이력 | [artifact/screen/overlay/history-pattern.md](../artifact/screen/overlay/history-pattern.md) |

## 작업 진행 표준 단계

```
[1] 메시지 분류 → 카테고리 결정 (위 트리)
[2] 해당 카테고리 INDEX.md 진입
[3] INDEX 가 가리키는 파일만 seek-read
[4] 영향 분석 (관련 패키지·엔티티·화면·docs)
[5] 사용자 승인 → 구현
[6] 검증 → 결과 보고
[7] 대화 원문은 log-raw 훅이 chat-history/ 에 남긴다 (harness/memory/logs.md)
```

## 충돌·모호 처리

- **요청이 모호** → 사용자에게 질문 (추정 금지: [CLAUDE.md §3](../../CLAUDE.md))
- **카테고리가 명확하지 않음** → [INDEX.md](../INDEX.md) 마스터로 돌아가서 표 확인
- **여러 카테고리에 걸침** → 가장 핵심인 1개 진입 후 다른 카테고리는 참조

## 메모리 우선

이 트리와 문서가 충돌하면 **소스 코드가 가장 우선**이다(CLAUDE.md §3).
