---
id: LLM-KNW-SYS-006
title: "배치 — 등록과 실행 이력"
category: knowledge/sys
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/domain/src/main/java/com/aiagent/domain/batch/entity/"]
author: Bong Jong Hyeon
tier: 3
tags: [knowledge, batch, schedule, history]
---

# 배치 — 등록과 실행 이력

> 표 둘: `SYS_SCHEDULE_BATCH`(사람이 관리한다) · `SYS_BATCH_HISTORY`(러너가 쌓는다).
> **둘의 생애가 다르다는 사실이 감사 넷의 유무로 나타난다.**
>
> **메커니즘은 [standard/backend/batch.md](../../standard/backend/batch.md)** 가 갖는다 —
> 스케줄러 · 러너 · 락 · 하트비트 · 유령 청소 · 취소.

## 1. `SYS_SCHEDULE_BATCH` — 사람이 관리하는 유일한 배치 표

| 컬럼 | |
|---|---|
| `BATCH_ID` | PK **이자 락 키** |
| `BATCH_NM` | |
| **`BATCH_DESC`** | **`nullable = false`** — §3 |
| `BEAN_ID` | 실행할 빈. **UNIQUE 가 없다** — §2 |
| `CRON` · `PARAM_JSON` | |
| `LOCK_EXPIRY_SEC` | 락 회수 시한 |
| `LOCK_MIN_INTERVAL_SEC` | 쿨다운 |
| `USE_YN` · `SORT_NO` | |

감사 넷을 **상속한다** — 사람이 만든다.

## 2. `BATCH_ID` 가 락 키인 것의 결과 — **창고 열 개**

`BEAN_ID` 가 같은 등록이 열이어도 **서로 다른 락을 잡는다.** 하나가 실패해도 **그 창고만
실패로 남으며**, 배치 하나가 내부에서 열 창고를 순회했다면 나머지에 영향이 갔을 것이다.

**`BEAN_ID` 에 UNIQUE 가 없는 것이 그 설계의 집행이다.** 중복을 막으면 창고마다 배치
서비스를 하나씩 만들어야 하고, 그것이 정확히 **데이터로 끝날 일이 코드 변경이 되는** 상황이다.

## 3. `BATCH_DESC` 가 필수인 이유

*끄면 무슨 일이 생기는가* 를 적는 자리이며 **비워 둔 채 저장할 수 없다.**

> 운영자가 배치를 끄는 순간은 대개 **장애 대응 중**이며 그때 소스를 열 시간은 없다.
> 그리고 **끄는 확인 창이 이 문장을 그대로 읽어 준다** — 비어 있으면 그 확인이 아무 말도
> 하지 않는다.

**`USE_YN` 을 따로 여는 메서드가 없다.** `apply(전 컬럼)` 이 함께 쓴다 — 그리드 한 행이
한 번에 저장되기 때문이며, **끄기 전 확인은 화면이 저장 전에** 낸다.

## 4. `SYS_BATCH_HISTORY` — **이력인데 갱신된다**

| 컬럼 | |
|---|---|
| `HIST_ID` | PK |
| `BATCH_ID` | **FK 가 없다** |
| `EXEC_TYPE_CD` · `NODE_ID` | |
| `START_DTM` · `END_DTM` · `ELAPSED_MS` | |
| `RSLT_CD` · `RSLT_MSG` | |
| `RSLT_DTL_MSG` · `ERR_MSG` | **`nclob` 둘** — §6 |
| `CANCEL_REQ_DTM` | 중단 요청 |

**이력 행은 불변이라는 규약의 유일한 예외다.** 이유는 하나 — **`RUNNING` 을 미리 넣기**
때문이며, 그렇게 하지 않으면 프로세스가 죽었을 때 아무 흔적도 남지 않아 ***실행 자체가
없었던 것*** 과 구분되지 않는다.

## 5. 유령 — `END_DTM` 이 NULL 인 채 오래 남은 행

그것이 곧 **비정상 종료의 증거**다. 화면이 `LOCK_EXPIRY_SEC` 를 조인해 유령으로 판정한다.

**화면이 정리하지는 않는다.** 유령을 `FAIL` 로 바꾸는 것은 **락 만료 안전망의 일**이며,
버튼을 두면 **정리 주체가 둘**이 된다.

### 감사 넷이 없고 `NODE_ID` 가 그 자리다

쓰는 주체가 사람이 아니라 러너다. **`NODE_ID` 가 *누가 썼나* 에 답하며**, 락 표와 같은
규칙으로 만들어져 ***락을 잡은 노드*** 와 ***배치를 실행한 노드*** 를 대조할 수 있다.

### FK 가 없다 — 이력이 삭제 게이트가 되면 안 된다

등록을 지워도 이 행은 남으며 **남아야 한다.** FK 를 걸면 **오래된 배치는 영영 못 지운다.**
대가는 화면의 고아이며 그것을 `(삭제된 배치)` 로 그린다.

## 6. 긴 문자열이 **둘**인 것

| | |
|---|---|
| `RSLT_DTL_MSG` | 처리한 대상 목록 — **성공한 실행에도 남는다** |
| `ERR_MSG` | 예외 스택 — 실패한 실행에만 남는다 |

**축이 달라서 합치지 않는다.** 둘 다 `nclob` 이라 **목록 조회가 SELECT 하지 않고** 상세
모달의 **탭 둘**이 된다.

## 7. 보존은 365일

파기 배치가 읽는다 — [logs.md §6](./logs.md).

## 관련

- [standard/backend/batch.md](../../standard/backend/batch.md) — 배치 메커니즘
- [progress-lock.md](./progress-lock.md) — 락과 진행률
- [logs.md](./logs.md) — 보존 정책
