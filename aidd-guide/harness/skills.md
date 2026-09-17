---
id: LLM-HRN-002
title: "스킬 카탈로그 + 작성 규약"
category: harness
type: operation
created: "2026-05-04"
updated: "2026-09-15"
status: active
sources: ["aidd-guide/harness/skill-src/", ".claude/skills/", ".agents/skills/"]
tier: 2
tags: [harness, skill, workflow, convention]
---

# 스킬 카탈로그 + 작성 규약

> 스킬은 **절차의 단일 정의처**다. 여러 세션에서 같은 순서로 해야 하는 일이 매번 즉흥이면
> 조금씩 다르게 되고, 그 차이는 산출물에 남는다.
>
> **각 스킬의 상세는 그 `SKILL.md` 가 갖는다.** 여기는 *무엇이 있고 언제 부르나* 와 *새로 만들 때의 규약* 이다.

## 진입 조건

- 반복 절차를 스킬로 만들지, 훅으로 만들지, 문서로 둘지 판단할 때
- 새 스킬을 만들거나 기존 스킬의 절차를 고칠 때
- 스킬이 **안 불릴 때** — 대개 `description` 문제다

## 스킬 카탈로그

### 프로젝트를 굴리는 것 — 단계와 게이트

| 스킬 | 언제 부르나 |
|---|---|
| [`kickoff`](./skill-src/kickoff.md) | 새 시스템 구축을 시작할 때 — P0 를 세운다 |
| [`interview`](./skill-src/interview.md) | 물어야 할 것을 질문 배치로 만들 때 |
| [`phase-gate`](./skill-src/phase-gate.md) | 단계 게이트를 점검하고 통과를 요청할 때 |
| [`pm-status`](./skill-src/pm-status.md) | *지금 어디까지 왔나* 를 보고할 때 |
| [`slice`](./skill-src/slice.md) | 수직 슬라이스 하나를 구현할 때 — 테스트 먼저 |
| [`integrate-main`](./skill-src/integrate-main.md) | 같은 main의 pull·merge·충돌 해결과 후속 검증 위임 |
| [`change-request`](./skill-src/change-request.md) | 베이스라인 뒤의 변경 요청 — 영향 분석과 3옵션 |
| [`adr`](./skill-src/adr.md) | 되돌리기 비용이 큰 결정을 기록할 때 |
| [`harness-sync`](./skill-src/harness-sync.md) | 스킬·훅을 양쪽에 추가하거나 누락을 복구할 때 |

### 산출물을 만들고 검사하는 것

| 스킬 | 언제 부르나 | 원본 → 파생 |
|---|---|---|
| [`doc-gen`](./skill-src/doc-gen.md) | spec YAML 에서 읽는 문서를 만들 때 | `documents/spec/{논리문서}/` → `documents/generated/` |
| [`menu-doc`](./skill-src/menu-doc.md) | 새 화면 착수 전 요건서 · 소스 변경 뒤 문서 대조 · 전수 결손 점검 | 원본이 둘(`requirements.md` · `manual.md`) |
| [`mockup`](./skill-src/mockup.md) | 요건서를 고친 뒤 · 승인용 그림이 필요할 때 · `manual-site` 앞 | `requirements.md` → `mockup.html` |
| [`manual-site`](./skill-src/manual-site.md) | 메뉴얼을 고친 뒤 · 사용자 매뉴얼을 확인할 때 · 화면을 캡처해 넣을 때 | `manual.md` + 목업/캡처 → 내부 검토 `build/deliverables/user/` · 사용자 독립본 `build/deliverables-user/` |
| [`runbook`](./skill-src/runbook.md) | 운영 절차를 세우거나 P6 인수 전 완결성을 검사할 때 | `80-operations/` → `80-운영런북.md` |
| [`deliverable-site`](./skill-src/deliverable-site.md) | 설계·사용자·운영 고객 제출 사이트와 선택 PDF를 만들 때 | 정본/파생 Markdown + 목업/캡처 → `build/deliverables/` |
| [`trace`](./skill-src/trace.md) | 추적성 체인이 끊긴 곳을 찾을 때 | — (검사) |
| [`doc-consistency`](./skill-src/doc-consistency.md) | 여러 문서의 사실·책임·규칙이 서로 어긋나는지 정기 또는 통합 뒤 점검할 때 | — (검사) |
| [`redteam`](./skill-src/redteam.md) | 자기가 만든 산출물을 적대적으로 검토할 때 | — (검사) |

**화면 셋이 한 사슬이다**: `requirements.md` → `/mockup` → `/manual-site`. 앞의 것을 고치면 뒤를 다시
만든다 — 그리고 **뒤의 것을 고쳐 앞을 바꾸지 않는다.** 파생물은 형상 관리에 없어(AGENTS.md §4-5)
새로 클론한 트리에는 목업도 메뉴얼 HTML 도 **없는 것이 정상**이다.

- 규칙은 [AGENTS.md §6](../../AGENTS.md) 가, 문서의 **형식**은 [`aidd-guide/artifact/template/`](../artifact/template) 의 머리 주석이 갖는다.
- 인자 없이 `/menu-doc` 을 부르면 **전수 점검**이다 — 화면별 문서 유무를 한 표로 낸다.

## 훅 · 스킬 · 플레이북의 경계

| | 무엇 | 누가 시작하나 | 예 |
|---|---|---|---|
| **훅** | 어겼는지 **검사**하거나 **기록**한다 | 도구 호출·턴이 자동으로 | [hooks.md](./hooks.md) 의 다섯 |
| **스킬** | 여러 단계를 **순서대로** 해낸다 | 사람 또는 AI 가 부른다 | `/integrate-main` · `/menu-doc` |
| **플레이북** | 화면 하나를 **어떻게 만드나** | AI 가 읽는다 | [playbook](../playbook/INDEX.md) |

> **한 가지를 셋 중 둘에 두지 않는다.** 스킬이 코드 표준을 다시 적으면 플레이북과 갈리고,
> 갈린 둘은 어느 쪽이 참인지 알 수 없게 된다.

## 작성 규약

### 정본과 발견 경로

```
aidd-guide/harness/skill-src/{이름}.md    공통 정본
.claude/skills/{이름}/SKILL.md            Claude 생성물
.agents/skills/{이름}/SKILL.md            Codex 생성물
.claude/skills/{이름}/*.mjs               기존 공용 실행기(점진 이전)
```

두 provider의 `SKILL.md` 직접 편집은 `guard-generated`가 막는다. 공통 원본을 고친 뒤
`sync-skills.mjs --write`로 다시 만든다.

### `description` 은 *무엇을 하나* 가 아니라 *언제 불릴 것인가* 다

- **트리거 어휘를 실제로 나열한다** — `"문서 셋"` · `"요건서"` · `"제출본"` · `"PDF"` · `"화면 캡처"`.
  스킬 이름만 적으면 사용자가 이름을 모를 때 **영원히 안 불린다**.
- 산출물과 시점을 함께 적는다. 두 스킬의 `description` 이 그 형태의 실물이다.

### 형식을 재정의하지 않는다

- 스킬은 **순서와 대조 방법**을 정한다. 문서의 섹션 구성·작성 원칙은 템플릿이 갖는다.
- 표준을 옮겨 적으면 표준이 둘이 된다 — 링크한다(AGENTS.md §6.2 · 단일 입구 정책).

### 원본은 하나, 나머지는 파생

- **파생물을 손으로 고치지 않는다.** 다음 생성에서 사라진다(AGENTS.md §5-11).
- 모양을 바꿔야 하면 **생성기를 고친다**(세 제출 사이트는 `artifact/site-kit/assets/`).
- 제출본(`build/`)은 **담지 않는다**(§8). 정본과 생성기를 커밋하고 필요할 때 다시 만든다.

### 스크립트는 의존성 없이 돈다

- `node` 하나로 서야 한다 — 폐쇄망에서 `npm i` 없이 도는 것이 전제다(AGENTS.md §1).
- **무거운 의존은 옵션이고, 없을 때의 길이 반드시 있어야 한다.** `capture.mjs` 는 playwright 가 필요하고
  로컬 앱·계정까지 요구하지만, **없으면 목업 그림으로 메뉴얼이 나온다.** 전제가 없으면 산출물도 없는
  스킬은 폐쇄망에서 없는 스킬이다.
- 자격증명은 **인자나 환경변수로만** 받는다. 소스에 적지 않는다.

### 실물 목록을 스킬이 늘리지 않는다

- 화면의 원본은 `screenRegistry.ts` 와 `menu-tree.yaml` 이다. `screens.mjs` 는 **읽을 뿐**이다.
- **거기 없는 화면은 없는 화면이다** — 대상이 목록에 없으면 거기서 멈추고 **사용자에게 묻는다**.
  화면을 먼저 등록할 일인지 경로를 잘못 들은 것인지는 판단이다(AGENTS.md §3).

### 보고는 문제부터

- 결손·불일치를 먼저 쓰고 잘된 것은 뒤에 짧게(AGENTS.md §5-10).
- **빈 점검 결과를 채우려고 산출물을 새로 만들지 않는다.** 무엇을 만들지는 사용자가 정한다.
- 생성기가 검사할 수 있는 것에는 끝이 있다 — 고객 브라우저와 PDF 뷰어에서 최종 열람을 확인한다.

## 새 스킬을 만들 때

1. `harness-sync`를 호출하고 **추가 게이트를 먼저 통과한다** — [tool-curation.md](./tool-curation.md).
2. 훅·플레이북과 경계가 겹치지 않는지 확인한다.
3. 공통 원본을 먼저 만들고 `description`에 실제 트리거 어휘를 넣는다.
4. 절차만 적고 형식·표준은 링크한다. provider 전용 문법은 생성기나 provider 문서가 갖는다.
5. `sync-skills.mjs --write`와 `harness-check.mjs`를 실행한다.
6. 이 파일과 [INDEX.md](./INDEX.md)의 카탈로그를 갱신하고 두 runtime에서 trigger를 확인한다.

## 관련

- [INDEX.md](./INDEX.md)
- [hooks.md](./hooks.md) — 훅 하나하나의 상세
- [automation-matrix.md](./automation-matrix.md) — 자동화 vs AI 책임
- [tool-curation.md](./tool-curation.md) — 도구 추가 게이트
- [playbook](../playbook/INDEX.md) — 화면 레시피
