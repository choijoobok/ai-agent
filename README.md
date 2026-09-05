# ai-agent — 기업용 Agentic AI Hub

여러 레거시 업무 시스템을 **하나의 대화 창구**로 모아, 자연어로 조회·실행·자동화한다.
백오피스 템플릿 위에 `admin` · `portal` · `agent` 세 모듈을 얹는다.

**AI 가 PM·BA·AA·DBA·개발자·테스터를 겸임하고 사용자는 고객이자 의사결정자다.**
그래서 이 저장소는 *코드 저장소* 가 아니라 **프로세스·규칙·산출물·코드가 함께 사는 곳**이다.

---

## 폴더 넷 — 나누는 축은 *누가 읽나* 다

| 폴더 | 무엇 | 읽는 사람 |
|---|---|---|
| **[`aidd-guide/`](aidd-guide/INDEX.md)** | **AI 가 읽는 규칙** — 프로세스(단계·게이트·추적성) + 개발 표준(백엔드·프론트·레시피) | AI · 표준을 찾는 개발자 |
| **[`documents/`](documents/INDEX.md)** | **AI 가 만드는 산출물** — spec(SSOT) · 결정 · 화면 문서 셋 · 생성 문서 | 설계자 · 승인자 |
| **[`user-guide/`](user-guide/INDEX.md)** | **사람이 읽는 안내** — 수행 방법 · 환경 구축 · 개발 · 빌드·배포 · 운영 | 프로젝트에 들어온 사람 |
| **[`sources/`](sources/)** | **코드** — 백엔드 · 프론트엔드. **빌드 루트가 여기다** | 개발자 |

**주제로 나누지 않았다.** "테스트" 는 규칙·절차·산출물·코드 넷에 걸치는데, 주제로 나누면
그 넷이 한 폴더에 섞이고 **읽는 사람이 자기 것을 못 찾는다.** 독자로 나누면 각 폴더가 한
종류의 독자에게만 답하므로, **새 문서를 어디 둘지가 물어보지 않아도 정해진다.**
→ [`CLAUDE.md`](./CLAUDE.md)

그 밖에 [`CLAUDE.md`](CLAUDE.md)(**헌법** — AI 가 매 세션 읽는 유일한 문서) ·
[`.claude/`](.claude/settings.json)(훅 아홉 · 스킬 열셋) · `.github/`(CI) 가 루트에 있다.

---

## 처음 왔다면

```
① 이 파일                     무엇을 만드는 프로젝트인가            5분
② user-guide/01-project.md    어떻게 굴러가는가 · 내 역할          15분
③ user-guide/02-setup.md      환경을 만든다                      30분~2시간
④ CLAUDE.md                   AI 가 지키는 규칙 — 사람도 한 번은   20분
⑤ aidd-guide/INDEX.md         규칙이 어디 있는지의 지도 (통독 금지)
```

**④를 건너뛰지 않는다.** AI 가 무엇을 지키도록 되어 있는지 모르면 결과물이 *왜 그렇게
나왔나* 를 판단할 수 없다.

```bash
cd sources/frontend && npm ci
```

```bash
cd sources && ./gradlew build -PskipFrontend
```

---

## 지금 어디까지 왔나

**[`documents/project.state.yaml`](documents/project.state.yaml) 하나가 그 답이다.**
Claude Code 에서는 `/pm-status`.

| | |
|---|---|
| **단계** | P0 착수 — **게이트 승인 전이다** |
| **들어온 것** | 요구사항 59 · 기능 85 · 화면 43 · 비기능 19 · 용어 35 · 액터 11 · 원칙 10 (전부 `status: migrated` — **미승인**) |
| **비어 있는 것** | 업무 프로세스 · 유즈케이스 · 데이터 모델 · API · **테스트 케이스** — 원본에 없었고 **지어내지 않았다** |
| **막혀 있는 것** | OQ-001(승인 순서) · OQ-002(1차 적용 업무) |

```bash
node .claude/hooks/trace-check.mjs --all
```

**이 명령은 지금 오류를 낸다** — 기능 85건과 비기능 19건에 TC 가 없다.
**그것이 사실이며 G3 를 통과할 수 없다는 뜻이다.**

---

## 세 저장소를 합쳐 만들었다

| 물려받은 것 | 어디서 | 강점 |
|---|---|---|
| **개발 표준** — `aidd-guide/standard` · `playbook` · `knowledge` (157파일 26,492줄) | ordinary-backoffice | 승인 뒤 *코드를 어떻게 쓰나* · **기계가 막는 게이트 열넷** |
| **프로세스** — `aidd-guide/process` · `phase` · `artifact` | ai-driven-development | 요구사항부터 인수까지 *언제 무엇을 승인받나* |
| **설계** — `documents/spec` · `design` (3,479줄 재편성) | agentic-ai | 실제로 만들 시스템 |

**셋이 공통으로 앓던 병이 하나였다** — 문서를 정리하면 정리 내역을 적는 문서가 생기고,
그 근거를 적는 문서가 또 생긴다. 그래서 **문서 예산**을 기계로 강제한다:
`documents/` 에 만들 수 있는 자리는 [산출물 지도 40행](aidd-guide/artifact/INDEX.md)이 정하고
`guard-write` 훅이 **지도 밖의 새 문서를 차단한다**(CLAUDE.md §4).

**옛 저장소를 지우지 않는다** — 재편성에서 잃은 것이 있는지 확인할 유일한 수단이다.

---

## 검증 — 게이트 넷

```bash
node aidd-guide/meta/_meta/lint.mjs
```

```bash
node .claude/hooks/trace-check.mjs --all
```

```bash
cd sources && ./gradlew check -PskipFrontend
```

```bash
cd sources/frontend && npm run lint && npm run typecheck && npm run test
```

**빌드 루트는 `sources/` 다.** 문서의 **파일 경로는 저장소 루트 기준**이고
**빌드 명령은 `sources/` 기준**이다.

---

## 규칙 다섯 — 나머지는 CLAUDE.md 가 갖는다

1. **한국어 · UTF-8(BOM 없음) · LF.**
2. **게이트를 건너뛰지 않는다.** 되돌릴 수 없는 것은 사용자가 직접 하거나 명시 승인한다.
3. **`documents/spec/` 이 유일한 진실이다.** `documents/generated/` 는 파생 뷰이며 손으로
   고치지 않는다.
4. **자리가 정해진 것만 만든다** — 문서 예산.
5. **한 커밋은 한 가지 일이다.** `git commit -F - -- <경로…>` · 푸시는 요청할 때만.
