---
id: LLM-KNW-SYS-010
title: "진행률 · 분산 락 — 지금 도는 것을 담는 표"
category: knowledge/sys
type: operation
created: 2026-09-03
updated: 2026-09-03
status: active
sources: ["sources/backend/domain/src/main/java/com/aiagent/domain/progress/entity/SysJobProgress.java", "sources/backend/domain/src/main/java/com/aiagent/domain/lock/entity/SysDataLock.java"]
author: Bong Jong Hyeon
tier: 3
tags: [knowledge, progress, lock, transient]
---

# 진행률 · 분산 락 — **지금 도는 것**을 담는 표

> 표 셋: `SYS_JOB_PROGRESS` · `SYS_DATA_LOCK` · `SYS_SEQUENCE`.
>
> **셋 다 업무 데이터가 아니다.** 그래서 감사 넷이 없고, 보존 정책이 아니라 **만료 청소**의
> 대상이며, 이력의 불변 규약에 걸리지 않는다.

## 1. `SYS_JOB_PROGRESS` — 임시 행이다

| 컬럼 | |
|---|---|
| `JOB_ID` | PK — 실행이 즉시 돌려주는 값 |
| `USER_ID` | **시작한 사람**이며 그것이 곧 **인가의 근거**다 |
| `JOB_STAT_CD` | |
| `CUR_CNT` · `TOT_CNT` | |
| `SUB_TITLE` | 구간이 갈리는 작업이 **지금 어느 구간인지** |
| `STEP_MSG` · `ERR_MSG` | |
| `CRE_DTM` · `MOD_DTM` | |

- **감사 넷이 없다.** `USER_ID` 가 작성자가 아니라 시작한 사람이며, `REG_ID` 를 함께 두면
  **언제나 같은 값인 컬럼**이 하나 는다.
- **갱신된다.** 이력 행의 불변 규약에 걸리지 않는 것은 **이것이 이력이 아니기** 때문이다.
- **종료 후 보관 기간을 넘기면 지운다** — **보존 정책이 아니라 만료 청소**다.

### 화면은 이 표를 직접 모른다

실행에 `progress: true` 한 줄을 적으면 그리드가 폴링을 훅에 넘긴다 —
[playbook/crud-screen.md](../../playbook/crud-screen.md).

**메커니즘은 [standard/backend/progress.md](../../standard/backend/progress.md)(맡기고
돌아오기 · 조절 · 실행기 · 청소)와 [sources/frontend/progress.md](../../standard/frontend/progress.md)
(폴링 · 창 · 경과 시간)가 갖는다.**

## 2. `SYS_DATA_LOCK` — **선점 판정이 PK INSERT 의 성공 여부**다

| 컬럼 | |
|---|---|
| `LOCK_TYPE` + `LOCK_KEY` | PK |
| `EXPIRE_DTM` | **장애 안전망** — 프로세스가 죽어 해제를 못 했을 때의 회수 시한 |
| `RELEASE_DTM` | **쿨다운** — 작업이 끝나도 이 시각까지는 다시 못 잡는다 |
| `NODE_ID` | 배치 이력과 **같은 규칙으로 만든다** — 두 표를 대조할 수 있다 |
| `USER_ID` | **감사가 아니라 진단용**이며 FK 도 걸지 않는다 |
| `CRE_DTM` | 언제 잡았나 — 진단 |

- **상태 컬럼도 *잠김 여부* 플래그도 없다.** 행이 있으면 잠긴 것이고 없으면 풀린 것이다.
  플래그로 두면 *읽고-판단하고-쓰는* 사이가 생겨 **락을 만드는 코드가 스스로 락을
  필요로 한다.**
- **`EXPIRE_DTM` 과 `RELEASE_DTM` 을 한 컬럼으로 합치지 않는다.** 합치면 **값의 의미가
  옵션에 따라 바뀌고**, 기본값을 그대로 둔 채 옵션만 끄면 **같은 키가 5분에 한 번만 도는
  사고**가 난다.
- **감사 넷이 없다.** 인프라 표이며 기계가 쓴다 — *누가 이 행을 만들었나* 라는 질문이
  성립하지 않는다.

### 첫 사용처가 배치만이 아니다

배치의 `BATCH_ID` 가 락 키인 것([batch.md §2](./batch.md))이 대표적이지만, **메뉴 트리
저장**처럼 *한 번에 한 사람만* 이어야 하는 편집도 이 표를 쓴다.

## 3. 유령은 락이 정리한다 — 화면이 아니다

배치 이력에 `END_DTM` 이 NULL 인 채 남은 행을 `FAIL` 로 바꾸는 것은 **락 만료 안전망의
일**이다. 화면에 버튼을 두면 **정리 주체가 둘**이 된다.

## 4. 이 셋이 공유하는 규칙

| | 이력 셋 | 여기 셋 |
|---|---|---|
| 행의 뜻 | **일어난 일** | **지금 도는 것** |
| 불변 | 그렇다 | **갱신된다** |
| 사라지는 방식 | **보존 기간**(파기 배치) | **만료 청소** |
| 감사 넷 | 없다 | 없다 |

## 5. `SYS_SEQUENCE` — 엔티티가 없는 유일한 표

Hibernate 의 `TABLE` 식별자 전략이 쓴다. **표가 늘 때마다 행이 하나 는다** — 새 표를
만드는 changeset 은 시퀀스 행을 함께 넣는다.

- **`allocationSize` 가 표마다 다르다**: 이력 셋과 배치 이력 **1000**, 알림함 **50**,
  나머지는 기본. 근거는 **INSERT 빈도**다([logs.md §1](./logs.md) · [notification.md §3](./notification.md)).
- **대가는 PK 순서가 시간 순서가 아닌 것**이며, 그래서 커서 정렬이 **시각을 먼저 본다.**

## 관련

- [batch.md](./batch.md) — 락 키와 유령
- [logs.md](./logs.md) — 보존과 만료의 차이
- [standard/backend/progress.md](../../standard/backend/progress.md) · [sources/frontend/progress.md](../../standard/frontend/progress.md) — 진행률 메커니즘
- [standard/backend/persistence.md](../../standard/backend/persistence.md) — `TABLE` 전략
