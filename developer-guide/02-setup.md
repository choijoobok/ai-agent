# 02. 개발 환경 구축

> **빌드 루트는 `sources/` 다.** `./gradlew` · `npm` 명령은 거기서 돈다.
> 문서에 적히는 **파일 경로는 저장소 루트 기준**(`sources/backend/…`)이고
> **빌드 명령은 `sources/` 기준**이다 — AGENTS.md §1 이 그 규칙의 정본이다.

## 1. 필요한 것

| 것 | 버전 | 왜 이 버전인가 | 확인 |
|---|---|---|---|
| **JDK** | **25** | 백엔드가 그 위에 서 있다 | `java -version` |
| **Node** | **22** (하한 `^20.19.0 \|\| ^22.13.0 \|\| >=24`) | `sources/.nvmrc` 가 22 를 고정한다. ESLint 10 이 `^22.13.0` 을 요구한다 | `node -v` |
| **PostgreSQL** | 16+ | 로컬 프로파일이 `jdbc:postgresql://localhost:5432/bo` 를 본다. **AI 전용 DB 는 PostgreSQL 고정**(CON-001) | `psql --version` |
| **Git** | 2.40+ | — | `git --version` |
| **Docker** | (선택) | 이식성 테스트(4벤더)에만 필요하다 | `docker info` |

- **Gradle 은 따로 설치하지 않는다** — 래퍼가 9.5.1 을 받아온다.
- **Node 는 `nvm` 을 권한다** — `sources/.nvmrc` 가 있으므로 `nvm use` 한 줄이면 맞는다.
- **AI 도구는 `node` 하나만 요구한다.** 훅과 문서 린터가 의존성 0 으로 돈다 —
  폐쇄망에서 `npm i` 없이 서야 하기 때문이다([`harness/hooks-contract.md`](../aidd-guide/harness/hooks-contract.md)).
- Claude Code는 `CLAUDE.md`가 공통 헌법을 가져온다. Codex는 `AGENTS.md`를 직접 읽고,
  첫 실행이나 훅 변경 뒤 `/hooks`에서 프로젝트 훅을 검토·신뢰해야 한다.

## 2. 받는 순서

```bash
git clone <저장소> ai-agent && cd ai-agent
```

```bash
cd sources/frontend && npm ci
```

```bash
cd sources && ./gradlew build -PskipFrontend
```

- **`npm ci` 를 쓴다.** `npm install` 은 lock 을 갱신해 남의 로컬과 버전이 갈린다.
- **`-PskipFrontend`** 는 백엔드만 만질 때 프론트 빌드를 건너뛴다. 프론트를 JAR 에 임베드하는
  경로가 있어, 빼지 않으면 백엔드 테스트 한 번에 `npm run build` 가 함께 돈다.

## 3. DB 준비

로컬 프로파일이 보는 기본값이다. 환경 변수로 바꿀 수 있다.

| 항목 | 기본값 | 환경 변수 |
|---|---|---|
| 호스트 | `localhost` | `DB_HOST` |
| 포트 | `5432` | `DB_PORT` |
| 데이터베이스 | `bo` | `DB_NAME` |
| 사용자 | `bo_admin` | `DB_USER` |

```bash
psql -U postgres -c "CREATE DATABASE bo" -c "CREATE USER bo_admin PASSWORD '<비밀번호>'" -c "GRANT ALL ON DATABASE bo TO bo_admin"
```

- **스키마와 시드는 Liquibase 가 만든다.** 애플리케이션을 처음 띄우면 changelog 가 적재된다.
  DDL 을 손으로 넣지 않는다.
- **비밀번호를 `application-local.yml` 에 적지 않는다.** 환경 변수로 주입한다 —
  `application-local.yml` 자체는 형상 관리에 들어 있다(템플릿을 받은 사람이 *로컬을 어떻게
  띄우나* 의 답을 가져야 하기 때문이다).

## 4. 띄우는 법

세 가지 방식이 있고 목적이 다르다.

### 개발 중 — 백엔드와 프론트를 따로

```bash
cd sources && ./gradlew :backend:bootstrap:bootRun -Pprofile=local
```

```bash
cd sources/frontend && npm run dev
```

- 프론트는 **3000** 포트, 백엔드는 **8080**. Vite 가 `/api` 를 백엔드로 프록시한다
  (`VITE_API_TARGET` 으로 바꿀 수 있다). **화면은 3000 으로 본다.**
- **`-Pprofile=local`을 반드시 붙인다.** local 프로파일은 `skipFrontend`와 `includeSample`을
  기본으로 켠다 — 개발 중에는 Vite dev 서버가 화면을 주므로 프론트 임베드 산출물을 쓰지 않는다.
  개발·운영 프로파일은 둘 다 반대가 기본이며, 명시한 옵션이 프로파일 기본값보다 우선한다.
- **일반 `build`·`bootJar`·`check`는 제품 변형이 기본이다.** sample을 제외하고 프론트를
  포함한다([04-release.md](04-release.md) §2).
- **`-PincludeSample` 은 DB 까지 가른다.** local에서 false를 명시하면 처리된 설정도 제품 master
  changelog를 가리켜 sample 클래스·화면·API·시드를 함께 제외한다.
- **그래서 8080 루트는 404 다.** 프론트를 안 실었으니 맞다 — 없는 것을 있는 척하지 않는다.
- **프로파일은 항상 적는다.** `bootRun`은 `-Pprofile=local|dev|운영 프로파일`만 받는다.
  `--args=`나 `SPRING_PROFILES_ACTIVE`로 대신하지 않는다 — 전자는 태스크 인자와 겹치고,
  후자는 Gradle 데몬 환경이라 재사용 시 조용히 어긋날 수 있다.
- **`application.yml`에는 기본 프로파일이 없다.** `java -jar`과 IDE 직접 실행도 반드시
  `--spring.profiles.active=...` 또는 동등한 외부 설정을 준다. 누락하면 데이터소스가 외부에서
  주어져 있어도 활성 프로파일 가드가 기동을 거부한다.
- **프론트만 고칠 때는 백엔드를 재기동하지 않는다** — HMR 이 받는다.
- 프로파일 넷의 용도는 [04-release.md](04-release.md) §3 이 갖는다.

### 배포본 확인 — 단일 JAR

```bash
cd sources && ./gradlew :backend:bootstrap:bootJar
```

```bash
java -jar sources/backend/bootstrap/build/libs/bootstrap-0.0.1-SNAPSHOT.jar --spring.profiles.active=local --server.port=8081
```

**프론트가 JAR 에 임베드된다.** 8081 하나로 화면까지 뜬다 —
**임베드가 조용히 빠지면 배포본이 빈 화면이 되므로** CI 가 그것을 검사한다([04-release.md](04-release.md)).

> Claude Code 에서는 `.claude/launch.json` 의 `frontend` · `packaged` 로 띄울 수 있다.

### IntelliJ 로 띄울 때 — **빌드·실행 위임을 Gradle 로 둔다**

`Settings → Build, Execution, Deployment → Build Tools → Gradle` 에서
*Build and run using* · *Run tests using* 를 **Gradle** 로 둔다.

- **local 개발 프로젝트 동기화에는 `-Pprofile=local`을 준다.** 같은 화면의 *Gradle* 설정, 또는
  `Gradle 도구창 → Run Configurations` 가 아닌 **Settings 의 Gradle *Arguments*** 에 넣는다.
  프로파일은 sample 모듈을 프로젝트 모델에도 포함한다. 개발·운영 대상 프로젝트라면 해당
  프로파일로 바꾸며, 제품 JAR을 만들 때는 local 프로파일을 남겨 두지 않는다.
- **IDEA 빌더로 두면 `check` 가 돌지 않는다.** 그러면 `checkSeeds` 도 돌지 않아
  **시드가 소스와 어긋난 사실을 아무도 말해 주지 않는다.** 증상은 화면의 **403** 으로만
  나타나고([seed.md](../aidd-guide/standard/seed.md) §3), 원인이 시드라고 적힌 곳이 없다.
- **시드는 어느 방식으로도 자동 생성되지 않는다.** `generateSeeds` 는 `bootRun` 에도
  `build` 에도 걸려 있지 않다. 선언(`menu-tree.yaml` · 컨트롤러 · `endpoints.ts` ·
  `messageKeys.ts` · **그 상수 바로 앞 주석**)을 고쳤으면 **그 자리에서** 손으로 돌린다 —
  `cd sources && ./gradlew generateSeeds`. 절차는 [seed.md](../aidd-guide/standard/seed.md) §2.
- **`main()` 을 직접 실행하면 프로파일이 없다.** 실행 구성의 *Program arguments* 에
  `--spring.profiles.active=local` 을 넣거나, **`bootRun` 태스크를 부르는 Gradle 실행 구성**을
  쓴다 — 후자가 낫다. 기본 프로파일을 아는 자리가 태스크 하나로 유지된다.
- QueryDSL 의 `Q` 클래스와 `build-info.properties`(`/api/system/info` 의 커밋·빌드 시각)도
  Gradle 이 만든다. **위임을 Gradle 로 두면 셋이 한꺼번에 해결된다.**

## 5. 잘 됐는지 확인 — 게이트 넷

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

| 게이트 | 무엇을 보나 | 지금 상태 |
|---|---|---|
| 문서 린터 | 메타블록 · 200줄 · BOM · **깨진 링크** | **위반 0 이어야 한다** |
| 추적성 | T1~T12 — dangling ID · 미실현 요구사항 · 고아 기능 · TC 없는 FEAT | **오류가 난다** — TC 가 아직 없다(아래) |
| 백엔드 | 컴파일 · 단위테스트 · ArchUnit · Spotless · `checkSeeds` | 초록이어야 한다 |
| 프론트 | ESLint · 타입 · Vitest | 초록이어야 한다 |

> **추적성 게이트가 빨간 것은 정상이다.** 기능 85건과 비기능 19건에 테스트 케이스가 없어서다 —
> **그것이 사실이며 G3 를 통과할 수 없다는 뜻이다**(`documents/project.state.yaml` 의
> `counter_note`). 지어낸 TC 로 초록을 만들지 않았다.

## 6. 막힐 자리

| 증상 | 원인과 조치 |
|---|---|
| `./gradlew` 가 안 돈다 | `sources/` 에서 돌리고 있는지 본다 — **빌드 루트는 저장소 루트가 아니다** |
| 백엔드 테스트에서 `npm` 을 찾는다 | `-PskipFrontend` 를 빼먹었다 |
| local 백엔드만 띄우는데 **프론트가 통째로 빌드된다** | `-Pprofile=local`이 빠졌거나 다른 프로파일이다(§4) |
| local인데 sample이 보이지 않는다 | `-PincludeSample=false`가 명시됐는지 본다. false면 제품 master changelog를 쓰는 것이 정상이다(§4) |
| **8080 이 404** (개발 중) | **정상이다.** 프론트를 안 실었다 — 화면은 **3000** 으로 본다 |
| `활성 프로파일이 없다`로 기동 실패 | `bootRun`은 `-Pprofile=...`, `java -jar`·IDE 직접 실행은 `--spring.profiles.active=...`를 준다 |
| 화면이 **403** 인데 코드는 맞다 | 선언을 고치고 시드를 다시 안 만들었다 → `./gradlew generateSeeds`. **IntelliJ 를 IDEA 빌더로 쓰면 `checkSeeds` 가 안 돌아 이것이 안 잡힌다**(§4) |
| `checkSeeds` 가 깨진다 | 선언(`menu-tree.yaml` · 컨트롤러 · `endpoints.ts` · `messageKeys.ts`)을 고치고 시드를 다시 만들지 않았다 → `cd sources && ./gradlew generateSeeds` |
| Liquibase `checksum` 오류 | **이미 적재된 changeset 을 고쳤다.** 되돌리고 **새 파일을 더한다** — 고치면 남의 로컬이 죽는다 |
| 문서 린터가 `broken link` | 파일을 옮기고 링크를 안 고쳤다. **경로를 손으로 세지 말고** 린터가 가리키는 자리를 본다 |
| 화면이 빈 페이지 (JAR 실행) | 프론트 임베드가 빠졌다 → `./gradlew :backend:bootstrap:bootJar` 를 `-PskipFrontend` **없이** 돌린다 |
| ESLint 가 한글 문자열을 막는다 | **의도된 차단이다.** 화면 문구는 `MSG` 키 + `label()` 로 쓴다(AGENTS.md §5-6) |
| 커밋이 훅에 막힌다 | 경로를 지정하지 않았거나 메시지에 큰따옴표를 썼다 → `git commit -F - -- <경로…>` |
| AI 가 `documents/` 에 문서를 못 만든다 | **문서 예산이다**(AGENTS.md §4). 산출물 지도에 자리가 없다 |
| AI 가 `sources/` 를 못 고친다 | **G3 미승인이다.** 템플릿 보수라면 `project.state.yaml` 의 `template_maintenance: true` |

## 7. 편집기 설정

- **UTF-8 (BOM 없음) · LF.** `.gitattributes` 가 `* text=auto eol=lf` 로 강제하고,
  `normalize-encoding` 훅이 AI 의 쓰기 직후 고친다. **사람의 편집기도 맞춰 둔다** —
  안 맞으면 줄끝만 다른 허위 변경이 diff 를 덮는다.
- 예외는 `*.bat` · `*.cmd` (CRLF).

## 관련

- 빌드·배포의 상세 — [04-release.md](04-release.md) ·
  [`aidd-guide/standard/build-deploy.md`](../aidd-guide/standard/build-deploy.md)
- 스택과 제약 — [`documents/spec/02-constraints.yaml`](../documents/spec/02-constraints.yaml)
- 시드를 만드는 절차 — [`aidd-guide/standard/seed.md`](../aidd-guide/standard/seed.md)
- 손으로 쓰는 changeset — [`aidd-guide/playbook/changeset.md`](../aidd-guide/playbook/changeset.md)
