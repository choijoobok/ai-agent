---
id: LLM-FWK-004
title: "생성 시드 — 절차와 검증"
category: standard
type: operation
created: 2026-09-03
updated: 2026-09-03
status: active
sources: ["sources/backend/bootstrap/build.gradle.kts", "aidd-guide/standard/seed.md"]
tier: 1
tags: [seed, liquibase, gradle, authz, message]
---

# 생성 시드 — 절차와 검증

> **시드는 생성물이다**(CLAUDE.md §5-8). 손으로 고치면 훅이 막고, 막히지 않는 것은
> **다음 생성에서 사라진다.**
>
> *왜 생성하는가* 는 ADR 이 갖는다. **이 문서는 사람이 하는 절차만 갖는다.**

## 1. 생성물은 넷, 태스크는 여섯

| 태스크 | 입력 | 산출물 | DB 반영 |
|---|---|---|---|
| **`generateMenuSeed`** | `menu/menu-tree.yaml` (사람이 쓰는 선언) | `003-init-menu.csv` | **upsert — 삭제하지 않는다.** 선언에서 사라진 메뉴는 `SRC_CD='ORPHAN'` |
| **`generateApiSeed`** | 컨트롤러 `@RequestMapping`(`/api/service/**`) · `@Operation` · 프론트 `endpoints.ts` · `screenRegistry.ts` · `menu-tree.yaml` | `006-init-api.csv`<br>`007-init-menu-api.csv` | **전건 삭제 → 전건 삽입** |
| **`generateMessageSeed`** | 프론트 `MSG` · 백엔드 `MsgKey`(+`ErrorCode`) **+ 직전 시드 파일** | `008-init-message-key.csv` | **없는 것만 추가** + `USE_SCOPE` 전건 재계산 |
| `check*Seed` 셋 | 위 + **커밋본** | — (비교) | — |

```bash
./gradlew generateSeeds     # 셋을 함께
./gradlew checkSeeds        # 셋을 함께 — check 에 연결돼 있다
```

> **태스크를 따로 기억하게 두지 않는다.** 하나만 돌린 커밋이 생기고, 그때 막는 것은
> CI 뿐이다. 묶어 두면 *"시드를 다시 만든다"* 가 **명령 하나**이며, 태스크가 다섯째로
> 늘어도 개발자가 외울 것이 늘지 않는다.

**메뉴가 먼저가 아니라 입력이 같다.** `generateApiSeed` 는 `MENU_CD ↔ MENU_URL` 을 읽어야
매핑을 만드는데, 둘이 **같은 선언 파일**을 읽는다 — 그래서 *어느 메뉴 파일을 읽나* 라는
질문이 없다.

### 사슬은 도메인 단위다 — 폴더 하나에 화면 하나

```
menu/menu-tree.yaml        MENU_CD  ↔  MENU_URL
screenRegistry.ts          MENU_URL  →  @/features/{도메인}
{도메인}/api/endpoints.ts   →  /api/service/** 들
```

**`screenRegistry` 에 있는데 선언에 없으면 실패다** — 그 화면은 메뉴 트리에 없어 열 수
없다. 반대 방향(선언에 있는데 `screenRegistry` 에 없음)은 **아직 만들지 않은 화면**이라 정상이다.

## 2. 절차 — 순서는 하나다

| # | 고친 것이 | 하는 일 |
|---|---|---|
| 1 | **컨트롤러** | 경로를 `/api/service/{도메인}/{동작}`. 접두가 동작과 다르면 `@ApiActionType`. **`@Operation(summary=…)` 필수** |
| 2 | **프론트 화면** | 호출 URL 을 `endpoints.ts` 에 모은다 — **리터럴 금지**(ESLint) |
| 3 | **메시지** | `MSG` · `MsgKey` 상수에 키를 넣는다 — **리터럴 금지**(ESLint · ArchUnit) |
| 4 | **신규 메뉴** | `menu/menu-tree.yaml` 에 줄 추가 — `MENU_CD` · `UP_MENU_CD` · `MENU_URL` · `EXPORT_YN` |
| 5 | — | **`./gradlew generateSeeds`** |
| 6 | — | **로컬 확인** — 재기동 후 화면 진입(§3) |
| 7 | — | **한 커밋** — 소스 · 상수 · 시드를 함께 |
| 8 | — | **CI `checkSeeds`** — 5 를 잊었으면 여기서 막힌다 |
| 9 | — | **배포 전 검증**(§5) → 배포 |

**기존 화면에 API 만 더하면 4 가 빠지고, 문구만 고치면 3·5·7·8 만 돈다.**
메시지 **값(번역)** 을 채우는 것은 이 절차가 아니라 **화면과 엑셀**이다 — 시드에 값이 없다.

> **주석도 생성 입력이다.** 메시지 키 시드의 설명 칸은 상수 **바로 앞의 JSDoc/Javadoc** 에서
> 오고, `@Operation(summary)` 도 마찬가지다. 그래서 **한 글자만 고쳐도 5 를 돌려야 한다** —
> *주석만 고쳤으니 생성물은 그대로겠지* 가 이 절차를 어기는 가장 흔한 방법이다.
> 2026-09-05 에 소스 주석 650곳을 고친 커밋이 시드를 재생성하지 않아 `checkSeeds` 가
> **21행에서 빨간 채로 하루를 갔다**(다음 날 실험 중에 발견됐다).

### 한 커밋이어야 하는 이유가 둘

| | |
|---|---|
| **리뷰** | *"이 API 를 이 메뉴에 여는 것이 맞는가"* 는 컨트롤러와 시드 diff 를 **함께** 봐야 판단된다. **매핑 행 추가가 곧 접근 범위 확장이다** |
| **CI** | 시드 커밋이 뒤로 밀리면 그 사이의 커밋에서 `checkSeeds` 가 깨진다 — **고친 사람이 아닌 사람의 PR 이 막힌다** |

**둘째가 실무에서 더 자주 아프다. 시드를 나중에 몰아서 만들지 않는다.**

## 3. 로컬 확인에서 드러나는 것

| 증상 | 원인 |
|---|---|
| **403** | `endpoints.ts` 미선언 또는 5 를 안 돌렸다 |
| 액션이 틀렸다 | **접두 오타** — `svae` 는 `EXECUTE` 로 떨어진다 |
| 화면에 **키 문자열**이 보인다 | 값이 아직 없다 — **정상이며 진단이다** |
| 역할 권한 트리의 출력 열이 `—` | 부를 API 가 없는 액션이다 — `EXPORT_YN` 을 보라 |

## 4. 여럿이 동시에 고칠 때 — 생성물의 충돌은 손으로 풀지 않는다

```bash
git pull --rebase
git checkout --ours -- '**/00*-init-*.csv'   # 어느 쪽이든 상관없다
./gradlew generateSeeds                       # 선언에서 다시 만든다
git add . && git rebase --continue
```

| 규칙 | 왜 |
|---|---|
| **손으로 푸는 것은 선언 파일뿐** | `menu-tree.yaml` · `endpoints.ts` · `MSG` · `MsgKey`. 생성물은 **선언의 함수**라 재계산으로 언제나 복구된다 |
| **CSV 를 편집해 충돌을 풀지 않는다** | 줄을 지우거나 남기는 판단을 하는 순간 **선언과 어긋나고**, `checkSeeds` 가 다음 CI 에서 막는다 — 그때 원인이 머지였다는 것을 알기 어렵다 |

### 브랜치를 바꿔도 로컬 DB 를 지우지 않는다

| 상황 | 무엇이 일어나나 |
|---|---|
| 다른 브랜치로 이동 후 기동 | `runOnChange` 가 **전건 upsert** → 메뉴가 소스와 일치한다 |
| 옛 브랜치에서 만든 메뉴 | **지워지지 않고 `SRC_CD='ORPHAN'`.** 트리에서 갈려 보이고 **기동은 정상** |
| 그 브랜치로 되돌아가면 | 다음 기동에서 **`SEED` 로 돌아온다** |
| **DB 를 지워야 하는 때** | **스키마 changeset 이 바뀌었을 때뿐이다** — 그쪽은 누적이며 `runOnChange` 를 쓰지 않는다 |

**`ORPHAN` 은 로컬에서 지우지 않는다.** 운영에서는 사람이 화면에서 지우며,
순서는 *엔드포인트 선언 제거 → 시드 재생성 → 배포 → 메뉴 삭제* 다.

## 5. 배포 전 검증 — 둘이다

| 무엇 | 태스크 | 답하는 질문 |
|---|---|---|
| **무엇이 실행될지 본다** | `updateSql` | *이 배포가 DB 에 무슨 SQL 을 던지나* |
| **무엇이 고아가 되는지 센다** | `reportSeedImpact` | *전건 삭제로 사라지는 매핑이 몇인가* |

**이름이 하나였을 때 둘째가 없는 것처럼 보였다.** `updateSql` 은 SQL 을 보여줄 뿐
*그 삭제가 누구의 권한을 없애는가* 는 말하지 않는다.

## 6. 손으로 쓰는 시드와 섞이지 않는다

| | 파일 | 고치는 법 |
|---|---|---|
| **생성물** | `003` · `006` · `007` · `008` | **선언을 고치고 다시 만든다.** 손편집은 훅이 차단 |
| **손으로 쓰는 시드** | 부트스트랩 권한 · 코드 · 메시지 **값** | **새 changeset 을 더한다** — 이미 적재된 것을 고치면 남의 로컬이 checksum 으로 죽는다 |

**섞이지 않는 대신 잊히는 자리가 하나 있다.** 새 파일은 `db.changelog-master.yaml` 에
**직접 걸어야** 하는데(`includeAll` 이 아니다), 잊어도 `checkSeeds` 는 생성물만 보고
시드 테스트는 **폴더를 훑으므로** 전부 초록이다. `SeedChangelogIncludeTest` 가 그 대조를
한다 — 자세한 것은 [playbook/changeset.md](../playbook/changeset.md).

## 관련

- [standard/backend/api.md](./backend/api.md) — 접두가 액션을 정한다
- [standard/backend/security.md](./backend/security.md) — 인가 사실이 데이터인 이유
- [standard/frontend/http.md](./frontend/http.md) — `endpoints.ts` 선언
- [CLAUDE.md §5-8 · §7](../../CLAUDE.md) — 시드는 생성물이다 · 게이트
