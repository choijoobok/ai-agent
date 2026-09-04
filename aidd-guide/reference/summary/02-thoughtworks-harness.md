---
id: LLM-REF-S002
title: "Thoughtworks Harness 요약"
category: 12-references
type: study
created: 2026-04-24
updated: 2026-05-04
status: active
sources: [ai-orchestration/references/summaries/02-thoughtworks-harness.md]
author: Bong Jong Hyeon
tier: 4
source_ref: 2
original_url: https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html
original_title: "Harness Engineering for Coding Agent Users"
original_author: Birgitta Böckeler (Thoughtworks · Distinguished Engineer, AI-assisted delivery)
original_published: 2026-04-02
fetch_status: direct
---
# [2] Thoughtworks — Harness Engineering for Coding Agent Users — 요약

## 🎯 핵심 주장 (원문 그대로)

1. > "To let coding agents work with less supervision, we need ways to increase our confidence in their result."
2. > "A well-built outer harness serves two goals: it increases the probability that the agent gets it right in the first place, and it provides a feedback loop that self-corrects as many issues as possible before they even reach human eyes."
3. > "Separately, you get either an agent that keeps repeating the same mistakes (feedback-only) or an agent that encodes rules but never finds out whether they worked (feed-forward-only)."
4. > "A good harness should not necessarily aim to fully eliminate human input, but to direct it to where our input is most important."
5. > "Building this outer harness is emerging as an ongoing engineering practice, not a one-time configuration."

---

## 📚 프레임워크·용어 (원문 정의)

### 기본 방정식
- **Harness** — "the term harness has emerged as a shorthand to mean everything in an AI agent except the model itself"
- 따라서 **Agent = Model + Harness**

### 제어 2축 — Guides vs Sensors

| 축 | 원문 정의 | 언제 작동 |
|----|----------|-----------|
| **Guides** (feedforward controls) | "anticipate the agent's behaviour and aim to steer it before it acts. Guides increase the probability that the agent creates good results in the first attempt" | 행동 **전** |
| **Sensors** (feedback controls) | "observe after the agent acts and help it self-correct. Particularly powerful when they produce signals that are optimised for LLM consumption" | 행동 **후** |

### 실행 유형 2축 — Computational vs Inferential

| 유형 | 원문 정의 |
|------|----------|
| **Computational** | "deterministic and fast, run by the CPU" |
| **Inferential** | "Semantic analysis, AI code review... Slower and more expensive; results are more non-deterministic" |

### 규제 카테고리 3가지 (Regulation categories)
1. **Maintainability harness**
2. **Architecture fitness harness**
3. **Behaviour harness**

*(각 카테고리의 세부 정의는 추후 본문 재확인 필요 — 본 요약은 WebFetch 반환 수준에 한정)*

---

## 📊 구체 예시·사례 (원문 인용)

### 타 회사 사례
- **OpenAI**: "An OpenAI team documented what their harness looks like: layered architecture enforced by custom linters and structural tests, and recurring 'garbage collection'" — [1] OpenAI Harness 문서와 직접 연결
- **Stripe**: "Stripe's write-up about their minions describes things like pre-push hooks that run relevant linters based on a heuristic"

### 언급된 구체 도구·패턴
- **approved fixtures pattern**
- **ArchUnit tests**
- **mutation testing**
- **LSP (Language Server Protocol)**

### 수치 실험
원문 언급 없음 (저자는 실험 수치 제시가 아닌 **개념·분류 체계** 제안에 무게).

---

## 💬 인용할 만한 구절

> **인용 단계**: 모두 `[1차]` — martinfowler.com 직접 WebFetch 성공.

### [1차] 원문 직접 인용

> "LLMs are non-deterministic, they don't know our context, and they don't really understand the code"
— [도입부](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)

> "the earlier you find issues, the cheaper they are to fix"
— [Timing: Keep quality left](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html#timing-keep-quality-left)

> "A coding agent has none of this: no social accountability, no aesthetic disgust at a 300-line function"
— [The role of the human](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html#the-role-of-the-human)

> "An LLM-based coding agent can produce almost anything, but committing to a topology narrows that space"
— [Ashby's Law 문맥 / Harnessability 섹션 근처](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)

> "if sensors never fire, is that a sign of high quality or inadequate detection mechanisms?"
— [A starting point - and open questions](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html#a-starting-point)

---

## 🧭 글 전체 섹션 구조 (H2 목차)

1. Metaphors only go so far
2. Feedforward and Feedback
3. Computational vs Inferential
4. The steering loop
5. Timing: Keep quality left
6. Regulation categories (→ Maintainability / Architecture fitness / Behaviour)
7. Harnessability
8. Harness templates
9. The role of the human
10. A starting point — and open questions

---

## 🔗 우리 프로젝트 반영 (AI 해석)

> **이 절은 이식 전에 쓰였다.** 아래가 부르는 `000-foundation/` · `100-prompts/` ·
> `200-context/` · `300-harness/` · `700-evals/` 는 **남의 프로젝트의 카테고리**이며
> 이 저장소에는 없다(현행은 `00-meta` ~ `13-safety`). **요약 본문은 자산이고 이 절은
> 계획이었다** — 계획 쪽만 낡았다.


> **이 섹션만 해석 허용.** 원문 주장이 아닌 해석·매핑.

### 이 글이 프로젝트 구조에 주는 핵심 교훈

1. **Guides · Sensors 2축은 이 프로젝트 구조와 정확히 대응** — 단일 축이 아니라 양축이 필요하다는 Böckeler의 경고는 이 프로젝트가 `CLAUDE.md`(guides) 와 `hooks/`(sensors) 를 모두 갖추고 있는 것을 정당화.
2. **Computational vs Inferential 구분은 자동화 배치 기준** — `.claude/hooks/*.js` (deterministic · 싸고 빠름) 는 computational 층. summary 초안 · taskBoard 판정 · review 는 inferential 층. 섞지 말 것.
3. **3가지 harness 카테고리는 향후 서브 인덱스 후보** — `300-harness/` 하위에 `maintainability.md` · `architecture-fitness.md` · `behaviour.md` 신설 고려.

### 개념 매핑 (해석)

| Böckeler 개념 | 이 프로젝트 자산 |
|---------------|------------------|
| **Guides (feedforward)** | `CLAUDE.md` · `.claude/skills/` · `permissions.allow/deny` |
| **Sensors (feedback)** | `.claude/hooks/*.js` (Stop · UserPromptSubmit) · 빌드·린트 결과 · CI |
| **Computational layer** | 훅 기반 자동화 (raw append · patchNotes 생성) · 린트 |
| **Inferential layer** | summary 다듬기 · taskBoard "의미있는 변경" 판정 · code review |
| **Maintainability harness** | Spring/React 린트 · 포맷 · 주석 규약 (CLAUDE.md) |
| **Architecture fitness harness** | 레이어 규약 (`boot/sys/app`) · Sand Box 원칙 → **ArchUnit 검토 대상** |
| **Behaviour harness** | 테스트 커버리지 · `@Test` 스위트 · TDD 규약 |

### 적용 지점
- `ai-orchestration/300-harness/index.md` — 참고문헌 [2] 섹션 보강 (아래 섹션에서 진행)
- 향후 신설 후보:
  - `300-harness/guides-vs-sensors.md` — 2축 분류 기준 정리
  - `300-harness/computational-vs-inferential.md` — 자동화 배치 가이드
  - `300-harness/categories/` — maintainability / architecture-fitness / behaviour 세 파일

### [1] OpenAI 와의 교차 관찰
- Böckeler는 [1] OpenAI 문서를 직접 인용 (`garbage collection`, `structural tests`, `layered architecture`) → **[1]·[2] 가 동일 어휘 체계를 공유**
- Böckeler의 기여는 OpenAI 의 구체 사례를 **Guides/Sensors · Computational/Inferential** 2×2 분류로 일반화한 것

---

## ✅ 자가 점검 (체화)

1. **Guides 와 Sensors 를 분리하는 이유는?**
   → 답: 단독으로는 실패. **Feedback-only** = 에이전트가 같은 실수 반복 / **Feedforward-only** = 규칙만 주입하고 통했는지 검증 불가. 양축을 동시에 운영해야 steering loop가 닫힘.

2. **Computational vs Inferential 구분의 실무 함의는?**
   → 답: 자동화 층을 섞지 말 것. deterministic 검증은 훅·린트 (싸고 빠름 · CPU) / 의미 분석은 LLM (느림 · 비용 · 비결정적) — 각자 다른 신뢰 수준으로 취급해야 한다.

3. **"harness 는 one-time configuration 이 아니다" 의 함의는?**
   → 답: 하네스 자체가 **진화하는 엔지니어링 산출물**. 우리가 `CLAUDE.md` 와 `.claude/hooks/` 를 지속적으로 개정하는 것이 정상이며, 첫 세팅 후 방치는 반(反)패턴.

---

## 📎 연결

- 카테고리: **300-harness**
- 연관 문헌:
  - [1] OpenAI Harness — 동일 주제 · Böckeler 가 직접 인용 · 구체 사례 제공자
  - [3] HumanLayer Skill Issue — 같은 "harness engineering" 용어를 코딩 에이전트 관점에서 재해석 (학습 예정)
  - [4] Anthropic Building Effective Agents — 에이전트 구축 관점 보완 자료
- 가이드 챕터: `docs/guides/ai-engineering/_parts/05-harness-engineering.html`
- 전체 서지: [`../bibliography.md`](../bibliography.md)

---

## 📅 개정 이력

- 2026-04-24 — 초판. `fetch_status: direct` (martinfowler.com WebFetch 성공). [1] 학습의 간접 접근 실패와 대조되는 첫 직접 학습 트랜잭션.
