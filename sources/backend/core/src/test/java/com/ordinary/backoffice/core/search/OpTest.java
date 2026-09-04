package com.ordinary.backoffice.core.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 연산자가 타입을 제한한다 — api-conventions.md §3.4.
 *
 * <p><b>이 판정이 화이트리스트의 절반이다.</b> {@code .col(…)} 이 <i>"이 필드가 존재하는가"</i>
 * 만 보고, 나머지는 여기서 나온다 — 필드마다 허용 연산자를 적으면 그것이 곧 미러링이다.
 */
class OpTest {

    @Test
    @DisplayName("eq · ne · in 은 전 타입을 받는다")
    void equalityAcceptsEverything() {
        for (Op op : new Op[] {Op.eq, Op.ne, Op.in}) {
            assertThat(op.accepts(String.class)).isTrue();
            assertThat(op.accepts(Integer.class)).isTrue();
            assertThat(op.accepts(Boolean.class)).isTrue();
            assertThat(op.accepts(OffsetDateTime.class)).isTrue();
        }
    }

    @Test
    @DisplayName("LIKE 셋은 문자열만 받는다 — 숫자 필드의 contains 는 400 이다")
    void likeIsStringOnly() {
        for (Op op : new Op[] {Op.startsWith, Op.contains, Op.endsWith}) {
            assertThat(op.accepts(String.class)).isTrue();
            assertThat(op.accepts(Integer.class)).isFalse();
            assertThat(op.accepts(OffsetDateTime.class)).isFalse();
        }
    }

    @Test
    @DisplayName("부등호와 between 은 숫자·날짜 계열만 받는다")
    void comparisonIsOrderedOnly() {
        for (Op op : new Op[] {Op.between, Op.gt, Op.gte, Op.lt, Op.lte}) {
            assertThat(op.accepts(Integer.class)).isTrue();
            assertThat(op.accepts(BigDecimal.class)).isTrue();
            assertThat(op.accepts(OffsetDateTime.class)).isTrue();
            assertThat(op.accepts(LocalDate.class)).isTrue();

            // 문자열은 받지 않는다. dateString 계열이 여기 걸리는데, 자바 타입이 String 이라
            // 구분할 근거가 서버에 없다 — 조용히 문자열 비교가 되는 것보다 400 이 낫다.
            assertThat(op.accepts(String.class)).isFalse();
        }
    }

    @Test
    @DisplayName("값을 받지 않는 연산자는 둘뿐이다 — 있으면 400 이다")
    void onlyTwoTakeNoValue() {
        assertThat(Op.isNull.takesValue()).isFalse();
        assertThat(Op.isNotNull.takesValue()).isFalse();

        for (Op op : Op.values()) {
            if (op != Op.isNull && op != Op.isNotNull) {
                assertThat(op.takesValue()).as("%s", op).isTrue();
            }
        }
    }

    /**
     * api-conventions.md §3.3 이 <b>열둘</b>이라고 적었는데 그 표에는 열셋이 있다.
     *
     * <p>같은 절이 <i>"처음에 <b>아홉</b>으로 닫으며 {@code endsWith}·{@code ne}·{@code isNull}
     * 을 뺐다 … <b>넷</b>을 되돌려"</i> 라고 적었으므로 <b>9 + 4 = 13</b> 이다. 되돌린 넷은
     * {@code endsWith}·{@code ne}·{@code isNull}·{@code isNotNull} 이며, 셋만 세고 넷을
     * 되돌린 것이 어긋난 자리다.
     *
     * <p>숫자를 여기서 못 박는 이유 — 그 수가 <b>MyBatis 공통 조각의 {@code <choose>} 분기
     * 수</b>이기도 하다(34 §5.5). 문서의 수와 코드의 수가 갈리면 그 조각을 짤 때 하나를
     * 빠뜨리고, 빠뜨린 연산자는 <b>조용히 조건이 사라진다.</b>
     */
    @Test
    @DisplayName("열셋에서 닫는다 — 늘리면 빌더와 폼과 저장된 조건이 함께 바뀐다")
    void thirteenOperators() {
        assertThat(Op.values()).hasSize(13);
    }
}
