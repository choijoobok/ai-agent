---
id: LLM-PMT-OVR-006
title: "Overlay — 대용량 이력 조회"
category: artifact/screen/overlay
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/frontend/src/modules/system/features/accesslog/", "sources/frontend/src/features/sample/singlecursor/", "sources/backend/domain/src/main/java/com/aiagent/domain/log/entity/"]
tier: 1
tags: [prompt, overlay, history, cursor]
---

# Overlay — 대용량 이력 조회

**트리거**: 사용 이력·로그인 이력·에러 로그·감사 기록처럼 **행이 계속 쌓이는 표**를 본다.
**필수가 되는 절**: §0 페이징 · §2 조회조건(기간) · §3-2 기본 정렬.

## 이력 화면은 CRUD 화면이 아니다

| | 업무 화면 | **이력 화면** |
|---|---|---|
| 액션 | R · S · E · X | **R · E 만** — 저장도 행 추가도 없다 |
| 페이징 | offset(총 건수 있음) | **cursor** 를 먼저 검토한다 |
| 기간 | 선택 | **필수** |
| 정렬 | 여럿 | **한 컬럼** |
| 삭제 | 화면에서 | **파기 배치가 한다** |

## 반드시 묻는 것 여섯

1. **총 건수를 보여줘야 하나** — 보여줘야 하면 offset 이고, `COUNT` 비용을 감수한다.
   아니면 **cursor** 다.
2. **기간 상한** — 며칠까지 한 번에 볼 수 있나. **기본값도 함께.**
3. **기본 정렬 컬럼** — cursor 면 **한 컬럼만** 가능하다. PK 는 시간 순서가 아니므로
   **시각을 먼저 보고 PK 는 동률만 가른다.**
4. **자동 새로고침이 필요한가** — 필요하면 주기도.
5. **엑셀로 내보내나** — 이력은 전건이 크다. **전체 다운로드의 상한**을 정해야 한다.
6. **상세를 어떻게 보나** — 긴 텍스트(전문·스택)는 목록이 싣지 않는다. **모달인가 탭인가.**

## 흔한 누락

| 빠뜨린 것 | 일어나는 일 |
|---|---|
| **기간 필수** | 전건 스캔이 나간다 |
| **cursor 인데 총 건수를 그리라고 적음** | 이 모드는 총 건수가 없다 — 푸터의 그 자리에 **무엇을 넣을지**를 대신 정해야 한다 |
| **정렬을 둘 이상 열어 둠** | 서버가 400 이다. 정렬을 바꾸면 **커서를 버리고 첫 장**으로 간다 |
| **긴 텍스트를 목록 컬럼으로 적음** | `nclob` 은 정렬도 그룹도 안 되고, 목록 조회가 그것을 SELECT 하면 **페이지마다 왕복이 커진다** |
| **보존 기간** | 이 화면이 보는 표가 **며칠 뒤 사라지는지**를 사용자가 모른다 |
| **관련 이력과의 연결** | 한 요청이 여러 표에 흔적을 남긴다 — 잇는 키(`TRACE_ID`)를 적지 않으면 화면이 서로를 못 찾는다 |

## 적지 않는 것

커서 네비(`‹ 이전 · 다음 ›`) · 페이지 크기 후보 · 파기 배치 — **전부 표준이거나 다른
기능이다.**

## 실물

| | |
|---|---|
| 커서 페이징 | `features/sample/singlecursor/` — 총 건수 없음 · 기간 필수 · 자동 새로고침 |
| 실제 이력 화면 | `features/accesslog/`(`/log/access`) · `features/loginlog/`(`/log/login`) |

## 표가 무엇을 담나

[knowledge/sys/logs.md](../../../knowledge/sys/logs.md) — 보존 기간과 `TRACE_ID` 가 잇는
두 표.

## 구현은

[playbook/crud-screen.md](../../../playbook/crud-screen.md).
