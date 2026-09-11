# AGENTS.md — 공통 세션 진입 규칙 (v1.2)

> **이 파일이 Claude Code와 Codex의 공통 헌법이다.** 각 도구의 진입 파일이 이 내용을
> 직접 읽거나 가져오므로,
> **지켜야 할 것은 여기 있어야 지켜진다.**
>
> 여기는 **변하지 않는 규칙**(§5)과 **어디를 먼저 보는가**(§3)만 담는다.
> *무엇을 해야 하는가* 는 여기가 이기고, *무엇이 참인가* 는 소스가 이긴다(§3).
> 상세와 근거는 [`aidd-guide/`](aidd-guide/INDEX.md) 가 갖는다 — **여기에 옮겨 적지 않는다.**

---

## 1. 프로젝트

| 속성 | 설명 |
|---|---|
| **이름** | ai-agent |
| **무엇** | **기업용 Agentic AI Hub** — 여러 레거시 업무 시스템을 하나의 대화 창구로 모아, 자연어로 조회·실행·자동화한다. 백오피스 템플릿 위에 `admin` · `portal` · `agent` 세 모듈을 얹는다 |
| **스택** | Spring Boot 4.x · JDK 25 · JPA/QueryDSL · Liquibase · PostgreSQL(AI 전용 DB) / React 19 · TypeScript · AntD 6 · AG Grid 36 · Vite |
| **개발 방식** | **AI 주도 개발이 표준이다.** 사용자는 **고객이자 의사결정자**, AI 는 **PM·BA·AA·DBA·개발자·테스터**를 겸임한다. 따라서 표준은 *사람이 외우는 관행* 이 아니라 **AI 가 읽는 문서**(`aidd-guide/`)와 **기계가 막는 게이트**(§8)로 존재해야 한다 |
| **폐쇄망 대비** | 고객사 서버에 직접 구축하며 AI 를 쓸 수 없는 환경이 실재한다. 그래서 *짧고 공통화된 소스* 와 *읽을 수 있는 문서* 가 기능보다 앞선다. **둘은 같은 목표를 다르게 요구하지 않는다** — AI 에게는 문맥 비용이고 사람에게는 이해 비용이며, 줄이는 방법이 같다 |

```
ai-agent/
├── aidd-guide/   ★ AI 가 읽는 규칙 — 프로세스 + 개발 표준
├── documents/    ★ AI 가 만드는 산출물 — spec(SSOT) · 결정 · 화면 문서 셋
├── user-guide/   ★ 사람이 읽는 안내 — 환경 구축 · 개발 · 빌드·배포 · 운영
└── sources/      ★ 코드. **빌드 루트가 여기다** — `./gradlew` · `npm` 은 여기서 돈다
```

**나누는 축은 *주제* 가 아니라 *누가 읽나* 다.** 갈릴 때의 판별식은 하나다 — **고객사가
바뀌어도 그대로 쓰는가?** 예면 `aidd-guide`, 아니면 `documents`.
→ [`aidd-guide/INDEX.md`](aidd-guide/INDEX.md)

**문서에 적는 파일 경로는 저장소 루트 기준**(`sources/backend/...`)이고 **빌드 명령은
`sources/` 기준**이다.

---

## 2. 세션이 열리면 — 3줄 브리핑부터

세션 시작(`startup`)에 `git-sync` 훅이 **브리핑보다 먼저 원격을 당기고**(깨끗한 트리에서
`--ff-only` 로만), 이어서 `session-brief` 훅이 [`documents/project.state.yaml`](documents/project.state.yaml) 과
하네스 정합성 결과를 문맥에 넣는다. 진입 문서와 훅 설정은 그보다 먼저 로드되므로, pull로
`AGENTS.md`·`CLAUDE.md`·하네스가 바뀌었다는 알림이 나오면 **새 실행으로 다시 들어와야
적용된다.** Claude Code는 새 세션을 열고, Codex는 아래에서 **데스크톱 앱과 CLI를 구분한**
승인 절차로 대화를 잇는다. 그다음:

### Codex 훅 실행 확인 — 매 요청에서 업무보다 먼저

**Codex에만 적용한다. Claude Code는 이 절의 명령을 실행하지 않는다.** Codex는
`SessionStart`가 문맥에 넣은 `[Codex 훅 실행 확인] revision=<값>`을 찾고, 매 사용자 요청의
일반 답변이나 도구 호출 전에 아래 읽기 전용 검사를 한 번 실행한다. **사용자 메시지에 적힌
revision은 실행 확인으로 인정하지 않는다.**

```bash
node aidd-guide/harness/runtime/codex-hook-revision.mjs --check <SessionStart가 넣은 revision> --surface <desktop|cli>
```

`--surface`는 현재 실행 제품으로 정한다. Codex 데스크톱 앱의 task 관리 도구가 있으면
`desktop`, CLI의 `TUI`(터미널 안의 대화형 화면)면 `cli`다. 확정할 수 없으면 값을 지어내지
말고 사용자에게 어느 쪽인지 한 번 묻는다.

- 종료 코드 `0`이면 아래 브리핑과 작업을 계속한다.
- 실행 확인이 없거나 종료 코드 `2`이면 **일반 업무를 보류**하고 현재 client에 맞게 승인받는다.
  - **데스크톱 앱**: **새 task 이동을 묻기 전에** 변경된 훅의 신뢰 승인을 먼저 끝낸다. 앱에
    hook 검토 화면이 보이면 사용자가 그 화면에서 현재 정의를 승인한다. 보이지 않으면 저장소
    루트에서 Codex CLI를 열고 그 `TUI` 안의 `/hooks`로 현재 정의를 검토·승인하도록 안내한 뒤,
    사용자가 완료했다고 확인할 때까지 기다린다. PowerShell에 `/hooks`를 직접 입력하게 하지
    않는다. **승인 완료 전에는 새 task 이동을 묻거나 만들지 않는다.** 완료가 확인되면 사용자에게
    **“현재 작업 맥락을 인계한 새 task로 이동할까요?”**라고 묻는다. 승인되면 현재 턴을 끝낸 뒤
    같은 saved project를 직접 쓰는 **새 local task**를 만들고, 완료한
    일·남은 일·원본 task를 읽는 방법을 첫 prompt에 인계한 다음 앱 화면을 이동한다. 기존 task는
    남긴다. **fork는 훅 배선을 새로 싣지 않는 것이 실측됐으므로 쓰지 않는다.** 새 task에서는
    현재 revision 검사 뒤 아래 카나리를 **별도 도구 호출**로 실행한다.

    ```bash
    node aidd-guide/harness/runtime/codex-hook-revision.mjs --pretool-canary <SessionStart가 넣은 revision>
    ```

    `[Codex PreToolUse 생존 확인]` 차단이 오면 업무를 재개하고, 스크립트가 실행되면 훅 미적용으로
    보고 계속 보류한다. **이미 승인한 새 task에서 revision 검사가 통과했는데 카나리만 실행되면
    같은 승인·새 task 이동을 반복하지 않는다** — 실제 도구 경로가 `PreToolUse`를 건너뛴 제품
    결손으로 보고하고 수리 차선만 연다. **앱 사용자에게 CLI를 기본 절차로 요구하지는 않되, 앱에 검토 화면이
    없으면 `/hooks` 승인은 새 task를 만들기 전의 필수 차선이다.**
  - **CLI**: 사용자에게 **“대화 기록을 유지한 채 같은 task를 새 실행으로 재개할까요?”**라고
    묻는다. 승인되면 `/hooks`로 현재 정의를 검토·승인하고 현재 실행을 끝낸 뒤
    `codex resume <SESSION_ID>`로 재개한다. 가장 최근 task면 `codex resume --last`를 쓴다.
    새 빈 task는 사용자가 원할 때만 연다.
  - **불명**: 앱인지 CLI인지 먼저 묻고, 확정 전에는 어느 경로도 강제하지 않는다.
  어느 경우든 승인은 낡은 훅을 현재 실행에서 우회해도 된다는 뜻이 아니다. **다만 아래 수리
  차선은 보류하지 않는다.**
- 단, **이 task에서 변경 전 revision 검사가 이미 통과했고**, 사용자의 요청으로
  `harness-sync` 절차에 따라 훅을 바꾼 경우에는 작성 작업을 버려 두지 않는다. 일반 업무는
  보류하되 **revision 동기화 → 필수 검증 → 그 하네스 변경 경로만 지정한 커밋 한 번**까지
  마친 뒤 멈춘다. 시작할 때부터 불일치했거나 `git pull`로 변경을 받은 task에는 적용하지 않는다.

**수리 차선 — 확인이 없어도 고칠 수는 있어야 한다.** 확인이 오지 않는 원인은 하네스 안에
있는데 조사와 수리까지 막으면 **그 원인을 고칠 방법이 사라진다**(2026-09-11 에 실제로 그랬다).
확인이 없을 때도 다음 넷은 연다:

| 열림 | 무엇 |
|---|---|
| 읽기 | 파일 읽기 · 검색 · 진단 명령 전부 |
| 수리 쓰기 | `aidd-guide/harness/**` · `.codex/**` · `.claude/hooks/**` · `AGENTS.md` |
| 절차 | `harness-sync` 와 그 검증 명령 |
| 커밋 | **위 경로만 지정한** 커밋 |

**그 밖은 그대로 보류한다** — 산출물 작성 · `sources/` 변경 · 게이트 통과 · 다른 경로의
커밋. 열린 자리에서 일반 업무를 하지 않는다. 근거와 판례는
[`hooks-contract.md`](aidd-guide/harness/hooks-contract.md) 의 「수리 차선」이 갖는다.

1. `documents/project.state.yaml` 과 **현재 작업흐름 단계의** [`aidd-guide/phase/P{n}-*.md`](aidd-guide/phase/P0-inception.md) 를 읽는다.
2. 사용자에게 **3줄 브리핑**을 먼저 제시한다 — `지금 여기(전역 단계 + 작업흐름) / 막힌 것 / 다음 할 일`.
3. **당기지 못했다고 하면 먼저 정리한다** — 커밋하거나 `git stash` 한 뒤 당긴다. 낡은 트리
   위에서 만든 산출물은 합칠 때 두 번 만든 것이 된다.
4. 하네스 불일치가 있으면 `harness-sync` 스킬로 먼저 복구한다. 그다음에야 작업을 시작한다.
   브리핑 없이 산출물을 만들지 않는다.
5. **하네스 재시작 알림이 있으면 그 실행에서 작업하지 않는다.** Claude Code는 새 세션을 연다.
   Codex 데스크톱 앱은 승인 뒤 작업 맥락을 인계한 새 local task를 만들어 이동하고,
   CLI는 `/hooks` 검토·승인 뒤 `codex resume`로 같은 task에 다시 들어온다. 어느 쪽인지
   불명확하면 먼저 묻는다. 위 작성 실행 종료 예외로 커밋 중이라면 그 커밋까지만 끝낸다.

---

## 3. 정보가 충돌할 때 — 신뢰 순서

```
현재 소스 코드  >  documents/spec/  >  aidd-guide/  >  documents/ 생성 문서  >  chat-history 요약  >  기억
```

- **소스가 이긴다.** 문서는 구현을 따라온다 — 둘이 어긋나면 *문서가 낡은 것* 이 기본 가정이고, 고칠 것은 문서다. 단, 어긋남을 **보고 없이 지나가지 않는다**.
- **`documents/spec/` 이 산출물의 SSOT 다.** 아직 구현되지 않은 것에 대해서는 spec 이 이긴다 — 구현이 없으면 소스는 말할 것이 없다.
- **검증 없이 과거 기록을 현재 사실로 쓰지 않는다.** 기억·요약·과거 대화에 적힌 파일명·함수명·플래그는 **쓰기 전에 실물을 확인한다**.
- 확실하지 않으면 **추정하지 말고 묻는다.** 답에 추정이 섞이면 `확정 / 추정 / 확인 필요` 를 구분해 적는다.

### 요청이 오면 — 어디를 먼저 읽나

| 요청 | 진입 |
|---|---|
| **지금 어디까지 됐나** | `documents/project.state.yaml` → `pm-status` 스킬 |
| **새 프로젝트 착수** | `kickoff` 스킬 → [`aidd-guide/phase/P0-inception.md`](aidd-guide/phase/P0-inception.md). **이 저장소 안에서 무언가를 새로 여는 것은 여기가 아니다** — `kickoff` 는 빈 템플릿에서 프로젝트 하나를 세운다 |
| **다음 차수를 연다** | `phase-gate` 스킬의 `G6` 승인이 차수를 넘긴다 → [`aidd-guide/process/04-gates.md`](aidd-guide/process/04-gates.md) §5. **업무 시스템 확장(SHAPE-02)은 Hub 완성 뒤이며 그때 이 자리를 다시 본다** |
| **요구사항·설계 산출물** | [`aidd-guide/artifact/INDEX.md`](aidd-guide/artifact/INDEX.md) — 산출물 지도(무엇을 언제 어디에) |
| **단계를 마감한다** | 전역인지 작업흐름인지 먼저 정하고 `phase-gate` 스킬 → [`aidd-guide/process/04-gates.md`](aidd-guide/process/04-gates.md) · 작업흐름이면 [`process/13-workstreams.md`](aidd-guide/process/13-workstreams.md) |
| **메뉴 화면 신규·수정** | **먼저 §6.3 워크플로** → `documents/screen/{페이지경로}/requirements.md` → [`aidd-guide/artifact/screen/INDEX.md`](aidd-guide/artifact/screen/INDEX.md) |
| **이미 구현된 것을 고친다** | 화면이면 **§6.3 으로 되돌아간다** — 요건서의 달라지는 절만 고치고 → `mockup` 스킬 → 승인 → 구현([`aidd-guide/artifact/screen/screen.md`](aidd-guide/artifact/screen/screen.md) 의 「기존 화면을 고칠 때」). 화면이 아니면 `guide-drift` 가 가리키는 가이드를 **소스와 같은 커밋에** 고친다. `G3`(설계 베이스라인) 승인 뒤면 앞에 `change-request` 스킬이 붙는다 |
| **승인된 요건서로 화면을 만든다** | [`aidd-guide/playbook/INDEX.md`](aidd-guide/playbook/INDEX.md) 의 **결정 트리** — 화면 모양이 레시피를 정한다 |
| **기능 하나를 구현한다** | 소유 작업흐름 G3 승인 확인 → `slice` 스킬 → [`aidd-guide/process/07-slice.md`](aidd-guide/process/07-slice.md) |
| **테스트를 무엇으로 짜나** | [`aidd-guide/quality/test-design.md`](aidd-guide/quality/test-design.md) — 층별로 무엇을 잠그나 |
| 백엔드 구조·이름·트랜잭션 | [`aidd-guide/standard/backend/INDEX.md`](aidd-guide/standard/backend/INDEX.md) |
| 공통 컴포넌트 추가·변경 | [`aidd-guide/standard/frontend/INDEX.md`](aidd-guide/standard/frontend/INDEX.md) — 올리는 조건. **이미 있나**는 [`aidd-guide/standard/registry.md`](aidd-guide/standard/registry.md)(생성물), **고치는 절차**는 [`aidd-guide/standard/INDEX.md`](aidd-guide/standard/INDEX.md) 의 「이미 있는 것을 고칠 때」 |
| CRUD·마스터디테일·엑셀 레시피 | [`aidd-guide/playbook/INDEX.md`](aidd-guide/playbook/INDEX.md) |
| 도메인 지식(인가·메뉴·코드·메시지) | [`aidd-guide/knowledge/INDEX.md`](aidd-guide/knowledge/INDEX.md) |
| 훅·스킬·컨텍스트 예산 | [`aidd-guide/harness/INDEX.md`](aidd-guide/harness/INDEX.md) |

- **읽는 방법**: 통째로 읽지 않는다 — 텍스트 검색으로 절을 찾고 필요한 범위만 읽는다. 소스에도 같은 규칙을 적용한다.
- **표준을 추정해 새로 만들지 않는다.** `aidd-guide/` 에 없으면 **비슷한 화면의 실물을 읽는다** — 샘플 여섯(`sources/frontend/src/features/sample/`)이 그 목적으로 있다.

---

## 4. 문서 예산 — **자리가 정해진 것만 만든다**

1. **`documents/` 에는 [산출물 지도](aidd-guide/artifact/INDEX.md)에 등재된 자리만 만든다.** `guard-write` 훅이 지도를 읽어 **차단한다.** 새 종류가 정말 필요하면 **지도에 먼저 행을 더하고** — 목적·서식·소유자 셋을 함께 — 사용자에게 왜 필요한지 보고한다.
2. **정리·현황·근거를 적는 별도 문서를 만들지 않는다.** 무엇을 왜 그렇게 했는가는 **커밋 메시지**가 갖고(§9), 되돌리기 비용이 큰 것만 **ADR** 이 갖는다. *지금 어디까지 왔나* 는 `project.state.yaml` 하나다.
   - **미룬 것의 목록도 만들지 않는다.** 미룬 결정은 **그것이 사는 자리에 `@defer <기한>` 을 달아 두고**, `node .claude/skills/pm-status/deferred.mjs` 가 긁어 모은다. 기한을 모르면 `?` 를 쓴다 — 아는 척한 기한보다 낫고 경고 칸으로 모인다.
   - **이 파일에도 현황을 적지 않는다.** 개수와 날짜를 헌법에 박으면 아무도 모르게 낡는다 — 그래서 여기엔 *어디를 보라* 만 있고 *지금 몇 개인가* 는 없다.
3. **한 사실은 한 곳에서만 정의한다.** 다른 곳은 **링크**다. 요약을 옮겨 적으면 그 순간부터 두 사실이 되고, 갈렸을 때 어느 쪽이 참인지 알 방법이 없다.
4. **문서를 지우는 것도 작업이다.** 낡은 문서를 남겨 두는 것은 *보존* 이 아니라 *거짓말의 유지* 다. 지울 때 그 사실을 커밋 메시지에 적고, **지웠다는 목록을 따로 파일로 남기지 않는다**(git 이 갖는다).
5. **정본이면 커밋하고 파생이면 제외한다.** 정본을 한 줄 고칠 때마다 파생물이 diff 를 덮으면 **무엇이 바뀌었는지 보이지 않게** 된다. **파생물은 손으로 고치지 않는다** — 다음 생성에서 사라지고, 훅이 막는다. 무엇이 어느 쪽이고 **어느 파생물만 커밋하는지** → [산출물 지도 §2](aidd-guide/artifact/INDEX.md).

---

## 5. 절대 규칙 (매 응답 적용)

1. **한국어로 답한다.** 파일은 **UTF-8(BOM 없음)**, 줄끝은 **LF**(`.gitattributes` 가 `eol=lf`). 편집 도구가 CRLF 를 섞어 넣지 않게 한다 — `normalize-encoding` 훅이 쓰기 직후 고친다.
2. **게이트를 건너뛰지 않는다.** 전역 또는 소유 작업흐름의 Exit Criteria 를 모두 충족하고 사용자가 **명시 승인**해야 다음 단계로 간다. **한 턴에 하나의 게이트만** 넘는다 — "설계도 하고 구현도 했습니다" 는 금지다. 소스 쓰기는 기능을 소유한 작업흐름 G3가 열고, 전역 G3는 차수 통합을 잠근다([`process/13-workstreams.md`](aidd-guide/process/13-workstreams.md)). **되돌릴 수 없는 것은 AI 가 하지 않는다** — DB DROP/TRUNCATE, `terraform apply`, `kubectl delete`, `git push --force`, 프로덕션 변경은 사용자가 직접 하거나 명시 승인한다(`guard-bash` 훅이 차단한다).
3. **한 커밋은 한 가지 일이다.** 메시지는 `<타입>: <현상> — <조치>` 이며 **한국어로 쓰고** **왜** 를 본문에 적는다(`guard-commit` 이 형식과 언어를 막는다). **경로를 지정해** 커밋한다(§9). **푸시는 사용자가 말할 때만** 한다.
4. **`documents/spec/` 이 유일한 진실이다.** `documents/generated/` 는 파생 뷰다 — 그쪽을 고치지 말고 spec 을 고친 뒤 `doc-gen` 스킬로 재생성한다.
5. **ID 없는 산출물은 만들지 않는다.** 요구사항·유즈케이스·기능·엔티티·API·화면·테스트는 ID 를 갖고 **상위 ID 에 연결된다** → [`process/05-traceability.md`](aidd-guide/process/05-traceability.md). **추측을 사실처럼 쓰지 않는다** — 미확인 전제는 `ASM-###` 으로 [`documents/decisions/ASSUMPTIONS.md`](documents/decisions/ASSUMPTIONS.md) 에 적고 산출물 안에서 `[ASM-###]` 로 표시한다.
6. **문구를 소스에 박지 않는다.** 화면 문구는 `MSG` 키 + `label()`, 서버 문구는 `MsgKey` + `SYS_MESSAGE`. **소스에 남는 서버 문구 — 로그와 예외의 기본 메시지 — 는 한국어로 쓴다**(정본은 `SYS_MESSAGE` 이고 소스의 것은 폴백·진단이며, 그것을 읽는 사람이 한국어 운영자다).
7. **판단이 갈리는 것은 먼저 묻는다** — 표준·이름 규칙·경로·데이터 마이그레이션·삭제. 규칙이 이미 정해진 일은 진행하고 **결과를 보고한다**. 큰 리팩터는 *무엇을 왜 어떻게* 를 먼저 한 문단으로 요약한 뒤 착수한다. **질문은 배치로 묶는다** — 한 번에 최대 7개, 전부 **권장안**을 붙이고 `[필수]` 는 3개 이하 → [`process/03-interview.md`](aidd-guide/process/03-interview.md).
8. **시드는 생성물이다.** `menu-tree.yaml` · 컨트롤러 · `endpoints.ts` · `messageKeys.ts` 를 고쳤으면 생성 태스크를 돌려 **CSV 를 함께 커밋한다**(§7). 이미 적재된 changeset 은 고치지 않고 **새 파일을 더한다** — 고치면 남의 로컬이 checksum 으로 죽는다.
9. **대용량 파일을 통째로 읽지 않는다**(§3 의 읽는 방법).
10. **리뷰·점검 요청에는 문제·위험·누락을 먼저** 쓴다. 잘된 점은 뒤에, 짧게. **테스트 통과만으로 완료를 선언하지 않는다** — 업무 규칙을 코드에서 뒤집었을 때 테스트가 실패하는지 확인한다 → [`quality/redteam.md`](aidd-guide/quality/redteam.md).
11. **훅·생성기의 영역을 침범하지 않는다.** 생성 산출물(시드 CSV · `manual.html` · `documents/screen/index.html` · `documents/generated/`)을 손으로 고치지 않는다 — 훅이 막고, 막히지 않는 것은 다음 생성에서 사라진다. **`mockup.html` 은 반만 생성물이다** — 골격·테스트 케이스 표·확인 목록은 요건서에서 오고 **그림만 AI 가 그린다**. 그래서 훅이 막지 않으며, 대신 **표와 확인 목록에는 손대지 않는다**(`mockup --check` 가 어긋남을 잡는다).
12. **사용자가 이해하지 못한 승인을 받아내지 않는다.** 게이트마다 **결정 카드**(업무 언어 3~5줄)와 **역질문**(AI 가 확신 없는 것 1~2개)을 제시한다 → [`process/10-cognitive-debt.md`](aidd-guide/process/10-cognitive-debt.md). **"절차를 줄이자" 에 즉흥적으로 답하지 않는다** — 줄일 수 있는 것 / 절대 안 되는 것 / 지금은 빠르지만 나중에 비싼 것, 3분류로 답한다 → [`process/12-scope-reduction.md`](aidd-guide/process/12-scope-reduction.md).
13. **기호로만 말하지 않는다.** 사용자에게 ID·번호·약자를 쓸 때는 **괄호 안에 그것이 무엇인지 한 줄로 붙인다.**
    - `ASM-004` 가 아니라 **`ASM-004`(고객사 없이 제품부터 만든다는 미확인 전제)**
    - `G2` 가 아니라 **`G2`(아키텍처 게이트 · P2 를 닫고 P3 로 넘어가는 관문)**
    - `DTO` 가 아니라 **`DTO`(계층 사이로 데이터를 실어 나르는 객체)** — IT 약자도 **처음 쓸 때 한 번은 풀어 쓴다**

    **사용자는 ID 목록을 외우고 있지 않고, 외우게 만드는 것이 이 프로젝트의 목표가 아니다.** 뜻을 붙이지 않은 기호는 *말하지 않은 것* 과 같고, 그 상태로 받은 답은 승인이 아니라 짐작이다(§5-12 와 같은 뿌리다). 풀이의 사전은 [`user-guide/06-glossary.md`](user-guide/06-glossary.md) 가 갖는다 — **없는 말을 만났으면 거기에 더한다.**

    **이 규칙은 대화에만 적용한다.** 산출물 문서는 ID 로 촘촘히 엮이는 것이 목적이므로 안에서 매번 풀어 쓰지 않는다 — 문서는 사전을 링크한다.

---

## 6. 화면 문서 셋 — 게이트와 현행화

> 화면 하나 = **정본 둘**(`requirements.md` · `manual.md`) **+ 파생 둘**(`mockup.html` · `manual.html`).
> **읽는 사람이 다르므로 각자의 언어로 적고, 같은 사실을 두 번 적지 않는다**(§4-3).

### 6.1 경로 — **페이지 경로**를 그대로 미러링한다

`/log/access` → `documents/screen/log/access/`. **경로는 소스가 소유하고**(`screenRegistry.ts`),
**바꾸면 폴더도 같은 커밋에서 옮긴다**. `_standalone/` 은 메뉴 없는 화면이다.
→ [`documents/screen/README.md`](documents/screen/README.md)

### 6.2 셋의 역할 — 겹치지 않게

`requirements.md` 는 **AI 에게 *무엇을*** (어떻게는 적지 않는다), `manual.md` 는 **운영자에게 순서대로**
(테이블·API 는 적지 않는다), `mockup.html` 은 **설계자에게 그림**이다.
**목업에만 있는 규칙은 유실된 것으로 친다** — 다시 생성되기 때문이며, 그래서 테스트 케이스도 요건서가 갖는다.
→ [`documents/screen/README.md`](documents/screen/README.md) · 서식은 [`artifact/template/`](aidd-guide/artifact/template/02-requirements.md)

### 6.3 메뉴 개발 워크플로 — **승인 없이 착수 금지**

```
① 요건 정의서 → ② 목업 → ③ 사용자 승인 → ④ 개발·시드 → ⑤ 사용자 테스트 → ⑥ 개선(①로)
```

**①과 ②는 한 번에 내고, ③ 전에는 BE·FE·시드를 건드리지 않는다.** 승인은 *둘을 함께* 보는
판단이라 요건서만 승인받고 목업에서 뒤집히면 그 승인이 무효가 된다.
**⑤ 를 AI 의 게이트 초록이 갈음하지 않는다** — 돌아간 것과 쓸 만한 것은 다르다.
단계별로 무엇을 내고 무엇이 막는지 → [`artifact/screen/screen.md`](aidd-guide/artifact/screen/screen.md)

### 6.4 현행화 — 소스가 바뀌면 즉시 대조한다

**일치하면 고치지 않는다.** 고칠 것이 있으면 **소스와 문서를 같은 커밋에** 담는다 — 나누면 그 사이의
커밋이 거짓말을 한다. → [`documents/screen/README.md`](documents/screen/README.md)

### 6.5 소스 ↔ 문서 매핑 — 훅이 계산한다

`doc-drift`(화면) · `guide-drift`(그 파일을 `sources:` 에 적은 문서)가 **가리키기만 하고 막지 않는다** — *고쳐야 하는가* 는
판단이고(§6.4), 판단은 사람과 AI 의 몫이다. → [`harness/hooks.md`](aidd-guide/harness/hooks.md)

---

## 7. 검증 — 고쳤으면 돌린다

**초록을 확인하지 않은 변경은 완료가 아니다.** 게이트는 셋이다 — 문서 · 추적성 · 소스.
**무엇을 고치면 무엇을 더 돌리는지** → [`quality/INDEX.md`](aidd-guide/quality/INDEX.md).

```bash
node aidd-guide/harness/runtime/harness-check.mjs && node aidd-guide/meta/_meta/lint.mjs && node .claude/hooks/trace-check.mjs --all
```

```bash
cd sources && ./gradlew check -PskipFrontend
```

```bash
cd sources/frontend && npm run lint && npx tsc -b --noEmit && npm run test
```

---

## 8. 소스 규약 — 기계가 지키는 것 / 사람이 지키는 것

**기계가 막는 것의 목록은 [`harness/automation-matrix.md`](aidd-guide/harness/automation-matrix.md) 가 갖는다** — 빌드 게이트와 훅 전부. **훅의 현재 목록은 생성물이다**
([`user-guide/07-harness.md`](user-guide/07-harness.md)) — 손으로 적은 목록은 훅을 더할 때마다 낡고, 낡은 목록은 **없는 것보다 나쁘다**(있다고 믿게 한다).

### 사람이 지킨다 (검사가 없다)

| 규약 | 요지 | 본문 |
|---|---|---|
| 서비스 이름 · **명령의** 트랜잭션 | 조회는 `<기능>QueryService` / 명령은 `<기능>Service` + 쓰기 메서드마다. **조회의 `readOnly` 는 `ServiceConventionTest` 가 빌드에서 막는다** — 사람 몫은 **어느 이름을 고르나**와 **명령 쪽 표시**다 | [`standard/backend/packages.md`](aidd-guide/standard/backend/packages.md) |
| API 경로 · 액션 | `/api/{계층}/{도메인}/{동작}` · **접두가 액션을 정한다** · `service` 는 전부 POST | [`standard/backend/api.md`](aidd-guide/standard/backend/api.md) |
| 화면 뼈대 | 뿌리 `<FillColumn>` · `useSearchFormHeader()` · `auditColumns()` · `useGridController` 선언 | [`standard/frontend/grid.md`](aidd-guide/standard/frontend/grid.md) |
| 호출 감싸기 | 기능의 HTTP 호출은 `api/{도메인}Api.ts` 함수로. **호출 URL 은 `features/{도메인}/api/endpoints.ts` 에만** — 그 선언이 인가 시드의 입력이다 | [`standard/frontend/http.md`](aidd-guide/standard/frontend/http.md) |
| 공통물 | **두 번째 사용에** `shared/` 로 올리고 목록에 등재하고 **원본을 지운다.** 복사하지 않는다 | [`standard/frontend/packages.md`](aidd-guide/standard/frontend/packages.md) |
| 코드 태그 | 소스 파일 머리에 `@feat FEAT-###` — 추적성 T10. **템플릿은 면제 명단**(`.claude/hooks/feat-baseline.txt`)**에 있다** — 새 파일만 센다 | [`process/05-traceability.md`](aidd-guide/process/05-traceability.md) |

> **검사가 없으므로 여기 있는 것이 유일한 방어선이다** — 그래서 요지는 남긴다.
> 다만 **표가 본문이 되지 않게** 한다: 근거와 예외는 오른쪽 칸이 갖는다.

---

## 9. 커밋 · 형상 관리

- **푸시는 요청할 때만.**
- **경로를 지정해 커밋한다**: `git commit -F - -- <경로…>`. 한 트리에서 세션이 둘일 수 있고, 낡은 인덱스가 남의 커밋을 되돌린다.
- 커밋 메시지는 stdin(`-F -`)으로 넘긴다 — POSIX는 heredoc, PowerShell은 here-string pipe를 쓴다. `-m`·`-F <파일>`은 훅이 본문을 확정할 수 없어 막는다.
- **커밋하는 생성물은 시드 CSV 뿐이다** — 소스와 같은 커밋에 담는다(빼면 새로 클론한 사람이 앱을 띄울 수 없다). `mockup.html` · `manual.html` · `documents/generated/` 는 **`.gitignore` 대상**이다 → [산출물 지도 §2](aidd-guide/artifact/INDEX.md).
- **AI 가 만든 커밋에는 만든 주체를 남긴다** — 메시지의 마지막 trailer 묶음에 `Agent: <이름>` 한 줄.
  두 AI 가 한 저장소에 커밋하므로 표식이 없으면 **이 줄을 누가 썼나**를 나중에 알 방법이
  없다(`guard-commit` 이 차단한다). **무엇을 적나는 각 provider 문서가 갖는다** —
  이름은 저장소가 정하는 값이며, 남의 도구의 신원을 지어내지 않는다.

---

## 10. `chat-history/` — 대화 기록 (형상 관리 제외)

- **`.gitignore` 대상이다.** 대화는 결론의 근거일 뿐이고, 결론은 `documents/` 와 커밋 메시지가 갖는다.
- **요약은 사실의 원본이 아니다**(§3) — 인용할 때 실물을 확인한다.
- 무엇을 남기고 무엇을 남기지 않나는 [`harness/memory/logs.md`](aidd-guide/harness/memory/logs.md) 가 갖는다.

---

## 11. Claude Code와 Codex를 함께 쓸 때

- 공통 규칙의 정본은 이 파일, 공통 스킬의 정본은
  [`aidd-guide/harness/skill-src/`](aidd-guide/harness/skill-src/), 공통 훅 의미의 정본은
  [`hooks-contract.md`](aidd-guide/harness/hooks-contract.md)다. `.claude/`와 `.agents/`의
  `SKILL.md`는 생성물이다.
- 새 스킬이나 훅은 `harness-sync` 스킬로 **공통 명세부터** 고친다. 한 AI의 구현만 추가하고
  끝내지 않는다. 구현 불가능한 차이는 provider 문서와 capability manifest에 근거를 남긴다.
- 세션 시작과 변경 검증에서 `node aidd-guide/harness/runtime/harness-check.mjs`를 실행한다.
  불일치가 있으면 일반 작업보다 복구가 먼저다.
- 같은 작업을 병행할 때는 AI마다 별도 Git worktree/branch를 쓴다. 같은 working tree에
  동시에 쓰지 않는다. 결과는 테스트를 통과한 작은 커밋 단위로 합친다.
- 컨텍스트 관리는 결과 동등성만 요구한다. Claude는 사용량 조기 경보, Codex는 자동 압축 뒤
  `SessionStart(source=compact)` 재주입을 사용하며 근거 없는 백분율을 만들지 않는다.
