---
id: LLM-HRN-008
title: "훅 계약 — 배선 · lib.mjs · 새 훅을 더할 때"
category: harness
type: operation
created: "2026-09-06"
updated: "2026-09-15"
status: active
sources: ["aidd-guide/harness/capabilities.yaml", ".claude/hooks/", ".claude/settings.json", ".codex/hooks.json"]
tier: 2
tags: [harness, hooks, contract, wiring]
---

# 훅 계약 — 배선 · `lib.mjs` · 새 훅을 더할 때

> **훅을 만들거나 고칠 때** 읽는다. *어떤 훅이 있고 각각 왜 그런가*는 [hooks.md](./hooks.md)가 갖는다 — 갈린 축은 **읽는 이유**다: 여기는 만드는 사람, 저기는 막힌 사람이 온다.

## 정본과 구현

| 층 | 정본 | 책임 |
|---|---|---|
| 공통 의미 | 이 문서 · [`capabilities.yaml`](./capabilities.yaml) | 목적·강도·실패 정책·동등성 |
| 공통 스킬 | `skill-src/*.md` | 절차와 trigger |
| Claude adapter | `.claude/settings.json` | Claude 이벤트·입력·컨텍스트 게이지 |
| Codex adapter | `.codex/hooks.json` · `.codex/hooks/` | `apply_patch` 정규화·압축 뒤 재주입 |
| 정책 엔진 | `.claude/hooks/*.mjs` | 역사적 경로를 유지한 공용 Node 로직. 화면 역인덱스는 `screen-registry.mjs` 하나를 훅·스킬이 함께 쓴다 |
| 공통 chain | `runtime/chains.mjs` | 실행 순서의 유일한 원본 — manifest·adapter·생성 문서가 함께 읽는다 |
| spec-set 로더 | `runtime/spec-set.mjs` | 논리 spec 이름을 기존 단일 YAML 또는 분할 폴더로 읽는 유일한 원본 |
| 사전 진입 | `runtime/pretool-bootstrap.mjs` | 파일 chain이 import 전부터 깨져도 차단하고 훅 파일 수리만 연다 |
| 셸 파싱 | `runtime/shell-parse.mjs` | **따옴표 안이 데이터인가 명령인가** — `guard-bash`·`guard-commit`이 함께 읽는 유일한 원본 |

`spec-set`은 `이름.yaml`과 `이름/_index.yaml` 중 하나만 허용한다. 폴더형은 명시적 `parts` 순서로 병합하며 미등재 YAML·중복·폴더 이탈·값 덮어쓰기를 실패시킨다. 새 공용 로직부터 `runtime/`에 둔다.

## 배선

| 이벤트 | Claude | Codex | 공통 결과 |
|---|---|---|---|
| `SessionStart` | `session-start` chain | `session-start`(`startup`) · `session-brief`(`resume\|clear\|compact`) | `git-sync` → `session-brief` |
| `PreToolUse` 파일 | `pre-write` chain | `file-chain` | `guard-write`(기능 소유 작업흐름 G3) → `guard-generated` |
| `PreToolUse` shell | `pre-shell` chain | `pre-shell` chain | 파괴 명령·커밋 사고 차단 → **셸이 쓰는 경로를 파일 chain 에 태운다** |
| `PostToolUse` 파일 | `post-write` chain | `file-chain` | 인코딩 → 추적성 → 문서 현행화 |
| `UserPromptSubmit` | `log-raw` + `context-gauge` | `log-raw` | 사용자 대화 기록 |
| `Stop` | `log-raw` | `log-raw` | AI 대화 기록 |

- **배선은 도구 이름으로 선다 — 그래서 무엇을 덮는지 세지 않으면 도구를 바꾸는 것만으로 게이트가 사라진다.** `harness-check`가 provider별 대표 도구 이름(Claude의 `Write`·`Edit`·`NotebookEdit`, Codex의 `apply_patch`, 양쪽의 shell·MCP 쓰기)을 각 matcher 정규식에 실제로 먹여 본다. 새 쓰기·셸 도구가 생기면 그 목록에 먼저 더한다. **파일 쪽만 MCP를 덮고 셸 쪽을 두면 같은 구멍이 남는다** — 2026-09-14 실측에서 `Bash`로 막힌 명령이 MCP `start_process`로 그대로 돌았다.
- **셸 chain이 보는 것은 `tool_input.command` 하나다.** 셸을 *새로 여는* MCP 도구는 덮지만 이미 열린 REPL에 이어 넣는 입력(`interact_with_process`의 `input`)은 못 본다 — 그 자리는 사후 chain과 사람이 본다. 같은 matcher의 command hook은 동시 실행될 수 있으므로, 순서가 필요한 정책은 handler를 여러 개 배선하지 않고 **chain 하나**가 직렬 실행한다.
- **같은 chain에는 같은 timeout을 준다.** 예산이 갈리면 좁은 쪽의 뒤쪽 훅이 잘리므로 `harness-check`가 파일 chain 둘을 비교한다.
- 실행은 `node` 하나다. `package.json`도 `node_modules`도 보지 않는다(AGENTS.md §1).
- 사전 보호 chain에서 내부 오류가 나면 차단한다. 사후 chain 오류는 되돌릴 수 없으므로 경고한다.
- **정책의 원본은 훅 코드가 아니다.** 차단·교정·경고의 근거는 먼저 `AGENTS.md` 또는 `aidd-guide/`에 있어야 하고, 훅은 그 규칙을 기계적으로 집행한다. matcher와 입력 정규화 같은 구현 상세만 훅이 단독으로 가질 수 있다.
- `trace-check` 강도는 `process/05-traceability.md`가 정한다. T2·T5·T7의 P3 설계 결손은 뒤 차수나 소유 작업흐름 G3 전에는 경고이고, `--workstream <키>` G3 검사에서 그 소유 범위를 오류로 올린다. T2는 FEAT 미연결 `REQ.workstream`도 엄격 검사한다. **T13은 예외다** — G3 승인 뒤에도 `planned` 슬라이스의 TC는 경고이고, `slices[].testcases`로 매핑된 소유 슬라이스가 `in_progress` 이상이 된 뒤부터 코드 부재를 오류로 올린다. 구형 상태처럼 TC 매핑이 없으면 그 기능의 슬라이스가 모두 `done`이거나 P4가 승인된 뒤 엄격하게 검사한다. spec에 없는 TC를 코드가 부르는 역방향은 언제나 오류다.
- chain 순서는 코드에 다시 쓰지 않는다. `runtime/chains.mjs`를 adapter와 문서 생성기가 직접 읽고, `harness-check`가 `capabilities.yaml`과 대조한다.

### 깨진 보호에서 빠져나오는 길

사전 chain이 죽으면 지키던 도구와 고칠 도구가 함께 막힌다. 다음 장치로 복구한다.

| | 무엇 |
|---|---|
| 애초에 안 잠기게 | `hook-syntax` 가 사후 chain에서 **방금 쓴 훅**에 `node --check` 를 돌린다. 실행 권한·timeout 실패는 구문 오류라고 하지 않고 **검사 불가**로 알린다 |
| 길을 알린다 | 차단 사유에 `RECOVERY` 를 붙인다 — 쓰기가 막혔으면 *Bash로 고친다*, 셸이 막혔으면 *편집 도구로 고친다* |
| import 전부터 닫는다 | `pretool-bootstrap`이 파일 사전 chain의 입력을 먼저 보관하고 adapter import 실패를 구조화된 deny로 바꾼다. shell 진입 실패도 provider command wrapper가 명시적 deny로 바꾼다 |
| 수리 자리만 연다 | **죽어서 막힌 경우에만** 훅 adapter(`.claude/hooks/`·`.codex/hooks/`)와 **그들이 함께 쓰는 실행 원본**(`aidd-guide/harness/runtime/`)의 `.mjs` 쓰기를 통과시킨다 — `chains.mjs` 가 깨지면 모든 chain 이 서지 못하는데 열지 않으면 **잠긴 사람이 잠근 파일을 못 고친다**. 정책 차단과 다른 경로는 절대 열지 않는다 |
| 남의 트리로 안 퍼지게 | CI가 훅 전부에 `node --check` 를 돌린다 — 구문이 깨진 훅이 `main`에 들어가면 **clone하는 사람이 즉시 잠긴다** |

fixture는 `.codex/hooks/self-test.mjs`가 갖고 여는 쪽과 **닫히는 쪽을 함께** 센다.

## `git-sync` — 세션 시작의 원격 동기화

| 칸 | 값 |
|---|---|
| 이벤트 | `SessionStart`, **세션 시작(`startup`)에서만** |
| 입력 | 훅 입력의 `source`(Claude) · `startup` 전용 matcher 그룹(Codex) |
| 판정 | 원격 없음 → 조용히 통과 / 추적 브랜치 없음·fetch 실패 → 알림 / **작업 트리가 더러우면 당기지 않는다** / 깨끗하고 뒤처졌으면 `git pull --ff-only` / 이력이 갈렸으면 `integrate-main` 안내 |
| 강도 | 교정(당길 수 있을 때만) · 문맥에 넣는다 |
| 출력 | `[원격 동기화]` 로 시작하는 **한 덩이** — 무엇을 했나 · 못 했으면 왜 · 다음에 무엇을 하나 |
| 실패 정책 | **던지지 않는다.** git 이 없거나 네트워크가 죽어도 세션은 열린다. 네트워크 15초 · 로컬 5초에서 끊는다 |
| fixture | `.codex/hooks/self-test.mjs` — `source: 'compact'` 에서 아무것도 하지 않는다 |

**세 가지를 하지 않는 것이 이 훅의 절반이다.** ① 미커밋 변경 위로 남의 커밋을 얹지 않는다 — 충돌 해소는 사람의 판단이다(AGENTS.md §5-2). ② `--ff-only`가 안 되면 자동 merge하지 않고 `integrate-main`으로 넘긴다. ③ **푸시하지 않는다**(AGENTS.md §9).

## 통합 상태 — 현재 경고와 과거 이력을 섞지 않는다

`integration-state`는 `pending_rechecks`와 최근 `[충돌 통합]` 3건을 브리핑하고 CI에서 형식을 검사한다. `guard-commit`은 `pull --ff-only`·`merge --no-commit`, merge 상태의 경로 없는 커밋 예외, 충돌 커밋의 `영향`·`확인`·`검증`을 집행한다. 상세 정책은 [14-collaboration.md](../process/14-collaboration.md)가 갖는다.

`resume`·`clear`·`compact` 에서 돌지 않는다 — 작업 중간에 파일이 바뀌면 AI가 읽은 것과 디스크가 어긋난다.

startup 훅도 진입 문서와 hook 설정이 **로드된 뒤** 돈다. pull로 바뀐 것을 현재 실행에 적용됐다고 가장하지 않는다. Claude Code는 진입 문서·하네스 변경이면 새 세션을 연다. Codex는 문서·스킬 변경만이면 현재 작업에 필요한 부분을 다시 읽되 재시작을 강제하지 않는다. 실제 Codex 훅 실행면 revision이 바뀌면 최신 훅 집행이 필요한 작업을 지금 이어갈지 사용자에게 먼저 확인한다. 사용자가 선택했을 때만 Codex 앱은 승인 뒤 작업 맥락을 인계한 새 local task를 만들되, 앱에 hook 검토 화면이 없으면 **새 task를 묻기 전에** CLI `/hooks`로 현재 정의를 승인하고 완료를 확인한다. CLI 사용자는 승인·`/hooks` 검토 뒤 `codex resume <SESSION_ID>`(최근 task면 `--last`)로 돌아온다.

## `skill-sync` — 공통 스킬 원본 → 두 AI 의 `SKILL.md`

| 칸 | 값 |
|---|---|
| 이벤트 | `PostToolUse` 파일 chain, `guide-drift` 다음 · `harness-doc` **앞**(생성 결과를 `harness-doc` 이 센다) |
| 입력 | `aidd-guide/harness/skill-src/**` · `runtime/sync-skills.mjs` 쓰기 |
| 판정 | `skillDiffs()` 가 비면 통과 / 다르면 **양쪽 `SKILL.md` 를 다시 만든다** / `name` 불일치면 만들지 않고 알린다 |
| 강도 | 교정 · 경고 |
| 출력 | 다시 만든 스킬 이름과 *같은 커밋에 담으라* 는 말 |
| 실패 정책 | 생성기가 던져도 훅은 통과시키고 경고만 낸다 — 쓰기를 되돌릴 수는 없다 |

**왜 즉시 만드나.** `SKILL.md` 는 생성물이고 손편집은 `guard-generated` 가 막는다. 그러면 원본을 고친 사람은 고쳤다고 믿는데 **AI 가 부르는 것은 옛 파일**이다 — 다음 세션의 `harness-check` 가 잡아 주지만 **그 세션 안에서는 고친 스킬을 쓸 수 없다.** 일부 provider 쓰기가 실패하면 성공이라고 말하지 않고 실패 목록과 재실행 명령만 알린다.

## `guard-shell-write` — 셸이 쓰는 경로도 파일 게이트에 태운다

| 칸 | 값 |
|---|---|
| 이벤트 · 입력 | `PreToolUse` shell chain 의 끝 · `tool_input.command` |
| 판정 · 강도 | 명령에서 쓰기 대상을 뽑아 **`pre_file` chain 을 그대로** 돌린다 · 차단. 복사·이동은 원본이 아니라 목적지를 보고 `>|`·`<>`·`-t` 목적지도 포함한다. 저장소 밖·`/dev/null`·glob·인용부 안은 통과 |
| 출력 · 실패 정책 | 막힌 경로마다 원래 훅의 사유 · 사전 chain 이라 던지면 차단한다 |
| 못 보는 것 | 스크립트가 자기 안에서 여는 파일(`node -e` · gradle), 인용부 안의 리다이렉션, 변수·glob 경로, 삭제(`rm` — `@defer ?`) |
| fixture | `.codex/hooks/self-test.mjs` — 잡는 형태와 **통과해야 하는 형태**를 함께 센다 |

**왜.** 2026-09-14 실측에서 `Write` 로 막히는 지도 밖 경로가 `printf > …` 로는 조용히 만들어졌다. 게이트가 도구 이름으로 서면 **도구를 바꾸는 것만으로 게이트가 사라진다.** `guard-commit` 은 [hooks.md](./hooks.md)가 갖는다.

## 공통 계약 — `lib.mjs`

| 함수 | 무엇 |
|---|---|
| `readHookInput()` | 표준 입력 또는 bootstrap이 보관한 JSON 한 덩이. **못 읽으면 빈 객체** — 훅이 조용히 통과한다 |
| `REPO` | 저장소 뿌리. **작업 디렉터리를 믿지 않고** 훅 파일 위치에서 `AGENTS.md`를 찾아 올라간다 |
| `targetPath(input)` · `featureWorkstream()` · `workstreamGateStatus()` | 대상 경로를 읽고, FEAT의 명시 `workstream` 또는 `module`을 소유 작업흐름 G3에 연결한다 |
| `repoRelative(abs)` | 저장소 기준 상대 경로(슬래시 통일). **바깥이면 빈 문자열** |
| `pass()` · `deny(reason)` · `warn(message)` | 통과 · 차단 · 알림. chain 안에서는 결과 객체로 회수한다 |
| `runEmbeddedHook()` | 자식 process 없이 기존 정책 엔진을 한 번 실행한다 |
| `provider()` · `PROVIDER_NAME` | 지금 부른 것이 `claude`인가 `codex`인가 — bootstrap 표식 또는 **진입 경로가 정한다**. 모르면 `unknown` |
| `skillRef(name)` | 그 runtime에서 **실행되는 형태**의 스킬 표기 — `/이름` · `$이름` · 모르면 `이름 스킬` |

**두 가지가 설계 결정이다** — 고칠 때 되돌리지 않는다:

- **`REPO` 를 `process.cwd()` 로 바꾸지 않는다.** 훅이 어느 경로에서 불릴지는 하네스가 정하고, 그것이 바뀌면 **훅이 조용히 아무것도 안 하게** 된다.
- **provider 판정을 훅 입력의 필드로 하지 않는다.** 안정 계약에 없는 필드로 분기하면 조용히 틀린다. 판정의 근거는 **우리가 만든 배선**이고, `harness-check`가 그 전제(Codex는 어댑터를 거친다)를 검사한다.
- **`repoRelative` 는 저장소 밖을 빈 문자열로 돌려준다.** `normalize-encoding` 은 파일을 *고치므로* 밖을 상대 경로로 오인하면 남의 파일을 손댄다. **다른 드라이브**가 그 자리다 — 윈도우에서 `relative('D:\repo', 'C:\tmp\x')` 는 `..` 로 시작하지 않고 **절대 경로 그대로**를 돌려준다.

`warn()` 은 `systemMessage`(사람)와 `additionalContext`(모델)를 **둘 다** 보낸다 — *사람이 봤는데 AI 는 모르는* 상태를 만들지 않는다.

**Codex가 읽는 출력은 JSON 하나다.** `SessionStart`는 `additionalContext`, `PreToolUse` 허용은
결정 없는 중립 `hookSpecificOutput`을 낸다. 종료 코드 0의 빈 출력도 계약상 허용되지만 일부
실행면이 침묵을 `Failed`로 표시한 이력이 있어 호환 형태를 명시한다. Claude `SessionStart`는
날것이며, `emitHookResults` 한 곳에서 가르고 어댑터가 stdout을 섞지 않는다 — 사례는 [providers/codex.md](./providers/codex.md).

## Codex 훅 승인·revision — AIDD와 같이 매 세션에서 일반 업무를 잠근다

| 칸 | 값 |
|---|---|
| 실행면 | `.codex/hooks.json` · Codex adapter · 공통 chain · 정적 import · 훅 정책 데이터 |
| revision | 실행면의 경로와 내용을 정렬해 SHA-256으로 계산한다. 설정 안의 revision 표식 자체는 제외한다 |
| 동기화 | 훅 작성자가 `node aidd-guide/harness/runtime/codex-hook-revision.mjs --sync`를 실행해 startup 명령의 인자에 고정한다 |
| 실행 확인 | Codex `SessionStart` adapter가 실행 전후 revision과 설정값이 모두 같을 때만 `[Codex 훅 실행 확인]`을 문맥에 넣는다 |
| 승인 상태 | `SessionStart`는 브리핑 없이 `approval-status` adapter만 세션별·revision별로 매 `startup`·`resume`·`clear`·`compact`에 주입한다. 상태는 Git 무시 `chat-history/.codex-hook-approvals/`에만 둔다 |
| 선언·차단 | `UserPromptSubmit`의 `acknowledge` adapter가 `/hooks` 직접 검토 뒤의 `1`(기존)·`2`(신규)를 기록한다. `1` 또는 CLI의 `2` 뒤에만 `approved-session`이 `git-sync`·브리핑·실행 확인을 내고, 모든 `PreToolUse`보다 앞선 `approval-gate`가 승인 전 일반 작업을 막는다. Windows 데스크톱의 `2`는 현재 창을 잠그고 새 앱 창을 요구한다. 읽기·하네스 유지보수·관측 경로 close-out만 연다 |
| 판정 | AGENTS.md의 Codex 전용 preflight가 매 요청에서 문맥 revision과 현재 실행면을 대조한다 |
| 강도 | 불일치·확인 부재면 모델이 **일반 업무**를 보류한다. `harness-check`와 CI는 stale revision을 오류로 막는다 |
| 수리 차선 | 확인이 없어도 **읽기 전부 · `harness-sync` · 하네스 경로 한정 커밋**은 연다(아래) |
| 실패 정책 | 자동 승인·신뢰 저장소 읽기·우회 플래그를 쓰지 않는다. 문서·스킬 변경은 재시작하지 않는다. 실제 훅 실행면 revision이 바뀌면 최신 훅 집행이 필요한 작업을 지금 이어갈지 사용자에게 먼저 확인한다. 사용자가 지금 이어가기를 택한 경우에만 데스크톱 앱은 hook 검토 화면 또는 CLI `/hooks` 승인 완료 확인 → 새 task 이동 승인 → 현재 턴 종료 → 새 local task에 맥락 인계 → revision·`PreToolUse` 생존 카나리 확인 순서다. CLI는 재개 승인 → `/hooks` 검토 → 현재 실행 종료 → `codex resume` → revision·카나리 확인 순서다. **revision 불일치·확인 부재는 일반 업무를 보류하지만, 승인된 새 실행에서 revision이 맞고 카나리만 실행되면 제품 결손을 사용자에게 한 번 알리고 문서 규칙을 AI가 직접 적용하며 업무를 계속한다.** 같은 재진입과 경고를 반복하지 않는다. |
| fixture | `.codex/hooks/self-test.mjs` — 일치·확인 부재·잘못된 revision, **desktop·CLI·불명 세 갈래 안내**, 승인→재진입 순서, 양쪽 client의 카나리 경고 후 계속 정책, 카나리 deny, Codex `PreToolUse` 허용의 중립 JSON과 어댑터 출력 모양을 함께 센다 |

**부트스트랩 한계가 있다.** 승인되지 않은 훅은 자기 자신을 실행해 차단할 수 없다. 그래서 AIDD와
같이 hook runtime의 상태 게이트와 `AGENTS.md` preflight를 함께 쓴다. 구현이 바뀌면 `/hooks`
재승인이 필요하고, 확인이 없는 동안은 수리 차선만 열린다.

**승인은 훅 우회가 아니라 작업 맥락을 보존한 재연결 승인이다.** 실제 훅 실행면이 바뀌어 최신 집행이 지금 필요하다고 사용자가 고른 경우에만 적용한다. CLI의 `resume`은 저장된 대화를 잇고, 앱은 `thread/start`로 새 local task를 만들어 완료한 일·남은 일·원본 task를 읽는 방법을 첫 prompt에 인계한다.
`thread/fork` 뒤에는 startup 훅이 오지 않고 사전 훅 카나리도 통과한 것이 2026-09-11 실측됐으므로 재시작 수단으로 쓰지 않는다.
앱에 hook 검토 화면이 없으면 자동 승인하지 않고, 저장소 루트에서 Codex CLI를 연 뒤 그 TUI의 `/hooks`로 승인하게 한다. **사용자가 승인 완료를 확인하기 전에는 새 task 이동을 묻거나 만들지 않는다.** 완료 확인 뒤 이동 승인을 받고 새 task를 만든다. 그 task의 새 `SessionStart` revision은 반드시 일치해야 한다. `PreToolUse` 카나리는 자동 집행의 생존 여부를 알려 주며, 차단되지 않으면 사용자에게 결손 범위를 알리고 문서 규칙을 직접 적용하며 업무를 재개한다.

Claude Code에는 이 preflight와 revision 문맥을 주입하지 않는다. Claude의 프로젝트 훅 실행
동의는 Claude runtime이 관리하며, 공통 훅 수정 때 Codex revision을 갱신하는 것은 작성·검증
절차일 뿐 Claude 세션의 요청을 막거나 설정을 자동으로 쓰지 않는다.

**수리 차선이 종료 절차를 겸한다.** 무엇이 열리는지는 [`AGENTS.md`](../../AGENTS.md) §2 가,
왜는 [providers/codex.md](./providers/codex.md) 가 갖는다. 우회가 아니라 **미커밋 하네스를
남기지 않는 종료 절차**이며 옛 「좁은 종료 예외」를 대신한다 — 그것은 *변경을 작성한 task*
만 위한 것이라 **표식 없이 시작한 task, 바로 원인을 조사해야 할 task 를 잠갔다.**

## 새 훅을 더할 때

1. `harness-sync` 스킬로 이 문서에 이벤트·입력·판정·강도·출력·실패 정책·fixture를 먼저 적는다. 판정의 `AGENTS.md`·`aidd-guide/` 근거가 없으면 훅보다 규칙을 먼저 쓴다.
2. Claude와 Codex 입력이 같으면 정책 엔진을 공유하고 adapter만 둔다. 다르면 결과 동등성을 적는다.
3. `lib.mjs`만 import하고 런타임 의존성을 더하지 않는다.
   **`pass`·`warn`·`deny`를 `try` 안에 두지 않는다** — chain에서 이 셋은 예외로 빠져나오므로
   옆의 `catch`가 삼키면 훅이 *일은 하고 아무 말도 안 하는* 상태가 된다.
4. `deny`에는 *고칠 곳*과 *다음에 돌릴 것*을 함께 적는다.
5. 두 provider 배선과 self-test를 같은 변경에서 완성한다. 한쪽 실측을 못 하면 미검증으로 보고한다.
6. `codex-hook-revision --sync`, `harness-check`, `harness-doc --write`, 문서 lint를 실행한다.

## 훅이 의심스러울 때

```bash
echo '{"tool_input":{"file_path":"sources/backend/bootstrap/src/main/resources/db/changelog/data/003-init-menu.csv"}}' | node .claude/hooks/guard-generated.mjs
```

- **출력이 비면 통과한 것이다**(`pass()` 는 아무 말도 하지 않는다).
- 아무 훅도 안 도는 것 같으면 `REPO` 탐색과 provider 신뢰 승인을 먼저 본다.
- Codex는 `/hooks`에서 프로젝트 hook hash가 승인됐는지 확인한다.
- `doc-drift` 가 한 번 말하고 조용하면 정상이다. 다시 보려면 tmp 의 세션 파일을 지운다.

## 관련

- [hooks.md](./hooks.md) — 훅 하나하나가 무엇을 보고 무엇을 말하나
- [automation-matrix.md](./automation-matrix.md) — 무엇을 언제 · 강도가 왜 넷인가
- [skills.md](./skills.md) — 스킬과의 경계
