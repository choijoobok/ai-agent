package com.ordinary.backoffice.domain.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.search.Condition;
import com.ordinary.backoffice.core.search.InChunks;
import com.ordinary.backoffice.core.search.Op;
import com.ordinary.backoffice.core.search.PageMode;
import com.ordinary.backoffice.core.search.PageSpec;
import com.ordinary.backoffice.core.search.QuerySpec;
import com.ordinary.backoffice.core.search.SearchErrorCode;
import com.ordinary.backoffice.core.search.SearchRequest;
import com.ordinary.backoffice.core.search.SortDir;
import com.ordinary.backoffice.core.search.SortSpec;
import com.ordinary.backoffice.domain.message.admin.MessageSpec;
import com.ordinary.backoffice.domain.message.entity.QSysMessageKey;
import com.querydsl.jpa.impl.JPAQuery;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 화이트리스트가 실제로 막는가 — api-conventions.md §3·§4.
 *
 * <p><b>DB 가 없어도 도는 검사다.</b> {@code JPAQuery} 는 {@code EntityManager} 없이도 JPQL 을
 * 조립할 수 있으므로, 조건이 <b>어떤 SQL 이 되는가</b>를 문자열로 확인할 수 있다 — 그래야
 * PR 마다 도는 값싼 게이트가 된다(db-portability.md §2 의 Testcontainers 는 그 위층이다).
 */
class QueryDslBuilderTest {

    private static final QSysMessageKey K = QSysMessageKey.sysMessageKey;

    private final QueryDslBuilder builder = new QueryDslBuilder();

    private static SearchRequest<Void> request(List<Condition> conditions, List<SortSpec> sorts) {
        return new SearchRequest<>(conditions, sorts, new PageSpec(0, 20, null), null);
    }

    private static Condition where(String field, Op op, Object value) {
        return new Condition(field, op, value);
    }

    private Built build(List<Condition> conditions) {
        return builder.build(request(conditions, List.of()), MessageSpec.SPEC, PageMode.offset);
    }

    @Nested
    @DisplayName("거부")
    class Rejects {

        @Test
        @DisplayName("화이트리스트에 없는 필드는 400 이다 — 조용히 무시하지 않는다")
        void unknownField() {
            assertThatThrownBy(() -> build(List.of(where("secret", Op.eq, "x"))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(SearchErrorCode.UNKNOWN_FIELD);
        }

        @Test
        @DisplayName("연산자가 타입을 받지 않으면 400 이다 — 문자열 필드의 부등호")
        void opTypeMismatch() {
            assertThatThrownBy(() -> build(List.of(where("msgKey", Op.gt, "a"))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(SearchErrorCode.OP_TYPE_MISMATCH);
        }

        @Test
        @DisplayName("같은 필드가 두 번 오면 400 이다 — 범위는 between, 다중은 in 이 받는다")
        void duplicateField() {
            assertThatThrownBy(() -> build(List.of(
                            where("msgKey", Op.contains, "a"), where("msgKey", Op.contains, "b"))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(SearchErrorCode.INVALID_VALUE);
        }

        @Test
        @DisplayName("값을 받지 않는 연산자에 값이 오면 400 이다 — 무시하면 조용히 안 걸린다")
        void isNullWithValue() {
            assertThatThrownBy(() -> build(List.of(where("msgDesc", Op.isNull, "x"))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(SearchErrorCode.INVALID_VALUE);
        }

        @Test
        @DisplayName("정렬은 명시해야 열린다 — .sortable() 없는 필드는 400")
        void notSortable() {
            SearchRequest<Void> request =
                    request(List.of(), List.of(new SortSpec("msgDesc", SortDir.asc)));

            assertThatThrownBy(
                            () -> builder.build(request, MessageSpec.SPEC, PageMode.offset))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(SearchErrorCode.NOT_SORTABLE);
        }

        @Test
        @DisplayName("파생 필드는 정렬 대상이 될 수 없다 — 선언 시점에 막는다")
        void derivedCannotBeSortable() {
            assertThatThrownBy(() -> QuerySpec.of("x")
                            .from(K)
                            .derived("d", (op, value) -> K.msgKey.isNotNull())
                            .sortable())
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("tie-breaker 없이 스펙을 만들 수 없다 — 페이징이 흔들린다")
        void pkIsRequired() {
            assertThatThrownBy(() -> QuerySpec.of("x").from(K).col("a", K.msgKey).build())
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("조립")
    class Builds {

        /** {@code EntityManager} 없이 JPQL 만 만든다 — 조건이 무엇이 되는지 문자열로 본다. */
        private String jpql(Built built) {
            return built.apply(new JPAQuery<String>().select(K.msgKey)).toString();
        }

        /**
         * <b>이 실패는 오라클로 배포한 뒤에야 나타난다.</b> 오라클은 {@code IN} 의 표현식을
         * 1000개까지만 받고({@code ORA-01795}) 나머지 벤더는 훨씬 관대하다 — 개발 중에는
         * 아무 일도 없다가 배포지에서만 죽는다.
         *
         * <p><b>조건절이라 반복 질의로 나눌 수 없다</b> — 한 {@code WHERE} 에 남아야 페이징이
         * 성립한다. 그래서 {@code IN} 을 쪼개 {@code OR} 로 잇는다: 뜻은 그대로다.
         *
         * <p><b>JPQL 에는 목록이 보이지 않는다</b> — 자리표 하나({@code ?1})로 찍힌다. 목록이
         * 펼쳐지는 것은 드라이버로 나갈 때이고 한계도 거기서 걸리므로, 여기서 셀 수 있는 것은
         * <b>조각이 몇 개인가</b>(= {@code or} 로 이어졌는가)뿐이다.
         */
        @Test
        @DisplayName("긴 IN 은 쪼개져 OR 로 이어진다 — 오라클의 1000개 한계를 넘지 않게")
        void splitsLongInList() {
            List<String> many =
                    java.util.stream.IntStream.range(0, InChunks.LIMIT + 1)
                            .mapToObj(index -> "key" + index)
                            .toList();

            String rendered = jpql(build(List.of(where("msgKey", Op.in, many))));

            // 조각 둘이 OR 로 이어진다 — 하나였으면 ' or ' 가 없다.
            // 뒤 조각은 원소가 하나라 판이 `= ?2` 로 줄여 쓴다: 뜻은 같다.
            assertThat(rendered).contains(" or ");
        }

        @Test
        @DisplayName("짧은 IN 은 그대로 하나다 — 짧은 목록에 OR 를 만들지 않는다")
        void keepsShortInWhole() {
            String rendered = jpql(build(List.of(where("msgKey", Op.in, List.of("a", "b")))));

            assertThat(rendered).doesNotContain(" or ");
        }

        @Test
        @DisplayName("LIKE 는 값을 이스케이프하고 ESCAPE 절을 붙인다 — 화면이 와일드카드를 못 만든다")
        void likeEscapesWildcards() {
            String rendered = MessageSpec.SPEC
                    .field("msgKey")
                    .toPredicate(Op.contains, "50%_A")
                    .toString();

            // % 와 _ 가 리터럴이 된다. 이스케이프하지 않으면 "50%" 하나로 전건이 걸린다.
            assertThat(rendered).contains("50\\%\\_a").contains("escape");
        }

        @Test
        @DisplayName("LIKE 는 대소문자를 가리지 않는다 — 벤더 콜레이션에 답을 맡기지 않는다")
        void likeIgnoresCase() {
            String rendered = MessageSpec.SPEC
                    .field("msgKey")
                    .toPredicate(Op.startsWith, "Shell.")
                    .toString();

            // 콜레이션에 맡기면 같은 조건이 MySQL 에서는 걸리고 PostgreSQL 에서는 안 걸린다
            // — db-portability.md §1 의 *무수정 기동* 은 기동이 아니라 **같은 답**이다(api-conventions.md §3.3).
            assertThat(rendered).contains("lower").contains("shell.");
        }

        @Test
        @DisplayName("eq 는 여전히 가린다 — 코드값을 맞추는 자리에서 무시하면 서로 다른 키가 같아진다")
        void equalityStaysCaseSensitive() {
            String rendered = MessageSpec.SPEC
                    .field("msgKey")
                    .toPredicate(Op.eq, "Shell.")
                    .toString();

            assertThat(rendered).doesNotContain("lower").contains("Shell.");
        }

        @Test
        @DisplayName("tie-breaker 를 언제나 붙인다 — 요청 정렬 뒤에 PK 가 온다")
        void alwaysAppendsTieBreaker() {
            Built built = builder.build(
                    request(List.of(), List.of(new SortSpec("useScope", SortDir.desc))),
                    MessageSpec.SPEC,
                    PageMode.offset);

            assertThat(jpql(built)).contains("order by").contains("useScope desc").contains("msgKey asc");
        }

        @Test
        @DisplayName("정렬을 안 보내면 스펙의 기본 정렬이 돈다")
        void fallsBackToDefaultSort() {
            assertThat(jpql(build(List.of()))).contains("order by").contains("msgKey asc");
        }

        @Test
        @DisplayName("mode: all 은 요청의 정렬을 읽지 않는다 — 정렬은 클라이언트의 일이다")
        void allModeIgnoresSorts() {
            Built built = builder.build(
                    request(List.of(), List.of(new SortSpec("useScope", SortDir.desc))),
                    MessageSpec.SPEC,
                    PageMode.all);

            assertThat(jpql(built)).doesNotContain("useScope desc");
        }

        @Test
        @DisplayName("파생 조건은 서브쿼리가 된다 — 화면은 이름 하나만 보낸다")
        void derivedBecomesSubquery() {
            String rendered = jpql(build(List.of(where("untranslated", Op.eq, "en"))));
            assertThat(rendered).contains("not exists").contains("langCd");
        }
    }
}
