---
id: LLM-MET-IDX
title: "meta — 시스템 규약 INDEX"
category: meta
type: operation
created: "2026-04-30"
updated: "2026-09-06"
status: active
sources: []
tier: 3
tags: [meta, index]
---
# meta — 시스템 자체 규약

> 이 체계(`aidd-guide`)를 어떻게 운영하는지 정의한다. AI는 새 문서를 작성하거나 기존 문서를 수정할 때 이 카테고리의 규칙을 가장 먼저 따른다.

## 진입 조건

- 새 MD 파일을 작성·등록할 때
- 기존 문서의 메타블록을 수정할 때
- 작업 시작 시 어떤 카테고리로 가야 할지 모를 때

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-MET-001 | [meta-block.md](./meta-block.md) | 모든 MD 상단 메타블록 표준 스펙 |
| LLM-MET-002 | [doc-style.md](./doc-style.md) | 문서 작성 스타일 (200줄·UTF-8·마크다운) |
| LLM-MET-003 | [routing.md](./routing.md) | 작업 시작 라우팅 결정 트리 (상세) |
| LLM-MET-004 | [lifecycle.md](./lifecycle.md) | 문서 생성·수정·폐기 생명주기 |

> **새 문서를 쓸 때 템플릿 파일을 찾지 않는다.** [meta-block.md](./meta-block.md) 의 표준
> 형식과 [doc-style.md](./doc-style.md) 를 따르고, **같은 카테고리의 기존 파일 하나를 복사해
> 고친다** — 실물이 가장 정확한 템플릿이다. 별도의 템플릿을 두면 그것이 **표준의 두 번째
> 정의**가 되고, 갈렸을 때 어느 쪽이 참인지 알 방법이 없다(아래 **핵심 불변 규칙 3**).

## 핵심 불변 규칙

1. **모든 MD는 200줄 이내** — LLM 학습 누락 방지
2. **메타블록 필수** — id, title, category, created, updated, status
3. **중복 정의 금지** — 한 곳에서만 정의, 다른 곳은 참조 링크
4. **수정 시 `updated` 필드 갱신** — 추적 가능성 확보

## 관련 카테고리

- [INDEX](../INDEX.md) — 마스터 진입점
- [CLAUDE.md](../../CLAUDE.md) — 헌법 (이 메타 규약 위에서 동작)
