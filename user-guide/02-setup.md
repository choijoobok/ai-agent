# 02. 개발 환경 구축

> **빌드 루트는 `sources/` 다.** `./gradlew` · `npm` 명령은 거기서 돈다.
> 문서에 적히는 **파일 경로는 저장소 루트 기준**(`sources/backend/…`)이고
> **빌드 명령은 `sources/` 기준**이다 — CLAUDE.md §1 이 그 규칙의 정본이다.

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
  폐쇄망에서 `npm i` 없이 서야 하기 때문이다([`harness/hooks.md`](../aidd-guide/harness/hooks.md)).

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

두 가지 방식이 있고 목적이 다르다.

### 개발 중 — 백엔드와 프론트를 따로

```bash
cd sources && ./gradlew :backend:bootstrap:bootRun --args='--spring.profiles.active=local'
```

```bash
cd sources/frontend && npm run dev
```

- 프론트는 **3000** 포트, 백엔드는 **8080**. Vite 가 `/api` 를 백엔드로 프록시한다
  (`VITE_API_TARGET` 으로 바꿀 수 있다).
- **프론트만 고칠 때는 백엔드를 재기동하지 않는다** — HMR 이 받는다.

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
| `checkSeeds` 가 깨진다 | 선언(`menu-tree.yaml` · 컨트롤러 · `endpoints.ts` · `messageKeys.ts`)을 고치고 시드를 다시 만들지 않았다 → `cd sources && ./gradlew generateSeeds` |
| Liquibase `checksum` 오류 | **이미 적재된 changeset 을 고쳤다.** 되돌리고 **새 파일을 더한다** — 고치면 남의 로컬이 죽는다 |
| 문서 린터가 `broken link` | 파일을 옮기고 링크를 안 고쳤다. **경로를 손으로 세지 말고** 린터가 가리키는 자리를 본다 |
| 화면이 빈 페이지 (JAR 실행) | 프론트 임베드가 빠졌다 → `./gradlew :backend:bootstrap:bootJar` 를 `-PskipFrontend` **없이** 돌린다 |
| ESLint 가 한글 문자열을 막는다 | **의도된 차단이다.** 화면 문구는 `MSG` 키 + `label()` 로 쓴다(CLAUDE.md §5-6) |
| 커밋이 훅에 막힌다 | 경로를 지정하지 않았거나 메시지에 큰따옴표를 썼다 → `git commit -F - -- <경로…>` |
| AI 가 `documents/` 에 문서를 못 만든다 | **문서 예산이다**(CLAUDE.md §4). 산출물 지도에 자리가 없다 |
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
