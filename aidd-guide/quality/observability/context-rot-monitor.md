---
id: LLM-OBS-003
title: "Context Rot 모니터"
category: 08-observability
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [Chroma Context Rot 연구, 12-references/summaries/09-chroma-context-rot.md]
author: Bong Jong Hyeon
tier: 3
tags: [observability, context-rot, attention-budget, decay]
---

# Context Rot 모니터

> 컨텍스트 길이가 늘수록 LLM 정확도는 **선형이 아니라 가파르게** 저하 (Chroma 2026). 본 시스템에서 그 감쇠를 관찰·기록.

## 핵심 가설 (출처)

1. **Lost in the Middle** — 컨텍스트 중간 정보가 시작/끝보다 무시됨
2. **Distraction** — 무관 정보가 많을수록 정답 신호가 묻힘
3. **Clash** — 모순된 정보가 들어오면 최신 또는 가장 강한 톤이 이김 (틀린 결정 가능)
4. **Poisoning** — 한 번 잘못된 사실이 컨텍스트에 들어가면 이후 응답에 전파

## 모니터링 시점

- `/context` 가 50% 도달했을 때 — 작업 정확도 자기 점검 신호
- 70% 도달했을 때 — `/compact` 권장 + 짧은 자가 평가 1줄
- 사용자가 "방금 말한 거 다시 말해줘" 같은 신호를 보낼 때 — Lost-in-the-middle 의심

## 자가 점검 질문 (50%+ 시점)

응답 마지막에 한 줄로 자문:

```
[self-check] 이번 응답이 (a) 헌법 위반 없음 (b) 단일 입구 정책 지킴 (c) 사용자 원본 요청과 정합 — 셋 다 yes?
```

세 중 하나라도 no → 즉시 사용자에 보고하고 `/compact` 권장.

## Failure Mode 매핑

| 증상 | 가능 원인 | 대응 |
|------|----------|------|
| AI 가 같은 파일을 반복해서 Read | Distraction (중요한 신호 묻힘) | 서브에이전트로 위임 |
| AI 응답이 이전 세션과 모순 | Clash | `/clear` 뒤 **소스와 `llm-guide/` 를 다시 읽는다** |
| AI 가 존재하지 않는 함수 인용 | Poisoning (앞에서 hallucinate 한 게 살아남음) | 즉시 `/clear` |
| 응답 길이는 길지만 핵심 누락 | Lost in the middle | 결정 트리만 다시 출력 시키고 가드레일 강화 |

## 데이터 수집 (선택)

- `chat-history/YYYY-MM/summary/` 의 그날 요약에 "context rot 의심" 사례 1줄 기록
- 매주 누적 사례 5건 이상 → INDEX 결정 트리 또는 시스템 프롬프트 보강 검토

## 관련

- [02-context/failure-modes.md](../../harness/context/failure-modes.md) — 실패 모드 정의
- [12-references/summaries/09-chroma-context-rot.md](../../reference/summary/09-chroma-context-rot.md) — 출처
- [02-context/budget.md](../../harness/context/budget.md) — 컨텍스트 측정
