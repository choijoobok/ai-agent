# 04. 빌드 · 배포

> **상세와 근거의 정본은 [`aidd-guide/standard/build-deploy.md`](../aidd-guide/standard/build-deploy.md) 다** —
> 파이프라인 단계도 그 파일이 단일 원본이며 `.github/workflows/` 가 그것을 가리킨다.
> 여기는 *사람이 실제로 치는 명령* 과 *배포 전에 확인할 것* 이다.

## 1. 산출물은 하나다 — 단일 JAR

```
sources/frontend/dist/            npm run build
        ↓ (Gradle copy)
bootstrap/build/resources/main/static/
        ↓
bootstrap-{version}.jar           ← 배포 대상은 이 하나
```

| | |
|---|---|
| **얻는 것** | 배포 대상이 하나 · 웹서버 별도 구성 불필요 · **동일 오리진이라 CORS 가 없고** 세션 쿠키가 자연스럽다 |
| **감수하는 것** | 프론트만 고쳐도 전체 재배포 · JAR 크기 · CDN 불가 |

**폐쇄망에 고객사 서버로 직접 구축하는 방식**이므로 이 선택이 맞는다 —
SaaS 가 아니고 고객사 간 버전이 갈릴 수 있는 것을 전제한다(CON-014).

## 2. 빌드

```bash
cd sources && ./gradlew clean :backend:bootstrap:bootJar
```

**`-PskipFrontend` 를 붙이지 않는다** — 붙이면 프론트가 임베드되지 않고 **배포본이 빈 화면이
된다.** 개발 중 백엔드만 확인할 때만 붙인다.

임베드가 실제로 들어갔는지 확인한다.

```bash
unzip -l sources/backend/bootstrap/build/libs/bootstrap-*.jar | grep 'BOOT-INF/classes/static/index.html'
```

> **CI 가 같은 검사를 한다.** `package` 잡이 JAR 안의 `static/index.html` 을 확인하고
> 없으면 실패한다 — **임베드가 조용히 빠지는 것이 가장 늦게 발견되는 사고**이기 때문이다.

## 3. 프로파일과 빌드 변형

| 프로파일 | 용도 | 특징 |
|---|---|---|
| `local` | 로컬 개발 | PostgreSQL(ICU) · 세션 스토어 `jdbc` · Swagger 노출 · SQL 로그 |
| 그 외 | 배포 환경 | 현재 저장소에는 설정 파일을 두지 않는다. 배포 환경이 명시 프로파일·데이터소스·비밀값을 제공한다. |

```bash
./gradlew :backend:bootstrap:bootRun -PincludeSample=true
```

- **비밀값은 파일에 두지 않고 환경 변수로 주입한다** (`DB_PASSWORD` · `REDIS_PASSWORD`).
  단 **암호화 키는 운영에서 키 파일이 기본**이고 환경 변수는 로컬·개발용이다.
- **Hub 를 얹으면 프로파일이 하나 더 갈린다** — LLM Provider 선택(개발기 CLI ↔ 운영 API)이
  프로파일 설정으로 전환된다(CON-033). **개발 환경의 CLI 로는 토큰 집계·스트리밍·동시성
  세 항목이 검증되지 않으므로**, API 구독 확보 직후 실환경에서 그 셋을 최우선 검증한다.
- **업무 DB·DW 데이터소스와 API 자격증명은 yml 에만 둔다.** 화면은 매핑과 참조 키만 관리하고
  접속 정보를 노출하지 않는다(ARCH-030).

`sample`은 local 변형에서만 포함된다. product JAR은 `./gradlew :backend:bootstrap:bootJar`로
만들며 sample 코드·화면·DB 기준선을 넣지 않는다.

## 4. 배포 전에 확인할 것

### 게이트 넷이 초록인가

```bash
node aidd-guide/meta/_meta/lint.mjs && node .claude/hooks/trace-check.mjs --all
```

```bash
cd sources && ./gradlew check && cd frontend && npm run lint && npm run typecheck && npm run test
```

### 시드가 소스와 일치하나

```bash
cd sources && ./gradlew :backend:bootstrap:checkSeeds -PincludeSample=true
```

**`checkSeeds`는 local 전용 생성물 검사다.** product `check`는 sample을 포함하지 않으므로 이
검사를 건너뛴다.

### DB 기준선이 올바른 master에 걸려 있나

product는 `db.changelog-master.yaml`, local은 `db.changelog-local.yaml`을 쓴다. 모듈 master에
새 파일을 include하지 않으면 기동해도 적재되지 않는다. `SeedChangelogIncludeTest`가 두 루트를
함께 검사한다.

### 이식성 (DB 를 바꿀 계획이 있을 때만)

```bash
cd sources && ./gradlew :backend:bootstrap:portabilityTest
```

Docker 로 4벤더를 띄워 스키마·정렬을 대조한다. **20분이 걸려 매 푸시에 태우지 않는다** —
자체 워크플로(`db-portability.yml`)가 changelog·엔티티 변경과 야간 스케줄로 돌린다.

## 5. CI — 무엇이 언제 도나

| 잡 | 언제 | 무엇을 |
|---|---|---|
| **backend** | push(main) · PR · 수동 | `./gradlew build -PskipFrontend` — 컴파일 · 단위테스트 · ArchUnit · Spotless |
| **frontend** | 〃 | `npm ci` → lint → test → build |
| **package** | **수동만** | 단일 JAR + **프론트 임베드 검증** |
| **db-portability** | changelog·엔티티 변경 · 야간 | 4벤더 스키마·정렬 대조 |

- **`documents/**` · `aidd-guide/**` · `developer-guide/**` · `**/*.md` 만 바뀐 푸시는 CI 를 돌리지
  않는다** — 문서 트랙의 커밋이 다수가 되면 빌드 큐가 그것으로 찬다. PR 에서는 항상 돈다.
- **`package` 가 수동인 이유는 배포 대상이 아직 없어서다.** 배포가 생기면 그 조건을 지운다.
- **빌드 루트가 `sources/` 이므로 워크플로의 모든 잡이 `working-directory: sources` 를 갖는다.**
  경로를 고칠 때 이것을 함께 본다.

## 6. 운영 이관

**고객사 서버에 직접 구축하고 이관 후에는 고객사별로 개별 유지보수한다.**

| 확인할 것 | 어디서 |
|---|---|
| 아웃바운드 허용 (**도메인 기준**) · 프록시 정보 · 인바운드 미허용 | CON-013 — **고객사 인프라 영역이며 제품 기능이 아니다** |
| 업무 DB 읽기 전용 계정 + **메타데이터 조회 권한** | CON-018 — 없으면 카탈로그 자동 수집이 불가하다 |
| API 서비스 계정과 인증 방식 · 호출 허용 대역 | CON-019 |
| 백업·복구 RPO·RTO — **설정·정책과 이력은 주기를 분리한다** | CON-026 |
| 모니터링 — **화면은 제품 기능이 아니다.** 고객사 도구가 긁어 갈 지점만 노출한다 | CON-027 |
| 이력 용량 산정 — **재개 상태가 스텝마다 메시지 전량을 저장하므로 별도 항목으로 넣는다** | CON-025 |
| 대화 이력 보관 기간·파기 방식의 **법무·보안 검토** | CON-032 |

> **착수 시 확정 항목 18개가 전부 `documents/spec/02-constraints.yaml` 에 있다.**
> 시스템 기능이 아니므로 값을 우리가 정하지 않는다 — 대신 **확정되지 않은 상태로 구축에
> 들어가지 않는다**는 것을 요건으로 둔다.

## 관련

- 파이프라인의 정본 — [`aidd-guide/standard/build-deploy.md`](../aidd-guide/standard/build-deploy.md)
- 배포 후 무엇을 보나 — [05-operate.md](05-operate.md)
- 인도 단계 절차 — [`aidd-guide/phase/P6-deliver.md`](../aidd-guide/phase/P6-deliver.md)
- 사용자 메뉴얼 확인·캡처 치환 — `/manual-site` 스킬
- 설계·사용자·운영 오프라인 제출본 만들기 — `/deliverable-site` 스킬
