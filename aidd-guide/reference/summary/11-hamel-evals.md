---
id: LLM-REF-S005
title: "Hamel Husain Evals 요약"
category: 12-references
type: study
created: 2026-04-24
updated: 2026-05-04
status: active
sources: [ai-orchestration/references/summaries/11-hamel-evals.md]
author: Bong Jong Hyeon
tier: 4
source_ref: 11
original_url: https://hamel.dev/blog/posts/evals/
original_title: Your AI Product Needs Evals
original_author: Hamel Husain
original_published: 2024-03-29
fetch_status: direct
---
# [11] Your AI Product Needs Evals — 요약

## 🎯 핵심 주장 (3줄)

- 성공·실패를 가르는 AI 제품의 **공통 근본 원인**은 robust evaluation system 의 유무이며, "평가 > 디버깅 > 행동 변경" 3대 활동 중 대다수 팀은 ③ (prompt eng·fine-tuning) 에만 과집중해 demo 수준에서 정체된다.
- 평가는 **L1 Unit Tests · L2 Human & Model Eval · L3 A/B Testing** 3계층이며 "cost of Level 3 > Level 2 > Level 1" — 비용 역순으로 실행 빈도를 높여야 한다.
- 평가 프로세스를 간소화(streamline)하면 나머지 모든 활동이 쉬워지고, **반복 속도(iteration speed)** 가 곧 성공이 된다.

## 📚 프레임워크·용어 (원문 추출)

- **Trace** — "a log of a sequence of events such as user sessions or a request flow through a distributed system. In other words, tracing is a logical grouping of logs."
- **Unit Tests for LLMs** — "assertions (like you would write in pytest). Unlike typical unit tests, you want to organize these assertions for use in places beyond unit tests, such as data cleaning and automatic retries."
- **Three Levels of Evaluation** (저자 정의)
  - **Level 1: Unit Tests** — 빠르고 저렴한 assertions, 개발 중 자주 실행
  - **Level 2: Human & Model Eval** — Trace logging + LLM critique alignment 중심 리뷰 (humans periodically evaluate a sample 필수)
  - **Level 3: A/B Testing** — 프로덕션 사용자 행동 기반 검증
- **3 Critical Activities** — 원문 인용 순서:
  1. "Evaluating quality (ex: tests)"
  2. "Debugging issues (ex: logging & inspecting data)"
  3. "Changing the behavior or the system (prompt eng, fine-tuning, writing code)"
- **Fine-Tuning vs RAG 분할** — "Fine-tuning is best for learning syntax, style, and rules, whereas techniques like RAG supply the model with context or up-to-date facts."

## 📊 구체 예시·수치 (원문 인용)

**Case Study — Lucy (Rechat's AI Assistant)**: 부동산 대화형 어시스턴트. 저자가 기술한 3대 증상:
- "Addressing one failure mode led to the emergence of others, resembling a game of whack-a-mole"
- "Limited visibility into the AI system's effectiveness across tasks beyond vibe checks"
- "Prompts expanded into long and unwieldy forms"

**Listing Finder — Level 1 assertion 표 (원문 그대로 재구성)**:

| Scenario | Assertion |
|----------|-----------|
| Only one listing matches | `len(listing_array) == 1` |
| Multiple listings match | `len(listing_array) > 1` |
| No listings match | `len(listing_array) == 0` |

**Generic UUID assertion**: "Search for exposed UUIDs" — regex 로 `matches.length == 0` 검증 (모든 기능 공통 assertion 예시).

**Synthetic test case 생성 지시문 예시 (저자 인용)**:
> "Write 50 different instructions that a real estate agent can give to his assistant to create contacts on his CRM."

**저자가 열거한 도구 지도**:
- Trace logging: LangSmith · LangChain · Arize · Human Loop · OpenLLMetry · HoneyHive
- Data visualization: Metabase · Lilac
- UI framework (도메인 고유 뷰어): Gradio · Streamlit · Panel · Shiny for Python
- Testing: pytest

**저자 권고 (요지, 원문 인용 조합)**:
- "Use most powerful LLM you can afford" — critique model 은 가장 강력한 모델을 쓸 것
- 점수 체계는 binary (good/bad) 로 시작 → 숙달 후 granular
- Model-based eval 정합도는 precision/recall 로 **별도 추적**
- "Start with binary (good/bad) ratings before granular scoring"
- "Don't target 100% test pass rate — this is a product decision"

## 💬 인용할 만한 구절

### [1차] 원문 직접 인용

> "unsuccessful products almost always share a common root cause: a failure to create robust evaluation systems."
— Hamel, §Motivation ([원문](https://hamel.dev/blog/posts/evals/))

> "success with AI hinges on how fast you can iterate"
— Hamel, §Iterating Quickly == Success ([원문](https://hamel.dev/blog/posts/evals/))

> "Rigorous and systematic evaluation is the most important part of the whole system."
— Hamel, §Problem: How To Systematically Improve The AI? ([원문](https://hamel.dev/blog/posts/evals/))

> "Many people focus exclusively on #3 above, which prevents them from improving their LLM products beyond a demo."
— Hamel, §Problem: How To Systematically Improve The AI? ([원문](https://hamel.dev/blog/posts/evals/))

> "The cost of Level 3 > Level 2 > Level 1. This dictates the cadence and manner you execute them."
— Hamel, §The Types Of Evaluation ([원문](https://hamel.dev/blog/posts/evals/))

> "You can never stop looking at data—no free lunch exists."
— Hamel, §Conclusion ([원문](https://hamel.dev/blog/posts/evals/))

> "You must remove all friction from the process of looking at data."
— Hamel, §Looking At Your Traces ([원문](https://hamel.dev/blog/posts/evals/))

> "99% of the labor involved with fine-tuning is assembling high-quality data that covers your AI product's surface area."
— Hamel, §Fine-Tuning ([원문](https://hamel.dev/blog/posts/evals/))

> "Fine-tuning is best for learning syntax, style, and rules, whereas techniques like RAG supply the model with context or up-to-date facts."
— Hamel, §Fine-Tuning ([원문](https://hamel.dev/blog/posts/evals/))

## 🔗 우리 프로젝트 반영 (AI 해석)

> **이 절은 이식 전에 쓰였다.** 아래가 부르는 `000-foundation/` · `100-prompts/` ·
> `200-context/` · `300-harness/` · `700-evals/` 는 **남의 프로젝트의 카테고리**이며
> 이 저장소에는 없다(현행은 `00-meta` ~ `13-safety`). **요약 본문은 자산이고 이 절은
> 계획이었다** — 계획 쪽만 낡았다.


> 이 섹션만 해석 허용. 반드시 "해석" 명시.

- **적용 지점**: `ai-orchestration/700-evals/` (카테고리 첫 참고문헌 · 골격 본격 채택)

- **추가할 원칙 (해석)**:
  1. **L1/L2/L3 3계층 골격 채택** — 비용이 가장 낮은 L1 (assertion) 부터 쌓고, L1 신호 부족 시 L2 (Trace + Human/LLM judge), 운영 진입 후에만 L3 (A/B). 700-evals 의 기본 구조로 승격.
  2. **3 Critical Activities 자기 진단** — 현재 이 프로젝트는 ③ (prompt eng · skill 작성) 에 과집중. ① (tests) · ② (trace 로깅) 부재는 Hamel 기준 "demo 정체" 신호 → 700-evals 가 존재 이유를 공식 획득.
  3. **Iteration speed KPI 화** — eval 루프 1회 측정 비용이 분 단위를 넘으면 L1 assertion 으로 분해 강제.
  4. **"Remove all friction" 원칙** — Trace viewer 는 generic 프레임워크보다 **프로젝트 고유 UI** 가 효과적 (저자 권고). 도메인별 viewer 분리 타당성 확보.
  5. **100% pass 금지** — 통과율은 product decision. 현 `700-evals/index.md` 의 회귀 기준 (평균 ≥ 80점) 은 이 원칙과 정합 → 유지.

- **수정할 기존 문서 (해석)**:
  - `700-evals/index.md`: `status: draft → active`, Hamel 3-Level 계층 흡수, "첫 평가 후보" (/my-skill · /create-guide) 를 L1·L2 위치로 재배치.
  - `_meta/catalog.yaml`: `700-evals/index` 엔트리 `status: draft → active`, `updated: 2026-04-24` 갱신.
  - `LEARNING-LOG.md`: 필수 5건 표 [11] ✅, 세션 로그 #6, 통찰에 "Hamel 3-Level 비용 계층" 섹션 추가.
  - `bibliography.md`: 학습 진행 상태 요약 섹션 추가 ([1]⚠️ [2]✅ [5]✅ [9]✅ [11]✅).

## ✅ 자가 점검 (체화)

1. **Hamel 의 "3 Critical Activities" 는 무엇이고, 대부분의 팀은 어디에 과집중하는가?**
   → 답: ① 품질 평가(tests) / ② 디버깅(logging & inspecting data) / ③ 행동 변경(prompt eng · fine-tuning · writing code). 대부분 팀은 ③ 에만 집중해 demo 수준을 벗어나지 못함.

2. **Level 1/2/3 evals 의 비용 관계와 실행 cadence 는?**
   → 답: "cost of Level 3 > Level 2 > Level 1". L1 = 매 개발 주기 assertion (가장 자주) / L2 = 정기적 trace sample 리뷰 (중간 빈도) / L3 = production 진입 후만 (가장 드물게). 비용이 낮을수록 빈도 높음.

## 📎 연결

- 카테고리: 700
- 연관 문헌: [5] (Context Engineering — eval-driven context 품질), [9] (Context Rot — 실증 벤치마크의 역할 모델), [13] (Simon Willison — eval 관점 축적)
- 가이드 챕터: `docs/guides/ai-engineering/_parts/` (700 evals 챕터 활성화 시 연결)
