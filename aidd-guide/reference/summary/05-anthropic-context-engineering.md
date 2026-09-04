---
id: LLM-REF-S003
title: "Anthropic Context Engineering 요약"
category: 12-references
type: study
created: 2026-04-24
updated: 2026-05-04
status: active
sources: [ai-orchestration/references/summaries/05-anthropic-context-engineering.md]
author: Bong Jong Hyeon
tier: 4
source_ref: 5
original_url: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
original_title: "Effective Context Engineering for AI Agents"
original_author: Anthropic Applied AI Team (Prithvi Rajasekaran, Ethan Dixon, Carly Ryan, Jeremy Hadfield)
original_published: 2025-09-29
fetch_status: direct
---
# [5] Anthropic — Effective Context Engineering for AI Agents — 요약

## 🎯 핵심 주장 5개 (원문 그대로)

1. > "Context engineering refers to the set of strategies for curating and maintaining the optimal set of tokens (information) during LLM inference."
2. > "Studies on needle-in-a-haystack style benchmarking have uncovered the concept of context rot: as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases."
3. > "LLMs are based on the transformer architecture, which enables every token to attend to every other token across the entire context. This results in n² pairwise relationships for n tokens."
4. > "good context engineering means finding the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome"
5. > "For tasks that span tens of minutes to multiple hours of continuous work, like large codebase migrations or comprehensive research projects, agents require specialized techniques to work around the context window size limitation."

---

## 📚 프레임워크·용어 (원문 정의)

### 기본 용어

| 용어 | 원문 정의 |
|------|---------|
| **Context** | "the set of tokens included when sampling from a large-language model (LLM)" |
| **Context Engineering** | "optimizing the utility of those tokens against the inherent constraints of LLMs in order to consistently achieve a desired outcome" |
| **Prompt Engineering** | "methods for writing and organizing LLM instructions for optimal outcomes" |
| **Context Rot** | "as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases" |
| **Attention Budget** | "LLMs have an 'attention budget' that they draw on when parsing large volumes of context" |

**Prompt vs Context 관계**: Context Engineering 이 **상위 개념**. Prompt Engineering 은 그 하위 — "writing and organizing instructions".

### 장기 과제 대응 3기법

| 기법 | 원문 정의 | 강점 |
|------|----------|------|
| **Compaction** | "distills the contents of a context window in a high-fidelity manner, enabling the agent to continue with minimal performance degradation" | "maintains conversational flow for tasks requiring extensive back-and-forth" |
| **Structured Note-Taking** | "a technique where the agent regularly writes notes persisted to memory outside of the context window. These notes get pulled back into the context window at later times" | "excels for iterative development with clear milestones" |
| **Sub-Agent Architectures** | "specialized sub-agents can handle focused tasks with clean context windows. The main agent coordinates with a high-level plan while subagents perform deep technical work" | "handle complex research and analysis where parallel exploration pays dividends" |

### 동적 검색 용어

| 용어 | 원문 정의 |
|------|---------|
| **Just-in-Time Context** | agents "maintain lightweight identifiers (file paths, stored queries, web links, etc.) and use these references to dynamically load data into context at runtime using tools" |
| **Progressive Disclosure** | agents "incrementally discover relevant context through exploration. Each interaction yields context that informs the next decision" |
| **Tool Result Clearing** | "One of the safest lightest touch forms of compaction" |

---

## 🧭 컨텍스트 구성 전략 (3층)

### A. 정적 컨텍스트 설계 (초기 설정)

**System Prompts 의 "Right Altitude" 원칙**:
- 극단 1 (실패): "brittle if-else hardcoded logic"
- 극단 2 (실패): "vague, high-level guidance that fails to give the LLM concrete signals"
- 최적점: "specific enough to guide behavior effectively, yet flexible enough to provide the model with strong heuristics"

**권장 구조**: XML 태그 · Markdown 헤더 — `<background_information>`, `<instructions>`, `## Tool guidance`, `## Output description`

**Tools 원칙**: "self-contained, robust to error, and extremely clear with respect to their intended use"

**실패 사례** (원문): "bloated tool sets that cover too much functionality or lead to ambiguous decision points about which tool to use"

**Examples 원칙**: "curate a set of diverse, canonical examples that effectively portray the expected behavior of the agent"

### B. 동적 검색 (런타임)

- **RAG → JIT 전환 추세**: "increasingly see teams augmenting these retrieval systems with 'just in time' context strategies"
- **메타데이터의 역할**: "the presence of a file named `test_utils.py` in a `tests` folder implies a different purpose"
- **하이브리드**: "retrieving some data up front for speed, and pursuing further autonomous exploration at its discretion"
- **인지 유사성**: "This approach mirrors human cognition: we generally don't memorize entire corpuses of information, but rather introduce external organization and indexing systems like file systems, inboxes, and bookmarks"

### C. 장기 컨텍스트 관리 (3기법 — 위 프레임워크·용어 표 참조)

**Compaction 구현 예 (Claude Code)**:
> "we implement this by passing the message history to the model to summarize and compress the most critical details. The model preserves architectural decisions, unresolved bugs, and implementation details while discarding redundant tool outputs or messages."

**Compaction 경고**:
> "overly aggressive compaction can result in the loss of subtle but critical context whose importance only becomes apparent later"

**Note-Taking 사례 (Claude Pokémon)**:
> "The agent maintains precise tallies across thousands of game steps—tracking objectives like 'for the last 1,234 steps I've been training my Pokémon in Route 1, Pikachu has gained 8 levels toward the target of 10.'"

**Sub-Agent 성과**:
> "showed a substantial improvement over single-agent systems on complex research tasks"

---

## 📊 구체 수치 · 사례

| 수치/사례 | 원문 |
|----------|------|
| Claude Code 압축 후 유지 | "five most recently accessed files" |
| Pokémon 장기 추적 | "1,234 steps", "8 levels", "10 (target)" |
| Sub-agent 압축 반환 크기 | "often 1,000-2,000 tokens" |

**참조 논문**:
- Transformer "Attention is All You Need" (arxiv.org/abs/1706.03762)
- Position encoding (arxiv.org/pdf/2306.15595)

---

## 💬 인용할 만한 구절

> **인용 단계**: 모두 `[1차]` — anthropic.com 직접 WebFetch 성공.

### [1차] 원문 직접 인용

> "Context engineering is the art and science of curating what will go into the limited context window"
— [Context engineering vs. prompt engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents#context-engineering-vs-prompt-engineering)

> "Building with language models is becoming less about finding the right words and phrases for your prompts, and more about answering the broader question of 'what configuration of context is most likely to generate our model's desired behavior?'"
— [개요](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

> "find the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome"
— [The anatomy of effective context](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents#the-anatomy-of-effective-context)

> "Like humans, who have limited working memory capacity, LLMs have an 'attention budget'"
— [Context retrieval and agentic search](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents#context-retrieval-and-agentic-search)

> "it's likely that for the foreseeable future, context windows of all sizes will be subject to context pollution and information relevance concerns"
— [Context engineering for long-horizon tasks](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents#context-engineering-for-long-horizon-tasks)

> "treating context as a precious, finite resource will remain central to building reliable, effective agents"
— [Conclusion](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents#conclusion)

> "As models become more capable, the challenge isn't just crafting the perfect prompt—it's thoughtfully curating what information enters the model's limited attention budget at each step"
— [Conclusion](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents#conclusion)

---

## 🧭 글 전체 섹션 구조 (H2 목차)

1. Context engineering vs. prompt engineering
2. Why context engineering is important to building capable agents
3. The anatomy of effective context
4. Context retrieval and agentic search
5. Context engineering for long-horizon tasks
   - Compaction
   - Structured note-taking
   - Sub-agent architectures
6. Conclusion

---

## 🔗 우리 프로젝트 반영 (AI 해석)

> **이 절은 이식 전에 쓰였다.** 아래가 부르는 `000-foundation/` · `100-prompts/` ·
> `200-context/` · `300-harness/` · `700-evals/` 는 **남의 프로젝트의 카테고리**이며
> 이 저장소에는 없다(현행은 `00-meta` ~ `13-safety`). **요약 본문은 자산이고 이 절은
> 계획이었다** — 계획 쪽만 낡았다.


> **이 섹션만 해석 허용.**

### 이 글이 프로젝트 구조에 주는 핵심 교훈

1. **`200-context/` 카테고리 자체의 이론적 근거** — Anthropic 이 "context engineering 은 prompt engineering 의 상위 개념" 이라고 정의 → `100-prompts` 와 `200-context` 를 분리한 이 프로젝트 구조가 공식 정당화됨
2. **`CLAUDE.md` 의 컨텍스트 포화 게이지 정책은 직접 근거가 있음** — `n² pairwise relationships` + `context rot` 가 토큰 절약이 품질·비용 모두에 기여한다는 수학적 근거 제공
3. **장기 과제 3기법 중 이 프로젝트가 이미 2개 갖춤**:
   - Compaction → `/compact` 슬래시 명령 (CLAUDE.md 컨텍스트 관리 정책에 명시)
   - Structured Note-Taking → `docs/users/{UserName}/logs/` · `summary.md` · `taskBoard.md` · `LEARNING-LOG.md` 전체가 이 패턴
   - Sub-Agent Architectures → `Agent` tool (subagent_type) · 이 프로젝트의 `general-purpose`·`Explore`·`Plan` 에이전트들

### 개념 매핑 (해석)

| Anthropic 개념 | 이 프로젝트 자산 |
|----------------|------------------|
| **Context Engineering (상위)** | `200-context/` 카테고리 전체 |
| **Prompt Engineering (하위)** | `100-prompts/` 카테고리 |
| **Context Rot** | `CLAUDE.md` "Lost in the Middle" 언급 + 게이지 60%/80% 임계값 |
| **Attention Budget** | `CLAUDE.md` 토큰 예산 정책 |
| **Just-in-Time Context** | `CLAUDE.md` "참조 문서는 필요 시에만 읽기" 규약 · 서브에이전트 탐색 위임 |
| **Progressive Disclosure** | `LEARNING-LOG.md` 의 "다음 세션 즉시 시작 지점" — 필요 순간에 필요한 지점만 노출 |
| **Compaction** | `/compact` + 세션 로그 "최근 3 세션만 유지" 정책 |
| **Structured Note-Taking** | `logs/raw.md` · `logs/summary.md` · `taskBoard.md` · `LEARNING-LOG.md` · `references/summaries/` |
| **Sub-Agent Architectures** | `Agent` tool 위임 · `/btw` 컨텍스트 보호 |
| **"Right Altitude" System Prompts** | `CLAUDE.md` 설계 — "브리틀하지도 바구하지도 않게" |
| **Tool Sets 경고 (bloated)** | Claude Code 의 `ToolSearch` deferred tool 메커니즘 자체가 이 문제의 대응책 |

### [1]·[2] 와의 교차 관찰

- [1] OpenAI: **"in-context 에 없으면 존재하지 않는다"** ← [5] 가 이 원칙을 **구체 기법** (JIT · compaction · note-taking · sub-agent) 으로 전개
- [2] Böckeler: **Guides × Sensors 2축** ← [5] 의 정적 설계(A) 는 Guides, 동적 검색(B) · 장기 관리(C) 는 Guides+Sensors 혼합
- **3편 종합 해석**: [1]=철학·실전, [2]=분류 프레임워크, [5]=컨텍스트 층위의 구체 기법. 이 프로젝트의 `100/200/300` 분리가 세 글의 교집합에 정확히 대응

### 적용 지점
- `ai-orchestration/200-context/index.md` — 참고문헌 [5] 섹션 보강 (아래 단계)
- 향후 신설 후보:
  - `200-context/just-in-time.md` — JIT 패턴과 이 프로젝트의 "참조 문서 필요 시만 읽기" 규약 정리
  - `200-context/compaction-policy.md` — `/compact` 운영 기준
  - `200-context/note-taking.md` — logs/summary/taskBoard/LEARNING-LOG 가 어떻게 Anthropic 의 3기법을 충족하는지 명시

---

## ✅ 자가 점검 (체화)

1. **Context Engineering 과 Prompt Engineering 의 차이는?**
   → 답: Prompt = 지시사항의 **작성·조직화**. Context = 전체 토큰 집합 (system prompt · tools · examples · memory · retrieved docs · 대화 이력) 의 **큐레이션·유지**. Context Engineering 이 Prompt Engineering 을 포함하는 **상위 개념**.

2. **`n² pairwise relationships` 가 실무에 주는 함의는?**
   → 답: 컨텍스트 길이가 2배면 attention 비용은 4배 (선형 증가 아님). → 토큰 절약은 속도·비용·품질 **세 가지 모두**에 기여. `CLAUDE.md` 의 60%/80% 게이지 정책이 이를 근거로 함.

3. **Just-in-Time 이 전통 RAG 와 다른 점은?**
   → 답: RAG 는 **선험적 embedding** 으로 미리 주입. JIT 는 **식별자 (파일 경로·쿼리·링크) 만 유지** 하고 도구로 런타임에 동적 로드. 인간의 인지 (파일시스템·인박스·북마크 활용) 와 유사. → 이 프로젝트가 Agent 탐색 + LEARNING-LOG 포인터를 쓰는 이유.

---

## 📎 연결

- 카테고리: **200-context**
- 연관 문헌:
  - [7] Breunig · How Long Contexts Fail — [5] 의 context rot 전제를 실패 모드로 세분화
  - [8] Breunig · How to Fix Your Context — [5] 의 3기법과 상호보완 (구체 수정 레시피)
  - [9] Chroma · Context Rot — [5] 가 직접 인용하는 실험 배경
  - [10] Schmid · Context Engineering — 용어 대중화 문서
  - [1] OpenAI Harness — "in-context 에 없으면 존재 없음" 이라는 공통 전제
  - [2] Böckeler Harness — Guides·Sensors 프레임에서 [5] 의 기법이 어느 축에 해당하는지 대응
- 가이드 챕터: `docs/guides/ai-engineering/_parts/03-context-engineering.html`
- 전체 서지: [`../bibliography.md`](../bibliography.md)

---

## 📅 개정 이력

- 2026-04-24 — 초판. `fetch_status: direct` (anthropic.com WebFetch 1차 성공). [1]·[2] 와 함께 Phase 1 주요 3편의 **일관된 독법** 확보.
