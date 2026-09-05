---
id: LLM-KNW-SYS-005
title: "이력 셋 — 사용 · 에러 · 로그인"
category: knowledge/sys
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/domain/src/main/java/com/aiagent/domain/log/entity/", "sources/backend/domain/src/main/java/com/aiagent/domain/auth/entity/SysLoginLog.java", "sources/backend/bootstrap/src/main/resources/application.yml"]
tier: 3
tags: [knowledge, log, history, retention]
---

# 이력 셋 — 사용 · 에러 · 로그인

> 표 셋: `SYS_LO_ACCESS` · `SYS_LO_EXCEPTION` · `SYS_LO_LOGIN`.
> **클래스명과 표명이 갈린다**(`SysAccessLog` → `SYS_LO_ACCESS`).
>
> **어떻게 쌓이는가**는 [standard/backend/logging.md](../../standard/backend/logging.md)
> 가 갖는다. 여기는 **쌓인 것의 모양**이다.

## 1. 이력 셋의 공통 규칙

| 규칙 | 왜 |
|---|---|
| **감사 넷이 없다** | `USER_ID + CRE_DTM` 이 곧 *누가 언제* 다 |
| **FK 가 없다** | 계정이 사라져도 **과거 기록의 주체는 남아야 한다**. 로그인 이력은 **존재하지 않는 ID 의 시도도** 기록한다 |
| **행은 불변이다** | 갱신되는 이력은 [batch.md](./batch.md) 의 실행 이력 **하나뿐**이며 그것이 예외다 |
| **`allocationSize` 가 1000 이다** | 고빈도 INSERT 다. `TABLE` 전략은 할당 시 행 락을 잡으므로 기본 50 이면 **50건마다 경합한다** |

> **대가: PK 순서가 시간 순서가 아니다.** 노드마다 다른 블록을 쥔다 — **커서 정렬이
> 시각을 먼저 보고 PK 는 동률만 가른다.** 재기동 시 번호에 구멍이 생기지만 **이력 PK 에
> 연속성은 요구되지 않는다.**

## 2. `SYS_LO_ACCESS` — 전 요청이 한 행이다

| 컬럼 | |
|---|---|
| `ACCESS_LOG_SEQ` | PK |
| `USER_ID` · `MENU_CD` · `REQUEST_URI` · `HTTP_STAT` | |
| `PARAMETERS` | 요청 전문 — **`nclob`** |
| `CLIENT_IP` · `TRACE_ID` · `CRE_DTM` | |

**2xx 도 4xx 도 5xx 도 남는다.**

## 3. 에러 로그와 **배타가 아니다**

예외가 난 요청은 사용 이력에 한 행, 에러 로그에 **한 행이 더** 붙고 **`TRACE_ID` 가 둘을
잇는다.**

> **배타였을 때** *이 에러가 난 요청의 전문을 보자* 가 **언제나 0건**이었고 사용자는
> 그것을 **로그 유실**로 읽었다.

## 4. `SYS_LO_EXCEPTION` — 세 컬럼이 요점이다

| 컬럼 | |
|---|---|
| `EXCEPTION_LOG_SEQ` | PK |
| **`HTTP_STAT` · `ERR_CD` · `ERR_MSG`** | 응답이 **이미 갖고 있는 값**이다 — 새로 만드는 것이 아니라 **버리고 있던 것을 적는다** |
| `ROOT_CAUSE_STACK` | `nclob`. **4xx 는 `null`** |
| `USER_ID` · `MENU_CD` · `REQUEST_URI` · `CLIENT_IP` · `TRACE_ID` · `CRE_DTM` | |

- **셋이 없으면** 403 홍수 속에서 500 을 찾을 수 없고 *같은 오류가 몇 건인가* 를 물을 수
  없다 — **`nclob` 스택으로는 묶을 수 없다**(정렬도 그룹도 벤더가 막는다).
- **예외 클래스명 컬럼이 없다.** `ERR_CD` 가 같은 일을 하며, 클래스명은 리팩터링으로 바뀌어
  **과거 이력과 현재 코드가 어긋난다.**
- **4xx 는 스택을 남기지 않는다.** `AccessDeniedException` 의 스택은 인터셉터 프레임뿐이고
  **전 행이 같다** — 180일치 노이즈다. 그 `null` 이 **모달의 스택 탭이 비활성으로 뜨는
  근거**다.
- **401 은 아예 오지 않는다.** 세션 만료는 정상 흐름이고 하트비트마다 쌓이면 **에러 로그가
  만료 로그가 된다** — 그 사건은 로그인 이력의 `SESSION_TIMEOUT` 이 갖는다.

## 5. `SYS_LO_LOGIN` — 세션 종료까지 담는다

| 컬럼 | |
|---|---|
| `LOGIN_LOG_SEQ` | PK |
| `LOGIN_RSLT_CD` | 성공·실패에 더해 **세션 종료** — 코드 15종이 `SYS_YN='Y'` 그룹이다 |
| `USER_ID` · `CLIENT_IP` · `USER_AGENT` · `TRACE_ID` · `CRE_DTM` | |

**결과 코드가 소스의 열거형이라 그 코드 그룹은 운영이 지울 수 없다.**

## 6. 보존 — 파기 배치가 읽는다

| 표 | 보존 |
|---|---|
| `SYS_LO_ACCESS` | **90일** — 요청 전문(`nclob`)이 달려 있어 가장 짧다 |
| `SYS_LO_EXCEPTION` | 180일 |
| `SYS_LO_LOGIN` | 365일 |
| `SYS_BATCH_HISTORY` | 365일 |
| `SYS_NOTI_INBOX` | 90일 — **읽음 여부를 보지 않는다** |

- **설정 위치가 `sys-config` 아래다** — 운영하면서 조정하는 값인데 `app.*` 는 `yml` 뿐이라
  재배포가 필요하다. **평평한 스칼라**인 것은 화면의 값 타입이 넷뿐이라 중첩이면 **기간
  하나를 고치려고 JSON 을 손으로 짜기** 때문이다.
- **하한(최소 보존)은 설정으로 열지 않는다.** 대상 다섯은 **코드가 갖는다**.
- **파기 배치는 `USE_YN='N'` 로 시드된다.** 아카이브 형식이 미결이라, **켜는 프로젝트가
  그때 형식과 함께 정한다.**
- **`chunk-size` 는 응답성의 상한이다** — 중단 확인이 청크 사이에서 일어난다.

## 관련

- [batch.md](./batch.md) — 파기 배치의 실행 이력
- [user-role.md](./user-role.md) — 로그인 실패가 계정을 잠근다
- [standard/backend/logging.md](../../standard/backend/logging.md) — 마스킹과 파이프라인
