---
id: LLM-REF-S004
title: "Chroma Context Rot 요약"
category: 12-references
type: study
created: 2026-04-24
updated: 2026-05-04
status: active
sources: [ai-orchestration/references/summaries/09-chroma-context-rot.md]
author: Bong Jong Hyeon
tier: 4
source_ref: 9
original_url: https://www.trychroma.com/research/context-rot
original_title: "Context Rot: How Increasing Input Tokens Impacts LLM Performance"
original_author: Kelly Hong, Anton Troynikov, Jeff Huber (Chroma Research)
original_published: 2025-07-14
fetch_status: direct
---
# [9] Chroma — Context Rot — 요약

## 🎯 핵심 주장 (원문 그대로)

1. > "Large Language Models (LLMs) are typically presumed to process context uniformly—that is, the model should handle the 10,000th token just as reliably as the 100th. However, in practice, this assumption does not hold."
2. > "We observe that model performance varies significantly as input length changes, even on simple tasks."
3. > "models do not use their context uniformly; instead, their performance grows increasingly unreliable as input length grows."
4. > "model performance degrades as input length increases, often in surprising and non-uniform ways."
5. > "Real-world applications typically involve much greater complexity, implying that the influence of input length may be even more pronounced in practice."

---

## 🧪 실험 설계 (규모)

### 테스트 모델 — 18개
| 벤더 | 모델 |
|------|------|
| **Anthropic** | Claude Opus 4 · Sonnet 4 · Sonnet 3.7 · Sonnet 3.5 · Haiku 3.5 |
| **OpenAI** | o3 · GPT-4.1 · GPT-4.1 mini · GPT-4.1 nano · GPT-4o · GPT-4 Turbo · GPT-3.5 Turbo |
| **Google** | Gemini 2.5 Pro · 2.5 Flash · 2.0 Flash |
| **Alibaba** | Qwen3-235B-A22B · Qwen3-32B · Qwen3-8B |

### 벤치마크 — 7종
1. **Needle in a Haystack Extension** (+ 4개 하위 변형: Needle-Question Similarity / Distractors / Needle-Haystack Similarity / Haystack Structure)
2. **LongMemEval** — 대화형 QA (~113k tokens vs ~300 focused)
3. **Repeated Words Task** — 합성 문자열 복제 (25 ~ 10,000 단어, 1,090 변형)

### 규모
- NIAH: **194,480 total LLM calls** (거부율 0.035%)
- Repeated Words: 12개 길이 구간 × 1,090 변형
- 입력 토큰 범위: 100 ~ 113,000

---

## 📊 주요 실험 결과 (원문 수치)

### Repeated Words Task (길이 증가 = 성능 저하)
| 모델 | 결과 |
|------|------|
| **Opus 4** | "slowest degradation rate" · **2.89% refusal** |
| **GPT-4.1** | **2.55% refusal rate** |
| **Qwen3-8B** | **4.21% non-attempts** |
| **Sonnet 3.5** | 최대 출력 **8,192 토큰**까지 최고 성능 |

전체 공통: "performance consistently degrades" with input length

### Distractors 영향
- > "Even a single distractor reduces performance relative to the baseline"
- > "four distractors compounds this degradation further"
- **Claude 모델**: "consistently exhibit the lowest hallucination rates"
- **GPT 모델**: "highest rates of hallucination"

### Haystack Structure 역설 (반직관적 발견)
> "models perform better on shuffled haystacks than on logically structured ones"
— **전체 18개 모델에서 일관된 현상**

### LongMemEval
- Focused prompt (≈300 tokens): 높은 기준선
- Full prompt (≈113k tokens): "significantly higher performance on focused prompts compared to full prompts"
- **Opus 4**: "the most pronounced gap between focused and full prompt performance"

---

## 📚 주요 용어 (원문 정의)

| 용어 | 원문 정의 |
|------|---------|
| **Context Rot** | **원문 공식 정의 없음** — 제목에만 등장. 문맥상 "입력 토큰 증가에 따른 성능 저하" 현상 지칭 |
| **Needle in a Haystack (NIAH)** | "a simple lexical retrieval task... a known sentence (the 'needle') is placed in a long document of unrelated text (the 'haystack'), and the model is prompted to retrieve it" |
| **Distractors** | "topically related to the needle, but do not quite answer the question" |
| **Irrelevant content** | "unrelated to the needle and question" |
| **Repeated Words Task** | "a controlled task in which the model must replicate a sequence of repeated words, with a single unique word inserted at a specific position. The prompt explicitly instructs the model to reproduce the input text exactly" |
| **Needle-Question Similarity** | "cosine similarity between needle-question pairs using embeddings" (5개 embedding 모델 평균) |
| **LongMemEval** | "long-context benchmark for conversational question-answering" (기존 벤치마크) |

⚠️ **주의**: 제목의 "Context Rot" 은 저자들이 새로 주조한 용어이지만 **본문에 공식 정의 문장 부재**. [5] Anthropic 의 정의 ("as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases") 가 사실상 표준이 됨.

---

## 💬 인용할 만한 구절

> **인용 단계**: 모두 `[1차]` — trychroma.com 직접 WebFetch 성공.

### [1차] 원문 직접 인용

> "LLMs do not use their context uniformly; instead, their perform unreliably w/ growing input length."
— [Introduction](https://www.trychroma.com/research/context-rot)

> "NIAH underestimates what most long context tasks require in practice."
— [Related Work](https://www.trychroma.com/research/context-rot)

> "as needle-question similarity decreases, model performance degrades more significantly w/ longer inputs."
— [Needle-Question Similarity 결과](https://www.trychroma.com/research/context-rot)

> "even for these straightforward tasks, model performance becomes non-uniform as context length grows."
— [Repeated Words 섹션](https://www.trychroma.com/research/context-rot)

> "Shuffling the haystack and removing local coherence consistently improves performance."
— [Haystack Structure 결과](https://www.trychroma.com/research/context-rot)

> "Whether relevant information is present in a model's context is not all that matters; what matters more is how that information is presented."
— [Conclusion](https://www.trychroma.com/research/context-rot#conclusion)

> "effective context engineering essential for reliable performance"
— [Conclusion](https://www.trychroma.com/research/context-rot#conclusion)

---

## 🧭 전체 섹션 구조 (H2 목차)

1. Introduction
2. Related Work
3. **Needle in a Haystack Extension** (Needle-Question Similarity / Distractors / Needle-Haystack Similarity / Haystack Structure)
4. LongMemEval
5. Repeated Words
6. Limitations & Future Work
7. Conclusion
8. Footnotes / References / Appendix

---

## 🔗 우리 프로젝트 반영 (AI 해석)

> **이 절은 이식 전에 쓰였다.** 아래가 부르는 `000-foundation/` · `100-prompts/` ·
> `200-context/` · `300-harness/` · `700-evals/` 는 **남의 프로젝트의 카테고리**이며
> 이 저장소에는 없다(현행은 `00-meta` ~ `13-safety`). **요약 본문은 자산이고 이 절은
> 계획이었다** — 계획 쪽만 낡았다.


> **이 섹션만 해석 허용.**

### 이 글이 프로젝트 구조에 주는 교훈

1. **`200-context/index.md` 의 "Context Rot" 실패 모드에 경험적 근거 제공** — 지금까지 개념으로만 적혀 있던 Context Rot 을 18개 모델 × 194,480 호출 규모 실험으로 입증
2. **`CLAUDE.md` 의 "Lost in the Middle" 언급의 정확한 출처** — 우리 게이지 정책(60%·80% 임계값)의 실증적 방향성 근거
3. **Just-in-Time Context ([5] 용어) 의 실증적 정당화** — "focused prompt (~300 tokens) 가 full prompt (~113k tokens) 보다 성능 우위" → 전체를 주입하기보다 핵심만 주입하는 JIT 전략이 경험적으로 우세
4. **반직관적 발견 — Haystack Structure 역설**: 논리적으로 구조화된 문서가 오히려 성능 저하. 이 프로젝트에서 `docs/` 를 "의미적 그룹핑" 한다고 해서 모델 성능이 좋아지지 않음을 의미 → **구조 최적화보다 "관련 없는 정보 제거" 가 우선**

### 개념 매핑 (해석)

| Chroma 실험 발견 | 이 프로젝트 대응 |
|------------------|------------------|
| Performance degrades with input length | `CLAUDE.md` 게이지 정책 (60%/80% 임계값) |
| Focused prompt >> Full prompt | `200-context` JIT 규약 · "참조 문서는 필요 시에만" |
| Even 1 distractor lowers performance | `/btw` · 서브에이전트 위임 (컨텍스트 보호) |
| Shuffled > Structured haystack | **구조 최적화보다 무관 정보 제거 우선** → `docs/` 재분류 시 주의할 것 |
| Claude = lowest hallucination / GPT = highest | 이 프로젝트는 Claude Code 기반 — 상대적 유리, 단 안심 금지 |

### [5] Anthropic 과의 관계
- Anthropic 이 직접 인용한 실험의 **원 논문**
- [5] 의 "Context Rot" 용어는 실상 **이 [9] 보고서 제목에서 차용**
- [9] 의 수치 (2.55%, 2.89%, 4.21% refusal rates) 가 [5] 의 전제를 뒷받침
- **통합 독법**: [9] = 경험적 근거 → [5] = 이론적 해석 및 기법 → [1]·[2] = 실전 적용

### 적용 지점
- `ai-orchestration/200-context/index.md` — 참고문헌 [9] 섹션 보강 + "Context Rot" 실패 모드에 본 논문 링크
- 향후 신설 후보:
  - `200-context/empirical-basis.md` — 18 모델 실험 수치를 게이지 정책 근거로 정리
  - `200-context/haystack-paradox.md` — 구조화 역설을 `docs/` 재분류 시 유의사항으로

---

## ✅ 자가 점검 (체화)

1. **"context uniformly" 가정이 왜 실무에 중요한가?**
   → 답: 개발자들이 암묵적으로 "긴 컨텍스트 윈도우 = 모든 정보를 주입해도 OK" 로 가정함. Chroma 는 이 가정이 **194,480 호출 실험에서 폭로됨**을 보임 → JIT · compaction · note-taking 이 "옵션" 이 아니라 **필수**.

2. **Shuffled > Structured 역설의 실무 함의는?**
   → 답: 문서를 "의미적 그룹핑" 한다고 모델 성능이 좋아지지 않는다. 오히려 구조가 local coherence 를 만들어 attention 을 방해할 수 있음. → `docs/` 재분류 시 **"구조 최적화" 보다 "무관 정보 제거"** 가 우선.

3. **Claude vs GPT hallucination 차이가 의미하는 것은?**
   → 답: 모델별 harness 요구 수준이 다를 수 있음. GPT 기반 시스템은 distractor 제거 · 검증 레이어를 더 엄격히. Claude Code 사용인 이 프로젝트는 상대적 유리하지만, **Opus 4 가 full prompt 에서 가장 큰 성능 격차** 를 보인 것도 기억할 것.

---

## 📎 연결

- 카테고리: **200-context**
- 연관 문헌:
  - [5] Anthropic Effective Context Engineering — 본 [9] 를 직접 인용. [9]=실험, [5]=이론·기법
  - [7] Breunig How Long Contexts Fail — [9] 의 실험을 실패 모드로 세분화 (L3 학습 대기)
  - [8] Breunig How to Fix Your Context — [9] 에 대한 수정 레시피 (L3 학습 대기)
  - [10] Schmid Context Engineering — 용어 대중화 (L3 학습 대기)
- 가이드 챕터: `docs/guides/ai-engineering/_parts/03-context-engineering.html`
- 전체 서지: [`../bibliography.md`](../bibliography.md)

---

## 📅 개정 이력

- 2026-04-24 — 초판. `fetch_status: direct`. WebFetch 3연속 성공 ([2] martinfowler.com · [5] anthropic.com · [9] trychroma.com).
