---
id: LLM-IDX-000
title: "aidd-guide — 마스터 진입점 (11 카테고리)"
category: root
type: operation
created: 2026-05-04
updated: 2026-09-06
status: active
sources: []
tier: 1
tags: [index, routing, master, decision-tree]
---

# aidd-guide — 마스터 진입점

> **헌법은 [`CLAUDE.md`](../CLAUDE.md) 가 갖는다.** 여기는 **AI 가 읽는 규칙**의 단일 원본이다 —
> *프로젝트를 어떻게 굴리나*(프로세스)와 *코드를 어떻게 쓰나*(개발 표준)가 한 지붕 아래 있다.
> `CLAUDE.md` §3 이 요청 종류별로 이 INDEX 의 어느 카테고리로 들어갈지 정한다.
>
> **단일 입구 정책**: 한 사실은 한 곳에서만 정의. 다른 카테고리는 링크.
> **사람이 읽는 안내는 [`user-guide/`](../user-guide/INDEX.md) 다** — 같은 주제라도 *지킬 규칙* 은
> 여기, *따라할 절차* 는 그쪽이다.

## 폴더 넷 — 나누는 축은 *주제* 가 아니라 **누가 읽나** 다

```
ai-agent/
├── aidd-guide/   ★ AI 가 읽는 규칙 — 프로세스(단계·게이트·추적성) + 개발 표준(백엔드·프론트·레시피)
├── documents/    ★ AI 가 만드는 산출물 — spec(SSOT) · 결정 · 화면 문서 셋 · 생성 문서
├── user-guide/   ★ 사람이 읽는 안내 — 수행 방법 · 환경 구축 · 개발 · 빌드·배포 · 운영
└── sources/      ★ 코드 — 백엔드 · 프론트엔드. 빌드 루트가 여기다
```

**`aidd-guide` 는 *어떻게 하는가*, `documents` 는 *무엇을 만드는가* 다.** 갈릴 때 대는
판별식은 하나다 — **고객사가 바뀌어도 그대로 쓰는가?** 예면 `aidd-guide`, 아니면 `documents`.
코딩 방법 · 설정을 바꾸는 방법 · 프로세스를 진행하고 사용자와 합의하는 방법 · **산출물의
서식**은 다음 고객사에서도 그대로 쓰므로 여기다. 이 프로젝트가 만들 업무 기능의 **결정과
지식**은 프로젝트와 함께 닫히므로 저쪽이다.

- 그래서 [`knowledge/sys/`](./knowledge/INDEX.md) 열하나가 여기 있다 — 템플릿이 이미 준
  기능이 *어떻게 동작하고 어떻게 설정을 바꾸나* 이며, 이것을 모르면 AI 가 **있는 기능을
  다시 만든다.**
- 그래서 **서식은 [`artifact/template/`](./artifact/template/02-requirements.md) 이고
  채운 것은 `documents/` 다.**
- **`user-guide/` 와 헷갈리지 않는다.** 같은 주제라도 *AI 가 지킬 규칙* 은 여기, *사람이
  따라할 절차* 는 그쪽이다. 한쪽에 적었으면 다른 쪽은 **링크만** 둔다.
- **`sources/` 가 빌드 루트다.** 문서에 적는 **파일 경로는 저장소 루트 기준**
  (`sources/backend/...`)이고, **빌드 명령은 `sources/` 기준**이다.

## 이 가이드는 두 저장소를 합친 것이다

| 물려받은 것 | 어디서 | 무엇을 |
|---|---|---|
| **프로세스** — 단계·게이트·질문 규약·추적성·변경 관리 | ai-driven-development (AI-SDLC) | 요구사항 수집부터 인수까지, *언제 무엇을 승인받나* |
| **개발 표준** — 백엔드·프론트 규약·레시피·도메인 지식 | ordinary-backoffice | 승인 뒤 *코드를 어떻게 쓰나* |

**둘의 접합부가 `artifact/` 다.** 프로세스가 *무엇을 만들라* 고 말하고, 산출물 지도가
*어디에 어떤 형식으로* 를 말하며, 개발 표준이 *그것을 코드로 어떻게 옮기나* 를 말한다.
→ [`CLAUDE.md`](../CLAUDE.md)

## 작업 시작 결정 트리 (Routing-as-Code)

```
질문/요청 도착
  ↓
① 무엇을 하려는가?
  ├─ "규칙·헌법·금지·우선순위"                → CLAUDE.md (여기 아님)
  ├─ "개발 환경 구축 · 빌드 · 배포 · 운영 절차" → user-guide/ (여기 아님)
  │
  │  ── 프로세스 ──────────────────────────────────
  ├─ "지금 어디인가 · 다음에 무엇을"           → documents/project.state.yaml · /pm-status
  ├─ "단계별로 무엇을 하나"                    → phase/         P0~P6 플레이북
  ├─ "게이트·역할·질문·추적성·결정·변경"       → process/       방법론 열하나
  ├─ "무엇을 언제 어디에 만드나 · 문서 예산"   → artifact/      산출물 지도 40
  ├─ "화면 요건서를 쓴다 · 무엇을 물어야 하나" → artifact/screen/  절차 + Overlay 7
  │
  │  ── 개발 표준 ────────────────────────────────
  ├─ "스택·패키지·아키텍처·시드·빌드"          → standard/      공통
  ├─ "서비스 이름·트랜잭션·API 경로·영속화"    → standard/backend/
  ├─ "그리드·조회폼·공통물·i18n·테마"          → standard/frontend/
  ├─ "PII·인젝션·secrets·rate-limit"           → standard/safety/
  ├─ "CRUD·마스터디테일·엑셀·모달·시드 레시피" → playbook/      레시피 여덟
  ├─ "표가 무엇을 담나 · 이 말이 무슨 뜻인가"  → knowledge/     표 34 · 용어
  │
  │  ── 품질과 운영 ──────────────────────────────
  ├─ "테스트 설계·레드팀·뮤테이션·중복률"      → quality/
  ├─ "프롬프트 품질 검증·골든셋·회귀"          → quality/evals/
  ├─ "라우팅 정확도·토큰 비용·Context Rot"     → quality/observability/
  ├─ "훅·스킬·서브에이전트·문맥 예산·로그"     → harness/
  │
  ↓
② 해당 카테고리의 INDEX.md 진입 (Progressive Disclosure)
  ↓
③ INDEX 가 지정한 파일만 seek-read (JIT Context · 전체 로드 금지)
```

## 카테고리 카탈로그

| 카테고리 | 역할 | Tier | 문서 |
|---|---|---|---|
| [meta](meta/INDEX.md) | 메타블록·200줄·라우팅·문서 스타일 | 3 | 5 |
| [process](process/01-overview.md) | 방법론 — 역할·질문·게이트·추적성·결정·변경·인지부채·검증비용 | 1 | 12 |
| [phase](phase/P0-inception.md) | P0~P6 실행 플레이북 | 1 | 7 |
| [artifact](artifact/INDEX.md) | **산출물 지도 40 = 문서 예산** · 템플릿 · 화면 요건서 절차 | 1 | 22 |
| [standard](standard/INDEX.md) | 백엔드·프론트 표준의 상세와 근거 | 2 | 40 |
| [playbook](playbook/INDEX.md) | 화면 레시피 (샘플 여섯과 대응) | 2 | 10 |
| [quality](quality/INDEX.md) | 테스트 설계 · 레드팀 · 코드 품질 · 골든셋 · 관측 | 2 | 13 |
| [knowledge](knowledge/INDEX.md) | 표 34개 — 인가·코드·문구·이력·운영 | 3 | 14 |
| [harness](harness/INDEX.md) | 훅 · 스킬 · 문맥 예산 · 로그 — **지금 무엇이 있나는 [user-guide/07-harness.md](../user-guide/07-harness.md)**(생성물) | 2 | 14 |


**`문서` 는 그 폴더의 `.md` 개수다**(하위 폴더 · `INDEX.md` 포함). `lint.mjs` 가 실제와 대조한다 — 전에는 `운용` 이었는데 무엇을 세는지가 적혀 있지 않아 **아홉 중 여섯이 어긋나 있었다**(`standard` 는 48 대 36).
## SSoT 우선순위 (정보 충돌 시)

1. **현재 소스 코드** — 가장 신뢰
2. **`documents/spec/`** — 아직 구현되지 않은 것의 진실
3. **`aidd-guide/`** — 표준·패턴·프로세스
4. **`documents/` 생성 문서 · chat-history 요약 / 기억** — 검증 후 사용

> **규칙과 사실은 다투지 않는다.** *무엇이 참인가* 는 위 순서가 정하고,
> *무엇을 해야 하는가* 는 [CLAUDE.md](../CLAUDE.md) 가 정한다 (단일 정의처).

## ID 체계 (LLM-{CAT3}[-{SUB3}]-{NNN})

| Prefix | 카테고리 | 예 |
|---|---|---|
| LLM-IDX | 루트 인덱스 | LLM-IDX-000 |
| LLM-MET | meta | LLM-MET-001 |
| **LLM-PRO** | **process** | LLM-PRO-001 |
| **LLM-PHS** | **phase** | LLM-PHS-000 |
| **LLM-ART** | **artifact** (템플릿 포함) | LLM-ART-IDX |
| LLM-PMT | artifact/screen (`-OVR` 서브) | LLM-PMT-001 |
| LLM-FWK | standard (`-BE`/`-FE` 서브) | LLM-FWK-BE-001 |
| LLM-SAF | standard/safety | LLM-SAF-001 |
| LLM-PLY | playbook | LLM-PLY-001 |
| **LLM-QLT** | **quality** | LLM-QLT-001 |
| LLM-EVL | quality/evals | LLM-EVL-001 |
| LLM-OBS | quality/observability | LLM-OBS-001 |
| LLM-KNW | knowledge (`sys/` 서브) | LLM-KNW-SYS-001 |
| LLM-HRN | harness | LLM-HRN-001 |
| LLM-CTX | harness/context | LLM-CTX-001 |
| LLM-MEM | harness/memory | LLM-MEM-001 |

- 학습 자산은 `S` 접미사: `LLM-CTX-S001` 형태.
- **ID prefix 는 한 번 발급하면 변경 금지** — `status: deprecated|replaced` 로만 처리한다.
  폴더 이름이 번호를 잃고(`06-framework` → `standard`) 이름을 얻었어도 **ID 는 그대로 두었다**:
  ID 는 불변 앵커이고, 이미 다른 문서와 소스 주석이 그 번호를 가리키고 있다.
- **산출물의 ID 는 여기가 아니라 [`process/05-traceability.md`](process/05-traceability.md) 가 갖는다** —
  `REQ-` · `UC-` · `FEAT-` 는 프로젝트의 것이고 `LLM-` 은 이 가이드의 것이다. 두 체계는 섞이지 않는다.

## 사용 규약 (한 곳에서만 정의)

- **운용 파일** (`type: operation`) 은 200줄 이내, **UTF-8 (BOM 없음)**, LF, 메타블록 필수.
- **명시 예외는 하나** — 200줄 제한의 `meta/_meta/lint.mjs` 의 `LENGTH_EXEMPT` **셋**.
  조건은 [`meta/doc-style.md`](meta/doc-style.md) 가 갖는다.
  **`node aidd-guide/meta/_meta/lint.mjs` 는 위반 0 이어야 한다.**
- 카테고리 간 **중복 정의 금지** — 정의 1곳, 나머지는 링크.
- 메타블록 표준은 [`meta/meta-block.md`](meta/meta-block.md), 200줄 정책은
  [`meta/doc-style.md`](meta/doc-style.md), 라우팅 3계층은 [`meta/routing.md`](meta/routing.md).

## 변경 가이드

- 새 운용 파일을 추가했다면 (1) 카테고리 INDEX 에 링크 추가 (2) 영향 받는 결정 트리
  분기 검토 (3) `lint.mjs` 초록 확인. **파일 목록을 따로 유지하지 않는다** — 사람이
  유지하는 목록은 반드시 낙고, 낙은 목록은 없는 것보다 나쀼다.
- **위 카탈로그의 수는 `INDEX.md` 를 뺀 운용 파일 수다.** 세는 기준이 행마다 갈리면 어느 쪽도 믿을 수 없게 된다.
- 카테고리 구성 자체를 바꾸려면 헌법([CLAUDE.md](../CLAUDE.md)) 수준의 결정. **ADR 로 남긴다.**
