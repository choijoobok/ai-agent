package com.aiagent.core.search;

import com.querydsl.core.types.Expression;
import com.querydsl.core.types.OrderSpecifier;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.ComparableExpression;
import com.querydsl.core.types.dsl.ComparableExpressionBase;
import com.querydsl.core.types.dsl.NumberExpression;
import com.querydsl.core.types.dsl.SimpleExpression;
import com.querydsl.core.types.dsl.StringExpression;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;

/**
 * 화이트리스트의 한 줄 — backend/api.md.
 *
 * <p>둘 중 하나다. <b>컬럼 필드</b>는 {@code Path} 를 갖고 연산자를 여기서 편다.
 * <b>파생 필드</b>는 컬럼이 아니며 <b>번역 함수를 함께 갖는다</b>(backend/api.md) — 화면 값 하나가
 * 조각 하나가 되고, 그 관계가 깨지면 {@code params} 로 간다(backend/api.md).
 *
 * <p><b>타입을 따로 적지 않는다.</b> {@code Path} 가 자기 자바 타입을 알고 그것이 곧
 * {@link Op#accepts(Class)} 의 판정이다 — 컬럼을 개명하면 문자열이 아니라 Q타입 참조라
 * 컴파일이 깨진다.
 */
public final class FieldSpec {

    private final String name;
    private final Expression<?> path;
    private final BiFunction<Op, Object, BooleanExpression> derived;
    private boolean sortable;
    private boolean nullable;
    private boolean ordered;

    FieldSpec(String name, Expression<?> path, BiFunction<Op, Object, BooleanExpression> derived) {
        this.name = name;
        this.path = path;
        this.derived = derived;
    }

    void markSortable() {
        this.sortable = true;
    }

    void markNullable() {
        this.nullable = true;
    }

    void markOrdered() {
        this.ordered = true;
    }

    public String name() {
        return name;
    }

    /** {@code sorts} 에 올 수 있는가 — <b>기본은 불가</b>(backend/api.md). */
    public boolean sortable() {
        return sortable;
    }

    /** {@code in} 배열에 {@code null} 을 담을 수 있는가. {@code ne} 가 펴지는 근거이기도 하다. */
    public boolean nullable() {
        return nullable;
    }

    public boolean isDerived() {
        return derived != null;
    }

    /**
     * <b>문자열 순서가 곧 값의 순서인가</b> — {@code VARCHAR(6)} 의 {@code 202608} 이 그것이다
     * (playbook/INDEX.md).
     *
     * <p>{@link Op#accepts(Class)} 는 문자열에 부등호를 주지 않는다. 자바 타입만 보면
     * {@code ORD_NM} 과 {@code DLVR_YM} 이 같은 {@code String} 이고, 앞의 것에 범위를 열면
     * <i>가로 이상 나중</i> 같은 조건이 성립해 <b>말이 되지 않는 결과가 조용히 나온다</b>.
     *
     * <p>그래서 <b>타입이 아니라 선언이 근거</b>다. 이 표시를 붙인 컬럼은 스펙이
     * <i>"이 문자열의 사전순이 이 값의 시간순이다"</i> 라고 말한 것이며, 그 말은 컬럼을 아는
     * 자리에서만 할 수 있다.
     */
    public boolean ordered() {
        return ordered;
    }

    /**
     * 이 필드가 그 연산자를 받는가.
     *
     * <p>타입이 여는 문({@link Op#accepts(Class)})과 <b>선언이 여는 문</b>({@link #ordered()})
     * 둘이며, 둘 중 하나면 통과다.
     */
    public boolean accepts(Op op) {
        return op.accepts(javaType()) || (ordered && op.comparesOrder());
    }

    /** 커서 조립이 쓴다 — 같은 패키지의 {@link CursorSupport} 하나뿐이다(backend/api.md). */
    Expression<?> path() {
        return path;
    }

    /**
     * 이 필드가 받는 자바 타입.
     *
     * <p><b>파생은 {@code String} 이다</b> — 화면이 보내는 것이 묶음 이름 하나이고, 그것을 무엇으로
     * 펼지는 번역 함수만 안다. 부등호를 받지 않는 것이 옳다(backend/api.md 의 사례 넷이 전부 열거값이다).
     */
    public Class<?> javaType() {
        return derived != null ? String.class : path.getType();
    }

    public OrderSpecifier<?> order(SortDir dir) {
        ComparableExpressionBase<?> comparable = (ComparableExpressionBase<?>) path;
        return dir == SortDir.desc ? comparable.desc() : comparable.asc();
    }

    /**
     * 조건 하나를 표현식으로 편다.
     *
     * <p><b>{@code LIKE} 는 값을 이스케이프하고 {@code ESCAPE} 절을 붙인다</b>(backend/api.md) —
     * 4벤더 전부 지원하며, 화면이 와일드카드를 아는 일이 없다.
     */
    @SuppressWarnings({"unchecked", "rawtypes"})
    public BooleanExpression toPredicate(Op op, Object rawValue) {
        if (derived != null) {
            try {
                return derived.apply(op, rawValue);
            } catch (IllegalArgumentException e) {
                // 번역기가 거절한 것은 요청의 문제다 — 감싸지 않으면 500 이 된다.
                throw SearchErrors.derivedRejected(name, e);
            }
        }
        SimpleExpression simple = (SimpleExpression) path;
        Class<?> type = path.getType();

        return switch (op) {
            case isNull -> simple.isNull();
            case isNotNull -> simple.isNotNull();
            case eq -> simple.eq(ValueCoercion.one(rawValue, type, name));
            case ne -> {
                BooleanExpression base = simple.ne(ValueCoercion.one(rawValue, type, name));
                // 사용자가 "HQ 가 아닌 것" 이라 말할 때 부서 없는 행을 빼겠다는 뜻이 아니다 — backend/api.md.
                yield nullable ? base.or(simple.isNull()) : base;
            }
            case in -> inPredicate(simple, rawValue, type);
            case startsWith, contains, endsWith -> like(LikePattern.of(op, rawValue));
            case between -> betweenPredicate(rawValue, type);
            case gt, gte, lt, lte -> orderPredicate(op, rawValue, type);
        };
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private BooleanExpression inPredicate(SimpleExpression simple, Object rawValue, Class<?> type) {
        List<Object> values = new ArrayList<>();
        boolean hasNull = false;
        for (Object item : ValueCoercion.list(rawValue, name)) {
            if (item == null) {
                hasNull = true;
            } else {
                values.add(ValueCoercion.one(item, type, name));
            }
        }
        if (hasNull && !nullable) {
            throw SearchErrors.nullNotAllowed(name);
        }
        if (values.isEmpty()) {
            // in: [null] — 목록이 비어도 "없음만" 이라는 뜻이 성립한다.
            if (hasNull) {
                return simple.isNull();
            }
            throw SearchErrors.emptyIn(name);
        }
        // 목록이 길면 IN 을 쪼개 OR 로 잇는다 — 오라클은 1000개가 한계다(InChunks).
        // 조건절 안이라 반복 질의로 나눌 수 없다: 한 WHERE 에 남아야 페이징이 성립한다.
        BooleanExpression base = null;
        for (List<Object> chunk : InChunks.split(values)) {
            BooleanExpression piece = simple.in(chunk);
            base = base == null ? piece : base.or(piece);
        }
        return hasNull ? base.or(simple.isNull()) : base;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private BooleanExpression betweenPredicate(Object rawValue, Class<?> type) {
        List<?> pair = ValueCoercion.list(rawValue, name);
        if (pair.size() != 2) {
            throw SearchErrors.betweenArity(name);
        }
        Comparable lo = pair.get(0) == null ? null : comparableValue(pair.get(0), type);
        Comparable hi = pair.get(1) == null ? null : comparableValue(pair.get(1), type);
        if (lo == null && hi == null) {
            throw SearchErrors.betweenArity(name);
        }
        /*
          한쪽이 null 이면 단측이다 — backend/api.md. 숫자 가지를 타는 것은 위 orderPredicate 과
          같은 이유이며, 여기서 comparable() 만 쓰면 숫자 컬럼의 between 이 500 이 된다.
        */
        if (lo == null) {
            return orderPredicate(Op.lte, hi, type);
        }
        if (hi == null) {
            return orderPredicate(Op.gte, lo, type);
        }
        if (path instanceof NumberExpression number) {
            return number.between((Number) lo, (Number) hi);
        }
        return comparable().between(lo, hi);
    }

    /**
     * 부등호 넷 — <b>숫자와 그 밖이 다른 가지를 탄다</b>.
     *
     * <p>Querydsl 의 {@code NumberPath} 는 {@code ComparableExpression} <b>이 아니다</b>.
     * 둘 다 {@code ComparableExpressionBase} 를 상속하지만 비교 연산자는 각자 갖고 있어,
     * 숫자 컬럼을 {@code ComparableExpression} 으로 캐스팅하면 <b>{@code ClassCastException}
     * 이 되어 500</b> 이 난다.
     *
     * <p><b>실기동에서 잡혔다</b>(2026-09-02). 단위 테스트는 전부 통과했는데 — 스펙을 만들 때
     * {@code .col(...)} 은 {@code Expression<?>} 만 받으므로 <b>컴파일이 막지 않고</b>, 그
     * 자리는 조건이 실제로 요청에 실려 와야 지나간다. screen/batch/schedule/requirements.md 이 연 배치 이력의 <i>소요 시간
     * 이상</i> 도 같은 길이었다.
     */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private BooleanExpression orderPredicate(Op op, Object rawValue, Class<?> type) {
        if (path instanceof NumberExpression number) {
            Number value = (Number) ValueCoercion.one(rawValue, type, name);
            return switch (op) {
                case gt -> number.gt(value);
                case gte -> number.goe(value);
                case lt -> number.lt(value);
                default -> number.loe(value);
            };
        }
        ComparableExpression comparable = comparable();
        Comparable value = comparableValue(rawValue, type);
        return switch (op) {
            case gt -> comparable.gt(value);
            case gte -> comparable.goe(value);
            case lt -> comparable.lt(value);
            default -> comparable.loe(value);
        };
    }

    @SuppressWarnings("rawtypes")
    private ComparableExpression comparable() {
        return (ComparableExpression) path;
    }

    @SuppressWarnings("rawtypes")
    private static Comparable comparableValue(Object raw, Class<?> type) {
        Object value = ValueCoercion.one(raw, type, "");
        return (Comparable) value;
    }

    /**
     * <b>대소문자를 가리지 않는다</b> — backend/api.md.
     *
     * <p>이전에는 벤더 콜레이션에 맡겼다(<i>"프로토콜이 정할 일이 아니다"</i>). 그러면
     * <b>같은 조건이 MySQL 에서는 걸리고 PostgreSQL 에서는 안 걸린다</b> — backend/persistence.md 이 내건
     * <i>무수정 기동</i> 은 기동이 되는 것이 아니라 <b>같은 답이 나오는 것</b>이다.
     *
     * <p><b>{@code eq}·{@code ne}·{@code in} 은 그대로 가린다.</b> 그 셋은 코드값·ID 를
     * 맞추는 자리이며, 거기서 대소문자를 무시하면 <i>서로 다른 두 키</i> 가 같아진다.
     * 여기 셋만 <b>사람이 기억나는 대로 치는</b> 검색이다.
     *
     * <p>대가가 있다 — {@code LOWER(col)} 이라 <b>{@code startsWith} 가 인덱스를 못 탄다.</b>
     * 필요해지는 테이블에는 함수 기반 인덱스를 만든다(벤더마다 문법이 다르므로 backend/persistence.md 의
     * 대상이다). 그것 없이도 조회는 페이징으로 잘리며, <b>틀린 결과보다 느린 결과가 낫다.</b>
     */
    private BooleanExpression like(String pattern) {
        return ((StringExpression) path).likeIgnoreCase(pattern, LikePattern.ESCAPE);
    }
}
