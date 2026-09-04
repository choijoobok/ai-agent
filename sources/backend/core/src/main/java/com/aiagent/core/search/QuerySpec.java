package com.aiagent.core.search;

import com.querydsl.core.types.EntityPath;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.OrderSpecifier;
import com.querydsl.core.types.Predicate;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.ComparableExpressionBase;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;

/**
 * <b>이 객체가 곧 화이트리스트다</b> — backend/api.md.
 *
 * <pre>
 * public static final QuerySpec SPEC = QuerySpec.of("message")
 *     .from(K)
 *     .col("msgKey",   K.msgKey).sortable()
 *     .col("useScope", K.useScope)
 *     .derived("untranslated", MessageSpec::untranslated)
 *     .defaultSort("msgKey", SortDir.asc)
 *     .pk(K.msgKey)
 *     .build();
 * </pre>
 *
 * <p><b>레코드 리플렉션이 아닌 이유가 둘이다</b>(backend/api.md). ① 그 레코드는 바인딩되지 않는다 —
 * {@code between} 이면 값이 2원소 배열이고 {@code in} 이면 리스트라 스칼라 필드에 담기지
 * 않는다. ② 리플렉션은 이름만 주고 <b>어느 컬럼·별칭인지</b> 를 주지 않아 SQL 을 만들 수 없다.
 *
 * <p><b>컨트롤러에 목록을 손으로 적지 않는다.</b> 스펙과 목록이 둘이 되면 필드를 늘리고
 * 목록에 안 적었을 때 조용히 400 이고, 컬럼을 바꾸고 목록만 고치면 조용히 엉뚱한 컬럼이다.
 */
public final class QuerySpec {

    private final String name;
    private final EntityPath<?> root;
    private final List<JoinSpec> joins;
    private final Map<String, FieldSpec> fields;
    private final List<OrderSpecifier<?>> defaultSort;
    private final List<SortSpec> defaultSortSpecs;
    private final ComparableExpressionBase<?> pk;

    private QuerySpec(Builder builder) {
        this.name = builder.name;
        this.root = builder.root;
        this.joins = List.copyOf(builder.joins);
        this.fields = Map.copyOf(builder.fields);
        this.defaultSort = List.copyOf(builder.defaultSort);
        this.defaultSortSpecs = List.copyOf(builder.defaultSortSpecs);
        this.pk = builder.pk;
    }

    public static Builder of(String name) {
        return new Builder(name);
    }

    public String name() {
        return name;
    }

    public EntityPath<?> root() {
        return root;
    }

    public List<JoinSpec> joins() {
        return joins;
    }

    /** {@code null} 이면 화이트리스트 밖이다 — 400. */
    public FieldSpec field(String name) {
        return fields.get(name);
    }

    public List<OrderSpecifier<?>> defaultSort() {
        return defaultSort;
    }

    /**
     * 같은 기본 정렬을 <b>이름과 방향으로</b> — 커서형이 읽는다(backend/api.md).
     *
     * <p>{@link OrderSpecifier} 만 두면 커서를 만들 수 없다. 토큰에 담을 것이 <i>어느 필드를
     * 어느 방향으로</i> 인데 그 객체는 이미 표현식이라 <b>필드 이름을 되돌려주지 않는다</b>.
     */
    public List<SortSpec> defaultSortSpecs() {
        return defaultSortSpecs;
    }

    /**
     * tie-breaker — 빌더가 {@code ORDER BY {요청}, {PK}} 로 <b>언제나</b> 붙인다(backend/api.md).
     *
     * <p>backend/persistence.md 가 {@code NULL} 정렬 순서의 벤더 차이를 근거로 <i>"항상 명시적
     * tie-breaker"</i> 를 정했다. 화면에 맡기면 빠뜨린 곳에서만 페이징이 흔들린다.
     */
    public ComparableExpressionBase<?> pk() {
        return pk;
    }

    // ── 빌더 ─────────────────────────────────────────────────────────

    /**
     * {@code .col(…)} 뒤에 {@code .sortable()} 이 붙는 모양이라 <b>마지막에 더한 필드</b>를
     * 기억한다. 필드마다 별도 객체를 노출하면 선언이 두 줄로 갈리고, 그러면 스펙이 읽히지 않는다.
     */
    public static final class Builder {

        private final String name;
        private final Map<String, FieldSpec> fields = new LinkedHashMap<>();
        private final List<JoinSpec> joins = new ArrayList<>();
        private final List<OrderSpecifier<?>> defaultSort = new ArrayList<>();
        private final List<SortSpec> defaultSortSpecs = new ArrayList<>();
        private EntityPath<?> root;
        private ComparableExpressionBase<?> pk;
        private FieldSpec last;
        private EntityPath<?> pendingJoin;
        private boolean pendingLeft;

        private Builder(String name) {
            this.name = name;
        }

        public Builder from(EntityPath<?> root) {
            this.root = root;
            return this;
        }

        public Builder leftJoin(EntityPath<?> target) {
            flushJoin();
            this.pendingJoin = target;
            this.pendingLeft = true;
            return this;
        }

        public Builder join(EntityPath<?> target) {
            flushJoin();
            this.pendingJoin = target;
            this.pendingLeft = false;
            return this;
        }

        public Builder on(Predicate condition) {
            if (pendingJoin == null) {
                throw new IllegalStateException("on() 앞에 join() 이 없다 — " + name);
            }
            joins.add(new JoinSpec(pendingJoin, condition, pendingLeft));
            pendingJoin = null;
            return this;
        }

        /** 컬럼 필드. 이름이 겹치면 선언 실수이므로 기동 시 터진다. */
        public Builder col(String field, Expression<?> path) {
            return add(new FieldSpec(field, path, null));
        }

        /**
         * 파생 필드 — 컬럼이 아니다(backend/api.md).
         *
         * <p><b>정렬 대상이 될 수 없다</b> — {@code .sortable()} 을 붙여도 {@link FieldSpec#order}
         * 가 쓸 {@code Path} 가 없다. 그래서 {@link #sortable()} 이 여기서 거부한다.
         */
        public Builder derived(String field, BiFunction<Op, Object, BooleanExpression> translate) {
            return add(new FieldSpec(field, null, translate));
        }

        public Builder sortable() {
            requireLast("sortable");
            if (last.isDerived()) {
                throw new IllegalStateException(
                        "파생 필드는 정렬 대상이 아니다 — " + name + "." + last.name());
            }
            last.markSortable();
            return this;
        }

        public Builder nullable() {
            requireLast("nullable");
            last.markNullable();
            return this;
        }

        /**
         * <b>이 문자열의 사전순이 값의 순서다</b> — {@code DLVR_YM} 의 {@code 202608}(playbook/INDEX.md).
         *
         * <p>{@link FieldSpec#ordered()} 가 왜 타입이 아니라 선언인지를 적어 두었다. 여기서는
         * <b>거짓말을 막는 것</b>만 한다 — 문자열이 아닌 컬럼은 이미 타입이 부등호를 주므로 이
         * 표시가 필요 없고, 붙어 있으면 <i>무엇을 열었는지</i> 를 읽는 사람이 잘못 짚는다.
         *
         * <p>파생 필드도 거절한다. 파생은 값 하나를 조각으로 펴는 것이라(backend/api.md) 순서를 말할
         * 대상이 애초에 없다.
         */
        public Builder ordered() {
            requireLast("ordered");
            if (last.isDerived()) {
                throw new IllegalStateException(
                        "파생 필드는 순서를 말할 대상이 없다 — " + name + "." + last.name());
            }
            if (!CharSequence.class.isAssignableFrom(last.javaType())) {
                throw new IllegalStateException(
                        "ordered 는 문자열 컬럼에만 붙인다 — " + name + "." + last.name()
                                + " 는 " + last.javaType().getSimpleName() + " 다");
            }
            last.markOrdered();
            return this;
        }

        /** 헤더 정렬이 <i>없음</i> 으로 돌아왔을 때의 순서(frontend/grid.md). */
        public Builder defaultSort(String field, SortDir dir) {
            FieldSpec spec = fields.get(field);
            if (spec == null) {
                throw new IllegalStateException("defaultSort 가 없는 필드를 가리킨다 — " + field);
            }
            defaultSort.add(spec.order(dir));
            defaultSortSpecs.add(new SortSpec(field, dir));
            return this;
        }

        public Builder pk(ComparableExpressionBase<?> path) {
            this.pk = path;
            return this;
        }

        public QuerySpec build() {
            flushJoin();
            if (root == null) {
                throw new IllegalStateException("from() 이 없다 — " + name);
            }
            if (pk == null) {
                throw new IllegalStateException("pk() 가 없다 — tie-breaker 없이 페이징할 수 없다: " + name);
            }
            return new QuerySpec(this);
        }

        private Builder add(FieldSpec spec) {
            if (fields.putIfAbsent(spec.name(), spec) != null) {
                throw new IllegalStateException("필드 이름이 겹친다 — " + name + "." + spec.name());
            }
            last = spec;
            return this;
        }

        private void requireLast(String what) {
            if (last == null) {
                throw new IllegalStateException(what + "() 앞에 col()·derived() 가 없다 — " + name);
            }
        }

        private void flushJoin() {
            if (pendingJoin != null) {
                throw new IllegalStateException("join() 뒤에 on() 이 없다 — " + name);
            }
        }
    }
}
