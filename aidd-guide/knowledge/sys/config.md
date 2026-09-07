---
id: LLM-KNW-SYS-009
title: "환경설정 — SYS_CONFIG 는 오버라이드다"
category: knowledge/sys
type: operation
created: 2026-09-03
updated: 2026-09-03
status: active
sources: ["sources/backend/domain/src/main/java/com/aiagent/domain/config/entity/SysConfig.java", "sources/backend/bootstrap/src/main/resources/application.yml", "sources/backend/support/config/"]
tier: 3
tags: [knowledge, config, override]
---

# 환경설정 — `SYS_CONFIG` 는 **오버라이드**다

> 표 하나: `SYS_CONFIG`(`CFG_KEY` · `CFG_VAL`).
> **컬럼이 둘뿐인 것이 이 표의 결정 전부다.**

## 1. 층이 둘이다

```
application.yml 의 sys-config.*     기본값 — 코드가 소유한다
SYS_CONFIG                          적용값 — 바꾼 것만 있다
```

**행이 없는 키가 정상이다.** 한 번도 바꾸지 않은 키는 이 표에 없다 — 그 비어 있음은
*값이 없다* 가 아니라 ***아무도 안 바꿨다*** 를 뜻한다.

## 2. 행의 존재가 곧 `변경됨` 이다

**값이 기본값과 같아도 행이 있으면 배지가 붙는다.**

> 같은 값으로 저장해 두면 **다음 배포가 `yml` 기본값을 올려도 그 키만 옛 값에 묶인다.**
> 두 값이 같아 눈으로는 구분되지 않으므로 **배지가 유일한 신호**다.

## 3. 없는 컬럼 셋

| 없는 것 | 어디로 갔나 |
|---|---|
| `CFG_TYPE_CD`(값 타입) | **설정 클래스의 필드 타입** |
| `CFG_DESC`(설명) | **필드 Javadoc** |
| `SYS_YN` | **두 층 폴백이라 지킬 것이 없다** — 행을 지우면 기본값으로 돌아간다 |

**원천이 전부 코드로 옮겨갔다.** DB 에 두면 **같은 사실이 두 곳**이 된다.

## 4. 쓰기 경로는 관리 화면 하나다

**SQL 직접 수정은 비지원**이며 잘못된 값은 **다음 재바인딩에서 예외로 죽는다.**

## 5. 무엇을 `sys-config` 에 두나 — 판단 기준

| 두는 것 | 두지 않는 것 |
|---|---|
| **운영하면서 조정하는 값** — 보존 기간 · 만료 예고 일수 · 캐시 TTL | 재배포 없이 바꿀 이유가 없는 값 → `app.*`(yml 전용) |
| **평평한 스칼라** | **중첩 맵** — 화면의 값 타입이 넷뿐이라 JSON 한 칸이 되고, 그러면 **한 값을 고치려고 JSON 을 손으로 짠다** |
| 화면이 좁힐 수 있는 상한 | 코드가 갖는 **대상 목록** — 켜고 끄는 것이 아니라 **무엇에 적용되는가** 는 코드의 사실이다 |

> **화면 층은 시스템 값을 좁히기만 한다.** 화면이 32를 적어도 시스템이 31이면 31이다.

## 6. 값을 바꾸면 캐시 버전이 오른다

`SYS_CACHE_VERSION` 의 `config` — [message.md §4](./message.md).

## 7. 아직 여기 있는 임시 값

`sys-config.message.supported`(지원 언어)의 **원본은 장차 공통코드 `LANG_CD` 그룹**이다.
**읽는 쪽을 함께 옮기지 않은 채 행만 넣으면 같은 목록이 두 곳이 된다** — 그 이관은 읽는
쪽까지 한 번에 옮기는 별도 작업이다.

## 관련

- [code.md](./code.md) — 설정과 코드의 경계
- [message.md](./message.md) — 캐시 버전
- [logs.md §6](./logs.md) — 보존 기간이 이 설정이다
