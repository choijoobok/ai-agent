---
id: LLM-REC-IDX
title: "10-records — 기록 형식 INDEX"
category: "10-records"
type: operation
created: "2026-04-30"
updated: "2026-09-04"
status: active
sources: [orchestration/]
author: Bong Jong Hyeon
tier: 3
tags: [records, log, patch-notes, decision-template, index]
---
# 10-records — 기록·로그·문서 형식

> 로그의 **형식·템플릿**과, 형식이 아닌 둘 — **ADR 스물아홉**과 **폐지 문서 지도**.
> 로그 정책(언제·왜·무엇을)은 [04-memory](../harness/memory/INDEX.md) 가 갖는다.
>
> **`decision.md`(DEC 템플릿)는 2026-09-04 에 폐기했다** — 결정의 자리는 `adr/` 와 커밋 메시지다.

## 진입 조건

- 소스나 문서에서 **번호만 있는 인용**(`53 §6.1`)을 만났을 때 → [legacy-doc-map.md](./legacy-doc-map.md)
- raw / summary 로그 작성·다듬기 직전
- raw / summary 로그의 형식을 확인할 때

## 파일

| ID | 파일 | 역할 |
|----|------|------|
| LLM-REC-001 | [raw-log.md](./raw-log.md) | RAW 로그 템플릿 (USER/AI 원문 그대로) |
| LLM-REC-002 | [summary-log.md](./summary-log.md) | SUMMARY 로그 템플릿 (Topic/Summary/Artifacts) |
| LLM-REC-005 | [legacy-doc-map.md](./legacy-doc-map.md) | **폐지된 설계 문서 지도** — `53 §6.1` 의 `53` 이 무엇인가 |
| LLM-REC-ADR-IDX | [**adr/**](./adr/INDEX.md) | **ADR 스물아홉 — 형식이 아니라 실물이다** |

> **`adr/` 만 형식이 아니라 기록 그 자체다.** 이 카테고리의 나머지가 *어떻게 적나* 인 반면
> ADR 은 *무엇을 정했나* 이며, `docs/design/` 이 폐지되면서 여기로 왔다(2026-09-04) —
> 표준은 `06-framework/`, 표는 `09-knowledge/`, 화면은 `documents/screen/` 가 받았지만
> **버린 안과 그 이유는 받을 데가 여기뿐이었다.**

## Compaction Tiers (Anthropic)

> 기록은 **다층 압축**으로 영속한다 — raw → summary → essence. 각 단계마다 정보 밀도가 올라가고, 토큰 비용은 내려간다.

```
[Tier 1] raw      USER/AI 원본 그대로 (보존성 최우선 — 사람이 손대지 않는다)
            ↓ (하루 마감 또는 다음 세션 시작)
[Tier 2] summary  AI 가 사실 기반 bullet 로 압축 (Topic / Summary / Artifacts)
            ↓ (장기 보관 가치 결정)
[Tier 3] essence  커밋 메시지의 "왜" · 버린 안이 있으면 ADR
```

세 Tier 모두 본 카테고리에서 **형식**만 정의. 정책은 [04-memory](../harness/memory/INDEX.md).

## 형식 vs 정책

| 영역 | 형식 (이 카테고리) | 정책 ([04-memory](../harness/memory/INDEX.md)) |
|------|------------------|------------------------------------------|
| RAW 로그 | raw-log.md | logs.md (원본 — 손대지 않는다) |
| SUMMARY 로그 | summary-log.md | logs.md (AI 작성) |

## 저장 위치

| 기록 | 경로 |
|------|------|
| RAW 로그 | `chat-history/YYYY-MM/raw/` — **형상 관리 제외** |
| SUMMARY 로그 | `chat-history/YYYY-MM/summary/` — **형상 관리 제외** |

> 로그가 저장소에 올라가지 않는 이유는 CLAUDE.md §9 에 있다 —
> **대화는 결론의 근거일 뿐이고, 결론은 `llm-guide/` 와 커밋 메시지가 갖는다.**

## 관련 카테고리

- [INDEX](../INDEX.md)
- [04-memory](../harness/memory/INDEX.md) — 정책
- [05-harness](../harness/INDEX.md) — 자동화 매트릭스
