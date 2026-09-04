package com.aiagent.domain.search;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.Condition;
import com.aiagent.core.search.CursorSupport;
import com.aiagent.core.search.CursorToken;
import com.aiagent.core.search.FieldSpec;
import com.aiagent.core.search.Op;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SearchErrorCode;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.core.search.SortDir;
import com.aiagent.core.search.SortSpec;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.types.OrderSpecifier;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 동적 조회의 검증 + 조립 — 34 §4.5. <b>검증과 조립이 한 호출이다.</b>
 *
 * <p>가르면 서비스가 검증만 부르고 조립을 직접 할 수 있게 되고, 그러면 api-conventions.md §4.2 의
 * <i>"검증 없이 빌더에 들어갈 수 없다"</i> 가 규약으로만 남는다.
 *
 * <p><b>{@code c.field()} 가 쓰이는 곳은 맵 조회의 인자 자리뿐이다.</b> QueryDSL 은 컬럼을
 * {@code Path} 객체로 다루므로 인젝션 표면이 존재하지 않는다 — {@code ${}} 문제가 여기엔 없다.
 */
@Component
public class QueryDslBuilder {

    /**
     * @param mode <b>엔드포인트가 정한다</b>(api-conventions.md §3.8). 요청에도 화면 선언에도 없으며 응답이 나른다
     */
    public Built build(SearchRequest<?> request, QuerySpec spec, PageMode mode) {
        BooleanBuilder where = new BooleanBuilder();
        Set<String> seen = new HashSet<>();

        for (Condition condition : request.conditionsOrEmpty()) {
            FieldSpec field = resolve(spec, condition.field());

            // 같은 필드가 두 번 오지 않는다 — 범위는 between 이, 다중은 in 이 받는다(api-conventions.md §3.1).
            if (!seen.add(condition.field())) {
                throw duplicate(condition.field());
            }
            Op op = condition.op();
            // 타입이 여는 문과 선언이 여는 문 둘이다 — FieldSpec.ordered() 가 뒤엣것이다.
            if (!field.accepts(op)) {
                throw new BusinessException(
                        SearchErrorCode.OP_TYPE_MISMATCH,
                        "연산자 " + op + " 가 필드 " + condition.field() + " 의 타입을 받지 않는다");
            }
            if (!op.takesValue() && condition.value() != null) {
                throw new BusinessException(
                        SearchErrorCode.INVALID_VALUE,
                        "연산자 " + op + " 는 값을 받지 않는다 — " + condition.field());
            }
            where.and(field.toPredicate(op, condition.value()));
        }

        SortSpec cursorSort = mode == PageMode.cursor ? cursorSort(request, spec) : null;
        if (cursorSort != null && request.page().cursor() != null) {
            CursorToken token = CursorToken.decode(request.page().cursor());
            where.and(CursorSupport.predicate(resolve(spec, cursorSort.field()), spec.pk(), token));
        }

        return new Built(
                spec, where.getValue(), order(request, spec, mode), mode, request.page(), cursorSort);
    }

    /**
     * 커서형의 정렬 키 — <b>하나뿐이다</b>(api-conventions.md §3.8 · 64 §2.3).
     *
     * <p>번호 없는 이동은 <b>직전 페이지의 마지막 행을 기준점으로</b> 다음을 읽는다. 기준점이
     * 성립하려면 정렬 키가 고정이어야 하므로 <b>둘 이상은 400</b> 이다 — 조용히 첫 것만 쓰면
     * 두 번째 키가 무시된 채 <i>정렬이 먹은 것처럼</i> 보이고, 그 순간 페이지 경계가 깨진다.
     *
     * <p>요청에 정렬이 없으면 스펙의 기본 정렬이며, 그것도 하나여야 한다.
     */
    private SortSpec cursorSort(SearchRequest<?> request, QuerySpec spec) {
        List<SortSpec> sorts =
                request.sortsOrEmpty().isEmpty() ? spec.defaultSortSpecs() : request.sortsOrEmpty();
        if (sorts.size() != 1) {
            throw new BusinessException(
                    SearchErrorCode.CURSOR_SORT_ARITY,
                    "커서형은 정렬 키가 하나여야 한다 — " + spec.name() + " 에 " + sorts.size() + "개");
        }
        SortSpec sort = sorts.getFirst();
        FieldSpec field = resolve(spec, sort.field());
        if (!field.sortable()) {
            throw new BusinessException(SearchErrorCode.NOT_SORTABLE, "정렬 불가 필드: " + sort.field());
        }
        return sort;
    }

    /**
     * {@code ORDER BY {요청}, {PK}} — tie-breaker 를 <b>언제나</b> 붙인다(api-conventions.md §3.7).
     *
     * <p>db-portability.md §4.5 가 {@code NULL} 정렬 순서의 벤더 차이를 근거로 <i>"항상 명시적
     * tie-breaker"</i> 를 정했다. 화면에 맡기면 빠뜨린 곳에서만 페이징이 흔들린다.
     *
     * <p><b>{@code all} 모드는 요청의 정렬을 읽지 않는다.</b> 페이지가 없으므로 정렬을 서버가
     * 할 이유가 없고, 클라이언트가 즉시 정렬한다(api-conventions.md §3.8) — 화면이 보내지 않는 것이 규약이며
     * 보내와도 무시한다.
     *
     * <p><b>{@code cursor} 모드에서는 PK 도 정렬 키를 따라간다.</b> 기준점이
     * {@code (시각, PK)} 튜플 비교이므로(CursorSupport) PK 만 {@code asc} 로 고정하면
     * <b>{@code WHERE} 와 {@code ORDER BY} 가 어긋나</b> 같은 시각의 행이 페이지를 건너뛴다.
     * 뒤로 갈 때는 <b>둘 다</b> 뒤집힌다.
     */
    private OrderSpecifier<?>[] order(SearchRequest<?> request, QuerySpec spec, PageMode mode) {
        if (mode == PageMode.cursor) {
            return cursorOrder(request, spec);
        }
        List<OrderSpecifier<?>> specifiers = new ArrayList<>();

        if (mode != PageMode.all) {
            for (SortSpec sort : request.sortsOrEmpty()) {
                FieldSpec field = resolve(spec, sort.field());
                if (!field.sortable()) {
                    throw new BusinessException(
                            SearchErrorCode.NOT_SORTABLE, "정렬 불가 필드: " + sort.field());
                }
                specifiers.add(field.order(sort.dir()));
            }
        }
        if (specifiers.isEmpty()) {
            specifiers.addAll(spec.defaultSort());
        }
        specifiers.add(spec.pk().asc());
        return specifiers.toArray(new OrderSpecifier<?>[0]);
    }

    private OrderSpecifier<?>[] cursorOrder(SearchRequest<?> request, QuerySpec spec) {
        SortSpec sort = cursorSort(request, spec);
        SortDir scan = request.page().cursor() == null
                ? sort.dir()
                : CursorToken.decode(request.page().cursor()).scanDir();

        FieldSpec field = resolve(spec, sort.field());
        OrderSpecifier<?> pk = scan == SortDir.desc ? spec.pk().desc() : spec.pk().asc();
        return new OrderSpecifier<?>[] {field.order(scan), pk};
    }

    private static FieldSpec resolve(QuerySpec spec, String name) {
        FieldSpec field = spec.field(name);
        if (field == null) {
            throw new BusinessException(
                    SearchErrorCode.UNKNOWN_FIELD, "화이트리스트에 없는 필드: " + name);
        }
        return field;
    }

    private static BusinessException duplicate(String field) {
        return new BusinessException(SearchErrorCode.INVALID_VALUE, "같은 필드가 두 번 왔다 — " + field);
    }
}
