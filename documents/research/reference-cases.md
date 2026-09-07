# 참고 사례 조사 — 국내외 Agentic AI 구축 사례

| 항목 | 내용 |
|---|---|
| 조사 시점 | **2026-08** (외부 자료 접근 시점) |
| 성격 | **사례 조사** |
| 근거로 쓰인 결정 | **ADR 로 승격된 것은 없다.** §4 의 수용 결정 14건은 되돌리기 비용이 큰 기술 선택이 아니라 제품 요건이어서 `00-charter.yaml`·`10-requirements.yaml`·`31-features.yaml` 에 **직접 반영**됐다. 그 대응이 §4 의 표다 |
| 상위 | GOAL-1(자연어 데이터 조회) · PRN-10(정확도는 메타데이터에서 나온다) · REQ-301~304(업무 메타데이터) |

> **비규범이다.** 여기의 어떤 서술도 설계 제약이 아니다 — 제약은 `documents/spec/` 이 갖는다
> ([산출물 지도 42행](../../aidd-guide/artifact/INDEX.md)).
>
> **`agentic-ai/docs/design/research/01-reference-cases.md` 에서 옮겼다(2026-09-07).**
> 관측과 판단은 그대로 두고 **참조만 현행 ID 로 바꿨다** — `Q-n`→`REQ-0nn` ·
> `ADM/POR/AGT/CMN-nn`→`FEAT-nnn` · `P-n`→`PRN-0n` · `Nn`→`NGOAL-0n` · `Gn`→`GOAL-n` ·
> 없어진 DESIGN-00 의 장·절→해당 spec 항목. 옛 ID 로 되짚을 일이 있으면 이관 커밋을 본다.

---

## 1. 이 문서의 성격

기반 설계 지침서(현행 `documents/spec/`)는 **확정된 결정만** 담는다(개정 절차 — 현행은 `aidd-guide/process/` 가 갖는다). 그 결정의 근거가 된 외부 사례와 판단 과정은 이 문서에 둔다.

- 이 문서는 **규범이 아니다.** 여기의 어떤 서술도 설계 제약이 아니며, 수용하기로 한 것은 전부 현행 `documents/spec/`의 조항으로 옮겨져 있다. 4장이 그 대응표다.
- 사례의 수치는 대부분 **각 사의 자체 측정·발표치**다. 우리 목표 수치의 근거로 사용하지 않는다. 목표값은 P1 실측으로 확정한다 (현행 `documents/spec/` `00-charter.yaml` 성공 기준).
- 조사 시점은 2026-08이다. 이후 갱신하지 않으면 낡는다. 갱신 없이 인용하지 않는다.

---

## 2. 국외 사례

### 2.1 Uber QueryGPT — 사내 자연어→SQL (가장 구조가 가까운 사례)

2023년 사내 해커데이에서 시작해 20회 이상 반복 개선 후 프로덕션에 올렸다. 일 사용자 약 300명, 쿼리 작성 시간 10분 → 3분.

구조가 우리와 거의 같고, **단일 에이전트가 아니라 역할 분해**로 풀었다.

| 구성 | 역할 |
|---|---|
| Intent Agent | 질의를 업무 도메인(workspace)에 매핑해 탐색 범위를 좁힌다. 시스템 workspace 12개 + 사용자 정의 |
| Table Agent | 대상 테이블을 정해 **사용자에게 제시하고 승인·수정받은 뒤** 다음 단계로 넘긴다 |
| Column Prune Agent | 200컬럼·4~6만 토큰짜리 스키마에서 불필요한 컬럼을 LLM으로 잘라낸다. 토큰과 지연 시간이 함께 개선됐다 |
| SQL 생성 | 정제된 스키마와 few-shot 예제로 SQL과 설명을 생성 |

평가 체계를 두 축으로 운영한다 — **vanilla**(의도·데이터셋까지 추론시키는 엔드투엔드)와 **decoupled**(정답 의도·정답 스키마를 주입해 특정 단계만 격리 측정). 지표는 의도 정확도, 테이블 중첩도(0~1), 실행 성공, 결과 검증, 골든 SQL과의 정성 유사도. 평가셋은 **실제 프로덕션 질의를 수기로 검증**해 만들었다.

공개된 한계:

- **환각은 미해결**이다. 존재하지 않는 테이블·컬럼을 생성하는 문제가 남아 있고, 검증 에이전트를 검토 중이다.
- 사용자는 **오타 섞인 5단어 질의**를 던진다. 자연어 질의만으로는 부족해 프롬프트 보강 단계가 필수가 됐다.
- 사용자는 "생성된 쿼리는 당연히 정확할 것"으로 기대한다. 초기 롤아웃 대상 페르소나 선정이 중요했다.

### 2.2 LinkedIn SQL Bot — 정확도의 출처

LangChain·LangGraph 기반 멀티에이전트. 질문 유형별로 전담 핸들러에 라우팅한다.

가장 중요한 발견은 **정확도 9% → 53%의 상승분이 거의 전부 지식 그래프에서 나왔다**는 것이다. 프롬프트 엔지니어링이 아니었다. 지식 그래프는 DataHub 메타데이터, 쿼리 로그, 도메인 지식, **인증된 예제 쿼리**를 테이블을 중심 노드로 엮은 것이다.

파이프라인은 4단계다 — 임베딩 검색으로 후보 20테이블 → LLM 점수화로 7테이블 → SQL 생성 → **쿼리 수정(fixing)**. 마지막 수정 단계가 잘못된 객체 참조를 23% → 1%로, 컴파일 성공률을 96%로 올렸다.

두 가지 반전:

- **정확도 53%인데 사용자 만족은 95%**(40%는 "매우 좋음" 이상). 사용자가 가치를 느낀 것은 완벽한 첫 응답이 아니라 스키마를 이해하고 반복 교정하는 과정이었다.
- **가장 많이 쓰인 기능은 생성이 아니라 실패한 쿼리의 "Fix with AI"** 였다(세션의 80%). 이 발견이 로드맵 전체를 자율 에이전트에서 코파일럿 쪽으로 돌렸다.

그 외:

- 사용자가 직접 성능을 올릴 수 있는 자기 주도 수단 3개를 제공했다 — 데이터 영역 지정, 커스텀 지시, 예제 쿼리 등록. 중앙 팀이 모든 도메인의 컨텍스트를 관리하는 것은 불가능했기 때문이다.
- 사내 분석 플랫폼(DARWIN)에 **임베드하자 사용량이 5~10배**가 됐다.
- 학술 벤치마크(Spider)를 버리고 **자사 질의 133문항 평가셋**을 만들었다. 실제 환경은 테이블 수백만 개, 100컬럼 이상 스키마, 폐기된 테이블, 중복 정보가 섞여 있어 학술 난이도와 다르다.

### 2.3 Pinterest Text-to-SQL

과거 분석가 쿼리를 "이 쿼리가 답하려던 업무 질문"이라는 **의도 임베딩**으로 변환해 재사용한다. 사내 도구 중 사용량 1위. (원문 접근이 차단되어 2차 요약 기준이다. 인용 시 원문 재확인 필요.)

### 2.4 Klarna — 되돌린 사례

자율 상담 에이전트로 대화 수백만 건을 처리하고 티켓의 3분의 2를 해소, 해결 시간 11분 → 2분, 연 4천만 달러 이익 개선을 발표하며 상담 인력을 5,000명에서 3,500명으로 줄였다. 2025년 5월 방향을 되돌려 사람을 재고용했다. 고객 불만은 "일반론적 답변"과 복잡·예외 케이스 처리 실패였다.

지적된 원인은 모델 성능이 아니라 **아키텍처**다. "확신이 없으니 지금 사람에게 넘기고, 맥락을 전부 전달한다"는 경로가 프로덕션에 없었다. 정리된 교훈은 자동화율이 아니라 **자동화된 부분의 품질을 목표로 삼아야 한다**는 것 — 규제·업무 환경에서는 자동화 50%·정확도 98%가 자동화 75%·정확도 90%보다 낫다. 최종 형태는 AI 축소가 아니라 "AI + 보장된 사람 경로"였다.

### 2.5 프로덕션 공통 실패 양상

2026년 들어 데모에서 프로덕션으로 넘어가며 드러난 양상으로 다음이 반복 보고된다 — 비용 폭주, 잘못된 액션 실행, 루프에 갇힘, 사람이라면 승인하지 않을 판단. 통제 없는 에이전트 하나가 감지되기 전 $50~500를 태운다는 보고가 있고, 기업의 96%가 초기 예상 LLM 비용을 초과했다는 조사도 있다.

성공 사례의 공통점으로 지적되는 것:

- **만능 에이전트가 아니라 좁게 정의된 전문 에이전트의 네트워크.** 입력·출력이 정의된 단위로 쪼개고, 하나의 에이전트가 전체 워크플로우를 지지 않게 한다.
- **망가진 프로세스에 에이전트를 얹으면 빠르게 망가진 프로세스가 된다.** 워크플로우를 먼저 식별하고 의사결정 지점을 전부 매핑한 뒤, "처음부터 에이전트를 위해 설계했다면 어떤 모양일까"를 묻는다.
- **이미 측정하고 있는 지표가 있는 업무를 고른다.** 전후 비교가 반박 불가능해진다.
- 오류 비용이 큰 지점에는 사람을 남긴다.

참고 지표로 IBM AskHR(일반 문의 봉쇄율 94%, 티켓 75% 감소), JPMorgan LLM Suite(일 20만 명, 450개 이상 use case)가 인용된다.

### 2.6 의미 계층(Semantic Layer)과 MCP

2026년 업계 흐름은 **에이전트가 테이블에 직접 raw SQL을 쓰지 않게 하는 방향**이다. 인증된 메트릭과 조인 경로를 이름으로 호출하게 하고, 행·역할 권한을 **쿼리 컴파일 시점에 강제**해 애초에 권한 밖 데이터를 질의할 수 없게 만든다. MCP는 그 메트릭을 발견·질의하는 표준 통로로 자리 잡았고, 2026년 1월 OSI v1.0(의미 계층 정의의 벤더 중립 포맷)이 공개됐다.

우리 `22-authz.yaml`의 SQL 통제 4단계는 사후 검증형이고, `22-authz.yaml` 운영 가이드의 "뷰 분리 / 카탈로그 제외 + 조회 API"가 같은 개념의 초기 형태다. 이 흐름에서 취한 것은 프로토콜(MCP)이 아니라 **인증된 쿼리를 우선 경로로 두고 자유 SQL을 폴백으로 내리는 2단 구조**다 (현행 `documents/spec/` REQ-301~304).

### 2.7 "AI 파일럿 95% 실패" 조사 — 취급 주의

경영진 인터뷰 52건, 리더 설문 153명, 공개 배포 사례 300건 분석을 근거로 기업 생성형 AI 파일럿의 95%가 ROI를 내지 못한다고 보고됐다. 실패 원인으로 부서별 고립 배치(공유 컨텍스트 없음, 운영 데이터 미연동, 시스템 간 실행 불가), 거버넌스·성공 지표 부재, 영업·마케팅 편중 예산을 든다. "외부 벤더 주도 67% 성공 vs 내부 구축 33% 성공"도 함께 인용된다.

**표본이 작고 반박도 많다.** 방향성 참고용이며, "그러니 자체 구축하지 말라"는 결론의 근거로는 쓰지 않는다. 우리는 벤더 제품을 만드는 쪽이기도 하다. 취할 것은 실패 원인 목록 — 특히 고립 배치와 지표 부재 — 뿐이다.

---

## 3. 국내 사례

| 사례 | 내용 |
|---|---|
| **신한은행 감정평가서 AI 점검 Agent** | 금융권 최초. 부동산 담보대출 심사의 감정평가서를 LLM+OCR+RPA로 인식해 항목 간 정합성과 추가 확인 필요 사항을 분석. 자체 측정으로 건당 점검 시간 약 70% 감소, 일 처리량 약 3배. **범용 챗봇이 아니라 좁은 업무 하나를 끝까지 자동화한 형태** |
| **KB금융 그룹 공동 GenAI 포털** | 금융권 최초의 그룹 공동 생성형 AI 플랫폼. 상품 개발·리스크 관리 등 17개 업무에 적용하며 운영 방식을 에이전트 기반으로 재설계 중. 금융상담·PB·RM 에이전트(은행), 자산관리·상담지원 에이전트(증권)를 우선 개발. **여러 계열사·업무를 한 플랫폼에 모으는 방향이 우리 GOAL-0와 같다** |
| **삼성SDS / LG CNS** | FabriX(에이전트 플랫폼)·Brity Works, 공공 부문 AX 사례. 공개된 성과 중 "수백 건 데이터 수집에 1인 12시간 → 약 20분"이 있는데, 원인을 모델이 아니라 **업무 프로세스를 AI 기준으로 재설계한 것**으로 설명한다 |
| **KT&G** | CRM·커머스·멤버십·물류·상담으로 흩어진 데이터를 Customer 360으로 **먼저 통합**한 뒤 에이전트로 확장. 에이전트보다 데이터 통합이 선행 과제였던 사례 |
| **제조·물류** | 반도체 생산 에이전트가 장비 가동률·공정 제약·수율을 반영해 생산 배치를 실시간 재계획(기존 수십 시간). SCM AI Forum에서 "레거시(ERP/WMS)를 활용한 공급망 AX"가 주제로 다뤄지고, CJ대한통운 등 물류 현장 적용이 진행 중. **우리 idea.txt의 WMS 예시(적치·할당·피킹)와 같은 결** |

### 3.1 폐쇄망·온프레미스 관련 (idea.txt의 미해결 질문에 대한 업계 답)

공공기관 생성형 AI 도입은 세 갈래로 정리된다.

| 방식 | 내용 | 지적된 문제 |
|---|---|---|
| AI DLP·차단 | 외부 모델 사용을 막거나 전송 데이터를 검사 | 활용 범위가 좁다 |
| sLLM 자체 구축 | 오픈 웨이트 모델을 폐쇄망에 배치 | 초기 7~13억 원 + **최신 상용 모델과의 성능 격차가 누적** |
| **게이트웨이** | 단일 통로로 외부 모델을 호출하고 그 지점에서 보호 기법을 적용 | 비용·성능 균형은 좋으나 **내부 보호 기법의 수준이 규정 정합성을 결정** |

KISA는 2026 기업용 AI 보안 가이드라인에서 금융·의료·공공의 에어갭 환경 구축을 권고한다.

우리 구조(PRN-01 단일 경로 + FEAT-304 + REQ-106 전송 데이터 정책 + CON-012·CON-013 아웃바운드 단일 통로)는 이미 **게이트웨이 방식**이며, ARCH-040의 임베딩 모델 폐쇄망 배치 옵션과 CON-012·CON-013의 "폐쇄망 내 모델 배치를 대안으로 제공"이 sLLM 선택지에 해당한다. 이 항목에서 추가로 수용한 것은 없고, **기존 결정이 업계 표준과 일치함을 확인**한 것이다.

---

## 4. 수용 결정과 반영 위치

사례에서 도출해 현행 `documents/spec/`에 반영한 항목이다. 이 표가 두 문서를 잇는 유일한 연결점이다.

| # | 수용한 것 | 근거 사례 | 현행 `documents/spec/` 반영 위치 |
|---|---|---|---|
| 1 | 정확도의 출처는 업무 메타데이터다. 업무 명칭·설명·코드 체계·예제 쿼리를 핵심 산출물로 격상 | 2.2 (9%→53%), 2.1 | **PRN-10**, REQ-301~304, FEAT-003, FEAT-023 |
| 2 | 업무 도메인 단위 묶음으로 컨텍스트 범위를 단계적으로 축소 (도메인 → 데이터소스 → 테이블 → 컬럼) | 2.1 (workspace, Column Prune) | REQ-021, REQ-301~304, FEAT-202, FEAT-024 |
| 3 | 인증 예제 쿼리를 **우선 경로**로 두고 자유 SQL 생성을 폴백으로 내림 | 2.2, 2.6 | REQ-301~304, FEAT-023, FEAT-219, NFR-001~005 |
| 4 | 실행 전 **조회 계획**을 업무 용어로 제시하고 자연어로 교정받음. 물리명·SQL 원문은 비노출 | 2.1 (Table Agent) — 단, 물리명 노출은 우리 사용자층에 맞게 변형 | **REQ-022·REQ-023**, `22-authz.yaml`(노출 통제), FEAT-108, FEAT-218 |
| 5 | 생성 SQL 원문 열람은 그룹 통제 선택 기능. 편집·직접 실행은 불허 | 2.2 (Fix with AI) — 개발자 대상 기능이라는 판단으로 축소 수용 | `22-authz.yaml`(노출 통제), FEAT-110 |
| 6 | 성공한 턴에 대한 **결과 교정 재요청**을 1급 기능으로 | 2.2 (세션의 80%가 수정 경로) | **REQ-024**, FEAT-109 |
| 7 | 확신 없을 때 추측 금지. 확인 요구 또는 처리 불가 응답, 이를 실패로 집계하지 않음 | 2.4 (Klarna), 2.1 (환각 미해결) | **REQ-025**, `00-charter.yaml` 성공 기준(정확성·절제) |
| 8 | 자율 처리 비율을 단독 목표로 삼지 않음. 정확성·절제를 유효성보다 앞에 둠 | 2.4 | `00-charter.yaml` 성공 기준 |
| 9 | 평가셋과 회귀 평가를 기능으로 보유. 단계별 + 전체 채점, 외부 벤치마크 미사용 | 2.1 (vanilla/decoupled), 2.2 (자사 133문항) | FEAT-034, `aidd-guide/standard/hub-conventions.md` §12.9 |
| 10 | 레거시 화면에서 팝업으로 진입하는 딥링크 | 2.2 (임베드 후 5~10배) — iframe 임베드는 배제하고 팝업으로 한정 | ARCH-010~015(진입 경로), FEAT-101, CON-015~032 |
| 11 | 스텝 **역할** 단위 모델 선택. 주 추론은 턴 시작 시점 고정, 보조 판정은 관리자 지정 고정값, 자동 난이도 라우팅 배제 | 2.5 (비용 폭주) | ARCH-040(역할별 모델 선택), 5.1, FEAT-015, NFR-010~017 |
| 12 | 프롬프트 캐시를 위한 컨텍스트 조립 순서 고정, 턴 상한 잔여의 컨텍스트 노출 | 2.5 | ARCH-040, NFR-010~017 |
| 13 | 대상 업무 선정과 프로세스 재설계, 기준선 지표 확보를 착수 협의 항목으로 | 3(삼성SDS), 2.5 | CON-015~032 |
| 14 | 사용자가 자기 도메인의 재사용 자산을 직접 쌓게 하고, 그중 유용한 것을 관리자가 조직 자산으로 승격 | 2.2 (자기 주도 커스터마이징 3종), 2.3 (과거 쿼리 재사용) | REQ-201~207, FEAT-025, FEAT-023 |

### 4.1 수용하지 않은 것

| 사례의 요소 | 수용하지 않은 이유 |
|---|---|
| 물리 테이블·컬럼명을 사용자에게 제시하고 직접 고르게 하기 (2.1의 Table Agent 원형) | 우리 사용자는 업무 담당자다. 물리명은 판단에 도움이 되지 않고 노출 자체가 정보다. 업무 명칭 기반 조회 계획으로 대체 (REQ-022) |
| SQL 원문을 일반 사용자에게 노출하고 편집·실행하게 하기 (2.2의 Fix with AI 원형) | 개발자용 기능이다. 사용자가 고친 SQL을 실행하면 `22-authz.yaml`의 통제 전제와 감사 이력의 의미가 함께 흔들린다. 열람만 그룹 통제로, 교정은 자연어로 (FEAT-110, REQ-024) |
| iframe으로 레거시 화면에 대화창 삽입 | 고객사별 CSS·스크립트 충돌 대응이 무한히 늘어난다. 별 창 팝업 하나로 고정 (ARCH-010~015) |
| 자동 난이도 판정 기반 모델 라우팅 | 판정 자체가 추가 LLM 호출이고 비결정적이다. 비용은 줄지 않고 같은 질의가 매번 다른 모델로 처리된다 (ARCH-040) |
| MCP를 연동 프로토콜로 채택 | 레거시 연동은 REST로 고정했다 (NGOAL-08). 의미 계층 흐름에서 취한 것은 프로토콜이 아니라 인증 쿼리 우선 구조다 |
| 자율 처리율·티켓 봉쇄율류의 지표를 성공 기준 상단에 두기 | 2.4가 그 지표로 잘못된 방향에 최적화한 사례다 |
| 벤더 주도가 내부 구축보다 성공률이 높다는 결론 | 2.7의 표본 한계. 우리 상황(벤더 제품 개발)에 적용되지 않는다 |

---

## 5. 출처

### 국외

- [QueryGPT – Natural Language to SQL Using Generative AI (Uber Blog)](https://www.uber.com/us/en/blog/query-gpt/)
- [What LinkedIn Learned Building an AI Data Agent for 300+ Weekly Users](https://www.getdot.ai/blog/linkedin-sql-bot-data-agent)
- [How we built Text-to-SQL at Pinterest](https://medium.com/pinterest-engineering/how-we-built-text-to-sql-at-pinterest-30bad30dabff) (직접 접근 차단, 2차 요약 기준)
- [Unified Context-Intent Embeddings for Scalable Text-to-SQL (Pinterest)](https://medium.com/pinterest-engineering/unified-context-intent-embeddings-for-scalable-text-to-sql-793635e60aac)
- [How Klarna's AI Agent Strategy Backfired But Became A Useful Lesson (Forbes)](https://www.forbes.com/sites/bernardmarr/2026/07/16/how-klarnas-ai-agent-strategy-backfired-but-became-a-useful-lesson/)
- [AI Agent Production Failures: Enterprise Lessons](https://www.openempower.com/blog/ai-agent-production-failures-enterprise-lessons-2026)
- [7 enterprise AI agent use cases in production (2026)](https://ecorpit.com/enterprise-ai-agents-production-use-cases-2026/)
- [Semantic Layer + MCP: The Architecture Behind Trustworthy AI Analytics](https://www.polaranalytics.com/post/mcp-semantic-layer-ai-analytics)
- [Semantic Layer for AI Agents (Cube)](https://cube.dev/articles/semantic-layer-for-ai-agents-2026)
- [AI Agent Cost Optimization: Token Budgets, Model Routing, and Production FinOps](https://zylos.ai/research/2026-04-12-ai-agent-cost-optimization-token-budget-model-routing/)
- [MIT Report Finds 95% of AI Pilots Fail to Deliver ROI](https://www.legal.io/blog/5719519/MIT-Report-Finds-95-of-AI-Pilots-Fail-to-Deliver-ROI-Exposing-GenAI-Divide) / [반론](https://www.marketingaiinstitute.com/blog/mit-study-ai-pilots)

### 국내

- [신한은행, 금융권 최초 '감정평가서 AI 점검 Agent' 도입](http://www.opinionnews.co.kr/news/articleView.html?idxno=142494)
- [시중은행, AI 현장 접목…KB국민, '그룹 공동 생성형AI 플랫폼' 구축](https://www.psnews.co.kr/news/articleView.html?idxno=2085728)
- [삼성SDS·LG CNS, 공공기관 업무혁신 이끈다… AI 에이전트 격돌](https://www.asiatoday.co.kr/kn/view.php?key=20260624010008545)
- [국내 기업 5곳이 증명한 AI 마케팅 자동화 성공 사례 (Salesforce Korea)](https://www.salesforce.com/kr/blog/agentforce-digital-summit-2026-korea-marketing-case-study/)
- [Thinking Supply Chains — AI Agents의 시대 (삼성SDS)](https://www.samsungsds.com/kr/insights/thinking-supply-chains-part2.html)
- [공급망 불확실성 시대, 'AI 솔루션'에서 답을 찾다 (KLNews)](https://www.klnews.co.kr/news/articleView.html?idxno=321489)
- [공공기관 생성형 AI 도입의 세 가지 길](https://llmcapsule.ai/resources/learn/public-sector-genai-three-approaches-in-korea)
- [기업 맞춤형 경량화 LLM? 새로운 AI 도입 트렌드 sLLM (SK C&C)](https://www.skcc.co.kr/insight/trend/2766)
- [2026 에이전트 AI 트렌드 (SK AX)](https://www.skax.co.kr/insight/trend/3624)
