---
id: LLM-HRN-008
title: "훅 계약 — 배선 · lib.mjs · 새 훅을 더할 때"
category: harness
type: operation
created: "2026-09-06"
updated: "2026-09-11"
status: active
sources: ["aidd-guide/harness/capabilities.yaml", ".claude/hooks/", ".claude/settings.json", ".codex/hooks.json"]
tier: 2
tags: [harness, hooks, contract, wiring]
---

# 훅 계약 — 배선 · `lib.mjs` · 새 훅을 더할 때

> **훅을 만들거나 고칠 때** 읽는다. *어떤 훅이 있고 각각 왜 그런가* 는
> [hooks.md](./hooks.md) 가 갖는다 — 한 문서였다가 200줄 상한에 닿아 갈랐고, 갈린 축은
> **읽는 이유**다: 여기는 만드는 사람, 저기는 막힌 사람이 온다.

## 정본과 구현

| 층 | 정본 | 책임 |
|---|---|---|
| 공통 의미 | 이 문서 · [`capabilities.yaml`](./capabilities.yaml) | 목적·강도·실패 정책·동등성 |
| 공통 스킬 | `skill-src/*.md` | 절차와 trigger |
| Claude adapter | `.claude/settings.json` | Claude 이벤트·입력·컨텍스트 게이지 |
| Codex adapter | `.codex/hooks.json` · `.codex/hooks/` | `apply_patch` 정규화·압축 뒤 재주입 |
| 정책 엔진 | `.claude/hooks/*.mjs` | 역사적 경로를 유지한 공용 Node 로직 |
| 공통 chain | `runtime/chains.mjs` | 실행 순서의 유일한 원본 — manifest·adapter·생성 문서가 함께 읽는다 |
| 사전 진입 | `runtime/pretool-bootstrap.mjs` | 파일 chain이 import 전부터 깨져도 차단하고 훅 파일 수리만 연다 |

정책 엔진을 한 번에 중립 경로로 옮기지 않는다. 경로 이동은 동작 개선이 아니면서 스킬·문서·
권한 규칙을 대량으로 깨뜨린다. 새 훅은 가능하면 `aidd-guide/harness/runtime/`에 공용 로직을 두고,
기존 훅은 수정할 때 호환 wrapper와 함께 점진적으로 옮긴다.

## 배선

| 이벤트 | Claude | Codex | 공통 결과 |
|---|---|---|---|
| `SessionStart` | `session-start` chain | `session-start`(`startup`) · `session-brief`(`resume\|clear\|compact`) | `git-sync` → `session-brief` |
| `PreToolUse` 파일 | `pre-write` chain | `file-chain` | `guard-write` → `guard-generated` |
| `PreToolUse` shell | `pre-shell` chain | `pre-shell` chain | 파괴 명령·커밋 사고 차단 |
| `PostToolUse` 파일 | `post-write` chain | `file-chain` | 인코딩 → 추적성 → 문서 현행화 |
| `UserPromptSubmit` | `log-raw` + `context-gauge` | `log-raw` | 사용자 대화 기록 |
| `Stop` | `log-raw` | `log-raw` | AI 대화 기록 |

- 같은 matcher의 command hook은 동시 실행될 수 있다. 그래서 순서가 필요한 정책은 handler를
  여러 개 배선하지 않고 **chain 하나**가 직렬 실행한다.
- **같은 chain에는 같은 timeout을 준다.** 예산이 갈리면 좁은 쪽에서만 뒤쪽 훅이 통째로
  잘리고, 잘렸다는 사실은 보이지 않는다. `harness-check`가 파일 chain 둘을 비교해 막는다.
- 실행은 `node` 하나다. `package.json`도 `node_modules`도 보지 않는다(AGENTS.md §1).
- 사전 보호 chain에서 내부 오류가 나면 차단한다. 사후 chain 오류는 되돌릴 수 없으므로 경고한다.
- chain 순서는 코드에 다시 쓰지 않는다. `runtime/chains.mjs`를 adapter와 문서 생성기가 직접
  읽고, `harness-check`가 `capabilities.yaml`과 대조한다.

### 깨진 보호에서 빠져나오는 길

사전 chain이 죽으면 **그 chain이 지키던 도구가 통째로 막힌다.** 그런데 고칠 때 쓰는 도구가
바로 그것이다 — 쓰기 chain이 죽으면 훅 파일을 `Edit`으로 열 수 없다. 셋으로 막는다.

| | 무엇 |
|---|---|
| 애초에 안 잠기게 | `hook-syntax` 가 사후 chain에서 **방금 쓴 훅**에 `node --check` 를 돌린다. 실행 권한·timeout 실패는 구문 오류라고 하지 않고 **검사 불가**로 알린다 |
| 길을 알린다 | 차단 사유에 `RECOVERY` 를 붙인다 — 쓰기가 막혔으면 *Bash로 고친다*, 셸이 막혔으면 *편집 도구로 고친다* |
| import 전부터 닫는다 | `pretool-bootstrap`이 파일 사전 chain의 입력을 먼저 보관하고 adapter import 실패를 구조화된 deny로 바꾼다. shell 진입 실패도 provider command wrapper가 명시적 deny로 바꾼다 |
| 수리 자리만 연다 | **죽어서 막힌 경우에만** `.claude/hooks/*.mjs`·`.codex/hooks/*.mjs` 쓰기를 통과시킨다. 정책 차단과 다른 경로는 절대 열지 않는다 |
| 남의 트리로 안 퍼지게 | CI가 훅 전부에 `node --check` 를 돌린다 — 구문이 깨진 훅이 `main`에 들어가면 **clone하는 사람이 즉시 잠긴다** |

fixture는 `.codex/hooks/self-test.mjs`가 갖는다 — 여는 쪽과 **닫히는 쪽을 함께** 센다.
여는 쪽만 시험하면 게이트가 통째로 열린 것을 보지 못한다.

## `git-sync` — 세션 시작의 원격 동기화

| 칸 | 값 |
|---|---|
| 이벤트 | `SessionStart`, **세션 시작(`startup`)에서만** |
| 입력 | 훅 입력의 `source`(Claude) · `startup` 전용 matcher 그룹(Codex) |
| 판정 | 원격 없음 → 조용히 통과 / 추적 브랜치 없음·fetch 실패 → 알림 / **작업 트리가 더러우면 당기지 않는다** / 깨끗하고 뒤처졌으면 `git pull --ff-only` |
| 강도 | 교정(당길 수 있을 때만) · 문맥에 넣는다 |
| 출력 | `[원격 동기화]` 로 시작하는 **한 덩이** — 무엇을 했나 · 못 했으면 왜 · 다음에 무엇을 하나 |
| 실패 정책 | **던지지 않는다.** git 이 없거나 네트워크가 죽어도 세션은 열린다. 네트워크 15초 · 로컬 5초에서 끊는다 |
| fixture | `.codex/hooks/self-test.mjs` — `source: 'compact'` 에서 아무것도 하지 않는다 |

**세 가지를 하지 않는 것이 이 훅의 절반이다.** ① 미커밋 변경 위로 남의 커밋을 얹지
않는다 — 충돌 해소는 사람의 판단이다(AGENTS.md §5-2). ② `--ff-only` 만 쓴다 — merge 와
rebase 중 무엇으로 합칠지는 AI 가 고르지 않는다. ③ **푸시하지 않는다**(AGENTS.md §9).

`resume`·`clear`·`compact` 에서 돌지 않는 이유는 하나다 — 그때는 작업 중간이라
**AI 가 방금 읽은 것과 디스크가 어긋난다.**

단, startup 훅도 AI의 진입 문서와 hook 설정이 **이미 로드된 뒤** 돈다. pull 결과에
`AGENTS.md`·`CLAUDE.md`·`.claude/`·`.agents/`·`.codex/`·`aidd-guide/harness/`가 있으면
현재 세션에 새 규칙이 적용됐다고 가장하지 않고 **새 세션을 열라고 알린다**.

## `skill-sync` — 공통 스킬 원본 → 두 AI 의 `SKILL.md`

| 칸 | 값 |
|---|---|
| 이벤트 | `PostToolUse` 파일 chain, `guide-drift` 다음 · `harness-doc` **앞**(생성 결과를 `harness-doc` 이 센다) |
| 입력 | `aidd-guide/harness/skill-src/**` · `runtime/sync-skills.mjs` 쓰기 |
| 판정 | `skillDiffs()` 가 비면 통과 / 다르면 **양쪽 `SKILL.md` 를 다시 만든다** / `name` 불일치면 만들지 않고 알린다 |
| 강도 | 교정 · 경고 |
| 출력 | 다시 만든 스킬 이름과 *같은 커밋에 담으라* 는 말 |
| 실패 정책 | 생성기가 던져도 훅은 통과시키고 경고만 낸다 — 쓰기를 되돌릴 수는 없다 |

**왜 즉시 만드나.** `SKILL.md` 는 생성물이고 손편집은 `guard-generated` 가 막는다. 그러면
원본을 고친 사람은 고쳤다고 믿는데 **AI 가 부르는 것은 옛 파일**이다 — 다음 세션의
`harness-check` 가 잡아 주지만 **그 세션 안에서는 고친 스킬을 쓸 수 없다.**
일부 provider 쓰기가 실패하면 성공이라고 말하지 않고 실패 목록과 재실행 명령만 알린다.

## `guard-commit` — 보이는 메시지의 provider 표식

AI가 만드는 커밋은 `-F -`로 본문을 명령에 드러낸다. POSIX heredoc과 PowerShell here-string을
모두 읽고, provider 문서가 정한 정확한 `Agent:` 값과 마지막 trailer 묶음을 검사한다.
`-m`·`-F <파일>`처럼 본문을 확인할 수 없는 형태는 통과시키지 않는다. Claude는 `Agent:` 뒤의
정해진 `Co-Authored-By:`를 허용하고, Codex는 `Agent: Codex`가 마지막 줄이다.

## 공통 계약 — `lib.mjs`

| 함수 | 무엇 |
|---|---|
| `readHookInput()` | 표준 입력 또는 bootstrap이 보관한 JSON 한 덩이. **못 읽으면 빈 객체** — 훅이 조용히 통과한다 |
| `REPO` | 저장소 뿌리. **작업 디렉터리를 믿지 않고** 훅 파일 위치에서 `AGENTS.md`를 찾아 올라간다 |
| `targetPath(input)` | `tool_input.file_path` ‖ `tool_response.filePath` — `Write`·`Edit` 이 같은 칸을 쓴다 |
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

## 새 훅을 더할 때

1. `harness-sync` 스킬로 이 문서에 이벤트·입력·판정·강도·출력·실패 정책·fixture를 먼저 적는다.
2. Claude와 Codex 입력이 같으면 정책 엔진을 공유하고 adapter만 둔다. 다르면 결과 동등성을 적는다.
3. `lib.mjs`만 import하고 런타임 의존성을 더하지 않는다.
   **`pass`·`warn`·`deny`를 `try` 안에 두지 않는다** — chain에서 이 셋은 예외로 빠져나오므로
   옆의 `catch`가 삼키면 훅이 *일은 하고 아무 말도 안 하는* 상태가 된다.
4. `deny`에는 *고칠 곳*과 *다음에 돌릴 것*을 함께 적는다.
5. 두 provider 배선과 self-test를 같은 변경에서 완성한다. 한쪽 실측을 못 하면 미검증으로 보고한다.
6. `harness-check`, `harness-doc --write`, 문서 lint를 실행한다.

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
