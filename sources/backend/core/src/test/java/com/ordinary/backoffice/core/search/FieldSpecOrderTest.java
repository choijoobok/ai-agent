package com.ordinary.backoffice.core.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.querydsl.core.types.dsl.Expressions;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * 부등호가 <b>타입마다 다른 가지를 탄다</b> — api-conventions.md §3.3.
 *
 * <p><b>실기동에서만 드러나던 자리다</b>(2026-09-02). Querydsl 의 {@code NumberPath} 는
 * {@code ComparableExpression} 이 아니라 형제이고, 숫자 컬럼을 그쪽으로 캐스팅하면
 * {@code ClassCastException} 이 되어 <b>500</b> 이 난다.
 *
 * <p>그 사고가 조용했던 이유가 둘이다 —
 *
 * <ul>
 *   <li>{@code QuerySpec.col(...)} 이 {@code Expression<?>} 을 받으므로 <b>컴파일이 막지
 *       않는다</b>
 *   <li>그 가지는 <b>조건이 실제로 요청에 실려 와야</b> 지나간다. 스펙에 컬럼을 선언하고
 *       화면에 연산자를 열어 두는 것만으로는 한 번도 돌지 않는다
 * </ul>
 *
 * <p>그래서 이 검사는 <b>연산자 다섯 × 타입 넷</b>을 전부 돌린다 — 하나씩 고르면 고르지 않은
 * 조합이 다시 실기동까지 간다.
 */
class FieldSpecOrderTest {

    private static FieldSpec column(String name, com.querydsl.core.types.Expression<?> path) {
        return new FieldSpec(name, path, null);
    }

    @ParameterizedTest
    @EnumSource(value = Op.class, names = {"gt", "gte", "lt", "lte"})
    @DisplayName("숫자 컬럼이 부등호를 받는다 — NumberPath 는 ComparableExpression 이 아니다")
    void numberTakesOrderOps(Op op) {
        FieldSpec longs = column("procMs", Expressions.numberPath(Long.class, "procMs"));
        FieldSpec decimals = column("ordAmt", Expressions.numberPath(BigDecimal.class, "ordAmt"));
        FieldSpec ints = column("ordQty", Expressions.numberPath(Integer.class, "ordQty"));

        assertThatCode(() -> longs.toPredicate(op, 1000)).doesNotThrowAnyException();
        assertThatCode(() -> decimals.toPredicate(op, 100000)).doesNotThrowAnyException();
        assertThatCode(() -> ints.toPredicate(op, 5)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @EnumSource(value = Op.class, names = {"gt", "gte", "lt", "lte"})
    @DisplayName("날짜 컬럼도 같은 연산자를 받는다 — 이쪽은 ComparableExpression 이다")
    void dateTakesOrderOps(Op op) {
        FieldSpec dates = column("ordDt", Expressions.datePath(LocalDate.class, "ordDt"));

        assertThatCode(() -> dates.toPredicate(op, "2026-09-01")).doesNotThrowAnyException();
    }

    /**
     * {@code ordered()} 를 붙인 문자열 칸 — 68 §3.3 의 납기월({@code VARCHAR(6)}).
     *
     * <p>여기는 원래도 {@code ComparableExpression} 이라 캐스팅이 성립했고, 실기동에서도
     * 이 조건만 통과했다. <b>그 통과가 숫자 쪽을 가렸다</b> — 문자열 범위가 되니 범위 자체는
     * 되는 줄 알았다.
     */
    @Test
    @DisplayName("ordered 를 붙인 문자열 칸이 범위를 받는다")
    void orderedStringTakesRange() {
        FieldSpec ym = column("dlvrYm", Expressions.stringPath("dlvrYm"));
        ym.markOrdered();

        assertThat(ym.ordered()).isTrue();
        assertThat(ym.accepts(Op.between)).isTrue();
        assertThatCode(() -> ym.toPredicate(Op.between, java.util.List.of("202601", "202612")))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("between 도 숫자 가지를 탄다 — 단측이든 양측이든")
    void numberTakesBetween() {
        FieldSpec amounts = column("ordAmt", Expressions.numberPath(BigDecimal.class, "ordAmt"));

        assertThatCode(() -> amounts.toPredicate(Op.between, java.util.Arrays.asList(1, 10)))
                .doesNotThrowAnyException();
        // 한쪽만 아는 조건 — api-conventions.md §3.3 의 단측이다.
        assertThatCode(() -> amounts.toPredicate(Op.between, java.util.Arrays.asList(null, 10)))
                .doesNotThrowAnyException();
        assertThatCode(() -> amounts.toPredicate(Op.between, java.util.Arrays.asList(1, null)))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("문자열 칸은 ordered 없이 부등호를 받지 않는다 — 선언이 근거다")
    void plainStringRejectsOrderOps() {
        FieldSpec names = column("ordNm", Expressions.stringPath("ordNm"));

        assertThat(names.accepts(Op.between)).isFalse();
        assertThat(names.accepts(Op.gt)).isFalse();
        assertThat(names.accepts(Op.contains)).isTrue();
    }
}
