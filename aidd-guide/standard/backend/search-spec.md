---
id: LLM-FWK-BE-014
title: "조회 화이트리스트 — 스펙 객체와 기간 상한"
category: standard/backend
type: operation
created: 2026-09-06
updated: 2026-09-06
status: active
sources: ["sources/backend/core/search/", "sources/backend/domain/search/"]
tier: 2
tags: [backend, query, whitelist, spec, guard]
---

# 조회 화이트리스트 — 스펙 객체와 기간 상한

> **여기는 서버가 무엇을 막는가** 다. 화면과 서버가 주고받는 **봉투·연산자·페이징**은
> [search.md](./search.md) 가 갖는다 — 그쪽은 프론트도 읽고 여기는 백엔드만 읽는다.
>
> **동적형에만 필요하다.** 고정형은 `params` 를 서비스가 이름으로 직접 읽으므로
> 화이트리스트도 인젝션 표면도 없다([search.md](./search.md) §1).

## 1. 화이트리스트 — 스펙 객체가 그것이다

```java
public static final QuerySpec SPEC = QuerySpec.of("accessLog")
    .from(AL)
    .leftJoin(U).on(U.userId.eq(AL.userId))    // 조인도 여기 있다
    .col("creDtm",  AL.creDtm).sortable()
    .col("userNm",  U.userNm)                  // 조인 컬럼 — 별칭을 Q타입이 안다
    .col("menuCd",  AL.menuCd).nullable()
    .derived("status", AccessLogSpec::status)  // 컬럼이 아니다 — 정렬 불가
    .defaultSort("creDtm", DESC)
    .pk(AL.seq)                                // tie-breaker
    .build();
```

**`.col(…)` 로 열지 않은 이름이 오면 400 이다.** 대상이 `Path` 객체라 **타입이 곧 허용
연산자**이며, 프론트 선언을 미러링하지 않는다.

> **레코드 리플렉션이 아닌 이유 둘.** ① 그 레코드는 **바인딩되지 않는다** — `between` 의
> 값은 2원소 배열이고 `in` 은 리스트라 `OffsetDateTime`·`String` 필드에 담기지 않는다.
> ② 리플렉션은 **절반만 준다** — 이름 집합은 나오지만 **어느 컬럼·별칭인지**는 안 나온다.

### 검증 없이 빌더에 들어갈 수 없다 — 자료형으로 막는다

**빌더의 산출물 `Built` 만 쿼리에 들어간다.** 생성자를 패키지 전용으로 닫으면
**빌더 말고는 아무도 만들 수 없다.**

| | AOP 통과 표식 | **자료형** |
|---|---|---|
| 검증을 건너뛰면 | 런타임 500 | **컴파일 실패** |
| 조회 서비스가 받는 것 | 무엇이든 | **`Built` 하나** — `apply` · `count` · `respond` 를 그것이 갖는다 |

**그래도 런타임에 뚫리면 400 이 아니라 500 이다.** 사용자 입력 문제가 아니라 **우리 코드의
버그**이므로, 조용히 400 으로 돌리면 *"조회가 안 된다"* 로 묻힌다.

## 2. 조회 기간 상한 — `RangeGuard` 하나가 판정한다

이력 화면은 기간 없이 열면 표 전체를 훑는다. **화면마다 다시 짜지 않는다.**

```java
RangeGuard.check(request, new RangeGuard.Rule(
        "creDtm", "traceId",                        // 기간 조건의 field · 면제 조건
        configs.get(SearchRangeProps.class).maxDays(),
        XxxErrorCode.RANGE_REQUIRED, XxxErrorCode.RANGE_TOO_WIDE));
```

- **상한은 시스템 설정**(`SearchRangeProps`)이다. 더 좁히는 것은 `Math.min(시스템, N)` 이며
  **요건서가 그렇게 말한 화면만** 한다 — 사용 이력은 31일, 로그인 이력은 좁히지 않는다.
- **`bypassField` 는 한 건을 정확히 집는 조건**이다. 그것이 오면 기간이 선택이 된다.
- 쓰는 곳 넷 — `AccessLog` · `LoginLog` · `ErrorLog` · `Sample` 의 `QueryService`.

## 관련

- [search.md](./search.md) — 봉투 · 연산자 열셋 · 페이징 모드 셋
- [persistence.md](./persistence.md) — `IN` 쪼개기 · tie-breaker 의 벤더 근거
- [api.md](./api.md) — 경로·봉투·헤더
