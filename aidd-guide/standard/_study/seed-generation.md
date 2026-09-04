---
id: LLM-FWK-S001
title: "생성 시드 — 원문"
category: "06-framework"
type: study
created: 2026-08-28
updated: 2026-09-03
status: active
sources: ["(원본) docs/design/33-seed-generation-guide.md — 2026-09-04 폐지"]
author: Bong Jong Hyeon
tier: 1
tags: [seed, liquibase, study]
---

> **이 파일은 근거다** — 절차는 [`../seed.md`](../seed.md) 가 갖는다.
> 태스크별 입력·산출물의 상세, 배포 전 검증 둘, 실패했을 때 볼 곳이 여기 남는다.

# 33. 생성 시드 — 실행 절차와 배포 전 검증

- 상태: 확정
- 최종수정일: 2026-08-29
- 관련 ADR: [0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) · [0022](../../records/adr/0022-generated-seed-full-sync.md) · [0023](../../records/adr/0023-message-key-sync-from-source.md)
- **읽어야 할 때**: 컨트롤러·프론트 상수를 고친 뒤 **무엇을 실행할지** · `check*Seed` 가 CI 에서 막았을 때 · **운영 배포 전 시드를 검증할 때**

## 1. 범위 — 절차만 갖는다

생성 시드는 ADR 셋과 문서 둘에 걸쳐 있고, [25](../build-deploy.md) §7.1 은 **태스크 목록만** 갖는다.
개발자가 실제로 묻는 것에 답하는 자리가 없었다.

| 묻는 것 | 여기 |
|---|---|
| 무엇이 생성물이고 무엇이 손으로 쓰는 것인가 · **여럿이 동시에 고칠 때**(§3.3) | [§2](#2-생성물은-넷-태스크는-여섯) |
| 언제 · 어떤 순서로 실행하나 | [§3](#3-개발자-절차--순서는-하나다) |
| **운영에 넣기 전에 무엇을 확인하나** | [§4](#4-배포-전-검증--검증이-둘인데-이름이-하나였다) |
| 막혔을 때 어디를 보나 | [§5](#5-실패했을-때) |

**왜 생성하는가는 여기 없다** — [ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md)(인가 시드) · [ADR-0022](../../records/adr/0022-generated-seed-full-sync.md)(동기화 방향) ·
[ADR-0023](../../records/adr/0023-message-key-sync-from-source.md)(메시지 키)이 갖는다. 파일 배치와 Liquibase 방식은 [22](../backend/_study/db-portability.md) §1 이다.
**이 문서는 사람이 하는 절차만 갖는다.**

> **절차를 ADR 에 두지 않는다.** ADR 은 **되돌리기 어려운 결정**을 남기는 자리이고 절차는
> 바뀐다. [ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) 이 자기 결정의 범위에서 *개발자 작업 순서* 를 이미 갖고 있으나,
> **메시지 시드가 생기면서 순서가 하나가 아니게 됐다** — 두 ADR 에 절반씩 있으면 어느
> 쪽도 전체를 말하지 못하고, 개발자는 둘 다 읽어야 하는지를 모른다.

## 2. 생성물은 넷, 태스크는 여섯

| 태스크 | 입력 | 산출물 | DB 반영 | 근거 |
|---|---|---|---|---|
| **`generateMenuSeed`** | **`menu/menu-tree.yaml`**(사람이 쓰는 선언) | **`003-init-menu.csv`** | **표시 → upsert. 삭제하지 않는다** — 선언에서 사라진 메뉴는 `SRC_CD='ORPHAN'` | [ADR-0028](../../records/adr/0028-menu-seed-upsert-and-orphan.md) |
| **`checkMenuSeed`** | 위 + **커밋본** | — (비교) | — | 〃 |
| `generateApiSeed` | 컨트롤러 `@RequestMapping`(`/api/service/**`) · **`@Operation`** · 프론트 `endpoints` 선언 · `screenRegistry` · **메뉴 선언**(`menu-tree.yaml`) | **`006-init-api.csv`**<br>**`007-init-menu-api.csv`** | **전건 삭제 → 전건 삽입** — changeSet 하나가 넷을 함께 돈다([ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md)) | [ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) · [ADR-0022](../../records/adr/0022-generated-seed-full-sync.md) |
| `checkApiSeed` | 위 + **커밋본** | — (비교) | — | 〃 §3 |
| `generateMessageSeed` | 프론트 `MSG` · 백엔드 `MsgKey`(+`ErrorCode`) **+ 직전 시드 파일**(§2.2) | **`008-init-message-key.csv`** | **없는 것만 추가** + `USE_SCOPE` 전건 재계산 | [ADR-0023](../../records/adr/0023-message-key-sync-from-source.md) |
| `checkMessageSeed` | 〃 + **커밋본** | — (비교) | — | 〃 |

**묶은 태스크 둘을 둔다.**

```bash
./gradlew generateSeeds     # = generateMenuSeed + generateApiSeed + generateMessageSeed
./gradlew checkSeeds        # = checkMenuSeed  + checkApiSeed  + checkMessageSeed   (check 에 연결)
```

> **메뉴가 먼저다.** `generateApiSeed` 는 `MENU_CD ↔ MENU_URL` 을 읽어야 매핑을 만드는데,
> 이제 **둘이 같은 선언 파일을 읽는다**([ADR-0028](../../records/adr/0028-menu-seed-upsert-and-orphan.md)) — 순서 의존이 아니라 **입력 공유**이며,
> 그래서 *어느 메뉴 파일을 읽을 것인가* 라는 질문이 없어졌다.

**태스크를 따로 기억하게 두지 않는다.** 하나만 돌린 커밋이 생기고, 그때 막는 것은 CI 뿐이다.
묶어 두면 *"시드를 다시 만든다"* 가 **명령 하나**이며, 태스크가 다섯째로 늘어도 개발자가
외울 것이 늘지 않는다.

#### `generateApiSeed` 의 사슬은 **도메인 단위**다 — 폴더 하나에 화면 하나 (2026-08-30)

```
menu/menu-tree.yaml         MENU_CD  ↔  MENU_URL          ← 사람이 쓰는 선언 (ADR-0028)
screenRegistry.ts           MENU_URL  →  @/features/{도메인}
{도메인}/api/endpoints.ts    →  /api/service/** 들
```

> **첫 마디가 시드 파일에서 선언 파일로 옮겼다**(2026-09-01 — [ADR-0028](../../records/adr/0028-menu-seed-upsert-and-orphan.md)).
> 그 전에는 `003-init-menu.yaml` **한 파일**이었고, 메뉴가 파일로 늘어나는 모델에서는
> **둘째 메뉴 파일을 태스크가 못 읽어** 그 화면의 API 가 전부 미매핑(=403)이 됐다.
>
> **`SCREENS` 에 있는데 선언에 없으면 실패다.** 그 화면은 메뉴 트리에 없어 **열 수 없다** —
> 반대 방향(선언에 있는데 `SCREENS` 에 없음)은 *아직 만들지 않은 화면* 이라 정상이며
> `screenRegistry` 주석이 이미 그렇게 적어 두었다.

**가운데 마디가 도메인이고 도메인마다 `api/endpoints.ts` 가 하나다.** 그래서 한 폴더에
화면이 둘이면 **두 화면의 선언이 한 파일에 섞이고**, 시드는 그것을 *두 메뉴가 모두 쓰는
API* 로 읽는다 — **한쪽 메뉴 권한만 가진 역할이 다른 화면의 API 를 부를 수 있게 된다.**

> **실제로 그렇게 만들어졌다**([64](../../../documents/screen/log/access/requirements.md) §7-2.1). 사용 이력과 로그인 이력을 `features/log` 에
> 함께 두었더니 `LOGIN_LOG → /api/service/accessLog/getList` 가 시드에 들어갔다. 화면에는
> 그 버튼이 없지만 **인가는 화면이 아니라 시드가 정한다**([42](../../knowledge/sys/menu.md) §5).
>
> **폴더 이름이 곧 인가 경계다.** [ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) 이 *선언 = 사용* 을 구조로 보장하는데
> 그 구조의 단위가 **폴더**라는 것이 여기서 드러났다. 화면 셋이 한 문서에 있어도
> ([64](../../../documents/screen/log/access/requirements.md) §1.1) 폴더는 셋이다.

> **샘플을 걷어낼 때 이 셋이 서로 다르게 움직인다**(2026-09-01 — [48](../../playbook/INDEX.md) §7.1).
> `006`·`007` 은 소스가 사라지면 **행도 사라지고**, `008` 은 **남아서 `USE_SCOPE='NONE'`
> 으로 표시만** 되며, 손으로 쓰는 시드(메뉴·코드·메시지 값)는 **아무 일도 일어나지 않는다.**
> `008` 의 `sample.` 줄을 CSV 에서 지우지 않으면 `loadUpdateData` 가 **다시 넣는다** —
> 제거 절차의 유일한 수작업이 그 자리다([48](../../playbook/INDEX.md) §7.5).

### 2.1 손으로 쓰는 시드와 섞이지 않는다

| 시드 | 소유 | 생성 태스크가 |
|---|---|---|
| `001-init-sequence` · `002-init-admin` · `004-init-role` · `005-init-code` | **사람** | **파일을 열지 않는다** |
| **`003-init-menu`** | **구조는 코드 · 표시는 운영** | **전건을 다시 쓰되 지우지 않는다** — `SORT_NO`·`ICON_CD`·`USE_YN` 은 CSV 에 없어 **갱신되지 않는다**([ADR-0028](../../records/adr/0028-menu-seed-upsert-and-orphan.md)) |
| `006-init-api` · `007-init-menu-api` | **코드** | 전건을 다시 쓴다 |
| `008-init-message-key` | **키는 코드 · 값은 사람** | 키만 쓴다. **`SYS_MESSAGE` 를 열지 않는다** |
| **`009-init-message` · `010-init-message` · …** | **사람** | **파일을 열지 않는다** — 설치 출발값이다(2026-08-29 신설) |

> **값 시드는 파일 하나가 아니다**(2026-08-29 — 구현). 사람 소유 시드는 기존 changeset 을
> 손대지 않고 **파일을 더하며 늘어나므로**([22](../backend/_study/db-portability.md) §1.1) `009` · `010` · … 이 된다. 실제로
> `010` 이 그리드 규약의 문구를 갖고 들어왔다.
>
> **검사가 이름을 고정하면 안 된다.** `SeedMessageTest` 가 `009` 로 못 박고 있었고 그러면
> 다음 파일이 **검사 밖으로 나간다** — 값을 넣었는데 여전히 실패하거나, 더 나쁘게는
> **넣지 않았는데 통과**한다. 지금은 `0NN-init-message.csv` 를 패턴으로 모으며, **하나도
> 못 찾으면 그 자체가 실패**다(빈 목록은 모든 검사를 공허하게 통과시킨다).

**`code.*` · `menu.*` 접두는 `generateMessageSeed` 가 건드리지 않는다** — 소스 상수가 아니라
**데이터에서 조립된 키**다([43](../../knowledge/sys/code.md) §4.4 · [ADR-0023](../../records/adr/0023-message-key-sync-from-source.md) §4). 그 행은 `CODE_MGMT`([63](../../../documents/screen/code/requirements.md) §2.3)와
메뉴 저장이 만든다.

> **이 예외를 빼먹으면 그 키 전부가 `USE_SCOPE='NONE'` 으로 떨어져 죽은 키로 잡힌다.**
> 접두 목록이 곧 *"데이터가 키를 만드는 자리"* 의 전부이며, 늘어나면 여기와 [ADR-0023](../../records/adr/0023-message-key-sync-from-source.md) §4 를
> 함께 고친다.

### 2.2 `generateMessageSeed` 는 **커밋된 시드 파일도 입력으로 읽는다**

`generateApiSeed` 와 다르고, **구현이 틀리기 쉬운 자리**다.

[ADR-0023](../../records/adr/0023-message-key-sync-from-source.md) §2 는 *"코드에서 사라진 것은 남는다 — `USE_SCOPE='NONE'` 으로 표시만 한다"* 로
정했다. **그런데 소스에서 사라진 키는 소스 스캔으로 알 수 없다.** 그것을 아는 유일한 곳이
**직전 시드 파일**이다.

```
프론트 shared/i18n/messageKeys.ts (MSG)  ─┐
백엔드 core MsgKey                        ─┼→ generateMessageSeed → 008-init-message-key.csv
직전 008-init-message-key.csv             ─┘   소스에 없는 키는 USE_SCOPE='NONE' 으로 이어 쓴다
```

**산출물이 CSV 다**(2026-08-29 — 구현). `loadUpdateData` 가 CSV 를 받으므로 changelog
(`008-init-message-key.yaml`)는 **고정된 껍데기**이고 생성되는 것은 데이터 쪽뿐이다 —
그래서 *"재생성 결과 == 커밋본"* 비교가 파일 하나로 끝난다.

**감사 컬럼을 담지 않는다.** 재생성마다 시각이 바뀌면 그 비교가 성립하지 않는다.

| 이 입력이 없으면 | |
|---|---|
| 재생성이 그 행을 **떨어뜨린다** | 파일에서 사라지므로 `loadUpdateData` 가 그 행을 갱신하지 않는다 |
| DB 의 `USE_SCOPE` 가 **옛 값으로 굳는다** | `BOTH` 로 남아 **`미사용` 배지가 영원히 안 붙는다**([63](../../../documents/screen/code/requirements.md) §3.4) |

**이 입력이 죽은 키 판정의 실제 경로다.** [ADR-0023](../../records/adr/0023-message-key-sync-from-source.md) 이 *"`USE_SCOPE` 전건 재계산이 죽은 키
판정의 유일한 경로"* 라고 한 것의 구현이 이것이다.

- **멱등이다** — 소스를 안 고치고 두 번 돌리면 결과가 같다. `checkMessageSeed` 의
  *"재생성 결과 == 커밋본"* 비교가 이 멱등성에 기댄다
- **시드에서 죽은 키 행을 실제로 빼는 방법은 손으로 지우는 것뿐이다.** 그리고 그것으로도
  **DB 행은 사라지지 않는다**(`loadUpdateData` 는 지우지 않는다 — [22](../backend/_study/db-portability.md) §1.1) — DB 에서 지우는
  자리는 화면이다([63](../../../documents/screen/code/requirements.md) §3.2 의 `rowState: 'D'`)

### 2.3 `check` 둘이 같은 것을 보장하지 않는다

| | `checkApiSeed` | `checkMessageSeed` |
|---|---|---|
| 소스에 **추가**하고 생성을 잊었다 | **막는다** | **막는다** |
| 소스에서 **지우고** 생성을 잊었다 | **막는다** | **막는다** — `USE_SCOPE` 가 `NONE` 으로 바뀌어 파일이 달라진다 |
| 지운 것의 **행 제거** | **자동** | **안 된다 — 사람이 판단한다**(§2.2) |
| 아무도 안 쓰는 것의 **표시** | `SYS_MENU_API` 0건 = *미매핑*([42](../../knowledge/sys/menu.md) §5) | `USE_SCOPE='NONE'` = *미사용* |

**둘 다 *잊음* 은 막는다. 갈리는 것은 *청소* 다** — 생성물의 소유가 다르기 때문이며
[ADR-0022](../../records/adr/0022-generated-seed-full-sync.md) 의 축(*"누가 소유하는가"*) 그대로다. API 행에는 사람의 것이 딸려 있지 않고,
메시지 키에는 **번역이 딸려 있다.**

## 3. 개발자 절차 — 순서는 하나다

[ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) 의 작업 순서에 **메시지 두 단계가 끼어든다.** 통합한 것이 아래이며,
**ADR-0020 의 표는 인가 부분의 근거로 남는다.**

| # | 고친 것이 | 하는 일 | 산출물 |
|---|---|---|---|
| 1 | **컨트롤러** | 경로를 `/api/service/{도메인}/{동작}` 으로. 접두가 동작과 다르면 `@ApiActionType`. **`@Operation(summary=…)` 은 필수** | `.java` |
| 2 | **프론트 화면** | 호출 URL 을 `endpoints.ts` 에 모은다 — **리터럴 금지**(ESLint · [24](../frontend/_study/frontend-stack.md) §9) | `endpoints.ts` |
| 3 | **메시지** | `MSG` · `MsgKey` 상수에 키를 넣는다 — **리터럴 금지**(ESLint · ArchUnit) | `messageKeys.ts` · `MsgKey.java` |
| 4 | **신규 메뉴** | **`menu/menu-tree.yaml`** 에 줄 추가 — `MENU_CD` · `UP_MENU_CD` · `MENU_URL` · `EXPORT_YN`. 목록은 [52](../../knowledge/sys/menu.md) 가 소유 | `menu-tree.yaml` |
| 5 | — | **`./gradlew generateSeeds`** | `003` · `006` · `007` · `008` |
| 6 | — | **로컬 확인** — 재기동 후 화면 진입. §3.2 의 넷을 본다 | — |
| 7 | — | **한 커밋** — 소스 · 상수 · 시드를 함께(§3.1) | PR |
| 8 | — | **CI `checkSeeds`** — 5 를 잊었으면 여기서 막힌다 | — |
| 9 | — | **배포 전 검증**([§4](#4-배포-전-검증--검증이-둘인데-이름이-하나였다)) → 배포 | — |

**기존 화면에 API 만 추가하면 4 가 빠지고, 문구만 고치면 3 · 5 · 7 · 8 만 돈다.**

> **~~4-1 이 유일하게 손으로 쓰는 인가 시드다~~ — 사라졌다**(2026-09-01 · [ADR-0028](../../records/adr/0028-menu-seed-upsert-and-orphan.md)).
> `EXPORT_YN` 이 **선언 파일의 칸**이 되면서 `0xx-menu-export.yaml` 이 없어졌다. 잊으면
> 조용한 것은 그대로이므로(화면은 돌고 출력 권한만 줄 수 없다) `004` 의 `EXPORT` 부여와
> 대조하는 `SeedBootstrapAuthorityTest` 는 **남는다** — 근거는 [ADR-0027](../../records/adr/0027-menu-declared-export-action.md) 그대로다.
메시지 값(번역)을 채우는 것은 이 절차가 아니라 **화면과 엑셀**이다([63](../../../documents/screen/code/requirements.md) §3) — 시드에 값이 없다.

### 3.1 한 커밋이어야 하는 이유가 둘이다

| | |
|---|---|
| **리뷰** | [ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) — *"이 API 를 이 메뉴에 여는 것이 맞는가"* 는 컨트롤러와 시드 diff 를 **함께** 봐야 판단된다. 매핑 행 추가가 곧 접근 범위 확장이다([23](../backend/_study/security-design.md) §4) |
| **CI** | 시드 커밋이 뒤로 밀리면 그 사이의 커밋에서 `checkSeeds` 가 깨진다 — **고친 사람이 아닌 사람의 PR 이 막힌다** |

둘째가 실무에서 더 자주 아프다. **시드를 나중에 몰아서 만들지 않는다.**

### 3.2 6 에서 드러나는 것 넷

| 증상 | 원인 | 어디 |
|---|---|---|
| **403** | `endpoints` 미선언 또는 5 를 안 돌렸다 | [ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) |
| 액션이 틀렸다 | **접두 오타**(`svae` → `EXECUTE`) | [ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) §1 |
| 화면에 **키 문자열**이 보인다 | 값이 아직 없다 — **정상이며 진단이다** | [43](../../knowledge/sys/code.md) §7.3 · [63](../../../documents/screen/code/requirements.md) §2.3 |
| **`code.*` 키가 `미사용` 으로 보인다** | 접두 예외를 빼먹었다 | §2.1 |
| **역할 권한 트리의 출력 열이 `—`** | 4-1 을 안 했다 — 부를 API 가 없는 액션이다 | [ADR-0027](../../records/adr/0027-menu-declared-export-action.md) |

### 3.3 여럿이 동시에 고칠 때 — **생성물의 충돌은 손으로 풀지 않는다** (2026-09-01)

메뉴가 생성물이 되면서([ADR-0028](../../records/adr/0028-menu-seed-upsert-and-orphan.md)) 개발자 둘이 같은 CSV 를 고치는 일이 흔해진다.
**그 충돌은 푸는 것이 아니라 다시 만드는 것이다.**

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
| **한 커밋 규칙은 그대로**(§3.1) | 선언과 생성물이 같은 커밋에 있어야 이 절차가 성립한다 |

#### 브랜치를 바꿔도 로컬 DB 를 지우지 않는다

| 상황 | 무엇이 일어나나 |
|---|---|
| 다른 브랜치로 이동 후 기동 | `runOnChange` 가 **전건 upsert** → 메뉴가 **소스와 일치**한다 |
| 옛 브랜치에서 만든 메뉴 | **지워지지 않고 `SRC_CD='ORPHAN'`** 으로 표시된다. 트리에서 갈려 보이고 **기동은 정상**이다 |
| 그 브랜치로 되돌아가면 | 다음 기동에서 **`SEED` 로 돌아온다** |
| **DB 를 지워야 하는 때** | **스키마 changeset 이 바뀌었을 때뿐이다** — 그쪽은 여전히 누적이며 `runOnChange` 를 쓰지 않는다([22](../backend/_study/db-portability.md) §1.1) |

> **`006`·`007` 도 같은 성질을 이미 갖고 있었다.** 달라진 것은 **메뉴가 그 집합에 들어온
> 것**이며, 개발 중 가장 자주 바뀌는 것이 메뉴라 체감이 여기서 갈린다.

#### 이 절차가 답하지 않는 것 — `ORPHAN` 을 언제 지우나

**로컬에서는 지우지 않는다.** 브랜치를 오가는 동안 생겼다 사라지는 표시일 뿐이다.
**운영에서는 사람이 화면에서 지운다** — [62](../../../documents/screen/menu/requirements.md) §4.8 의 삭제 게이트가 그 자리이며,
순서는 *엔드포인트 선언 제거 → 시드 재생성 → 배포 → 메뉴 삭제* 다.

## 4. 배포 전 검증 — **검증이 둘인데 이름이 하나였다**

| 무엇을 대조하나 | 무엇으로 | 언제 | 지금까지 |
|---|---|---|---|
| **소스 ↔ 시드 파일** | `checkSeeds` | 커밋 · PR | **있다** |
| **시드 파일 ↔ 대상 DB** | §4.1 · §4.2 | **배포 전** | **없었다** |

`checkSeeds` 는 **커밋본이 최신인지만** 본다 — **대상 DB 를 쳐다보지 않는다.** 운영에서
실제로 문제가 되는 것은 *"이 시드를 저 DB 에 적용하면 무엇이 사라지나"* 이고, 그것은
**DB 를 봐야** 알 수 있다. 두 검증을 *"시드 검증"* 이라는 한 이름으로 부르면 하나가 빠진다.

> **[25](../build-deploy.md) §8 이 이 검증을 필수로 만든다.** 운영 Liquibase 자동 실행이 **OFF 기본**이고
> DBA 수동 적용을 전제한다 — 즉 **누군가 SQL 을 손에 들고 본다.** 그 SQL 이 무엇을 지우는지
> 모르는 채로 넘기면 이미 있는 검증 지점을 낭비하는 것이다.

### 4.1 무엇이 실행될지 본다 — `updateSql`

```bash
./gradlew updateSql -Pdb=oracle      # 22 §1 — 벤더별 SQL 을 생성한다. 적용하지 않는다
```

| 보는 것 | 있어야 하나 |
|---|---|
| `003` · `004` 의 **`DELETE FROM SYS_API` · `SYS_MENU_API`** | **반드시 있다** — 전건 동기화다([ADR-0022](../../records/adr/0022-generated-seed-full-sync.md)). 없으면 `runOnChange` 가 안 걸린 것이다 |
| `005` 의 `DELETE` | **없어야 한다** — `loadUpdateData` 다([22](../backend/_study/db-portability.md) §1.1). 있으면 잘못 만든 것이다 |
| `001` · `002` 의 changeset | **없어야 한다** — 사람 소유는 누적이므로 재실행되지 않는다 |

**읽는 순서는 `DELETE` 다.** `INSERT` 는 코드가 가진 사실이라 리뷰할 것이 적고, 지우는
문장만이 **운영 데이터를 건드린다.**

### 4.2 무엇이 고아가 되는지 센다 — `reportSeedImpact`

`updateSql` 은 **실행될 문장**을 보여주지만 *"그래서 운영 데이터가 어떻게 되나"* 는 말하지
않는다. [42](../../knowledge/sys/menu.md) 는 사라진 API 의 권한 부여 행을 **지우지 않고 고아로 남긴다**고 정했다
(*"배포가 운영 결정을 지우지 않는다"*). **그 고아가 몇 건인지 세는 것이 아무것도 없었다.**

```bash
./gradlew reportSeedImpact -Pdb=oracle -Purl=...   # 대상 DB 를 읽기만 한다
```

| 리포트 항목 | 무엇을 뜻하나 | 근거 |
|---|---|---|
| 사라지는 `SYS_API` 행 | 그 API 를 아무도 부를 수 없게 된다 | [ADR-0022](../../records/adr/0022-generated-seed-full-sync.md) |
| **그로 인해 고아가 되는 부여 행 수** | `SYS_ROLE_MENU_AUTH` · `SYS_USER_MENU_AUTH` — **권한이 조용히 무의미해진다** | [42](../../knowledge/sys/menu.md) · [25](../build-deploy.md) §7.1 |
| 새로 생기는 `SYS_API` · `SYS_MENU_API` 행 | **접근 범위 확장** — PR 리뷰가 이미 봤어야 하는 것 | [23](../backend/_study/security-design.md) §4 |
| 추가되는 메시지 키 수 | **번역이 필요한 양** | [63](../../../documents/screen/code/requirements.md) §3.3 |
| **`NONE` 으로 바뀌는 키 수** | 죽은 키가 늘었다 | [ADR-0023](../../records/adr/0023-message-key-sync-from-source.md) §4 |
| **`ORPHAN` 이 되는 메뉴 수** | 선언에서 사라진 메뉴다 — **지워지지 않고 표시만** 된다 | [ADR-0028](../../records/adr/0028-menu-seed-upsert-and-orphan.md) |
| **그 메뉴에 딸린 부여·즐겨찾기 행 수** | 지우려면 **먼저 회수해야 하는 양**([62](../../../documents/screen/menu/requirements.md) §4.8) | 〃 |

- **읽기 전용이다.** 쓰지 않으므로 스키마 변경 권한이 필요 없다. 그래도 **운영에 직접
  붙이지 않고 스냅샷·스테이징에 붙인다** — 접속 정보가 파이프라인에 남는 문제가 §6 미결이다
- **막지 않고 센다.** 고아 발생이 곧 오류가 아니다 — `getUserList` → `searchUserList` 이름
  변경은 정상 작업이며 [42](../../knowledge/sys/menu.md) 가 *"지우는 것은 사람이 판단한다"* 로 정했다. 게이트로 만들면
  정상 작업이 배포를 막고, 그러면 사람이 게이트를 끄는 법을 배운다
- **숫자가 `0` 이 아니면 배포 노트에 옮긴다.** 다음 운영자가 화면의 고아 표시를 보고
  *"왜 이렇게 됐나"* 를 물을 때 답할 자리가 그것뿐이다([ADR-0010](../../records/adr/0010-request-logging-without-audit-trail.md) — 감사 이력이 없다)

### 4.3 체크리스트

- [ ] `checkSeeds` 통과 — CI 가 이미 했다(§3 의 8)
- [ ] `updateSql` 로 **`DELETE` 대상 확인** — `003` · `004` 에만 있는가(§4.1)
- [ ] `005` 의 SQL 에 `DELETE` 가 **없는가**
- [ ] `reportSeedImpact` 의 **고아 수**를 배포 노트에 옮겼는가
- [ ] 새로 생기는 API 행이 **PR 리뷰를 거친 것과 같은가** — 리뷰 후 추가된 것이 없는가
- [ ] 체크섬 우회(`validCheckSum`)를 쓰지 않았는가([22](../backend/_study/db-portability.md) §1.1)

## 5. 실패했을 때

| 말하는 것 | 원인 | 하는 일 |
|---|---|---|
| `checkApiSeed FAILED` | 5 를 잊었다 · **시드를 손으로 고쳤다** | `generateSeeds` 후 커밋. **생성물을 손으로 고치지 않는다** |
| `checkMessageSeed FAILED` | 〃 · 직전 시드를 입력에서 뺐다(§2.2) | 〃 |
| Liquibase **체크섬 오류** | 이미 실행된 changeset 파일을 고쳤다 | `runOnChange` 대상인지 본다([22](../backend/_study/db-portability.md) §1.1). 사람 소유 시드면 **새 파일을 더한다** |
| 기동 후 **403** | 시드는 맞고 **매핑이 0** | [42](../../knowledge/sys/menu.md) §5 의 *미매핑* — `endpoints` 선언을 본다 |
| 배포 후 화면에 **키 문자열** | 키는 들어갔고 **값이 없다** | 정상이다. [63](../../../documents/screen/code/requirements.md) §3 에서 채운다 |

## 6. 미결 사항

| 항목 | 성격 | 범위 | 게이트 |
|---|---|---|---|
| **`reportSeedImpact` 를 어디서 돌리나**(§4.2) — CD 파이프라인 단계로 넣을지, 배포 담당이 손으로 돌릴지. **대상 DB 접속 정보를 파이프라인에 두는 문제**와 엮인다 | 결정 | 프로젝트 | 릴리스 |
| **죽은 키(`NONE`)를 CI 경고로 올릴지**(§2.3) — [63](../../../documents/screen/code/requirements.md) §5 와 같은 항목이다. 배포 예정 화면의 키가 먼저 들어오는 정상 경로가 있어 오탐이 난다 | 결정 | 템플릿 | Phase 5 |
| **시드에서 죽은 키 행을 언제 손으로 지우나**(§2.2) — 주기와 판단 기준. 지워도 DB 행은 남으므로 **화면 작업과 짝**이다 | 결정 | 템플릿 | Phase 5 |
| **기존 배포의 이행**([ADR-0028](../../records/adr/0028-menu-seed-upsert-and-orphan.md)) — `data-003-menu` 를 `runOnChange` 로 바꾸면 이미 적용한 DB 에서 **checksum 이 달라져 한 번 더 돈다**. 그것이 곧 첫 동기화라 의도한 동작이지만 **4벤더에서 확인해야 한다** — 특히 `update`→`loadUpdateData` 순서가 한 트랜잭션으로 도는지 | 검증 | 템플릿 | **ADR-0028 구현** (폴백: `id` 를 바꿔 새 changeset 으로 두고 옛 것을 `preConditions` 로 건너뛴다) |
| **`ORPHAN` 배지를 CI 경고로 올릴지**([62](../../../documents/screen/menu/requirements.md) §4.8) — 죽은 키와 **같은 성격**이다. 브랜치를 오가는 개발 중에 정상적으로 뜨므로 오탐이 잦다 | 결정 | 템플릿 | ADR-0028 구현 |

## 7. 다음 문서와의 경계

| 여기 없는 것 | 어디 |
|---|---|
| **왜** 생성하고 왜 검증하나 | [ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) · [ADR-0022](../../records/adr/0022-generated-seed-full-sync.md) · [ADR-0023](../../records/adr/0023-message-key-sync-from-source.md) |
| 시드 파일 배치 · Liquibase 명령 · 체크섬 규칙 | [22](../backend/_study/db-portability.md) §1 · §1.1 |
| CI 파이프라인 전체 · 운영 Liquibase 토글 | [25](../build-deploy.md) §7 · §8 |
| 접두 ↔ 액션 규칙과 `@ApiActionType` | [ADR-0020](../../records/adr/0020-path-prefix-action-and-seed-generation.md) §1 |
| 죽은 키 · 미번역을 **화면에서** 보는 법 | [63](../../../documents/screen/code/requirements.md) §3.3 · §3.4 |
| 메시지 키 상수의 배치(`shared/i18n` · `core`) | [24](../frontend/_study/frontend-stack.md) §2.1 · [21](../backend/_study/architecture.md) §3 |
