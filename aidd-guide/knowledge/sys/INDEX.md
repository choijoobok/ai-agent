---
id: LLM-KNW-SYS-IDX
title: "sys — 시스템 표 INDEX"
category: knowledge/sys
type: operation
created: 2026-05-04
updated: 2026-09-04
status: active
sources: ["sources/backend/domain/src/main/java/com/aiagent/domain/"]
tier: 3
tags: [knowledge, sys, index]
---

# sys — 시스템 표 34개

> **표 하나가 어느 파일에 있는지**를 먼저 찾는 자리다.
> 각 파일은 *담는 것 · 지키는 규칙 · 없는 컬럼과 그 이유* 순으로 적혀 있다.

## 표 → 파일

| 표 | 무엇 | 파일 |
|---|---|---|
| `SYS_USER` | 계정 | [user-role.md](./user-role.md) |
| `SYS_USER_PWD_HIST` | 비밀번호 이력 — 재사용 금지 | 〃 |
| `SYS_USER_PWD_RESET` | 재설정 토큰 — **사용자당 한 행** | 〃 |
| `SYS_USER_IP_ALLOW` | 접속 허용 IP | 〃 |
| `SYS_ROLE` | 역할 | 〃 |
| `SYS_USER_ROLE` | 역할 부여(기간) | 〃 |
| `SYS_MENU` | 메뉴 트리 | [menu.md](./menu.md) |
| `SYS_API` | API 마스터 — 액션이 여기 붙는다 | 〃 |
| `SYS_MENU_API` | 메뉴 ↔ API 매핑(시드) | 〃 |
| `SYS_ROLE_MENU_AUTH` | 역할 권한 | 〃 |
| `SYS_USER_MENU_AUTH` | 개인 예외 권한 | 〃 |
| `SYS_CODE_GROUP` | 코드 그룹 | [code.md](./code.md) |
| `SYS_CODE` | 상세 코드 | 〃 |
| `SYS_CODE_GRP_REF` | 참조 코드 **정의**(열) | 〃 |
| `SYS_CODE_REF` | 참조 **값**(셀) | 〃 |
| `SYS_MESSAGE_KEY` | 메시지 키 — **코드가 소유** | [message.md](./message.md) |
| `SYS_MESSAGE` | 메시지 값 — **사람이 소유** | 〃 |
| `SYS_CACHE_VERSION` | 프론트 캐시 유효성 기준 | 〃 |
| `SYS_CONFIG` | 환경설정 **오버라이드** | [config.md](./config.md) |
| `SYS_LO_ACCESS` | 사용 이력 — 전 요청 1행 | [logs.md](./logs.md) |
| `SYS_LO_EXCEPTION` | 에러 로그 | 〃 |
| `SYS_LO_LOGIN` | 로그인 이력(세션 종료 포함) | 〃 |
| `SYS_SCHEDULE_BATCH` | 배치 등록 | [batch.md](./batch.md) |
| `SYS_BATCH_HISTORY` | 실행 이력 — **갱신되는 이력** | 〃 |
| `SYS_NOTICE` | 공지 | [notification.md](./notification.md) |
| `SYS_NOTI_INBOX` | 인앱 알림함 | 〃 |
| `SYS_NOTI_REQUEST` | 사용자 → 관리자 요청함 | 〃 |
| `SYS_JOB_PROGRESS` | 진행률 — 임시 행 | [progress-lock.md](./progress-lock.md) |
| `SYS_DATA_LOCK` | 분산 락 | 〃 |
| `SYS_USER_FAVORITE` | 즐겨찾기 | [personalization.md](./personalization.md) |
| `SYS_USER_GRID_PREF` | 그리드 설정 | 〃 |
| `SYS_USER_SEARCH_COND` | 저장된 조회조건 | 〃 |
| `SYS_USER_MENU_STAT` | 자주 쓰는 메뉴(월 버킷) | 〃 |
| `SYS_SEQUENCE` | 논리 시퀀스 — **엔티티가 없다** | [progress-lock.md §5](./progress-lock.md) |

## 파일

| ID | 파일 | 상태 |
|----|------|------|
| LLM-KNW-SYS-001 | [user-role.md](./user-role.md) | ✅ |
| LLM-KNW-SYS-002 | [menu.md](./menu.md) | ✅ |
| LLM-KNW-SYS-003 | [code.md](./code.md) | ✅ |
| LLM-KNW-SYS-007 | [message.md](./message.md) | ✅ |
| LLM-KNW-SYS-009 | [config.md](./config.md) | ✅ |
| LLM-KNW-SYS-005 | [logs.md](./logs.md) | ✅ |
| LLM-KNW-SYS-006 | [batch.md](./batch.md) | ✅ |
| LLM-KNW-SYS-008 | [notification.md](./notification.md) | ✅ |
| LLM-KNW-SYS-010 | [progress-lock.md](./progress-lock.md) | ✅ |
| LLM-KNW-SYS-004 | [personalization.md](./personalization.md) | ✅ |

## 관련

- [../INDEX.md](../INDEX.md) — 카테고리
- [../glossary.md](../glossary.md) — 용어
