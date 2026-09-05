---
id: LLM-KNW-SYS-008
title: "공지 · 알림 · 요청 — 셋이 갈리는 축"
category: knowledge/sys
type: operation
created: 2026-09-03
updated: 2026-09-03
status: active
sources: ["sources/backend/domain/src/main/java/com/aiagent/domain/notification/entity/"]
author: Bong Jong Hyeon
tier: 3
tags: [knowledge, notice, notification, request]
---

# 공지 · 알림 · 요청 — 셋이 갈리는 축

> 표 셋: `SYS_NOTICE` · `SYS_NOTI_INBOX` · `SYS_NOTI_REQUEST`.
> **한 표로 합칠 수 없는 이유**가 이 문서의 요점이다.

## 1. 셋이 갈리는 축

| | 대상 | 방향 | 상태의 뜻 | 누가 쓰나 |
|---|---|---|---|---|
| `SYS_NOTICE` | **전체 공개** | 관리자 → 전원 | 게시 기간 | **사람** |
| `SYS_NOTI_INBOX` | `USER_ID` **한 명** | 시스템 → 사용자 | **읽음**(봤나) | 시스템 |
| `SYS_NOTI_REQUEST` | 관리자 | **사용자 → 관리자** | **처리**(했나) | 사용자 + 처리자 |

**알림과 요청을 한 표에 합치면 읽음과 처리가 한 컬럼에 섞인다.**

## 2. `SYS_NOTICE` — 축이 셋이고 한 컬럼으로 합칠 수 없다

| 축 | 컬럼 | 뜻 |
|---|---|---|
| **게시 기간** | `NOTICE_FROM_DTM` · `NOTICE_TO_DTM` | *언제부터 언제까지 목록에 있는가* — **미리 정한다** |
| **즉시 내림** | `USE_YN` | *지금 당장 감출 것인가* — **사고 대응** |
| **팝업 기간** | `POPUP_YN` · `POPUP_FROM_DTM` · `POPUP_TO_DTM` | *그중 언제 팝업으로 띄우는가* |

그 밖에 `NOTICE_ID`(PK) · `TITLE` · `CONTENT` · `CONTENT_TYPE_CD` · `SORT_NO`.

> **`USE_YN` 만으로 닫으면 내리는 것을 잊는 것이 정상 경로가 된다** — 점검 안내가 점검이
> 끝난 뒤에도 떠 있는다.

### 대상도 읽음도 없다

- **공지는 전체 공개다.** 역할별로 갈리는 통지는 공지가 아니라 **알림**이다.
- **읽음 상태를 두지 않는다.** 배지가 공지를 세지 않으므로 저장해도 나타날 곳이 없고,
  전체 공개라 읽음은 **사용자 수 × 공지 수**로 자라는 교차 표가 된다.
- **감사 넷이 있다** — 사람이 작성한다. 알림함과 갈리는 지점이다.

## 3. `SYS_NOTI_INBOX` — 큐가 아니다

| 컬럼 | |
|---|---|
| `NOTI_ID` | PK |
| `USER_ID` | **수신자다** — 작성자가 아니다 |
| `NOTI_TYPE_CD` | *누가 넣었나* 에 답한다 — **생산자의 종류** |
| `TITLE` · `CONTENT` | |
| `LINK_MENU_CD` · `LINK_PARAM` | 눌렀을 때 갈 곳 |
| `READ_YN` · `READ_DTM` · `CRE_DTM` | |

- **DB 에 행을 쓰는 것이 곧 도달이다.** 상태 전이도 릴레이도 없고 **`READ_YN` 하나만
  바뀐다.** `SYS_NOTI_OUTBOX` 는 **표 자체가 없다** — 외부 채널 어댑터가 없는 배포에서
  outbox 는 **지나가는 것이 없는 표**다.
- **감사 넷이 없다.** 행을 만드는 것이 사람이 아니고 `USER_ID` 는 수신자다 — `REG_ID` 를
  두면 **언제나 `'system'` 인 컬럼**이 하나 는다.
- **`allocationSize` 가 50 이다.** 이력 셋과 배치 이력이 1000 인 것과 갈린다 — 저쪽은
  **요청마다** 나지만 알림은 **사건마다** 난다. 만료 예고 배치의 버스트가 있지만 **하루
  한 번**이다.
- **보존 90일이고 읽음 여부를 보지 않는다.** 읽은 것만 지우면 **안 읽은 알림이 영원히
  쌓이고, 그것이 정확히 지우고 싶은 행이다.**

> **읽기·쓰기 서비스는 아직 없다**(2026-09-03 확인). 지금 이 엔티티가 있는 이유는
> **파기 배치**다 — 리포지토리로 도는 구조라 대상 표에는 엔티티가 있어야 한다.

## 4. `SYS_NOTI_REQUEST` — 짝이 둘이고 뜻이 다르다

| 컬럼 | |
|---|---|
| `REQ_ID` | PK |
| `USER_ID` · `CRE_DTM` | **낸 사람** — `REG_*` 자리 |
| `REQ_TYPE_CD` · `REQ_CONTENT` · `REQ_STAT_CD` | |
| `HANDLER_ID` · `HANDLE_DTM` | **판정한 사람** — `MOD_*` 자리 |
| `HANDLE_MEMO` | |

**감사 넷을 두면 같은 사실을 두 벌로 적는다.** 그리고 **두 짝의 뜻이 다른 것이 요점**이다 —
앞은 낸 사람, 뒤는 **판정한** 사람이다.

### 화면이 셀을 고치지 않는다

처리는 저장이 아니라 **판정**이고, **부수 효과가 있으며**(요청자에게 알림이 나간다),
반려는 **두 값을 함께 강제해야 한다.** 그래서 이 엔티티에는 그리드 저장이 부르는
`apply(전 컬럼)` 이 없고 `handle` 하나만 있다.

## 관련

- [logs.md §6](./logs.md) — 알림함 보존
- [personalization.md](./personalization.md) — 배지가 세는 것
- [playbook/crud-screen.md](../../playbook/crud-screen.md) — 판정형 실행은 `actions` 다
