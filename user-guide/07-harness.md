# 07. 훅과 스킬 — 지금 무엇이 있나

> **이 파일은 생성물이다. 손으로 고치지 않는다** — 다음 생성에서 사라지고, 훅이 막는다.
> 정본은 `.claude/` 의 실물이며 `node .claude/hooks/harness-doc.mjs --write` 가 만든다.
> `.claude/` 아래를 고치면 **훅이 스스로 다시 만든다.**
>
> **여기는 *지금 무엇이 있나* 다.** *왜 그렇게 만들었나* 는
> [`aidd-guide/harness/hooks.md`](../aidd-guide/harness/hooks.md) 와
> [`skills.md`](../aidd-guide/harness/skills.md) 가 갖는다 — 같은 사실을 두 번 적지 않는다.

---

## 훅 — 12 개가 걸려 있다

**강도는 그 훅이 실제로 부르는 함수에서 계산한다** — 주석에 적힌 말이 아니다.

| 이벤트 | 언제 | 훅 | 하는 일 | 강도 | 제한 |
|---|---|---|---|---|---|
| `SessionStart` | — | `session-brief` | 세션이 열릴 때 지금 어디인가를 문맥에 넣는다 | 문맥에 넣는다 | 15s |
| `PreToolUse` | `Write\|Edit\|NotebookEdit` | `guard-write` | 쓰기의 다섯 사고를 막는다 | **차단** · 경고 | 15s |
| `PreToolUse` | `Write\|Edit\|NotebookEdit` | `guard-generated` | 생성물을 손으로 고치는 것을 막는다 | **차단** | 10s |
| `PreToolUse` | `Bash\|PowerShell` | `guard-bash` | 되돌릴 수 없는 명령을 막는다 | **차단** | 15s |
| `PreToolUse` | `Bash\|PowerShell` | `guard-commit` | 커밋의 두 사고를 막는다 | **차단** | 10s |
| `PostToolUse` | `Write\|Edit` | `normalize-encoding` | BOM 과 CRLF 를 방금 쓴 파일에서 걷어낸다 | 경고 | 10s |
| `PostToolUse` | `Write\|Edit` | `trace-check` | 추적성 검사 — `PostToolUse`(`documents/spec/**` 쓰기) 훅 겸 `/trace` 스킬의 실행기. | 경고 | 30s |
| `PostToolUse` | `Write\|Edit` | `doc-drift` | 화면 소스를 고치면 그 화면의 문서를 대조하라고, 요건서가 승인 전이면 승인부터 받으라고 알린다 | 경고 | 15s |
| `PostToolUse` | `Write\|Edit` | `guide-drift` | 공통물·표준 소스를 고치면 그것을 설명하는 가이드 문서를 대조하라고 알린다. | 경고 | 15s |
| `PostToolUse` | `Write\|Edit` | `harness-doc` | 훅·스킬 목록을 `user-guide/07-harness.md` 로 만든다 | **차단** · 경고 | 10s |
| `UserPromptSubmit` | — | `log-raw` | 대화 원문을 `chat-history/` 에 append 한다 | 조용히 한다 | 10s |
| `UserPromptSubmit` | — | `context-gauge` | 컨텍스트 게이지 — 문맥이 차오르면 압축할 여지가 남아 있을 때 알린다. | 문맥에 넣는다 | 10s |
| `Stop` | — | `log-raw` | 대화 원문을 `chat-history/` 에 append 한다 | 조용히 한다 | 15s |

- **전부 fail-open 이다** — 훅이 죽어도 세션을 막지 않는다. 죽은 훅이 세션을 막으면
  사람이 훅을 끄고, 꺼진 훅은 없는 훅이다.
- **`node` 하나로 돌며 의존성이 없다.**

### 걸리지 않은 것 — 손으로 부른다

| 파일 | 하는 일 | 언제 |
|---|---|---|
| `quality-check` | 코드 품질 기계 검사 — 슬라이스 미니게이트(G4)의 기계가 세는 부분. | 필요할 때 `node .claude/hooks/quality-check.mjs` |

---

## 스킬 — 13 개

슬래시로 부른다. **AI 가 정해진 절차를 따르게 하는 지시서**이며, 사람이 외울 것이 아니다.

| 부르는 법 | 무엇을 | 언제 쓰나 |
|---|---|---|
| `/adr` | 아키텍처 의사결정 기록(ADR)을 작성한다. | 되돌리기 비용이 큰 기술·설계 선택을 대안·근거·포기한 것과 함께 남긴다. 기술 스택, DB, 인증, 아키텍처 스타일 등을 정할 때 사용. |
| `/change-request` | 베이스라인 이후의 변경 요청(CR)을 처리한다. | 영향 분석, 3옵션 제시, 사용자 판정, spec 반영, 재작업 범위 산정. G3 승인 후 설계나 요구사항을 바꿔야 할 때 사용. |
| `/doc-gen` | documents/spec/ 의 YAML에서 사람이 읽는 산출물 문서를 생성한다. | 요건정의서, 유즈케이스 명세, ERD, API 문서, 화면정의서, 권한 매트릭스, 테스트 케이스, 사용자 매뉴얼 등을 documents/generated/ 아래에 만든다. |
| `/interview` | 현재 단계에서 사용자에게 물어야 할 것을 질문 배치로 만들어 제시한다. | 각 질문에 권장안·영향범위·되돌리기비용을 붙인다. 정보가 부족해 진행이 막혔을 때 사용. |
| `/kickoff` | 새 시스템 구축 프로젝트를 시작한다. | 사용자가 "○○ 시스템을 만들고 싶다"고 할 때 AI-SDLC 방법론에 따라 P0 착수를 개시하고, 프로젝트 뼈대와 첫 질문 배치를 만든다. |
| `/manual-site` | 화면별 manual.md 에서 사용자 메뉴얼 산출물을 만든다 — 저장소용 manual.html·열람 페이지와, 고객사에 통째로 복사해 전달하는 build/manual/ 폴더(화면 그림 포함 · 인쇄용 PDF · 선택 PPTX). 메뉴얼을 고친 뒤, 제출본을 만들 때, 실제 화면을 캡처해 넣을 때 쓴다. | "메뉴얼 HTML" · "메뉴얼 사이트" · "제출본" · "PDF" · "PPT" · "화면 캡처" 요청에 쓴다. |
| `/menu-doc` | 메뉴 화면의 문서(requirements.md · manual.md)를 시작하거나, 소스와 대조해 현행화하거나, 전체 화면의 결손 현황을 센다. | 새 화면 착수 전 요건서를 쓸 때, 화면 소스를 고친 뒤 문서를 맞출 때, "화면 문서" · "요건서" · "메뉴얼" 을 만들거나 점검하라는 요청에 쓴다. 목업은 /mockup 이 요건서에서 생성한다. |
| `/mockup` | 화면 목업(mockup.html)을 요건서에서 생성하거나, 있는 목업이 요건서·메뉴얼과 어긋나지 않는지 검사한다. | 요건서를 고친 뒤 목업을 맞출 때, 새 화면의 목업을 처음 만들 때, "목업을 만들어" · "목업 다시 그려" · "목업 검사" 요청에 쓴다. 목업은 파생물이라 형상 관리에 없으므로 /manual-site 를 돌리기 전에 이 스킬로 먼저 만든다. |
| `/phase-gate` | 단계 게이트를 점검하고 통과를 요청한다. | Exit Criteria 자체검증 → 레드팀 자기반박 → 사용자 승인 요청의 4단계를 실행한다. 한 단계를 마치고 다음으로 넘어갈 때 반드시 사용. |
| `/pm-status` | 프로젝트 현재 상태를 보고한다. | 지금 어느 단계인지, 게이트 상태, 미결 질문, 진행 중 슬라이스, 다음 할 일을 한 화면에 정리한다. 세션 시작 시나 "지금 어디까지 됐어?" 물을 때 사용. |
| `/redteam` | 현재 산출물을 적대적으로 검토한다. | AI가 자기가 만든 설계·요구사항·코드를 인수 심사자 입장에서 공격해 실패 시나리오, 누락, 사용자가 반대할 지점을 찾아낸다. 게이트 전이나 중요 산출물 완료 후 사용. |
| `/slice` | 수직 슬라이스 하나를 구현한다. | 스펙 재확인 → 테스트 먼저 → DB → API → UI → 테스트 통과 → 미니게이트 순으로 진행한다. P4 구현 단계에서 기능 하나를 만들 때 사용. |
| `/trace` | 추적성 체인을 검사한다. | REQ→UC→FEAT→ENT/API/SCR→TC 연결이 끊긴 곳, 고아 산출물, 미실현 요구사항, dangling ID를 찾아 보고하고 추적성 매트릭스를 생성한다. |

### 스크립트를 가진 스킬

| 스킬 | 스크립트 | 직접 돌리려면 |
|---|---|---|
| `/manual-site` | `build.mjs` | `node .claude/skills/manual-site/build.mjs` |
| `/manual-site` | `capture.mjs` | `node .claude/skills/manual-site/capture.mjs` |
| `/menu-doc` | `screens.mjs` | `node .claude/skills/menu-doc/screens.mjs` |
| `/mockup` | `scaffold.mjs` | `node .claude/skills/mockup/scaffold.mjs` |
| `/pm-status` | `deferred.mjs` | `node .claude/skills/pm-status/deferred.mjs` |

