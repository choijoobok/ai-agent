---
id: LLM-KNW-SYS-002
title: "메뉴 · 인가 데이터 — SYS_MENU · SYS_API · 권한"
category: "09-knowledge/sys"
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/domain/src/main/java/com/ordinary/backoffice/domain/authz/entity/", "sources/backend/bootstrap/src/main/resources/menu/menu-tree.yaml"]
author: Bong Jong Hyeon
tier: 3
tags: [knowledge, menu, authz, api]
---

# 메뉴 · 인가 데이터 — `SYS_MENU` · `SYS_API` · 권한

> 표 다섯: `SYS_MENU` · `SYS_API` · `SYS_MENU_API` · `SYS_ROLE_MENU_AUTH` ·
> `SYS_USER_MENU_AUTH`.
>
> **판정이 어떻게 도는가**는 [06-framework/backend/security.md](../../standard/backend/security.md)
> 가 갖는다. 여기는 **그 판정이 읽는 다섯 표**다.

## 1. `SYS_MENU` — `MENU_URL` 의 NULL 여부가 권한 대상 여부다

| 컬럼 | |
|---|---|
| `MENU_CD` | PK |
| `UP_MENU_CD` | 부모 — **연관관계로 매핑하지 않는다**(문자열) |
| `MENU_NM` | **메뉴명이 아니라 메시지 키다** — `menu.{MENU_CD}` |
| `MENU_URL` | **NULL 이면 순수 구조 노드** — 권한 표에 들어오면 거부한다 |
| `ICON_CD` · `SORT_NO` · `USE_YN` | |
| `EXPORT_YN` | 서버 경로 없이 프론트가 엑셀을 만드는 화면의 `EXPORT` 근거 |
| `SRC_CD` | `SEED` / `ORPHAN` — §2 |

- **URL 과 자식은 배타다.** `MENU_URL IS NULL` 과 *자식이 있다* 가 **같은 사실**이라
  판정이 볼 것도 하나다.
- **`MENU_NM` 을 저장 DTO 에 두지 않는다.** 명칭의 단일 원본이 `SYS_MESSAGE` 이며,
  **조작할 경로가 구조적으로 없다.**
- **`UP_MENU_CD` 에 `@ManyToOne` 을 걸지 않는다.** 걸면 조상 역산이 **지연 로딩 N+1** 이
  되고, 순환이 있는 데이터에서는 **순회가 끝나지 않는다.** 문자열이면 트리를 한 번에 읽어
  메모리에서 방문 집합과 깊이 상한을 건다.

## 2. 메뉴 시드는 생성물이고 **지우지 않는다**

원본은 `menu-tree.yaml` 이고 `generateMenuSeed` 가 CSV 를 만든다. 적재는 **upsert** 이며
API 시드와 달리 **전건 삭제를 하지 않는다.**

```
①  SRC_CD='SEED' 를 전부 ORPHAN 으로 표시한다
②  CSV 에 있는 것만 SEED 로 되돌린다 (없으면 새로 넣는다)
③  남은 ORPHAN 이 곧 "선언에서 사라진 메뉴" 다
```

- **`SYS_MENU` 를 참조하는 FK 가 일곱이고 넷은 사람이 결정한 사실이다**(역할 권한 · 개인
  예외 · 매핑 · 자식 노드). 전건 삭제는 배포를 FK 위반으로 터뜨리고, CASCADE 로 뚫으면
  **배포가 운영 결정을 지운다.**
- **두 단계가 한 changeSet 이어야 한다.** 갈라 두면 ①만 돌고 ②가 안 도는 창이 생기고,
  그때 기동이 끊기면 **전 메뉴가 고아로 남는다.**
- **고아를 지우는 것은 화면의 일이다** — 배포가 아니다.

## 3. `SYS_API` — 액션은 **API 의 속성**이다

| 컬럼 | |
|---|---|
| `API_URL` | PK |
| `API_NM` · `API_DESC` | |
| `ACTION_CD` | `READ` · `SAVE` · `EXPORT` · `EXECUTE` |

**`ACTION_CD` 가 (API, 메뉴) 조합의 속성이 아니라 API 하나의 속성이다.** 그래서 *같은 API
가 메뉴 A 에서는 READ, 메뉴 B 에서는 SAVE* 라는 모순이 **구조적으로 저장될 수 없다** —
검증을 사람의 리뷰에서 구조로 옮긴 것이다.

### 없는 컬럼 둘

| 없는 것 | 왜 |
|---|---|
| **`HTTP_METHOD`** | 업무 API 는 **경로가 곧 오퍼레이션**이라 메서드가 식별에 기여하지 않는다. 검증하지 않는 정보 컬럼은 표류한다 — 한 경로에 두 오퍼레이션을 두려는 시도는 **PK 충돌로 시드 배포에서 막힌다** |
| **`USE_YN`** | API 의 존재는 **코드가 결정하는 사실**이며 데이터로 끄는 대상이 아니다 |

## 4. `SYS_MENU_API` — 이 행의 추가가 곧 접근 범위 확장이다

그래서 **운영 화면에서 편집하는 데이터가 아니라** 화면 코드와 함께 코드 리뷰를 거쳐
배포되는 **시드**다(원본은 `endpoints.ts`).

- **1 : N 이 정상이다** — 같은 API 를 여러 화면이 쓴다. 판정은 그 메뉴들 중 **하나라도**
  권한이 있으면 통과하는 **OR** 이며, 정당한 이유는 사용자가 얻는 것이 화면이 아니라
  **API 능력**이고 능력은 호출 경로와 무관하기 때문이다.
- **화면마다 허용 범위가 달라야 한다면 그것은 공유 API 가 아니라 분리해야 할 두 API 다.**
- **0건은 아무도 권한을 가질 수 없다는 뜻이다.** `SYS_API` 에 행이 없는 것과 **구분해
  기록한다** — 둘 다 403 이지만 **고치는 곳이 다르다.**

## 5. `SYS_ROLE_MENU_AUTH` — 행의 존재가 곧 허용이다

`ROLE_ID` + `MENU_CD` + `ACTION_CD` 셋이 PK 이고 **다른 컬럼이 없다.**

| 없는 것 | 왜 |
|---|---|
| **`DENY_YN`** | 개인 예외가 허용만 하므로, 거부 컬럼을 두면 **합집합 규칙이 즉시 무너진다** |
| **`USE_YN`** | `N` 이 *거부* 인지 *미부여* 인지 정해야 하고, 합집합 위에서 그 구분은 `DENY_YN` 과 같은 우선순위 문제다 |

**부여를 멈추는 수단은 행 삭제 또는 역할 자체의 `USE_YN` 둘뿐이다.**

- **`READ` 는 나머지 셋의 전제다.** 다른 액션이 있으면 같은 메뉴의 `READ` 행이 있어야
  한다 — 없으면 화면에 들어갈 수 없어 그 권한을 쓸 방법이 없다. **같은 표의 다른 행에
  의존하므로 DB 제약으로 표현할 수 없고** 저장 서비스와 시드 검증 테스트가 지킨다.
- **고아가 되어도 지우지 않는다.** API 가 사라져 (메뉴, 액션)이 미정의가 되어도 **인가에는
  무해하다** — 부를 API 가 없다. `SYS_API` 와 방향이 반대인 것은 **소유자가 다르기**
  때문이다: 코드가 소유한 것은 코드를 따라가고, **사람이 소유한 것은 사람을 기다린다.**

## 6. `SYS_USER_MENU_AUTH` — 개인 예외에는 **마찰이 있어야 한다**

| 컬럼 | |
|---|---|
| `USER_ID` + `MENU_CD` + `ACTION_CD` | PK |
| `VALID_FROM_DT` · `VALID_TO_DT` | **필수** |
| `GRANT_RSN` | **필수** |

**역할 부여와 모양이 다른 것이 의도다** — 저쪽은 기간 선택 + 사유 없음이다. 역할 부여는
일상 운영이고 **개인 예외는 예외여야 한다.**

- **허용만 있다.** 차단을 두면 우선순위 규칙이 필요해지고 *왜 권한이 없는지* 를 추적할 수
  없게 된다. **특정 사용자만 빼야 하면 역할을 분리한다.**
- **폴더 단위로 확장하지 않는다.** 한 경로의 리프 열을 통째로 줘야 하면 그것은 개인 예외가
  아니라 **역할**이다 — 마찰을 없애면 개인 예외가 **제2의 역할 체계**가 된다.
- **만료 판정은 조회 시 계산이다.** 배치가 이 행을 비활성화하지 않는다 — 배치가 하는 일은
  **이력 기록과 만료 예정 통보뿐**이라 **배치가 실패해도 권한 판정은 정확하다.**

## 관련

- [user-role.md](./user-role.md) — 역할과 부여
- [06-framework/seed.md](../../standard/seed.md) — 메뉴·API 시드 생성
- [11-playbook/changeset.md](../../playbook/changeset.md) — 손으로 넣는 쪽
