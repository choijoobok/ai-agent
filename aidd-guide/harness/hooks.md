---
id: LLM-HRN-001
title: "훅 카탈로그 — 다섯의 상세와 공통 계약"
category: "05-harness"
type: operation
created: "2026-05-04"
updated: "2026-09-03"
status: active
sources: [".claude/hooks/", ".claude/settings.json"]
author: Bong Jong Hyeon
tier: 2
tags: [harness, hooks, gate, automation]
---

# 훅 카탈로그 — 다섯의 상세

> **무엇을 언제 · 왜 강도가 넷인가**는 [automation-matrix.md](./automation-matrix.md) 가 갖는다.
> 여기는 **각 훅이 실제로 무엇을 보고 무엇을 말하는가**, 그리고 훅을 더하거나 고칠 때의 계약이다.

## 진입 조건

- 훅이 막았는데 **왜 막았는지** 모를 때
- 훅이 **안 도는 것 같을** 때 — 조용한 실패가 가장 나쁘다
- 새 훅을 더하거나, 목록·패턴을 고칠 때

## 배선 — `.claude/settings.json`

| 이벤트 | matcher | 훅 | timeout |
|---|---|---|---|
| `PreToolUse` | `Write\|Edit` | `guard-generated.mjs` | 10s |
| `PreToolUse` | `Bash\|PowerShell` | `guard-commit.mjs` | 10s |
| `PostToolUse` | `Write\|Edit` | `normalize-encoding.mjs` → `doc-drift.mjs` | 10s · 15s |
| `UserPromptSubmit` | — | `log-raw.mjs` | 10s |
| `Stop` | — | `log-raw.mjs` | 15s |

- **`PostToolUse` 둘은 순서가 있다.** 인코딩을 먼저 고치고 문서 셋을 대조한다.
- 실행은 `node` 하나다. `package.json` 도 `node_modules` 도 보지 않는다 — **폐쇄망에서 `npm i` 없이 선다**(CLAUDE.md §1).

## 공통 계약 — `lib.mjs`

| 함수 | 무엇 |
|---|---|
| `readHookInput()` | 표준 입력의 JSON 한 덩이. **못 읽으면 빈 객체** — 훅이 조용히 통과한다 |
| `REPO` | 저장소 뿌리. **작업 디렉터리를 믿지 않고** 훅 파일 위치에서 `CLAUDE.md` 를 찾아 올라간다 |
| `targetPath(input)` | `tool_input.file_path` ‖ `tool_response.filePath` — `Write`·`Edit` 이 같은 칸을 쓴다 |
| `repoRelative(abs)` | 저장소 기준 상대 경로(슬래시 통일). **바깥이면 빈 문자열** |
| `pass()` · `deny(reason)` · `warn(message)` | 통과 · 차단(`PreToolUse` 전용) · 알림(`PostToolUse` 전용) |

**두 가지가 설계 결정이다** — 고칠 때 되돌리지 않는다:

- **`REPO` 를 `process.cwd()` 로 바꾸지 않는다.** 훅이 어느 경로에서 불릴지는 하네스가 정하고, 그것이 바뀌면 **훅이 조용히 아무것도 안 하게** 된다.
- **`repoRelative` 는 저장소 밖을 빈 문자열로 돌려준다.** `normalize-encoding` 은 파일을 *고치므로* 밖을 상대 경로로 오인하면 남의 파일을 손댄다. **다른 드라이브**가 그 자리다 — 윈도우에서 `relative('D:\repo', 'C:\tmp\x')` 는 `..` 로 시작하지 않고 **절대 경로 그대로**를 돌려준다(2026-09-03 실물).

`warn()` 은 `systemMessage`(사람)와 `additionalContext`(모델)를 **둘 다** 보낸다 — *사람이 봤는데 AI 는 모르는* 상태를 만들지 않는다.

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

## `guard-commit` — 커밋의 두 사고 차단

**본다**: 명령을 `\n ; & | && ||` 로 자른 뒤 **각 조각의 시작 자리에 있는 `git commit`** 만. 조각의 **첫 줄까지만** 인자로 센다.

| 걸리는 것 | 왜 |
|---|---|
| `-m "` | PowerShell 에서 here-string 인자가 깨져 pathspec 오류가 난다 |
| `-a` · `--all` | 추적 중인 모든 변경을 담는다 |
| `--` 가 없다 | 경로 없는 커밋 — 낡은 인덱스가 **남의 커밋을 되돌린다** |

- **두 가지 좁힘이 없으면 훅이 자기 자신의 커밋을 막는다**: 문자열 안에 우연히 든 `git commit`(예: `echo`), here-string 본문에 든 `--` 나 `-m "`.
- 통과하는 형태는 하나다: `git commit -F - -- <경로…> <<'EOF'`.

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

## `doc-drift` — 화면 소스 ↔ 문서 셋 경고

**계산한다**: 바뀐 파일 → 페이지 경로 → `documents/screen/{경로}/`(CLAUDE.md §5.5). 사슬은 두 갈래다.

```
sources/frontend/src/features/{기능}/…  ─→ screenRegistry.ts 역인덱스 ─→ 페이지 경로
{…}Controller.java @RequestMapping ─→ endpoints.ts 가 그 경로를 부르는가 ─↗
```

- **`docs/` 와 `*.test|spec.*` 은 통과한다.** 문서를 고치는 것은 드리프트의 반대이고, 테스트는 화면 계약을 바꾸지 않는다.
- **프론트**는 가장 긴 기능 폴더가 이긴다(`sample/…` 이 `sample` 을 덮지 않게).
- **백엔드는 패키지 이름으로 기능 폴더를 맞히지 않는다.** 둘은 닮았을 뿐 규칙이 아니라(`accesslog` ↔ `api/log`), 맞히기 시작하면 **틀린 화면의 문서를 가리키는 훅**이 된다. 대신 그 경로를 **실제로 부르는 `endpoints.ts` 선언**을 찾는다.
- 문서 셋이 **셋 다 없음 / 일부 없음 / 다 있음** 셋으로 갈라 말이 달라진다.
- **한 화면당 세션에 한 번만** 말한다. 말한 화면은 `os.tmpdir()/ai-agent-doc-drift/{세션}.json` 에 적는다(저장소를 더럽히지 않는다). 매번 같은 말을 하면 **읽히지 않는 경고**가 되고, 그때부터 다른 경고까지 함께 묻힌다.

## `log-raw` — 대화 원문 append

**남긴다**: `chat-history/YYYY-MM/raw/YYYY-MM-DD.md` 에 append only(CLAUDE.md §9 · [04-memory/logs.md](./memory/logs.md)).

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

> **`let` 선언을 실행 블록 아래에 두지 않는다.** 마스킹 규칙의 memo 를 아래에 두었더니 첫 턴이 TDZ 로 죽었고, **조용히 실패하도록 만들어 둔 탓에 그 죽음이 보이지 않았다**(2026-09-03 실물). 조용한 훅일수록 손으로 한 번 돌려 확인한다.

## 새 훅을 더할 때

1. **강도를 먼저 정한다** — 차단 · 교정 · 경고 · 기록. 판단이 필요하면 경고이고, 말할 것이 없으면 기록이다([automation-matrix](./automation-matrix.md)).
2. `lib.mjs` 만 import 한다. **의존성을 더하지 않는다** — 훅이 자기 의존성을 갖는 순간 그 설치가 새 사람의 첫 관문이 된다.
3. `.claude/settings.json` 에 이벤트·matcher·timeout·`statusMessage` 를 배선한다.
4. **막기만 하지 않는다.** `deny` 의 문구에 *고칠 곳* 과 *다음에 돌릴 것* 을 함께 적는다.
5. [automation-matrix.md](./automation-matrix.md) 의 훅 표와 이 파일에 행을 더한다. CLAUDE.md §6 의 표도 함께 본다.

## 훅이 의심스러울 때

```bash
echo '{"tool_input":{"file_path":"sources/backend/bootstrap/src/main/resources/db/changelog/data/003-init-menu.csv"}}' | node .claude/hooks/guard-generated.mjs
```

- **출력이 비면 통과한 것이다**(`pass()` 는 아무 말도 하지 않는다).
- 아무 훅도 안 도는 것 같으면 `REPO` 탐색을 먼저 의심한다 — `CLAUDE.md` 를 6단계 위까지 찾는다.
- `doc-drift` 가 한 번 말하고 조용하면 정상이다. 다시 보려면 tmp 의 세션 파일을 지운다.

## 관련

- [automation-matrix.md](./automation-matrix.md) — 무엇을 언제 · 강도가 셋인 이유 · AI 가 하는 것
- [skills.md](./skills.md) — 스킬 카탈로그와 작성 규약
- [sensors-guides.md](./sensors-guides.md) — Sensors vs Guides 분류
- [CLAUDE.md §6](../../CLAUDE.md) — 기계가 막는 것 / 사람이 지키는 것
