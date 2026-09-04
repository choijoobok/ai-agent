---
id: LLM-REC-005
title: "폐지된 설계 문서 지도 — 번호를 만났을 때"
category: "10-records"
type: operation
created: 2026-09-04
updated: 2026-09-04
status: active
sources: ["git fc352bc (폐지)", "git 6fd3213 (재배선)", "git 92ad97f (이전)"]
author: Bong Jong Hyeon
tier: 2
tags: [records, legacy, citation, map, docs-design]
---

# 폐지된 설계 문서 지도 — `53 §6.1` 을 만났을 때

> **소스 주석과 문서가 `NN §X` 로 부르는 그 `NN` 이 여기 있다.**
> `docs/design/` 은 2026-09-04 에 폐지됐다(`fc352bc` — 번호 문서 **45** 와 `README.md`).
> 내용은 아래 표의 오른쪽이 받았다.
>
> **인용은 9천 곳이 넘는데 폐지 사실을 적어 둔 데가 없었다.** 이 파일이 그 자리다.
>
> **이 파일의 목표는 스스로 없어지는 것이다.**
>
> 인용이 0 이 되면 지도가 필요 없고, 그때 이 파일을 지운다. **유지가 목표가 아니다.**
> 다만 지금 한 번에 지울 수는 없다 — 아래 잔량이 그 이유다.
>
> **잔량을 세는 것은 `node aidd-guide/meta/_meta/lint.mjs` 다** — 구역별로 세고
> **절이 살아 있는 것과 죽은 것을 갈라** 낸다. 2026-09-04(소스 주석 치환 뒤) 기준
> 소스 주석 **4806 곳**(살아있음 1455 · 죽음 3351)이다. **늘면 안 된다.**
>
> 아래 표의 `인용` 열은 그보다 넓게 센 **대략값**이다(절 번호가 없는 `NN §` 와 링크형까지).
> **줄어드는지를 보는 눈금은 `lint.mjs` 하나로 한다** — 숫자가 둘이면 어느 쪽도 안 믿게 된다.

## 진입 조건

- 소스나 문서에서 **번호만 있는 인용**(`24 §5` · `53 §6.1`)을 만났을 때
- `[61](../../documents/screen/user/requirements.md) §3.3` 처럼 **링크와 절 번호가 어긋나 보일 때**
- 옛 문서를 인용하는 문장을 **새로 쓰려 할 때**(→ 아래 “새로 쓸 때”. 쓰지 않는다)

## 1. 읽는 법 — 형태가 셋이다

| 보이는 것 | 뜻 |
|---|---|
| `53 §6.1` — 평문 | 옛 `53` 의 6.1절. **지금 읽을 곳은 이 표의 오른쪽**이다 |
| `[53](./경로) §6.1` — 링크 + 절 | 같다. **`§6.1` 은 옛 53 의 절이고 링크 대상의 절이 아니다** |
| `화면 흐름 §3.2` — 평문 이름 | 후속 파일이 없는 다섯. 재배선이 링크를 걷고 이름만 남겼다 |

> **둘째 형태가 사람을 속인다.** 링크가 열리므로 **대상 문서에서 `§6.1` 을 찾게 되고**,
> 그런 절은 없다. `llm-guide/` 안에만 그런 인용이 **459곳**이다.
>
> **`[NN]` 의 대괄호 안 숫자가 옛 문서 번호라는 것**이 그 형태를 알아보는 표식이다.

## 2. 지도 — 마흔여섯

폐지된 **45** 와, 그보다 먼저 옮겨진 **`10-feature-inventory`**(`92ad97f`)를 함께 담아 마흔여섯이다.
`인용` 은 저장소 전체에서 `NN §` 형태가 나온 횟수다(2026-09-04 스캔).

| # | 옛 파일 `docs/design/NN-….md` | 지금 받는 곳 | 인용 |
|---|---|---|---|
| `00` | overview | **후속 없음** — 평문 *“설계 개요”* | 4 |
| `01` | principles-and-scope | **후속 없음** — 평문 *“설계 원칙”* | 12 |
| `10` | feature-inventory | [`09-knowledge/features.md`](../knowledge/features.md) | 18 |
| `11` | non-functional-requirements | **후속 없음** — 평문 *“비기능 요건”* | 1 |
| `20` | tech-stack | [`06-framework/stack.md`](../standard/stack.md) | 13 |
| `21` | backend-architecture | [`06-framework/backend/_study/architecture.md`](../standard/backend/_study/architecture.md) | 51 |
| `22` | db-portability | [`06-framework/backend/_study/db-portability.md`](../standard/backend/_study/db-portability.md) | 40 |
| `23` | security-design | [`06-framework/backend/_study/security-design.md`](../standard/backend/_study/security-design.md) | 73 |
| `24` | frontend-stack | [`06-framework/frontend/_study/frontend-stack.md`](../standard/frontend/_study/frontend-stack.md) | 76 |
| `25` | build-and-deploy | [`06-framework/build-deploy.md`](../standard/build-deploy.md) | 11 |
| `26` | llm-engineering-plan | **후속 없음** — 평문 *“LLM 엔지니어링 계획”* | — |
| `27` | pii-vault | [`06-framework/backend/pii-vault.md`](../standard/backend/pii-vault.md) | 10 |
| `28` | system-logging | [`06-framework/backend/_study/system-logging.md`](../standard/backend/_study/system-logging.md) | 8 |
| `29` | request-dedup | [`06-framework/backend/crosscutting.md`](../standard/backend/crosscutting.md) | 6 |
| `30` | async-and-concurrency | [`06-framework/backend/crosscutting.md`](../standard/backend/crosscutting.md) | 75 |
| `31` | distributed-lock | [`06-framework/backend/persistence.md`](../standard/backend/persistence.md) | 135 |
| `32` | data-retention | [`09-knowledge/retention.md`](../knowledge/retention.md) | 77 |
| `33` | seed-generation-guide | [`06-framework/_study/seed-generation.md`](../standard/_study/seed-generation.md) | 8 |
| `34` | query-implementation-guide | [`06-framework/backend/search.md`](../standard/backend/search.md) | 19 |
| `40` | data-model-inventory | [`09-knowledge/sys/INDEX.md`](../knowledge/sys/INDEX.md) | 80 |
| `41` | data-model-auth | [`09-knowledge/sys/user-role.md`](../knowledge/sys/user-role.md) | 172 |
| `42` | data-model-authz | [`09-knowledge/sys/menu.md`](../knowledge/sys/menu.md) | 366 |
| `43` | data-model-master | [`09-knowledge/sys/code.md`](../knowledge/sys/code.md) | 417 |
| `44` | data-model-pii | [`06-framework/backend/pii-vault.md`](../standard/backend/pii-vault.md) | — |
| `45` | data-model-log | [`09-knowledge/sys/logs.md`](../knowledge/sys/logs.md) | 100 |
| `46` | data-model-infra | [`09-knowledge/sys/batch.md`](../knowledge/sys/batch.md) | 164 |
| `47` | data-model-file-noti | [`09-knowledge/sys/notification.md`](../knowledge/sys/notification.md) | 80 |
| `48` | data-model-sample | [`11-playbook/INDEX.md`](../playbook/INDEX.md) | 146 |
| `50` | screen-flow | **후속 없음** — 평문 *“화면 흐름”* | 86 |
| `51` | main-shell | [`06-framework/frontend/_study/main-shell.md`](../standard/frontend/_study/main-shell.md) | 67 |
| `52` | menu-inventory | [`09-knowledge/sys/menu.md`](../knowledge/sys/menu.md) | 97 |
| `53` | grid-standard | [`06-framework/frontend/_study/grid-standard.md`](../standard/frontend/_study/grid-standard.md) | 130 |
| `54` | grid-column-contract | [`06-framework/frontend/_study/grid-column-contract.md`](../standard/frontend/_study/grid-column-contract.md) | 111 |
| `55` | grid-api-contract | [`06-framework/frontend/_study/grid-api-contract.md`](../standard/frontend/_study/grid-api-contract.md) | 38 |
| `56` | grid-edit-validation | [`06-framework/frontend/_study/grid-edit-validation.md`](../standard/frontend/_study/grid-edit-validation.md) | 49 |
| `57` | search-form-contract | [`06-framework/frontend/_study/search-form-contract.md`](../standard/frontend/_study/search-form-contract.md) | 12 |
| `60` | screen-auth | [`documents/screen/_standalone/README.md`](../../documents/screen/_standalone/README.md) | 106 |
| `61` | screen-user | [`documents/screen/user/requirements.md`](../../documents/screen/user/requirements.md) | 565 |
| `62` | screen-menu | [`documents/screen/menu/requirements.md`](../../documents/screen/menu/requirements.md) | 520 |
| `63` | screen-master | [`documents/screen/code/requirements.md`](../../documents/screen/code/requirements.md) | 416 |
| `64` | screen-log | [`documents/screen/log/access/requirements.md`](../../documents/screen/log/access/requirements.md) | 556 |
| `65` | screen-batch | [`documents/screen/batch/schedule/requirements.md`](../../documents/screen/batch/schedule/requirements.md) | 439 |
| `66` | screen-notice | [`documents/screen/notice/requirements.md`](../../documents/screen/notice/requirements.md) | 257 |
| `68` | screen-sample | [`11-playbook/INDEX.md`](../playbook/INDEX.md) | 444 |
| `72` | api-conventions | [`06-framework/backend/_study/api-conventions.md`](../standard/backend/_study/api-conventions.md) | 59 |
| `90` | add-language-guide | [`06-framework/frontend/i18n.md`](../standard/frontend/i18n.md) | — |

- **`_study/` 로 간 것은 원문이다.** 규칙은 그 옆의 운용 파일이 갖는다 —
  `_study/grid-standard.md` 의 규칙은 [`sources/frontend/grid.md`](../standard/frontend/grid.md),
  `_study/api-conventions.md` 의 규칙은 [`sources/backend/api.md`](../standard/backend/api.md) 이다.
  **읽는 순서는 운용 파일이 먼저다**(`_study/` 는 *왜 그런가* 가 남을 때만).
- **한 문서가 여럿으로 갈린 것이 있다.** 위는 **가장 많이 받은 한 곳**이며,
  `42`·`52` 가 함께 `sys/menu.md` 로, `29`·`30` 이 함께 `sources/backend/crosscutting.md` 로 간 것이 그 예다.
- **`ADR` 은 여기 없다.** 스물여덟은 `docs/design/adr/` 에서 [`adr/`](./adr/INDEX.md) 로
  **번호를 그대로 갖고** 왔다(`942494b`) — `ADR-0020` 은 지금도 `ADR-0020` 이다.

## 3. 후속 파일이 없는 다섯

`00` · `01` · `11` · `26` · `50` 은 재배선 때 **링크를 걷고 평문 이름만 남겼다**
(*설계 개요* · *설계 원칙* · *비기능 요건* · *LLM 엔지니어링 계획* · *화면 흐름*).
그 내용은 한 파일이 받은 것이 아니라 **여러 곳에 녹았다.**

> **평문이라 거짓말을 하지 않는다.** 링크가 없으므로 열어 보고 없다는 것을 알게 되는 일이 없다.
> 다만 `50`(화면 흐름)은 인용이 **91곳**이라 언젠가 받을 곳을 정해야 한다 — 지금은 미결이다.

## 4. 새로 쓸 때 — 이 형식을 쓰지 않는다

**지금 있는 문서를 인용할 때는 절 번호가 아니라 절 제목으로 쓴다.**

```
(X)  [grid.md](../standard/frontend/grid.md) §4
(O)  [grid.md](../standard/frontend/grid.md) 의 “컬럼 정의” 절
```

번호는 문서를 고칠 때마다 밀린다 — `SYS_USER_PWD_RESET` 을 `user-role.md` 에 넣자
그 아래 세 절의 번호가 한 칸씩 밀렸고, 번호로 인용한 곳이 있었다면 전부 어긋났을 것이다.

### 이미 있는 것은 — **만질 때 함께 고친다**

**한 덩어리로 고치지 않는다.** 인용은 도는 코드가 아니라 주석이라, 그것만 고치는 커밋은
`git blame` 을 흐리면서 아무 기능도 바꾸지 않는다. 그 파일을 **다른 이유로 만질 때**
눈에 들어온 것을 함께 고친다(`CLAUDE.md` §4-5 의 영어 로그 일곱과 같은 원칙이다).

**예외는 판단이 필요 없을 때다.** 후속 문서가 원문 그대로 이관돼 **절이 살아 있으면**
치환이 기계적이라 한 덩어리로 해도 된다 — 2026-09-04 에 소스 주석 2868 곳을 그렇게
바꿨다(`54 §5` → `grid-column-contract.md §5`). **절이 죽은 것은 그렇게 하지 않는다.**
후속이 재작성돼 번호만 우연히 맞은 경우가 섞여 있어, 기계로 바꾸면 **틀린 곳을 가리키는
인용**이 된다 — 지금이 그저 못 읽는 것보다 나쁘다.

## 5. 어떻게 만들었나

| 열 | 근거 |
|---|---|
| 옛 파일 이름 | `git show fc352bc --name-only -- docs/design` — **확정** |
| 지금 받는 곳 | 재배선 커밋 `6fd3213` 에서 **링크 텍스트가 같은 `-`/`+` 쌍**을 맞춰 가장 많이 치환된 대상 — **확정** |
| 후속 없음 다섯 | 같은 커밋에서 링크가 평문으로 바뀐 것 — **확정** |
| 인용 수 | 저장소 전수 스캔(`NN §` 패턴). **대략값** — 문맥이 다른 두 자리 수가 섞일 수 있다 |
| `10-feature-inventory` | `92ad97f` 의 `R069` 이름 변경 — **확정** |

## 관련

- [adr/INDEX.md](./adr/INDEX.md) — 같은 폴더에서 온 스물여덟. **번호를 그대로 지켰다**
- [`00-meta/doc-style.md`](../meta/doc-style.md) — 문서를 쓸 때의 인용 규약
- [`CLAUDE.md` §2](../../CLAUDE.md) — 문서와 소스가 어긋나면 소스가 이긴다
