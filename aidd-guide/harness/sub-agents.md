---
id: LLM-HRN-005
title: "Sub-Agent Architecture 정책"
category: 05-harness
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [Anthropic "Effective context engineering"]
author: Bong Jong Hyeon
tier: 2
tags: [harness, sub-agent, delegation, context-protection]
---

# Sub-Agent Architecture 정책

> 메인 컨텍스트를 보호하기 위해 **탐색·계획·검토** 작업을 서브에이전트에 위임. AI 가 자기 컨텍스트를 직접 부풀리지 않게 한다.

## 위임 결정 트리

```
새 작업이 들어왔다 — 직접? 위임?
  ├─ 결과만 필요하고 과정 노이즈가 큼 (탐색·검색)
  │    → Explore 서브에이전트
  ├─ 설계가 필요하고 다양한 대안 검토
  │    → Plan 서브에이전트
  ├─ 1~3 파일 단순 수정
  │    → 직접
  ├─ 사용자와 대화하며 점진 진행
  │    → 직접
  └─ 4파일 이상 또는 키워드 모를 때
       → general-purpose 서브에이전트
```

## 사용 가능한 서브에이전트

> **넷 다 Claude Code 의 기본 제공이다.** 이 저장소에는 `.claude/agents/` 가 없고
> **프로젝트가 정의한 서브에이전트는 하나도 없다**(2026-09-04 확인).
> 코드 검토는 서브에이전트가 아니라 **게이트**(`CLAUDE.md` §6·§7)가 맡는다.

| 에이전트 | 용도 | 트리거 |
|---------|------|------|
| Explore | 코드 위치 탐색 | "어디에 있지", "X를 어떻게 사용하는지" |
| Plan | 구현 전략 설계 | "어떻게 구현해야 할까" |
| general-purpose | 복잡한 다단계 조사 | 모호한 검색·다중 도구 필요 |
| claude-code-guide | Claude Code/SDK/API 질문 | "Claude Code 의 hooks 어떻게" |

## 위임 vs 직접 비용 분석

| 측면 | 직접 | 위임 |
|------|------|------|
| 메인 컨텍스트 점유 | 큼 | 결과 요약만 |
| 토큰 비용 | 단일 | 서브가 추가 |
| 응답 속도 | 빠름 | 지연 발생 |
| 정확도 (탐색 류) | 낮을 수 있음 | 격리된 컨텍스트로 향상 |
| 격리 (실패 시) | 메인 오염 | 서브에서 격리 |

> 메인 컨텍스트가 50% 넘으면 **위임 비용 < 오염 비용**. 적극 위임.

## 위임 잘 하는 법 (프롬프트 작성)

1. **자기완결적 입력** — 서브는 본 대화 모름. 파일 경로·맥락·범위 명시.
2. **응답 형식 강제** — "200자 이내로 보고", "punch list 만" 같이.
3. **이해 위임 금지** — "분석한 결과로 알아서 수정해줘" 금지. 동작 명시 필수.
4. **병렬 호출** — 독립 위임은 한 메시지에 multiple Agent 콜로 동시 실행.

## 결과 검증

서브에이전트는 **자기가 한 일을 요약**하지만, 실제로 한 게 그것이라는 보장은 없다. 코드 변경한 경우 직접 diff 확인.

## 안티 패턴

- "에이전트한테 다 시키고 결과만 받으면 됨" → 검증 없이 신뢰. 잘못된 결과 수용.
- 같은 검색을 메인 + 서브에서 중복 → 토큰 낭비.
- 단순 1파일 수정에 에이전트 호출 → 오버헤드만.

## 관련

- [INDEX.md](./INDEX.md)
- [tool-curation.md](./tool-curation.md) — 서브 에이전트도 도구 추가의 일종
- [02-context/budget.md](./context/budget.md) — 메인 컨텍스트 보호
