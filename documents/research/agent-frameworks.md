# AI Agent 프레임워크 조사 — 채택 가능성 검토

| 항목 | 내용 |
|---|---|
| 조사 시점 | **2026-08** (프레임워크 지형 · 버전은 그 시점의 것) |
| 성격 | **기술 평가** |
| 근거로 쓰인 결정 | [`ADR-001`](../decisions/ADR-001-오케스트레이션-프레임워크.md)(오케스트레이션 B안) · [`ADR-002`](../decisions/ADR-002-플랫폼-노선.md)(Spring Boot 4 · Spring AI 2.0 계열) |
| 상위 | PRN-01·PRN-05(외부 모델 호출 추상화와 공급사 교체) · CON-006(오케스트레이션) · `03-glossary.yaml` turn_states · REQ-030~035 |
| 후속 | [오케스트레이션 PoC](orchestration-poc.md) — 이 문서 §5.2 의 확인 항목을 실행한 결과 |

> **비규범이다.** 여기의 어떤 서술도 설계 제약이 아니다 — 제약은 `documents/spec/` 이,
> 결정은 `documents/decisions/` 가 갖는다 ([산출물 지도 42행](../../aidd-guide/artifact/INDEX.md)).
>
> **`agentic-ai/docs/design/research/02-agent-frameworks.md` 에서 옮겼다(2026-09-07).**
> 관측과 판단은 그대로 두고 **참조만 현행 ID 로 바꿨다** — 규칙은
> [참고 사례 조사](reference-cases.md) 머리와 같다. **버전 문자열은 조사 시점의 것을
> 그대로 뒀다** — 지금 값으로 고치면 그때의 판단 근거가 사라진다.

---

## 1. 이 문서의 성격과 범위

[참고 사례 조사](reference-cases.md)과 같은 **비규범 조사 자료**다. 여기의 어떤 서술도 설계 제약이 아니며, 채택하기로 확정한 것만 현행 `documents/spec/`의 조항으로 옮긴다 (1.1, 1.2).

- **조사 시점은 2026-08이다.** 이 분야는 분기 단위로 지형이 바뀐다. 버전·상태 표기는 조사 시점 기준이며, 갱신 없이 인용하지 않는다.
- 다루는 질문은 둘이다. ① agent 구현에 쓸 수 있는 프레임워크·라이브러리에 무엇이 있는가 ② 그중 **Spring Boot 단일 애플리케이션**(`02-constraints.yaml` 기술 제약)이라는 우리 제약 안에서 실제로 쓸 수 있는 것은 무엇이며, 무엇까지 대체되고 무엇이 남는가.
- 이 문서는 **선정 결정을 내리지 않는다.** 후보와 판단 근거, 확인이 필요한 항목까지만 정리한다. 프레임워크 채택은 `02-constraints.yaml` 기술 제약(기술 스택)과 `aidd-guide/standard/hub-conventions.md` §12.5(외부 모델 호출 규칙)의 개정을 수반하므로 현행 `documents/spec/` 개정 절차를 따라야 한다.

### 1.1 판단 기준 — 우리 요건에서 유도한 평가 축

일반적인 프레임워크 비교표는 우리 판단에 쓸모가 없다. 우리 설계가 이미 확정한 요건에서 축을 뽑는다.

| 축 | 근거 조항 | 요구 내용 |
|---|---|---|
| A. 공급사 추상화 | PRN-01, PRN-05, ARCH-040, `aidd-guide/standard/hub-conventions.md` §12.5 | 공급사·모델·effort가 설정 값. SDK 의존은 FEAT-304 안에만 |
| B. 연속 도구 호출 | REQ-004, FEAT-201·13 | LLM이 도구 호출을 연속 요청하고 agent가 처리하는 루프 |
| C. 턴 지속·재개 | `03-glossary.yaml` turn_states, REQ-013, REQ-016, FEAT-216 | 턴은 상태를 가진 지속 작업. 서버 재시작·이탈을 견디고 재개 |
| D. 사용자 개입 | REQ-005, REQ-017, REQ-105 | 처리 중 승인·추가 정보 요구, 응답 수신 후 재개 |
| E. 중단·스트리밍 | REQ-007, REQ-018, REQ-030~035 | 스텝(청크) 경계 중단, 진행 상태·경과 시간 표시 |
| F. 컨텍스트 관리 | REQ-002, REQ-003, FEAT-202, ARCH-040 | 과거 턴 참조 + 요약, 총량 제한, 안정 접두부 고정 |
| G. 역할별 모델 | ARCH-040 | 스텝 역할별 모델 매핑, 턴 시작 시점 고정 |
| H. 지식 검색 | ARCH-060, FEAT-206 | 태그 검색 기본 + 벡터 검색 선택, 결과 병합 |
| I. SQL 통제 | `22-authz.yaml`, FEAT-204, ARCH-030 | 파싱·카탈로그 대조·조건 주입·원본 컬럼 추적 |
| J. 감사 | PRN-07, REQ-107, `aidd-guide/standard/hub-conventions.md` §12.6 | 전량 기록, 별도 트랜잭션, 기록 실패 = 처리 실패 |
| K. 쿼터 | NFR-010~017, FEAT-211 | 사용자 귀속 토큰·비용 집계와 한도 집행 |
| L. 운영 형태 | ARCH-010~015, CON-012·CON-013, REQ-030~035 | 폐쇄망 구축형 납품, 고객사별 개별 유지보수, 멀티 인스턴스 |

**A~H는 프레임워크가 후보로 답할 수 있는 영역이고, I~L은 원리상 어떤 프레임워크도 주지 않는다.** 이 구분이 이 문서의 결론을 대부분 결정한다.

---

## 2. 프레임워크 지형 (2026-08)

### 2.1 Python·TypeScript 진영 — 참고용

우리가 직접 쓸 수 없지만(`02-constraints.yaml` 기술 제약의 단일 WAS·Spring Boot 제약), **설계 아이디어의 원천**이고 JVM 진영이 무엇을 모방하고 있는지의 기준이므로 정리한다.

| 프레임워크 | 주체 | 성격 | 우리 관점의 시사점 |
|---|---|---|---|
| **LangGraph** | LangChain | 상태 그래프 오케스트레이션. 노드=작업, 엣지=제어 흐름. 체크포인터로 매 스텝 상태 저장 | **우리 `03-glossary.yaml` turn_states 턴 상태 모델과 개념이 같다.** interrupt/resume이 REQ-005·REQ-013의 정석 구현. 감사·롤백이 필요한 규제 환경에서 사실상 표준으로 자리잡음 |
| **CrewAI** | CrewAI | 역할 기반 다중 에이전트. 프로토타입 최속 | 역할 분해 아이디어는 유효하나([참고 사례 조사](reference-cases.md)의 Uber QueryGPT와 같은 방향) 통제 밀도가 우리 요구에 못 미침 |
| **OpenAI Agents SDK** | OpenAI | handoff(에이전트 간 제어 이양) 중심 | 공급사 종속. PRN-05와 충돌 |
| **Microsoft Agent Framework** | Microsoft | AutoGen + Semantic Kernel의 통합 후계. 그래프 워크플로우, Python·.NET 1.0 GA | .NET·Python만. Java는 구 Semantic Kernel Java가 남아 있으나 이 통합의 대상이 아님 |
| **Strands Agents** | AWS | 모델 주도 SDK, 다중 에이전트 프리미티브, A2A | Python·TypeScript |
| **Claude Agent SDK** | Anthropic | 범용 agent 런타임 (구 Claude Code SDK) | 공급사 종속. 단 **개발기 CLI Provider**(ARCH-040)의 실체가 이 계열이다 |
| **LlamaIndex / Haystack** | — | RAG 파이프라인 중심 | 우리 지식 검색(ARCH-060)은 태그 우선 + 선택적 벡터라 이들의 전제(벡터 우선)와 다름 |

이 진영을 도입하려면 **Python 사이드카 프로세스**를 폐쇄망에 함께 배포해야 한다. CON-012·CON-013의 구축형·개별 유지보수 모델에서 운영 구성요소를 하나 더 늘리는 선택이며, 6.1이 "별도 벡터 DB를 두지 않는다"고 판단한 것과 같은 이유로 불리하다. **이 조사에서는 배제한다.**

### 2.2 JVM 진영 — 실제 후보군

| 프레임워크 | 버전·상태 | 라이선스 | 성격 |
|---|---|---|---|
| **Spring AI** | 1.1.x (Boot 3 계열) / **2.0.0 GA** (2026-06, Boot 4 계열) | Apache 2.0 | Spring 공식. ChatModel·ChatClient 추상화, Advisors, 도구 호출, 구조화 출력, ChatMemory, VectorStore, MCP, Micrometer 관측, 프롬프트 캐싱 |
| **LangChain4j** | 1.19.0 (agentic 모듈은 beta) | Apache 2.0 | JVM 최대 독립 라이브러리. 20+ 공급사/임베딩 스토어, AiServices 선언형 API, `langchain4j-agentic`(워크플로·supervisor·HITL suspend/resume) |
| **LangGraph4j** | 1.8.x, 커뮤니티 | MIT | Python LangGraph의 Java 이식. 상태 그래프 + 체크포인터(**PostgreSQL·Redis 등**). Spring AI·LangChain4j **양쪽과 결합 가능** |
| **Spring AI Alibaba (Graph)** | 1.0.0.x GA | Apache 2.0 | Spring AI 기반 그래프 런타임. 체크포인트, InterruptableAction, HumanInTheLoopHook |
| **Embabel** | 1.0 GA (2026) | Apache 2.0 | Rod Johnson. GOAP(비-LLM 계획 알고리즘)로 실행 경로를 결정. 비결정성 최소화가 목표 |
| **Koog** | 1.2.x | — | JetBrains. Kotlin 네이티브, 명시적 그래프 + 체크포인트 재개, 이력 압축 |
| **Google ADK for Java** | GA | — | Gemini 우선. 개발용 트레이싱 UI |
| **Semantic Kernel (Java)** | 1.0+ | — | Azure 종속 |
| **MCP Java SDK** | 2.0.0 GA | Apache 2.0 | 도구 프로토콜 표준 구현. Spring AI 2.0에 통합 |

정리하면, **2025년의 "Java에는 쓸 만한 게 없다"는 전제는 2026년 기준으로 더 이상 유효하지 않다.** 사용자 지적대로 처음부터 만들 이유는 줄었다. 다만 뒤에서 보듯 **줄어든 것은 A~H 축이고 I~L은 그대로 남는다.**

---

## 3. 우리 요건과의 대조

### 3.1 프레임워크가 실제로 덜어주는 것 (A~H)

| 축 | 대체 가능성 | 내용 |
|---|---|---|
| A. 공급사 추상화 | **높음** | Spring AI `ChatModel`·LangChain4j `ChatModel` 모두 우리가 FEAT-304에 만들려던 것과 같은 계층이다. 20+ 공급사 구현체가 이미 있다. 다만 **우리 인터페이스를 없애고 프레임워크 타입을 도메인에 노출하면 PRN-05를 프레임워크에 위임하는 것이 된다** — 3.3에서 다룬다 |
| B. 연속 도구 호출 | **높음** | 도구 스키마 자동 생성, 호출 파싱, 결과 회신, 루프 종료 판정이 전부 제공된다. 우리가 직접 만들면 공급사별 tool-call 포맷 차이를 계속 따라가야 한다. **가장 확실한 이득** |
| C. 턴 지속·재개 | **중간~높음** | LangGraph4j 체크포인터(PostgreSQL saver 존재), Spring AI Alibaba Graph, LangChain4j 1.18의 crash-resilient suspend/resume, Koog 체크포인트가 모두 이 문제를 정면으로 다룬다. **단 이들의 체크포인트 저장 형식은 우리 턴 상태 모델(`03-glossary.yaml` turn_states)·이력 스키마와 다르다.** 6가지 상태·대기 유형·만료·"액션 실행한 턴은 재개 제외"는 우리 규칙이며 프레임워크에 없다 |
| D. 사용자 개입 | **중간~높음** | interrupt / HumanInTheLoopHook / suspend-resume 이 정확히 이 패턴이다. REQ-017의 "명시적 승인이 아닌 모든 입력은 비승인" 같은 판정 규칙은 우리가 얹는다 |
| E. 중단·스트리밍 | **중간** | 스트리밍 응답은 전부 지원. REQ-030~035의 **"다른 인스턴스가 턴 레코드에 기록한 중단 요청을 청크 경계에서 확인"** 은 프레임워크 밖의 우리 구조다 |
| F. 컨텍스트 관리 | **낮음** | 프레임워크의 ChatMemory는 대체로 최근 N개 슬라이딩 윈도우·토큰 윈도우다. **`10-requirements.yaml` 질의 처리이 이미 "슬라이딩 윈도우 단독은 REQ-002를 만족하지 못한다"고 못 박았다.** REQ-021의 업무 도메인 → 데이터소스 → 테이블 → 컬럼 단계 축소는 우리 고유 로직이다. 프레임워크 메모리는 **쓰지 않는 편이 낫다** |
| G. 역할별 모델 | **중간** | 런타임 ChatModel 교체는 지원(LangChain4j는 agentic 상태 기반 동적 모델 선택 제공). 역할 ↔ 모델 매핑과 턴 시작 시점 고정은 우리 설정(FEAT-015) |
| H. 지식 검색 | **중간** | pgvector VectorStore·임베딩 모델 추상화·재임베딩 기반은 제공된다. **태그 검색과 벡터 검색의 병합, 임베딩 끄기 구성(ARCH-060), 참조 테이블 링크 합류(REQ-301~304)** 는 우리 것 |

### 3.2 어떤 프레임워크도 주지 않는 것 (I~L)

**이것이 이 제품의 실제 부피다.** 프레임워크 선택이 여기를 줄여주지 않는다는 점을 분명히 해 둔다.

| 축 | 내용 |
|---|---|
| I. SQL 통제 | `22-authz.yaml`의 4단계 — 파싱, **선언된 데이터소스 카탈로그와 참조 객체 대조**(ARCH-030), 행 스코프·기본 필터 주입, 원본 컬럼 추적과 마스킹. 이건 agent 프레임워크가 아니라 **SQL 파서**의 일이다. JSQLParser(경량, 다중 방언)와 Apache Calcite(파서+검증기+관계 대수, 무겁다)가 후보이며, ARCH-030가 "데이터소스별로 파서를 교체 가능하게" 설계한 것이 그대로 유효하다. **FEAT-204는 자체 구현이 확정적이다** |
| J. 감사 | Micrometer 관측·트레이싱은 운영 모니터링이지 PRN-07의 감사가 아니다. 프롬프트·생성 SQL·파라미터·응답·토큰·정책 판정을 **차등 보존 정책(REQ-107)에 따라 우리 스키마에 별도 트랜잭션으로**(`aidd-guide/standard/hub-conventions.md` §12.6) 남기고, 기록 실패를 처리 실패로 취급하는 것은 전부 우리 구현 |
| K. 쿼터 | 토큰 사용량 수집은 프레임워크가 제공하나, 사용자 귀속·등급별 한도·전사 예산 배분(NFR-010~017, FEAT-017)은 우리 도메인 |
| L. 운영 형태 | 폐쇄망 구축형·고객사별 버전 분기(CON-012·CON-013)는 **의존성의 수명 리스크**를 다르게 만든다. SaaS라면 프레임워크 breaking change를 우리가 흡수하면 끝이지만, 우리는 고객사마다 다른 버전이 수년간 돌아간다. **beta·1인 메인테이너 모듈에 핵심 경로를 태우는 비용이 일반 프로젝트보다 크다** |

### 3.3 구조적 쟁점 — 프레임워크와 FEAT-304의 관계

가장 먼저 정리해야 할 것은 버전 선택이 아니라 **경계**다. `aidd-guide/standard/hub-conventions.md` §12.5는 "`modules/` 아래 어떤 코드도 공급사 SDK를 import 하지 않는다"고 규정하고, 이 경계를 **의존성 규칙 검사로 강제**한다(빌드 실패). 프레임워크를 도입하면 이 규칙에 새 범주가 생긴다.

| 계층 | 무엇인가 | 배치 제안 |
|---|---|---|
| 공급사 SDK (OpenAI·Anthropic …) | `aidd-guide/standard/hub-conventions.md` §12.5가 이미 금지 | FEAT-304 내부에만. **현행 유지** |
| 모델 추상화 (Spring AI `ChatModel`, LangChain4j `ChatModel`) | 공급사 SDK가 아니라 **우리 FEAT-304와 같은 층의 경쟁 추상화** | **FEAT-304 내부 구현으로 감싼다.** FEAT-304 인터페이스는 우리 것을 유지 |
| 오케스트레이션 (그래프·워크플로) | 스텝 루프를 도는 agent 내부 구조 | `modules/agent` 안에 노출. 단 노출 범위를 명시하고 portal·admin 참조는 금지 |

**모델 추상화를 그대로 도메인에 노출하지 않는 이유는 PRN-05의 성격 때문이다.** PRN-05는 "공급사를 바꿀 수 있게 하라"이고, Spring AI/LangChain4j를 그대로 노출하면 공급사 교체 가능성은 얻지만 **프레임워크 자체가 교체 불가능한 종속이 된다.** 또한 FEAT-304에는 프레임워크가 대신해 주지 않는 책임이 붙어 있다 — 호출 기록 없는 성공 호출 금지(`aidd-guide/standard/hub-conventions.md` §12.5), 용도별 인터페이스 분리(대화·추론 / 임베딩)와 그 참조 관계 검사, 테스트용 녹화·재생 구현체 자리(`aidd-guide/standard/hub-conventions.md` §12.9). 이것들은 **얇은 래퍼를 유지해야 성립한다.**

반대로, 얇은 래퍼 하나를 유지하는 비용으로 20여 개 공급사 구현체·tool-call 포맷 대응·프롬프트 캐싱 연동을 얻는다. **이 교환은 명백히 유리하다.**

### 3.4 Spring Boot 3 vs 4 — 먼저 확정해야 할 갈림길

> **확정됨 (2026-08-31).** 최신 안정 버전을 계속 따라가는 것이 목표이므로 **Boot 4 계열 / Spring AI 2.0 계열**로 간다. 아래는 그 판단의 근거다.

프레임워크 선택보다 앞서는 제약이다.

- **Spring AI 2.0은 Spring Boot 3.x 컨텍스트에 로드되지 않는다.** Boot 4 / Spring Framework 7 / Jakarta EE 11 / Jackson 3 기반이며 아키텍처 요구사항이라 우회 경로가 없다.
- Boot 3 계열을 유지하면 Spring AI는 1.1.x 라인이 된다.
- Embabel 1.0도 Boot 3.5 계열을 대상으로 한다(조사 시점 기준). 프레임워크마다 Boot 4 대응 시점이 다르다.
- **LangChain4j·LangGraph4j는 Spring 버전 종속이 상대적으로 약하다**(Java 17 기준). 이 축에서는 위험이 낮다.

이 결정은 QueryDSL·JPA 등 기존 스택의 Boot 4 대응 여부와 함께 판단해야 하므로, 프레임워크 검토와 **별개 항목으로 먼저 확정**하는 것이 맞다.

---

## 4. 후보 조합안

축 A~H를 어디까지 프레임워크에 맡기느냐로 갈린다.

### A안 — Spring AI 단독

FEAT-304 구현체를 Spring AI `ChatModel`로 두고, 오케스트레이션(스텝 루프·턴 상태·재개)은 우리가 구현한다.

| | |
|---|---|
| 얻는 것 | 공급사 추상화, 도구 호출, 구조화 출력, pgvector, 프롬프트 캐싱, Micrometer, MCP. Spring 공식이라 수명·문서·인력 확보가 가장 안전하다 |
| 남는 것 | 스텝 루프, 턴 상태 지속·재개(`03-glossary.yaml` turn_states), 중단 요청 반영(REQ-030~035), 컨텍스트 조립(FEAT-202) 전부 |
| 리스크 | 낮음. 단 C·D축(재개·개입)을 처음부터 직접 만들어야 하고, 이 부분이 turn 처리의 난이도 대부분을 차지한다 |

### B안 — Spring AI(모델 계층) + LangGraph4j(오케스트레이션)

A안에 상태 그래프 런타임을 얹는다. 스텝을 노드로, 턴을 그래프 실행으로 모델링하고 PostgreSQL 체크포인터로 지속화한다.

| | |
|---|---|
| 얻는 것 | A안 + C·D·E축. **AI 전용 DB가 PostgreSQL 고정**(`02-constraints.yaml` 기술 제약)이라 체크포인터 저장소가 그대로 맞는다. REQ-005·REQ-013·REQ-017의 interrupt/resume이 검증된 패턴으로 들어온다 |
| 남는 것 | `03-glossary.yaml` turn_states의 상태 전이 규칙·대기 유형·만료·재개 제외 규칙, 감사 이력, SQL 통제 |
| 리스크 | **가장 큰 쟁점.** 체크포인트가 우리 턴 이력과 **이중 상태 원천**이 된다. 어느 쪽이 정본인지 정하지 않으면 감사(PRN-07)와 재개(REQ-013)가 어긋난다. 또한 LangGraph4j는 커뮤니티 프로젝트(MIT, 소수 메인테이너)라 L축 리스크가 있다 |

동일 성격의 대안으로 **Spring AI Alibaba Graph**(Apache 2.0, 기업 후원, GA)가 있다. 후원 주체가 뚜렷해 L축은 유리하나, 중국 클라우드 생태계 결합도와 폐쇄망 납품 시 고객사 수용성을 별도로 확인해야 한다.

### C안 — LangChain4j (+ langchain4j-agentic)

모델 계층부터 agentic 워크플로까지 한 라이브러리로 가져간다.

| | |
|---|---|
| 얻는 것 | A~E축을 한 벤더에서. 1.18의 crash-resilient HITL suspend/resume이 D·C축에 직접 대응. Spring 버전 종속이 약해 3.4의 갈림길에서 자유롭다 |
| 남는 것 | B안과 동일 |
| 리스크 | **agentic 모듈이 공식적으로 experimental이다** — 문서가 "모듈 전체가 실험적이며 변경될 수 있다"고 명시한다. 고객사별로 수년 유지되는 구축형 제품(CON-012·CON-013)의 핵심 경로에 두기에는 부담. 모델 계층(안정)만 쓰고 agentic 모듈은 배제하는 축소 채택도 가능하다 |

### D안 — 프레임워크 없이 자체 구현

FEAT-304를 HTTP 클라이언트로 직접 구현.

| | |
|---|---|
| 얻는 것 | 의존성 0. 완전한 통제 |
| 잃는 것 | 공급사별 tool-call 포맷·스트리밍·에러 시맨틱·프롬프트 캐싱 대응을 계속 따라가야 한다. 공급사 API는 계속 바뀐다 |
| 판단 | **권장하지 않는다.** 사용자 지적대로 검증된 것을 응용하는 편이 유리하며, 이 영역은 특히 그렇다 |

### 배제 후보와 사유

| 후보 | 사유 |
|---|---|
| Embabel | GOAP 계획으로 실행 경로를 결정하는 것이 핵심 가치인데, **우리 흐름은 이미 REQ-021에서 단계가 고정되어 있다**(도메인 → 데이터소스 → 테이블 → 컬럼 → SQL). 동적 계획이 필요한 문제가 아니다. 프레임워크의 강점이 우리 문제에 닿지 않는다 |
| Koog | Kotlin 네이티브. 기술 스택에 Kotlin을 추가할 이유가 없다 |
| Google ADK Java / Semantic Kernel Java | 각각 Gemini·Azure 결합이 전제. PRN-05와 폐쇄망 구축형에 맞지 않는다 |
| Python 진영 전체 | 2.1 참조. 사이드카 프로세스 추가 |

---

## 5. 검토 결과 요약

1. **처음부터 만들지 않는다는 방향은 옳다.** 단 대체되는 것은 축 A~H(모델 추상화·도구 루프·상태 지속·개입)이고, **축 I~L(SQL 통제·감사·쿼터·운영)은 프레임워크와 무관하게 남는다.** 이 제품의 난이도는 후자에 몰려 있다. "프레임워크를 쓰면 agent가 만들어진다"는 기대는 성립하지 않으며, **정확히 얼마를 덜어내는지를 알고 쓰는 것**이 이 검토의 목적이다.
2. **가장 확실한 이득은 축 A·B다.** 공급사 추상화와 도구 호출 루프는 어떤 안을 택하든 프레임워크에 맡긴다. 자체 구현할 이유가 없다.
3. **축 C·D(턴 지속·재개·개입)가 유일한 진짜 선택지다.** 우리 `03-glossary.yaml` turn_states·REQ-030~035은 이미 상당히 구체적이고 프레임워크의 기성 모델과 완전히 겹치지 않는다. **그래프 런타임을 도입하면 상태 원천이 둘이 되는 문제**를 먼저 풀어야 하며, 이것이 B·C안의 핵심 검증 항목이다.
4. **축 F(컨텍스트)는 프레임워크 기능을 쓰지 않는 편이 낫다.** `10-requirements.yaml` 질의 처리이 슬라이딩 윈도우를 이미 배제했고, REQ-021의 단계적 축소는 우리 메타데이터(REQ-301~304)에 의존한다.
5. **경계 규칙을 먼저 정한다.** 프레임워크의 모델 추상화는 FEAT-304 **내부 구현**으로 감싸고, 인터페이스는 우리 것을 유지한다(3.3). 이것이 PRN-01·PRN-05·`aidd-guide/standard/hub-conventions.md` §12.5를 지키면서 프레임워크 이득을 취하는 유일한 배치다.

### 5.1 확정 전 확인이 필요한 항목

| # | 항목 | 상태 | 내용 |
|---|---|---|---|
| 1 | **Spring Boot 3 / 4 노선 확정** | **확정** | 최신 안정 버전을 계속 따라간다 → Boot 4 계열, Spring AI 2.0 계열 (3.4) |
| 2 | **상태 원천 단일화 방식** | **해소** | 우리 테이블을 체크포인트 저장소로 만들면 원천이 하나가 된다. [오케스트레이션 PoC](orchestration-poc.md) 2.1에서 실행 확인 |
| 3 | **CLI Provider 실현 수단** | **대안 확보** | CLI 사용이 불가하면 Gemini 무료 API로 대체한다. 단 토큰 한도로 원활한 테스트가 어려울 수 있으므로, 자동 검증은 FEAT-304의 결정적 테스트 구현체(`aidd-guide/standard/hub-conventions.md` §12.9)를 쓴다 |
| 4 | **SQL 파서 선정** | **미확정** | 설정으로 교체 가능한 구조로 간다는 것은 확정. 파서 인터페이스는 우리가 정의하고 구현체를 갈아끼운다. 후보(JSQLParser / Apache Calcite) 선정은 CON-015~032의 DBMS 목록 확정 후 |
| 5 | **폐쇄망 의존성 반입 경로** | **해소** | 로컬 Maven 서버를 제공한다. 참고로 LangGraph4j 채택 시 증분 jar은 2개다 ([오케스트레이션 PoC](orchestration-poc.md) 5.2) |
| 6 | **라이선스·공급망 검토** | **미확정** | Spring AI·LangChain4j·Embabel·Spring AI Alibaba = Apache 2.0, LangGraph4j = MIT. 전이 의존성까지의 확인은 남아 있다 |

### 5.2 다음 단계 제안

> **실행됨 (2026-08-31).** 아래 시나리오를 A안·B안으로 각각 구현해 돌린 결과는 [[오케스트레이션 PoC](orchestration-poc.md)](orchestration-poc.md)에 있다. C·D안은 제외했다.

**문서상의 비교로는 축 C·D를 결정할 수 없다.** 프레임워크의 재개·개입 모델이 `03-glossary.yaml` turn_states의 6가지 상태와 실제로 맞물리는지는 코드로만 확인된다. 1.3의 4단계(agent 설계서) 착수 전에 다음을 확인하는 것이 순서다.

| 확인 항목 | 성공 판정 |
|---|---|
| 한 턴 = 연속 도구 호출 3회 이상, 중간에 승인 대기 1회 | REQ-004·REQ-005 충족 |
| 승인 대기 중 WAS 강제 종료 후 재기동 → 승인 입력 → 이어서 완료 | `03-glossary.yaml` turn_states의 중단·재개, REQ-016 충족 |
| 인스턴스 A가 처리 중인 턴에 인스턴스 B로 중단 요청 → 스텝 경계에서 중단 | REQ-030~035 충족 |
| 위 전 과정의 스텝·토큰·프롬프트가 우리 이력 스키마에 빠짐없이 기록 | PRN-07·J축 충족 |

같은 시나리오를 A·B·C안으로 각각 만들어 비교하면, 각 안이 실제로 얼마를 덜어주고 무엇을 강제하는지가 드러난다. **이 결과가 나온 뒤에 `02-constraints.yaml` 기술 제약·`aidd-guide/standard/hub-conventions.md` §12.5를 개정한다.**

---

## 6. 출처

조사에 사용한 주요 출처다 (2026-08 접근).

- [Spring AI 1.1 GA Released](https://spring.io/blog/2025/11/12/spring-ai-1-1-GA-released/)
- [Spring AI 2.0.0 GA Available Now](https://spring.io/blog/2026/06/12/spring-ai-2-0-0-GA-available-now/)
- [Introducing Agent Client and Agent Bench (Spring AI Agents)](https://spring.io/blog/2025/10/28/agents-and-benchmarks/)
- [LangChain4j — GitHub](https://github.com/langchain4j/langchain4j) / [Agents and Agentic AI 문서](https://docs.langchain4j.dev/tutorials/agents/) / [langchain4j-agentic 모듈](https://github.com/langchain4j/langchain4j/tree/main/langchain4j-agentic)
- [LangGraph4j — GitHub](https://github.com/langgraph4j/langgraph4j) / [Checkpoint (Postgres)](https://langgraph4j.github.io/langgraph4j/core/checkpoint-postgres/)
- [Spring AI Alibaba — GitHub](https://github.com/alibaba/spring-ai-alibaba) / [Graph 소개](https://java2ai.com/en/docs/1.0.0.2/tutorials/graph/whats-spring-ai-alibaba-graph/) / [Human Feedback](https://java2ai.com/en/docs/1.0.0.2/tutorials/graph/human-in-the-loop/)
- [Embabel: A New Agent Platform For the JVM (Rod Johnson)](https://medium.com/@springrod/embabel-a-new-agent-platform-for-the-jvm-1c83402e0014) / [Embabel 1.0 GA](https://www.danvega.dev/blog/embabel-1-0-ga)
- [Java AI agent frameworks in 2026: a practical comparison](https://codewiz.info/blog/java-ai-agent-frameworks-2026/)
- [AI4JVM — Java & JVM AI Ecosystem Guide](https://ai4jvm.com/)
- [The best AI agent frameworks in 2026 (LangChain)](https://www.langchain.com/resources/ai-agent-frameworks)
- [Apache Calcite](https://calcite.apache.org/) / [JSqlParser](https://github.com/JSQLParser/JSqlParser)
- [Java News Roundup (InfoQ, 2026-07) — LangChain4j 1.18](https://www.infoq.com/news/2026/07/java-news-roundup-jul13-2026/)
- [LangChain4j Agentic Workflows (JAVAPRO)](https://javapro.io/2026/07/08/langchain4j-agentic-workflows-from-ai-calls-to-multi-agent-systems-in-java/)
