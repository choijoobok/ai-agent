---
id: LLM-HRN-001
title: "훅 카탈로그 — 하나하나가 무엇을 보고 무엇을 말하나"
category: harness
type: operation
created: "2026-05-04"
updated: 2026-10-28
status: active
sources: ["aidd-guide/harness/capabilities.yaml", ".claude/hooks/", ".codex/hooks.json"]
tier: 2
tags: [harness, hooks, gate, automation]
---

# 훅 카탈로그 — 하나하나의 상세

> **무엇을 언제 · 왜 강도가 넷인가**는 [automation-matrix.md](./automation-matrix.md) 가 갖는다.
> 여기는 **각 훅이 실제로 무엇을 보고 무엇을 말하는가** 다.
>
> **배선과 `lib.mjs` 계약, 새 훅을 더할 때의 규칙**은 [hooks-contract.md](./hooks-contract.md)
> 가 갖는다 — 200줄 상한에 닿아 갈랐다.
>
> **현재 목록은 생성물이다** — [`developer-guide/07-harness.md`](../../developer-guide/07-harness.md).
> 손으로 적은 목록은 훅을 더할 때마다 낡고, **낡은 목록은 없는 것보다 나쁘다**.

## 진입 조건

- 훅이 막았는데 **왜 막았는지** 모를 때
- 어떤 훅이 무엇을 보는지 알아야 할 때 — **목록·패턴을 고치기 전에**
- 훅이 **안 도는 것 같을** 때는 [hooks-contract.md](./hooks-contract.md) 쪽이다

## `guard-generated` — 생성물 손편집 차단

**본다**: 쓰려는 경로가 생성물 목록에 있는가. **말한다**: 고칠 곳 · 돌릴 태스크 · changeset 경고.

| 생성물 | 다시 만드는 태스크 | 고칠 곳 |
|---|---|---|
| `003-init-menu.csv` | `generateMenuSeed` | `menu-tree.yaml` |
| `006-init-api.csv` · `007-init-menu-api.csv` | `generateApiSeed` | 컨트롤러 `@RequestMapping` · `endpoints.ts` |
| `008-init-message-key.csv` | `generateMessageSeed` | `messageKeys.ts` · `MsgKey.java` |
| `902-*` · `904-*` (샘플 대량) | `generateSampleBulkSeed` | 태스크 파라미터 |

- **목록은 손으로 유지한다.** 원본은 `sources/backend/bootstrap/build.gradle.kts` 의 생성 태스크다 — 태스크가 파일을 더하면 훅에도 더한다. 스스로 계산하지 않는 이유는 Gradle 스크립트를 파싱해야 하고, **틀리게 파싱한 훅은 아무것도 안 막는 훅**이기 때문이다.
- 차단인 이유: 손편집이 성공하면 다음 생성에서 되돌아가는데, 그 사이 `checkSeeds` 가 초록이었다면 **고친 사람은 고쳐졌다고 믿는다**.

## `guard-commit` — 커밋 범위와 만든 주체를 확정한다

**본다**: 명령을 `\n ; & | && ||` 로 자른 뒤 **각 조각의 시작 자리에 있는 `git commit`** 만. 조각의 **첫 줄까지만** 인자로 센다.

| 걸리는 것 | 왜 |
|---|---|
| `-m` · `-F <파일>` | 메시지 본문과 provider trailer를 훅이 확인할 수 없다 |
| `-a` · `--all` | 추적 중인 모든 변경을 담는다 |
| `--` 가 없다 | 경로 없는 커밋 — 낡은 인덱스가 **남의 커밋을 되돌린다** |
| `-F -`가 아니거나 · trailer·제목 형식·언어가 틀리다 | 본문 · 만든 주체 · **무엇을 왜 했나**를 확인할 수 없다 |
| `--ff-only` 없는 pull · 자동 commit/squash merge | 충돌 영향·확인·검증 전에 통합되거나 이력이 사라진다 |

- **두 가지 좁힘이 없으면 훅이 자기 자신의 커밋을 막는다**: 문자열 안에 우연히 든 `git commit`(예: `echo`), here-string 본문에 든 `--` 나 `-m "`.
- POSIX heredoc과 PowerShell here-string pipe를 모두 읽는다. Claude는 마지막 trailer 묶음의 `Agent: Claude` + 정해진 `Co-Authored-By:`, Codex는 마지막 줄 `Agent: Codex`여야 한다. 제목은 `<타입>: <현상> — <조치>` 이고 **제목·본문 모두 한국어**여야 한다(§5-3) — trailer 는 영문 키라서 언어를 묻지 않는다. **허용 타입 열하나의 원본은 AGENTS.md §5-3 이고 훅은 집행만 한다** — 목록을 늘리려면 거기를 먼저 고친다.
- pull은 `--ff-only`, 통합은 `git merge --no-commit`만 허용하고 squash·`merge --continue`는 막는다. merge 상태에서는 예외적으로 `git commit -F -`를 쓰며, 실제 충돌이 있었으면 `[충돌 통합]`의 `영향`·`확인`·`검증`을 모두 요구한다.

## `normalize-encoding` — BOM · CRLF 교정

**본다**: 방금 쓴 파일의 첫 글자가 `\uFEFF` 인가, `\r\n` 이 섞였는가. **한다**: 고치고 알린다.

| 예외 | 근거 |
|---|---|
| `*.bat` · `*.cmd` | `.gitattributes` 의 `text eol=crlf` — CRLF 여야 안전하다 |
| `png jpg jpeg gif ico pdf woff woff2 jar` | `.gitattributes` 의 `binary` |
| `zip class xls xlsx` | `.gitattributes` 에는 **없다** — 훅 쪽이 넓다. 텍스트로 읽어 다시 쓰면 깨지는 것들이라 훅이 먼저 막는다 |

- **줄끝 규칙을 훅에서 다시 정의하지 않는다** — CRLF 예외는 `.gitattributes` 가 정한 그대로다.
- **바이너리는 확장자로만 거른다**(내용을 읽지 않는다). 목록에 없는 바이너리를 쓰면 훅이 텍스트로 다시 쓴다 — 새 바이너리 확장자가 저장소에 들어오면 **`.gitattributes` 와 훅 양쪽에 더한다.**
- 쓰기에 실패하면 막지 않고 *고치지 못했다* 고 알린다.

## `doc-drift` — 소스 ↔ 기능/API/화면 문서 경고

변경 소스를 `sources`·`source_contract`·`@feat`/`@scr`에 대조하고, 공통 사용 관계의 모든
소비 기능·화면을 따라간다. 메뉴 없는 화면도 `current_doc`·`target_doc`으로 찾는다.
기존 화면 레지스트리와 컨트롤러→endpoints 연결도 합치며 첫 메뉴에서 멈추지 않는다.

- 정본 문서가 없거나 화면 요건서 승인 상태가 아니면 해당 경로와 필요한 검토를 알린다.
- 목업은 파생물이므로 존재 여부로 결손을 판정하지 않는다. 공통 화면에 독립 매뉴얼을 강제하지 않는다.
- 문서·테스트 파일 변경은 이 훅 대상이 아니다. 한 문서당 세션에 한 번만 알린다.
- 기능·API·데이터·TC·운영 정본 전체는 `trace-check --source <저장소 상대 경로>`로 조회한다.
- **기록된 연결만 계산한다.** 미등록 소비자·동적 호출·실제 API 전수 일치·업무 의미는 대조해야 한다.
- 일치하면 문서를 고치지 않는다. 달라지면 정본·소스를 같은 변경에 담고 파생물을 다시 만든다.

## `guide-drift` — `sources:` 에 이 파일을 적은 가이드 문서 경고

**`doc-drift`와 축이 다르다.** doc-drift는 제품 기능/API/화면 정본을,
이 훅은 공통 구현을 설명하는 가이드를 가리킨다. 가이드도 같은 변경에서 대조한다.

**역인덱스는 새로 만들지 않는다** — 가이드 문서 메타블록의 `sources:` 가 그것이다.
그 값이 낡으면 `lint.mjs` 가 잡는다(실물과 맞지 않는 엔트리는 위반이다).

- **축약 경로를 허용한다.** `sources/backend/api/error/` 의 실물은 `.../api/src/main/java/com/aiagent/api/error/` 다 — 모듈 안쪽의 관례 경로를 접는다. **세그먼트가 순서대로 나타나면** 맞는 것으로 본다.
- **폴더 엔트리는 세그먼트 넷 이상만 넣는다.** `sources/frontend/src/` 는 *프론트 전부* 를
  주장하는 값이고, 그것까지 태우면 프론트를 건드릴 때마다 같은 이름이 떠 **경고가
  배경음**이 된다.
- **파일 엔트리에는 그 문턱을 걸지 않는다.** 문턱의 목적이 *너무 넓은 값을 빼는 것* 인데
  파일은 하나를 가리키므로 넓을 수가 없다. 세그먼트로만 재면 `AGENTS.md`(하나) ·
  `sources/build.gradle.kts`(둘) · `.claude/hooks/log-mask.patterns`(셋)처럼 **가장 구체적인
  값이 가장 먼저 빠진다** — 실제로 그랬고, 그 엔트리 서른한 개가 아무것도 하지 않았다.
- **테스트는 통과한다.** 계약을 바꾸지 않는다.
- **한 문서당 세션에 한 번만** 말한다 — `os.tmpdir()/ai-agent-guide-drift/{세션}.txt`.
  `doc-drift` 와 같은 이유이며 같은 방법이다.

### `sources/` 밖도 본다 — 판단을 뒤집었다

한때 **`sources/` 로 시작하지 않으면 즉시 통과**했다. *가이드 자신을 고치는 것은
드리프트가 아니라 그 반대다* 라는 이유였고, **엔트리가 소스 경로뿐일 때는 맞았다.**

역인덱스에는 다른 것들도 있다 — 가이드가 가이드를(`logging.md` → `packages.md`), 문서가
설정을(`safety/pii.md` → `log-mask.patterns`), 문서가 헌법을(`conventions.md` → `AGENTS.md`)
근거로 적은 값들이다. **그쪽은 반대 방향이 쓸모 있는 방향이다**: 근거가 바뀌면 그것을
근거로 규약을 적은 문서가 낡는다. 그래서 문구를 둘로 나눴다.

| 고친 것 | 무엇을 묻나 |
|---|---|
| `sources/**` | 선언 이름·기본값·규칙이 달라졌나 |
| 그 밖 | **그 문서가 인용한 이름·기본값·절**이 아직 여기 있나 |

**자기 자신은 뺀다.** `lint.mjs` 가 자기 참조를 막지만 검사보다 훅이 먼저 도는 순간이
있고, 그때 *이 문서를 고쳤으니 이 문서를 보라* 고 말하면 훅 전체가 우스워진다.

**`AGENTS.md` 를 고치면 여섯이 뜬다** — 가장 많이 인용되는 파일이라서다. 배경음이 아니라
**그 여섯이 헌법을 근거로 규약을 적었다는 사실**이며, 세션에 한 번씩만 뜬다.

**이름을 바꾼 것이라면** 옛 이름에 `@deprecated {@link 새이름}` 을 달아 둔다 — `lint.mjs` 가
**그것을 아직 가르치는 문서를 전부 열거한다**([standard/frontend/packages.md](../standard/frontend/packages.md) §3).
경고를 읽고 넘길 수 있는 이 훅과 달리 그쪽은 **차단**이다.

## `log-raw` — 대화 원문 append

**남긴다**: `chat-history/YYYY-MM/raw/YYYY-MM-DD.md` 에 append only(AGENTS.md §10 · [harness/memory/logs.md](./memory/logs.md)).

| 이벤트 | 무엇을 남기나 | 어디서 얻나 |
|---|---|---|
| `UserPromptSubmit` | `### USER` — 사람의 말 | 훅 입력의 `prompt` 그대로 |
| `Stop` | `### AI` — AI 의 말 | **transcript 를 읽는다** — AI 의 말은 훅 입력에 오지 않는다 |

- **아무 말도 하지 않는다.** 매 턴 도는 훅이라 한 마디라도 내면 그 말이 모든 턴에 쌓이고, 특히 `UserPromptSubmit` 의 표준 출력은 **모델의 문맥에 그대로 들어간다.**
- **조용히 실패한다.** 모든 예외를 삼킨다 — 로그를 못 남기는 것보다 나쁜 것은 **로그 때문에 작업이 멈추는 것**이다.
- **`thinking` 과 `tool_use` 는 남기지 않는다.** 원문은 대화이지 작업 내역이 아니고, `tool_use` 의 인자에는 파일 내용이 통째로 실려 **로그가 저장소 사본이 된다.**
- **서브에이전트(`isSidechain`)의 말은 남기지 않는다** — 사람과의 대화가 아니다.
- **워터마크로 겹쳐 적기를 막는다.** `Stop` 은 한 턴에 두 번 이상 설 수 있다. 마지막으로 남긴 assistant `uuid` 를 `os.tmpdir()/ai-agent-log-raw/{세션}.txt` 에 둔다 — 기록이 아니라 *어디까지 적었나* 라서 저장소에 두지 않는다.
- **마스킹은 규칙 파일이 정한다** — [`.claude/hooks/log-mask.patterns`](../../.claude/hooks/log-mask.patterns), 한 줄에 정규식 하나. 걸린 줄은 **통째로** `***MASKED***` 가 된다. 값만 지우면 앞뒤 문맥이 그 값을 되살린다.
- **마스킹이 있다고 붙여 넣어도 되는 것이 아니다.** 패턴은 아는 모양만 잡는다.

> **`let` 선언을 실행 블록 아래에 두지 않는다.** 마스킹 규칙의 memo 를 아래에 두었더니 첫 턴이 TDZ 로 죽었고, **조용히 실패하도록 만들어 둔 탓에 그 죽음이 보이지 않았다.** 조용한 훅일수록 손으로 한 번 돌려 확인한다.

## `guard-shell-write` — 셸이 쓰는 경로도 파일 게이트에 태운다

**본다**: 셸 명령에서 뽑은 쓰기 대상(리다이렉션 · `tee` · `sed -i` · `cp`/`mv` · `touch` · `dd of=` · PowerShell `Out-File`/`Set-Content` 계열). 그 경로로 `guard-write`·`guard-generated` 를 **그대로** 돌린다 — 여기에 새 정책은 없다. **못 보는 것**(스크립트가 자기 안에서 여는 파일 등)과 fixture 는 [hooks-contract.md](./hooks-contract.md) 가 갖는다.

## `git-sync` — 세션 시작에 원격을 당긴다

**깨끗한 트리에서 `startup` 일 때만** `git pull --ff-only` 를 돌린다. 더러우면 당기지 않고 이유와 다음 할 일을 말하며, 이력이 갈렸으면 `integrate-main`으로 보낸다 — 미커밋 변경 위로 남의 커밋을 얹을지는 **사람의 판단**이고(AGENTS.md §5-2), 푸시는 사용자가 말할 때만이다(§9). `session-brief`는 현재 `pending_rechecks` 전부와 최근 `[충돌 통합]` 커밋 세 건을 함께 넣는다. Codex는 매 세션 시작에 훅을 CLI에서 반드시 승인하고 새로 승인했다면 Windows 앱에서 새 세션 창을 열라는 주의 문구를 CLI 경고로 내며, Windows 앱에서는 첫 사용자 요청의 `final_answer` 첫 줄에 같은 문구를 세션당 한 번만 표시한다. `commentary`에 먼저 표시했더라도 첫 최종 응답에서 다시 표시하지만, 이전 assistant `final_answer`에 이미 표시됐다면 이후 응답에서는 반복하지 않는다. 시작·재개 상태 문구는 `Codex 훅 승인 상태 확인`이다. 승인 상태·revision을 자동 검사하거나 그 결과로 작업을 제어하지 않는다. 상세 절차와 fixture는 [hooks-contract.md](./hooks-contract.md)가 갖는다.

## 컨텍스트 관리 — 같은 목적, 다른 구현

공통 목적은 **성능이 무너지기 전에 작업 연속성을 보존하는 것**이다. token 관측값과 압축 lifecycle이 provider마다 다르므로 구현 동일성을 요구하지 않는다.

### Claude Code — 사용량 조기 경보

**자동 압축은 마지막 안전망이지 조기 경보가 아니다.** 관측된 발동 지점이
`preTokens: 1006239` 로 창의 100% 근처이며, 그때의 압축은 *무엇을 남길지 고를 여지가 없는*
압축이다. 이 훅은 그 앞에서 한 번 말한다.

| | |
|---|---|
| **언제** | `UserPromptSubmit` |
| **무엇을** | 직전 assistant 의 `message.usage` 합 — **어림이 아니라 실측**. 압축도 자동 반영 |
| **분모** | `1_000_000` — 관측값이며 **다시 재는 방법이 소스 주석에 있다** |
| **임계** | **60%.** 손으로 친 압축 55건의 중앙값이 592,134(59.2%)라 그 습관에 맞췄다 |
| **하는 일** | `/compact` 를 권한다. **막지 않는다** |

- **`Stop` 이 아닌 이유**: 훅의 stdout 이 모델에게 닿는 이벤트는 넷뿐이고
  (`UserPromptSubmit` · `UserPromptExpansion` · `SessionStart` · `PostModelSwitch`)
  **`Stop` 은 그중에 없다** — 거기서 낸 평문은 디버그 로그로만 간다. 재는 값은 *직전 턴이
  끝난 시점* 의 것이므로 "턴 종료 시 실측" 과 같고, 말은 다음 턴 첫머리에 나간다.
- **임계 아래에서는 아무것도 출력하지 않는다.** 문맥을 재는 일이 문맥을 갉아먹으면 안 된다.
- **5%p 마다 한 번씩만 말한다.** 넘긴 뒤 매 턴 말하면 그것이 곧 소음이다. 워터마크는
  `os.tmpdir()/ai-agent-context-gauge/{세션}.txt` 이며 `log-raw` · `doc-drift` 와 같은 방식이다.
- **압축하면 다시 말할 수 있게 워터마크를 낮춘다** — 압축 뒤 또 차오르는 것이 정상이다.

### Codex — 자동 압축 뒤 재주입

Codex에는 수치 경고 훅을 연결하지 않는다. hook의 안정된 입력에 실제 token usage가 없고, 임의 추정 백분율은 실측처럼 보이기 때문이다. 자동 또는 수동 압축 뒤 `SessionStart(source=compact)`가 즉시 실행되며 `session-brief`가 프로젝트 상태·현재 단계·하네스 정합성을 다시 넣는다. 압축 이벤트 자체를 경고로 만들지 않는다 — 정상 lifecycle을 소음으로
만들 이유가 없다. 상세는 [`providers/codex.md`](./providers/codex.md)가 갖는다.

## 관련

- [hooks-contract.md](./hooks-contract.md) — 배선 · `lib.mjs` · 새 훅을 더할 때
- [automation-matrix.md](./automation-matrix.md) — 무엇을 언제 · 강도가 왜 넷인가
- [memory/logs.md](./memory/logs.md) — `log-raw` 가 남기는 것
