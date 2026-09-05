---
id: LLM-PLY-008
title: "조회 전용 화면 — 이력 셋이 세 번 베낀 배선"
category: playbook
type: operation
created: 2026-09-05
updated: 2026-09-05
status: active
sources: ["sources/frontend/src/features/accesslog/", "sources/backend/domain/src/main/java/com/aiagent/domain/log/admin/", "2026-09-05 재현 실험 /log/login"]
tier: 2
tags: [playbook, list, cursor, readonly, log]
---

# 조회 전용 화면 — 이력 셋이 세 번 베낀 배선

> **실물 셋**: `/log/access` · `/log/login` · `/log/error`. 셋이 같은 모양이고
> **셋 다 서로를 베껴 만들어졌다.**
>
> [crud-screen.md](./crud-screen.md) 가 *무엇을 고르나*(페이징 모드 · 저장 · 실행)를 갖는다.
> 여기는 **고른 뒤에 손이 아는 것** 만 적는다 — 문서에 없어서 매번 옆 화면을 열게 만든 것들.
>
> **왜 이 문서가 생겼나**: 2026-09-05 재현 실험에서 독립한 둘이 같은 말을 했다 —
> *"규칙은 있는데 관용구가 없다."* 근거의 3분의 1이 옆 화면 소스였고, 그만큼이
> 복사였다([quality/evals/screen-reproduction.md](../quality/evals/screen-reproduction.md)).

## 1. 만들 파일 한 벌 — **찾지 말고 여기서 읽는다**

| # | 파일 | 무엇 |
|---|---|---|
| 1 | `features/{도메인}/api/endpoints.ts` | URL 선언. **화면마다 폴더 하나** — 합치면 시드가 서로의 API 를 준다 |
| 2 | `features/{도메인}/types.ts` | 서버 `{X}Row` 와 1:1 |
| 3 | `features/{도메인}/pages/{X}Page.tsx` | 화면 전량 |
| 4 | `shared/routes/screenRegistry.ts` | 한 줄 등록 |
| 5 | `domain/…/{X}Spec.java` | `QuerySpec` — 컬럼 화이트리스트 |
| 6 | `domain/…/{X}Row.java` | `record` |
| 7 | `domain/…/{X}ErrorCode.java` | 이 화면의 거절 |
| 8 | `domain/…/{X}QueryService.java` | 조회 하나 |
| 9 | `api/…/{X}Controller.java` | POST 하나 |
| 10 | `domain/…/{X}SpecTest.java` | 스펙 단위 |

- **`{도메인}Api.ts` 를 만들지 않는다.** 호출이 그리드 선언뿐이면 감쌀 것이 없다 →
  [standard/frontend/http.md](../standard/frontend/http.md).
- **패키지 자리는 엔티티가 사는 애그리거트를 따라간다.** 로그인 이력이
  `domain/log/` 가 아니라 `domain/auth/loginlog/` 인 것은 `SysLoginLog` 가
  `domain/auth/entity/` 에 살기 때문이다. **api 층은 갈릴 수 있다**(`api/log/`).

## 2. 백엔드 — 빌더 순서가 문법이다

```java
public static final QuerySpec SPEC = QuerySpec.of("accessLog")
        .from(AL)
        .leftJoin(U).on(U.userId.eq(AL.userId))   // .on() 은 .leftJoin() 바로 뒤
        .col("creDtm", AL.creDtm).sortable()      // .sortable() 은 직전 .col() 에 붙는다
        .col("userId", AL.userId).nullable()      // .nullable() 도 직전 .col() 에
        .col("userNm", U.userNm).nullable()
        .col("menuCd", AL.menuCd).nullable()
        .derived("outcome", AccessLogSpec::outcome)   // 컬럼이 아닌 조건
        .defaultSort("creDtm", SortDir.desc)
        .pk(AL.accessLogSeq)                       // 커서의 tie-breaker
        .build();
```

- **`.nullable()` 을 빠뜨리면 `ne` 가 그 행을 뺀다.** 조인이 `null` 을 낳는 칸에는 반드시 붙인다.
- **`.derived()` 가 파생 조회조건이다** — 화면의 `결과 묶음` 처럼 컬럼이 아닌 것.
  번역기가 던지는 `IllegalArgumentException` 을 `FieldSpec` 이 **400 으로 감싼다** —
  `BusinessException` 을 직접 던지지 않는다(던지면 문구가 둘이 된다).
- 계약의 전문은 [standard/backend/search.md](../standard/backend/search.md).

### 서비스 — 커서형 한 벌

```java
@Service
@Transactional(readOnly = true)          // 클래스 레벨. 메서드에 붙이지 않는다
public class AccessLogQueryService {
    private static final Expression<?>[] LIST = { AL.creDtm, AL.userId, U.userNm, … };

    public PageResponse<AccessLogRow> getList(SearchRequest<Void> request) {
        checkRange(request);
        Built built = builder.build(request, SPEC, PageMode.cursor);
        List<Tuple> found = built.apply(query.select(Projections.tuple(LIST))).fetch();
        …
        return built.respondCursor(rows, AccessLogRow::creDtm, AccessLogRow::accessLogSeq);
    }
}
```

- **`respondCursor` 의 인자는 셋** — 행 · 정렬 키 · PK. 순서가 `defaultSort` · `pk` 와 같다.
- **기간 상한은 `RangeGuard.Rule` 다섯 칸**: 기간 컬럼 · **면제 조건** · 상한 · 필수 오류 · 초과 오류.
  면제 조건(`traceId`)이 있으면 그것만으로 조회가 열린다.
- **상한을 화면이 덮지 않으면 상수를 두지 않는다.** 시스템 값과 같은 숫자를 다시 적으면
  설정을 고친 날 조용히 갈린다.

### 컨트롤러

```java
@RequestMapping("/api/service/accessLog")    // /api/{계층}/{도메인} — 접두가 액션을 정한다
@Operation(summary = "사용 이력 목록 조회", description = "…")     // 시드 CSV 와 글자까지 같다
@PostMapping("/getList")
public ApiResponse<PageResponse<AccessLogRow>> getList(@RequestBody @Valid SearchRequest<Void> request) {
    return ApiResponse.success(queries.getList(request), TraceId.current());
}
```

- **`TraceId.current()` 를 손으로 넣는다** — 빠뜨려도 컴파일된다.
- **`@Operation` 문구를 고치면 시드가 어긋난다** — `checkSeeds` 가 빨개진다.
- **세션 언어(`RequestLocale`)는 `SYS_MESSAGE` 에서 오는 이름이 있을 때만 받는다.**
  받아 놓고 안 쓰면 쓰이지 않는 인자가 된다.

## 3. 프론트 — 뼈대는 세 층이다

```tsx
<FillColumn>
  <SearchForm handleRef={…} fields={…} onSubmit={() => void grid.read()}
              onReset={grid.clearFilters}
              onActiveCountChange={header.onActiveCountChange} collapsed={header.collapsed} />
  <div style={{ flex: 1, minHeight: 0 }}>      {/* 이 래퍼가 없으면 그리드가 접힌다 */}
    <DataGrid title={…} menuCd={MENU_CD} controller={grid} … />
  </div>
</FillColumn>
```

- **`minHeight: 0` 래퍼를 빠뜨리는 것이 가장 흔한 사고다.** 오류가 아니라 *안 보임* 으로 나온다.
- **`api` 에 `save` 를 두지 않으면 저장 버튼이 나오지 않는다** — 감추는 코드를 쓰지 않는다.
  *되면 안 되는 것* 은 **선언을 안 하는 것**으로 이룬다.
- **0건 문구는 `params` 콜백 안에서 정한다.** 응답이 0건인 것을 안 시점에는 *무엇을 물었는지* 가
  폼에만 남아 있고, 그 사이 사용자가 조건을 고치면 문구가 묻지 않은 것을 말한다.

```tsx
const collectConditions = useCallback(() => {
  const conditions = searchForm.current?.collect() ?? null;
  if (conditions !== null) setEmptyText(failedOnly(conditions) ? MSG.X_EMPTY_FAILED : MSG.X_EMPTY);
  return Promise.resolve(conditions);
}, []);
const grid = useGridController<Row>({ menuCd, columns, api, pageSize, params: collectConditions });
```

### 공통코드 컬럼 — 네 키를 **함께** 쓴다

```ts
{ field: 'stsCd', header: MSG.X_COL_STATUS,
  type: 'code', grpCd: RESULT_GRP_CD,      // 이름은 공통코드가 붙인다
  renderer: 'badge', tone: RESULT_TONE }   // 색은 소스가 정한다 — 값 집합이 닫혔으면 맵
```

- **글자와 색의 소유가 다르다.** 갈래는 소스가 정하고 글자는 데이터가 정한다 —
  `options` 를 상수로 적으면 언어를 늘릴 때 이 파일이 함께 는다.
- **셀 밖에서 코드 이름이 필요하면 `codeLabel(grpCd, dtlCd)`** — `shared/i18n/codeLabel.ts`.
  ESLint 의 한글 리터럴 금지를 지나가는 유일한 길이다.
- 시스템 상한 같은 설정값은 **`useAuthStore().searchRange`** 에서 읽는다.

## 4. 커밋 전

- [ ] `.nullable()` 이 조인 칸마다 붙었나
- [ ] `minHeight: 0` 래퍼가 있나
- [ ] `@Operation` 문구가 시드와 같은가 — `./gradlew checkSeeds`
- [ ] 요건서 §9 의 *되면 안 되는 것* 이 **선언의 부재**로 이뤄졌나(감추는 코드가 아니라)

## 관련

- [crud-screen.md](./crud-screen.md) — 페이징 모드 · 저장 · 실행. **고르는 일은 저기가 한다**
- [standard/backend/search.md](../standard/backend/search.md) — `QuerySpec` 계약 전문
- [standard/frontend/grid.md](../standard/frontend/grid.md) — 컴포넌트 계약
- [standard/frontend/declarations.md](../standard/frontend/declarations.md) — 컬럼 선언 키
