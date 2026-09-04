package com.ordinary.backoffice.domain.search;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.search.CursorToken;
import com.ordinary.backoffice.core.search.JoinSpec;
import com.ordinary.backoffice.core.search.PageMode;
import com.ordinary.backoffice.core.search.PageResponse;
import com.ordinary.backoffice.core.search.PageSpec;
import com.ordinary.backoffice.core.search.QuerySpec;
import com.ordinary.backoffice.core.search.SearchErrorCode;
import com.ordinary.backoffice.core.search.SortSpec;
import com.querydsl.core.types.EntityPath;
import com.querydsl.core.types.OrderSpecifier;
import com.querydsl.core.types.Predicate;
import com.querydsl.core.types.dsl.SimpleExpression;
import com.querydsl.jpa.impl.JPAQuery;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Function;

/**
 * 검증을 통과한 조회 — api-conventions.md §4.2. <b>이 타입만 쿼리에 들어간다.</b>
 *
 * <p><b>생성자가 패키지 전용인 것이 장치다.</b> {@link QueryDslBuilder} 말고는 아무도 만들 수
 * 없으므로 <i>"검증 호출을 빠뜨렸다"</i> 가 <b>런타임 500 이 아니라 컴파일 실패</b>가 된다.
 * AOP 통과 표식은 배포 후에 알려 주고, 자료형은 빌드에서 막는다 — 원칙 P1.
 *
 * <p><b>{@code FROM}·{@code JOIN} 도 여기서 붙는다</b>(34 §4.4). 서비스에 남는 것은
 * <i>"무엇을 뽑나"</i>({@code PROJECTION})뿐이다 — 조인이 스펙과 서비스 두 곳에 있으면
 * 어긋났을 때 <b>묵시적 크로스 조인</b>으로 결과가 조용히 틀린다.
 */
public final class Built {

    private final QuerySpec spec;
    private final Predicate where;
    private final OrderSpecifier<?>[] order;
    private final PageMode mode;
    private final PageSpec page;

    /** 커서형에서만 채워진다 — 응답이 다음 토큰을 만들 때 <b>어느 필드·어느 방향</b>인지. */
    private final SortSpec cursorSort;

    Built(
            QuerySpec spec,
            Predicate where,
            OrderSpecifier<?>[] order,
            PageMode mode,
            PageSpec page,
            SortSpec cursorSort) {
        this.spec = spec;
        this.where = where;
        this.order = order;
        this.mode = mode;
        this.page = page;
        this.cursorSort = cursorSort;
    }

    public PageMode mode() {
        return mode;
    }

    /** 조회 쿼리에 {@code FROM}·{@code JOIN}·{@code WHERE}·{@code ORDER BY}·페이징을 붙인다. */
    public <T> JPAQuery<T> apply(JPAQuery<T> query) {
        source(query);
        query.where(where).orderBy(order);
        switch (mode) {
            case offset -> query.offset((long) page.pageOrFirst() * page.sizeOrDefault())
                    .limit(page.sizeOrDefault());
            // 상한 + 1 건을 읽어 넘침을 판정한다 — 조용히 자르면 '전량' 이 거짓말이 된다.
            case all -> query.limit(PageSpec.ALL_LIMIT + 1L);
            /*
              <b>{@code OFFSET} 이 없다.</b> 커서가 곧 {@code WHERE} 이므로 건너뛸 것이 없고,
              그래서 이 모드만 벤더 분기를 요구하지 않는다(db-portability.md §4.4 · api-conventions.md §3.8).

              한 건 더 읽는 것이 다음 장의 존재 판정이다 — ADR-0019 가 엑셀 상한을
              "상한 + 1 건까지만 조회" 로 판정한 것과 같은 수법이며, COUNT 를 세지 않기로 한
              이 모드에서 "다음이 있나" 에 답하는 유일한 수단이다.
            */
            case cursor -> query.limit(page.sizeOrDefault() + 1L);
        }
        return query;
    }

    /**
     * 총 건수 쿼리 — {@code offset} 모드에만 있다.
     *
     * <p><b>공짜가 아니다</b>(grid-standard.md §2.3). 대용량 이력에서 비싸며 그 화면들이 커서형을 고르는 이유다.
     */
    @SuppressWarnings("unchecked")
    public JPAQuery<Long> count(JPAQueryFactory factory) {
        JPAQuery<Long> query = factory.select(((SimpleExpression<Object>) spec.root()).count());
        source(query);
        return query.where(where);
    }

    /** 조회 결과를 응답 봉투로 — api-conventions.md §3.9. */
    public <T> PageResponse<T> respond(List<T> rows, long totalElements) {
        return switch (mode) {
            case offset -> PageResponse.offset(
                    rows, page.sizeOrDefault(), page.pageOrFirst(), totalElements);
            case all -> {
                if (rows.size() > PageSpec.ALL_LIMIT) {
                    throw new BusinessException(
                            SearchErrorCode.TOO_MANY_ROWS,
                            "전량 조회 상한 " + PageSpec.ALL_LIMIT + " 을 넘었다 — " + spec.name());
                }
                yield PageResponse.all(rows);
            }
            case cursor -> throw new IllegalStateException(
                    "커서형은 respondCursor 로 답한다 — 기준점을 뽑을 함수가 필요하다");
        };
    }

    /**
     * 커서형의 응답 — api-conventions.md §3.8 · §3.9.
     *
     * <p>{@link #apply} 가 {@code size + 1} 건을 읽어 왔다. 여기서 하는 일이 셋이다.
     *
     * <ol>
     *   <li><b>넘친 한 건을 떼어 낸다</b> — 그 한 건의 존재가 곧 <i>다음이 있다</i> 다
     *   <li><b>뒤로 온 장은 되집는다</b> — 뒤집어 읽었으므로 목록도 뒤집혀 있다
     *   <li><b>양쪽 토큰을 만든다</b> — 첫 행이 {@code prev}, 마지막 행이 {@code next}
     * </ol>
     *
     * <p><b>첫 장에는 {@code prevCursor} 가 없다.</b> 요청에 커서가 없었다는 것이 곧
     * <i>여기가 처음</i> 이라는 뜻이며, 없는 것을 만들어 주면 <b>이전 버튼이 늘 켜져
     * 있고</b> 눌러도 같은 장이 나온다.
     *
     * @param sortValue 행에서 정렬 키 값을 뽑는다 — {@code CRE_DTM} 이다
     * @param pk 행에서 tie-breaker 값을 뽑는다 — {@code ACCESS_LOG_SEQ} 다
     */
    public <T> PageResponse<T> respondCursor(
            List<T> rows, Function<T, Object> sortValue, Function<T, Object> pk) {

        if (mode != PageMode.cursor) {
            throw new IllegalStateException("커서형이 아니다 — " + spec.name());
        }
        int size = page.sizeOrDefault();
        boolean overflowed = rows.size() > size;

        List<T> content = new ArrayList<>(overflowed ? rows.subList(0, size) : rows);
        boolean backward = page.cursor() != null && CursorToken.decode(page.cursor()).backward();
        if (backward) {
            Collections.reverse(content);
        }
        if (content.isEmpty()) {
            // 토큰을 만들 행이 없다. 양쪽 다 null 이며 hasNext 는 false 가 된다.
            return PageResponse.cursor(content, size, null, null);
        }

        boolean hasNext = backward || overflowed;
        boolean hasPrev = backward ? overflowed : page.cursor() != null;

        return PageResponse.cursor(
                content,
                size,
                hasNext ? token(content.getLast(), sortValue, pk, false) : null,
                hasPrev ? token(content.getFirst(), sortValue, pk, true) : null);
    }

    private <T> String token(
            T row, Function<T, Object> sortValue, Function<T, Object> pk, boolean backward) {
        return new CursorToken(
                        cursorSort.field(),
                        cursorSort.dir(),
                        backward,
                        String.valueOf(sortValue.apply(row)),
                        String.valueOf(pk.apply(row)))
                .encode();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void source(JPAQuery<?> query) {
        query.from((EntityPath) spec.root());
        for (JoinSpec join : spec.joins()) {
            if (join.left()) {
                query.leftJoin((EntityPath) join.target()).on(join.on());
            } else {
                query.join((EntityPath) join.target()).on(join.on());
            }
        }
    }
}
