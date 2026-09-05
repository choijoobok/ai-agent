---
id: LLM-KNW-SYS-007
title: "문구 · 다국어 — SYS_MESSAGE_KEY · SYS_MESSAGE"
category: knowledge/sys
type: operation
created: 2026-09-03
updated: 2026-09-03
status: active
sources: ["sources/backend/domain/src/main/java/com/aiagent/domain/message/entity/"]
author: Bong Jong Hyeon
tier: 3
tags: [knowledge, message, i18n, cache]
---

# 문구 · 다국어 — `SYS_MESSAGE_KEY` · `SYS_MESSAGE`

> 표 셋: `SYS_MESSAGE_KEY` · `SYS_MESSAGE` · `SYS_CACHE_VERSION`.
>
> **두 표가 갈린 축은 소유다.** 키는 코드가, 값은 사람이 갖는다.

## 1. 소유가 갈린다 — 그것이 표를 나눈 이유다

| | 소유 | 만드는 것 |
|---|---|---|
| `SYS_MESSAGE_KEY` | **코드** | `generateMessageSeed` 가 `MSG`·`MsgKey` 에서 만든다. 사람은 손대지 않는다 |
| `SYS_MESSAGE` | **사람** | 문구를 changeset 으로 넣는다. **시드가 이 표를 열지 않는다** |

**한 표에 두 소유가 섞여 있던 것이** `MSG_GRP_CD` 부분 함수 종속의 원인이었다.

## 2. `SYS_MESSAGE_KEY`

| 컬럼 | |
|---|---|
| `MSG_KEY` | PK |
| `USE_SCOPE` | 어디서 쓰는가. **`NONE` 이 죽은 키다** |
| `MSG_DESC` | |

**이 행이 곧 관리 화면의 마스터 행이다** — 값이 하나도 없는 키도 행으로 존재하므로
*키만 있는 행* 을 위한 예외가 필요 없다.

> **키를 시드에서 빼는 것이 늘 되지는 않는다.** 이미 적재된 값 CSV 가 그 키를 참조하면
> **기동에서 FK 가 거부한다** — 그 CSV 는 체크섬이 걸려 고칠 수 없다. 그때 시드의 그 줄은
> **값이 들어올 자리를 지키는 것**이며 `USE_SCOPE='NONE'` 으로 남는다.

## 3. `SYS_MESSAGE` — 행 지향이고 `NULL` 이 미번역이다

| 컬럼 | |
|---|---|
| `MSG_KEY` + `LANG_CD` | PK |
| `MSG_VAL` | **`NULL` 일 수 있다** |

- **행 지향이라 언어를 늘려도 DDL 이 바뀌지 않는다.** 미번역 탐지가 **조회 한 번**이 된다 —
  열 지향이면 언어마다 벤더 다섯의 changelog 를 건드린다.
- **미번역은 *행이 없다* 가 아니라 *값이 비었다* 여야 한다.** 그래야 관리 화면이 빈 셀을
  그대로 편집한다.
- **빈 문자열과 가른다.** 화면은 빈 값을 `NULL` 로 저장한다 — 둘을 다 허용하면 **폴백이
  어느 쪽에서 도는지 알 수 없다.**

### 개명은 지우고 다시 넣는 것이다

`MSG_KEY` 가 PK 이고 값이 그것을 참조하므로 `update` 로 옮기려면 순서를 잡아야 한다.
행이 몇 안 되면 **`delete` 둘 + `loadData`** 가 짧다 — 새 키의 행은 키 시드가 이미 만든다.

## 4. `SYS_CACHE_VERSION` — **프론트** 캐시의 유효성 기준

| 컬럼 | |
|---|---|
| `CACHE_NAME` | PK — `message` · `code` · `config` |
| `VERSION` | |
| `MOD_DTM` | 진단용 |

- **백엔드 노드끼리 주고받는 신호가 아니다.** 폴링하지 않으며 읽는 시점은 **로그인과 공개
  번들 요청뿐**이다. 백엔드에는 노드 간 공유가 필요한 캐시가 없다.
- **버전은 `CACHE_NAME` 단위다.** 코드 그룹 하나가 바뀌어도 프론트의 `code` 캐시 전체가
  버려진다 — 그룹 단위로 두면 **표가 코드 그룹 수만큼** 늘어난다.
- **감사 넷을 상속하지 않는다.** 애플리케이션이 기계적으로 쓰는 값이라 *누가* 가 존재하지
  않는다.
- **값을 넣는 changeset 은 이 행을 함께 올린다.** 올리지 않으면 이미 뜬 인스턴스가 옛 값을
  계속 쓴다.

## 5. 어디에 문구를 두나

| 문구 | 어디 |
|---|---|
| 화면 문구 | `MSG` 키 + `label()` → `SYS_MESSAGE` |
| 서버 문구 | `MsgKey` → `SYS_MESSAGE` |
| **코드 이름** | `SYS_CODE.DTL_NM` 이 가리키는 `code.{GRP_CD}.{DTL_CD}` |
| **메뉴 이름** | `SYS_MENU.MENU_NM` 이 가리키는 `menu.{MENU_CD}` |
| 코드 그룹 이름 | **`SYS_CODE_GROUP.GRP_NM` — 여기만 컬럼이다**([code.md §2](./code.md)) |
| 개발자용 로그·예외 | **영어로 소스에** — 번역 대상이 아니다 |

## 관련

- [code.md](./code.md) — `DTL_NM` 의 반대편
- [standard/frontend/i18n.md](../../standard/frontend/i18n.md) — `label()` 과 언어 추가
- [standard/backend/caching.md](../../standard/backend/caching.md) — 캐시 백엔드
- [playbook/changeset.md](../../playbook/changeset.md) — 값 시드를 넣는 법
