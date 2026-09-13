# AGENTS.md — 공통 세션 진입 규칙 (v1.3)

> **Claude Code와 Codex의 공통 헌법이다.** 여기에는 모든 응답 전에 알아야 할 불변 규칙과
> 작업별 진입 경로만 둔다. *무엇을 해야 하는가*는 이 파일이, *무엇이 참인가*는 §3의
> 신뢰 순서가 결정한다. 상세 절차와 근거는 [`aidd-guide/`](aidd-guide/INDEX.md)가 갖는다.

## 1. 프로젝트

| 속성 | 설명 |
|---|---|
| 이름 | ai-agent |
| 무엇 | **기업용 Agentic AI Hub** — 백오피스 템플릿 위의 `admin` · `portal` · `agent`로 레거시 업무 시스템을 자연어 조회·실행·자동화에 연결한다 |
| 스택 | Spring Boot 4.x · JDK 25 · JPA/QueryDSL · Liquibase · PostgreSQL(AI 전용 DB) / React 19 · TypeScript · AntD 6 · AG Grid 36 · Vite |
| 방식 | 사용자는 고객·의사결정자, AI는 PM·BA·AA·DBA·개발자·테스터를 겸한다. 표준은 `aidd-guide/`와 기계 게이트로 집행한다 |
| 제약 | 고객사 폐쇄망에서도 사람이 읽고 재현할 수 있도록 소스와 문서를 짧고 공통화한다 |

```
ai-agent/
├── aidd-guide/   # 고객사가 바뀌어도 그대로 쓰는 AI 규칙
├── documents/    # 프로젝트별 spec(SSOT)·결정·화면 문서
├── user-guide/   # 사람이 읽는 구축·개발·배포·운영 안내
└── sources/      # 코드와 빌드 루트
```

고객사가 바뀌어도 그대로 쓰면 `aidd-guide/`, 프로젝트별 사실이면 `documents/`에 둔다.
문서 경로는 저장소 루트 기준(`sources/backend/...`), 빌드 명령은 `sources/` 기준이다.

## 2. 세션 진입 — 업무보다 먼저

`startup`에서는 `git-sync`가 깨끗한 트리만 `--ff-only`로 당기고, `session-brief`가
`documents/project.state.yaml`과 하네스 상태를 주입한다. 진입 문서나 훅이 바뀌었다는 알림이
있으면 현재 실행에 적용됐다고 간주하지 않는다. Claude Code는 새 세션, Codex는 아래 절차로 재진입한다.

### Codex 훅 실행 확인

Codex는 매 사용자 요청에서 일반 답변이나 다른 도구 호출 전에, `SessionStart`가 주입한
`[Codex 훅 실행 확인] revision=<값>`으로 다음을 한 번 실행한다. 사용자 메시지의 값은 인정하지 않는다.

```bash
node aidd-guide/harness/runtime/codex-hook-revision.mjs --check <revision> --surface <desktop|cli>
```

- 종료 코드 `0`: 계속한다.
- 확인이 없거나 종료 코드 `2`: 일반 업무를 보류하고
  [`providers/codex.md`](aidd-guide/harness/providers/codex.md)의 현재 client 절차를 따른다.
  데스크톱은 훅 승인 완료 뒤 새 local task 이동을 묻고(`fork` 금지), CLI는 `/hooks` 승인 뒤
  같은 task의 `codex resume` 여부를 묻는다. client가 불명확하면 먼저 묻는다.
- 새 실행은 revision 검사 뒤 `--pretool-canary <revision>`을 별도 도구 호출로 한 번 실행한다.
  revision은 맞고 카나리만 실행되면 자동 사전 차단의 제품 결손을 한 번 알리고, 문서 규칙을
  직접 지키며 계속한다. 같은 승인·재진입을 반복하지 않는다.
- 이 task에서 변경 전 검사가 통과한 뒤 사용자가 하네스 변경을 요청했다면 일반 업무는 멈추되,
  `harness-sync`의 동기화·검증과 그 변경 경로만 지정한 커밋 한 번까지 마친다.

확인이 없어도 교착을 피하기 위해 아래 **수리 차선**만 연다.

| 열림 | 범위 |
|---|---|
| 읽기 | 파일 읽기·검색·진단 명령 전부 |
| 쓰기 | `aidd-guide/harness/**` · `.codex/**` · `.claude/hooks/**` · `AGENTS.md` |
| 절차 | `harness-sync`와 필수 검증 |
| 커밋 | 위 경로만 지정한 커밋 |

### 공통 시작 순서

1. `documents/project.state.yaml`과 현재 작업흐름의 `aidd-guide/phase/P{n}-*.md`를 읽는다.
2. **지금 여기 / 막힌 것 / 다음 할 일**의 3줄 브리핑을 먼저 제시한다.
3. pull 실패나 더러운 트리는 먼저 사용자 변경을 보존한 채 정리한다.
4. 하네스 불일치는 `harness-sync`로 먼저 복구한다.
5. 하네스 재시작 알림이 있으면 승인된 수리 차선 외의 작업을 하지 않는다.

## 3. 신뢰 순서와 진입 지도

```
현재 소스 > documents/spec/ > aidd-guide/ > documents/ 생성 문서 > chat-history 요약 > 기억
```

- 구현된 현재 사실은 소스가 이긴다. 문서와 다르면 문서가 낡은 것이 기본 가정이지만 반드시 보고한다.
- 미구현 범위의 정본은 `documents/spec/`이다. `documents/generated/`는 파생 뷰다.
- 기억·요약의 파일명·함수명·플래그는 쓰기 전에 실물을 확인한다.
- 확실하지 않으면 묻고, 추정이 섞이면 `확정 / 추정 / 확인 필요`를 구분한다.
- 큰 파일은 통째로 읽지 않고 `rg`로 절을 찾은 뒤 필요한 범위만 읽는다.

| 요청 | 먼저 읽거나 사용할 것 |
|---|---|
| 현재 상태 | `project.state.yaml` → `pm-status` |
| 새 프로젝트 착수 | `kickoff` → `phase/P0-inception.md` (빈 템플릿에서 프로젝트를 세울 때만) |
| 다음 차수 | `phase-gate`의 G6 → `process/04-gates.md` §5 |
| 요구사항·설계 산출물 | `artifact/INDEX.md` |
| 단계 마감 | 전역/작업흐름을 구분 → `phase-gate` → `process/04-gates.md` · `process/13-workstreams.md` |
| 메뉴 화면 신규·수정 | §6 → `documents/screen/{페이지경로}/requirements.md` |
| 구현된 것 수정 | 화면은 §6, 그 밖은 `guide-drift`; G3 이후 설계 변경은 먼저 `change-request` |
| 승인된 화면 구현 | `playbook/INDEX.md` 결정 트리 |
| 기능 하나 구현 | 소유 작업흐름 G3 승인 확인 → `slice` → `process/07-slice.md` |
| 테스트 설계 | `quality/test-design.md` |
| 백엔드/API | `standard/backend/INDEX.md` |
| 프론트엔드/공통 컴포넌트 | `standard/frontend/INDEX.md` · `standard/registry.md` |
| CRUD·마스터디테일·엑셀 | `playbook/INDEX.md` |
| 인가·메뉴·코드·메시지 | `knowledge/INDEX.md` |
| 훅·스킬·문맥 | `harness/INDEX.md` |

표준이 없으면 새로 추정하지 말고 `sources/frontend/src/features/sample/`의 유사 실물을 읽는다.

## 4. 문서 예산 — 자리와 정본

1. `documents/`에는 [`artifact/INDEX.md`](aidd-guide/artifact/INDEX.md)에 등재된 자리만 만든다.
   새 종류는 지도에 목적·서식·소유자를 먼저 추가하고 사용자에게 이유를 보고한다.
2. 이 파일을 포함해 별도 정리·현황·근거·미룬 목록을 만들지 않는다. 현황은 `project.state.yaml`, 이유는 커밋 메시지,
   되돌리기 비싼 결정은 ADR, 미룬 일은 원래 자리에 `@defer <기한|?>`로 남긴다.
3. 한 사실은 한 곳에서만 정의하고 다른 곳은 링크한다.
4. 낡은 문서는 삭제하고, 삭제 사실은 별도 목록 없이 git 기록에 맡긴다.
5. 정본은 커밋하고 파생물은 손으로 고치지 않는다. 예외적으로 커밋하는 생성물은 시드 CSV뿐이다.

## 5. 절대 규칙 — 모든 응답과 변경에 적용

1. **한국어로 답한다.** 파일은 UTF-8(BOM 없음), LF로 유지한다.
2. **게이트를 건너뛰지 않는다.** Exit Criteria 충족과 사용자 명시 승인이 있어야 다음 단계로 간다.
   한 턴에 하나의 게이트만 넘는다. 소스 변경은 기능 소유 작업흐름 G3 승인 뒤에만 한다.
   G3 전 템플릿 보수는 사용자 확인과 `current.template_maintenance: true`를 첫 소스 커밋에 함께 담는다.
   DROP/TRUNCATE, `terraform apply`, `kubectl delete`, `git push --force`, 프로덕션 변경은 사용자가 직접 하거나 명시 승인한다.
3. 한 커밋은 한 가지 일이다. `<타입>: <현상> — <조치>` 형식의 한국어 제목과 본문 `왜`,
   마지막 trailer의 `Agent: <이름>`을 남기고 경로를 지정한다. 푸시는 요청받을 때만 한다.
4. `documents/spec/`이 유일한 진실이고 `documents/generated/`는 파생 뷰다.
5. 요구사항·유즈케이스·기능·엔티티·API·화면·테스트는 ID와 상위 ID 연결을 갖는다.
   미확인 전제는 `ASM-###`으로 `documents/decisions/ASSUMPTIONS.md`에 기록하고 산출물에서 참조한다.
6. 화면 문구는 `MSG` 키 + `label()`, 서버 문구는 `MsgKey` + `SYS_MESSAGE`를 쓴다.
   소스에 남는 로그·예외 폴백 메시지는 한국어로 쓴다.
7. 판단이 갈리는 표준·이름·경로·마이그레이션·삭제는 먼저 묻는다. 질문은 한 배치 최대 7개,
   `[필수]` 최대 3개이며 모두 권장안·영향·되돌리기 비용을 붙인다. 정해진 규칙은 진행 후 보고하고,
   큰 리팩터는 이유와 방법을 먼저 알린다.
8. 메뉴 트리·컨트롤러·`endpoints.ts`·`messageKeys.ts` 변경 시 생성 태스크로 시드 CSV를 갱신한다.
   적재된 changeset은 수정하지 않고 새 파일을 추가한다.
9. 큰 파일은 통째로 읽지 않고 검색으로 필요한 범위를 먼저 좁힌다.
10. 리뷰·점검은 문제·위험·누락부터 쓴다. 테스트 통과만으로 완료라 하지 않고 업무 규칙을
   뒤집었을 때 테스트가 실패하는지 확인한다.
11. 생성 산출물(시드 CSV · `manual.html` · 화면 index · `documents/generated/`)은 손편집하지 않는다.
   `mockup.html`은 그림만 편집하며 표와 확인 목록은 건드리지 않는다.
12. 게이트 승인에는 결정 카드(업무 언어 3~5줄)와 역질문 1~2개를 붙인다. 절차 축소 요청은
    `줄일 수 있음 / 절대 안 됨 / 지금은 빠르나 나중에 비쌈`으로 구분한다.
13. 대화에서 ID·번호·약자는 처음 한 번 괄호로 뜻을 푼다. 사전에 없으면 `user-guide/06-glossary.md`에 더한다.

## 6. 화면 문서와 개발 순서

### 6.1 경로

페이지 경로를 `documents/screen/` 아래에 그대로 미러링하고, 경로 변경 시 폴더도 같은 커밋에서 옮긴다.

### 6.2 문서 역할

화면 하나는 정본 `requirements.md`·`manual.md`와 파생 `mockup.html`·`manual.html`로 구성한다.
요건서는 AI에게 무엇을, 메뉴얼은 운영자에게 순서를, 목업은 설계자에게 그림을 말한다.
같은 사실을 중복하지 않는다. 목업에만 있는 규칙은 유실된 것이며 테스트 케이스는 요건서가 갖는다.
상세 역할은 [`documents/screen/README.md`](documents/screen/README.md)가 갖는다.

### 6.3 메뉴 개발 워크플로

```
① 요건 정의서 → ② 목업 → ③ 사용자 승인 → ④ 개발·시드 → ⑤ 사용자 테스트 → ⑥ 개선(①로)
```

- ①과 ②는 함께 내고, ③ 전에는 백엔드·프론트엔드·시드를 변경하지 않는다.
- ⑤ 사용자 테스트는 AI의 게이트 초록으로 대신하지 않는다.
- 기존 화면 수정도 달라지는 요건 → 목업 → 승인 순서로 되돌아간다. G3 이후면 `change-request`가 먼저다.
- 상세 절차는 [`artifact/screen/screen.md`](aidd-guide/artifact/screen/screen.md), 목업은 `mockup`, 제출본은 `manual-site`를 사용한다.

### 6.4 현행화

소스 변경 뒤 문서를 즉시 대조한다. 일치하면 고치지 않고, 다르면 같은 커밋에서 현행화한다.

### 6.5 소스 ↔ 문서 매핑

`doc-drift`와 `guide-drift`는 대상을 가리키며 수정 여부는 사람이 판단한다. 상세는
[`harness/hooks.md`](aidd-guide/harness/hooks.md)가 갖는다.

## 7. 검증 — 고쳤으면 돌린다

고친 범위에 맞는 검증을 [`quality/INDEX.md`](aidd-guide/quality/INDEX.md)에서 골라 실행한다.
초록을 확인하지 않은 변경은 완료가 아니며, 초록만으로 업무 완료를 선언하지 않는다. 최소 공통 문서 게이트는:

```bash
node aidd-guide/harness/runtime/harness-check.mjs && node aidd-guide/meta/_meta/lint.mjs && node .claude/hooks/trace-check.mjs --all
```

백엔드는 `sources/`에서 `./gradlew check -PskipFrontend`, 프론트엔드는 `sources/frontend/`에서
`npm run lint && npx tsc -b --noEmit && npm run test`를 실행한다.

## 8. 소스 규약 — 기계와 사람이 함께 지킨다

훅은 규칙의 원본이 아니다. 자동 차단이 없어도 문서 규칙은 유효하다. 집행 목록은
[`harness/automation-matrix.md`](aidd-guide/harness/automation-matrix.md), 현재 훅 목록은 생성물
[`user-guide/07-harness.md`](user-guide/07-harness.md)가 갖는다. 사람이 판단할 핵심 규약은:

- 조회는 `<기능>QueryService`, 명령은 `<기능>Service`; 쓰기 메서드는 트랜잭션을 표시한다.
- API는 `/api/{계층}/{도메인}/{동작}`이며 `service`는 POST다.
- 화면 뼈대는 `<FillColumn>` · `useSearchFormHeader()` · `auditColumns()` · `useGridController`를 따른다.
- HTTP 호출은 `api/{도메인}Api.ts`, URL 선언은 `features/{도메인}/api/endpoints.ts`에만 둔다.
- 공통물은 두 번째 사용에 `shared/`로 올리고 등록한 뒤 원본을 지운다. 복사하지 않는다.
- 새 소스 파일은 머리에 `@feat FEAT-###`를 둔다. 상세는 [`standard/INDEX.md`](aidd-guide/standard/INDEX.md)에서 진입한다.

## 9. 커밋 · 형상 관리

- 커밋은 stdin으로 메시지를 넘겨 `git commit -F - -- <경로…>`처럼 경로를 지정한다.
- 푸시는 사용자가 요청할 때만 한다. 커밋하는 생성물은 시드 CSV뿐이다.
- AI 커밋은 마지막 trailer 묶음에 저장소가 정한 `Agent: <이름>`을 남긴다.

## 10. `chat-history/` — 형상 관리 제외

대화는 결론의 근거일 뿐이며 요약은 사실의 원본이 아니다. 상세는
[`harness/memory/logs.md`](aidd-guide/harness/memory/logs.md)가 갖는다.

## 11. Claude Code와 Codex를 함께 쓸 때

- 공통 규칙은 이 파일, 공통 스킬 원본은 `aidd-guide/harness/skill-src/`, 공통 훅 의미는
  `aidd-guide/harness/hooks-contract.md`가 갖는다. 생성된 `SKILL.md`를 직접 고치지 않는다.
- 새 스킬·훅과 하네스 불일치는 `harness-sync`로 양쪽을 함께 맞추고 `harness-check`를 실행한다.
- 한 runtime에서 구현할 수 없는 차이는 provider 문서와 capability manifest에 근거를 남긴다.
- 병행 작업은 AI마다 별도 Git worktree/branch를 쓰며, 테스트를 통과한 작은 커밋으로 합친다.
- 컨텍스트 관리는 결과 동등성만 요구한다. Claude는 실측 경고, Codex는 자동 압축 뒤 재주입을 쓰며
  근거 없는 사용량 백분율을 만들지 않는다.
