---
id: LLM-KNW-IDX
title: "knowledge — 도메인 지식 INDEX"
category: knowledge
type: operation
created: 2026-05-04
updated: 2026-09-06
status: active
sources: ["sources/backend/domain/src/main/java/com/aiagent/domain/", "sources/backend/bootstrap/src/main/resources/db/changelog/schema/"]
tier: 3
tags: [knowledge, domain, index]
---

# knowledge — 이 백오피스가 무엇을 아는가

> **[standard](../standard/INDEX.md) 는 *어떻게 만드나* 이고 여기는 *무엇이 참인가* 다.**
> 표가 무엇을 담고 어떤 규칙이 그것을 지키는지, **그리고 왜 그 컬럼이 없는지** 를 적는다.
>
> **결정론 영역이다.** 여기서 추정하지 않는다 — 어긋나면 **엔티티 소스가 이긴다.**

## 진입 결정 트리

```
무엇을 아는가
  │
  ├─ 계정 · 로그인 · 비밀번호 재설정 · 역할 부여    → sys/user-role.md
  ├─ 메뉴 트리 · API · 역할 권한 · 개인 예외       → sys/menu.md
  ├─ 공통코드 · 참조 코드(부가 속성)               → sys/code.md
  ├─ 화면 문구 · 다국어 · 캐시 버전                → sys/message.md
  ├─ 환경설정 오버라이드                           → sys/config.md
  ├─ 사용 이력 · 에러 · 로그인 이력                → sys/logs.md
  ├─ 스케줄 배치 · 실행 이력                       → sys/batch.md
  ├─ 공지 · 알림함 · 요청함                        → sys/notification.md
  ├─ 진행률 · 분산 락                              → sys/progress-lock.md
  ├─ 즐겨찾기 · 그리드 설정 · 저장 조회조건 · 통계 → sys/personalization.md
  ├─ 얼마나 보관하나 · 언제 지우나                 → retention.md
  └─ 이 말이 무슨 뜻인가                           → glossary.md
```

## 파일

| ID | 파일 | 담는 표 |
|----|------|---------|
| LLM-KNW-001 | [glossary.md](./glossary.md) | 용어 — 이 저장소가 쓰는 말 |
| LLM-KNW-SYS-IDX | [sys/INDEX.md](./sys/INDEX.md) | 표 34개 한눈에 |
| LLM-KNW-003 | [retention.md](./retention.md) | **보존 기간 — 방향이 둘이다**(상한 · 하한) |

`sys/` 하위는 [sys/INDEX.md](./sys/INDEX.md) 가 목록을 갖는다.

## 이 저장소의 표 — 규모

| | |
|---|---|
| `SYS_` 표 | **34** (스키마 changelog 기준) |
| 엔티티 | **33** — `SYS_SEQUENCE` 만 엔티티가 없다(Hibernate `TABLE` 전략이 쓴다) |
| 샘플 표 | `SMPL_ORDER` · `SMPL_ORDER_ITEM` · `SMPL_ORDER_TAG` **셋** — 통째로 지울 수 있다 |

## 표를 읽는 규칙 — 전 도메인 공통

| 규칙 | 어디에 걸리나 |
|---|---|
| **감사 넷**(`REG_ID`·`REG_DTM`·`MOD_ID`·`MOD_DTM`)은 **사람이 쓰는 표에만** | 기계가 쓰는 표에 두면 *언제나 같은 값인 컬럼* 이 생겨 **그 컬럼 자체를 신뢰할 수 없게 된다** |
| **이력 표에는 감사 넷도 FK 도 없다** | `USER_ID + CRE_DTM` 이 곧 *누가 언제* 이고, **계정이 사라져도 과거 기록의 주체는 남아야 한다** |
| **`USE_YN` 은 읽는 쪽이 있을 때만 둔다** | 소비자 없는 플래그는 화면의 스위치가 아무 일도 하지 않는 상태가 된다 |
| **`*_NM` 이 이름이 아닐 수 있다** | `SYS_MENU.MENU_NM` · `SYS_CODE.DTL_NM` 은 **메시지 키**다 |
| **없는 값은 행이 없는 것이다** | 빈 문자열·`NULL`·`USE_YN='N'` 로 *없음* 을 두 가지로 표현하지 않는다 |
| **기간은 양끝 포함이고 `NULL` 이 제한 없음이다** | 계정·역할 부여·개인 예외·IP 허용이 같은 규칙을 쓴다 |

## 어긋남을 발견하면

**문서를 고친다.** 소스가 이긴다. 다만 **보고 없이 지나가지 않는다** — 그 어긋남이
*문서가 낡은 것* 인지 *구현이 규칙을 깬 것* 인지는 읽는 사람이 판단한다.

## 관련

- [INDEX](../INDEX.md) — 마스터
- [standard/backend](../standard/backend/INDEX.md) — 구조와 계약
- [playbook](../playbook/INDEX.md) — 화면 레시피
