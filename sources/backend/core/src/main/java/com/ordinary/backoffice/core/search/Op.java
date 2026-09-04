package com.ordinary.backoffice.core.search;

import java.time.temporal.Temporal;
import java.util.Date;

/**
 * 조회 연산자 <b>열둘</b> — api-conventions.md §3.3.
 *
 * <p><b>연산자가 타입을 제한한다</b>(api-conventions.md §3.4). 반대로 하면 필드마다 허용 연산자를 적어야
 * 하고 그것이 곧 미러링이다 — 화이트리스트는 <i>"이 필드가 존재하는가"</i> 만 보고, 나머지는
 * {@link #accepts(Class)} 가 필드의 자바 타입에서 도출한다.
 *
 * <p><b>{@code LIKE} 를 한 연산자로 두지 않았다.</b> 셋으로 갈라야 화면이 <i>"이것은 인덱스를
 * 타고 저것은 못 탄다"</i> 를 알 수 있고, 값에 {@code %} 를 담지 않으므로 <b>이스케이프가
 * 서버의 일</b>로 남는다.
 */
public enum Op {

    /** {@code = ?} */
    eq,
    /** {@code <> ?} — nullable 필드면 {@code OR col IS NULL} 을 함께 편다(api-conventions.md §3.3). */
    ne,
    /** {@code IN (…)} — 배열에 {@code null} 을 담을 수 있다(api-conventions.md §3.6). */
    in,

    /** {@code LIKE ? || '%'} — 문자열만. 인덱스를 탄다. */
    startsWith,
    /** {@code LIKE '%' || ? || '%'} — 문자열만. */
    contains,
    /** {@code LIKE '%' || ?} — 문자열만. 비용은 {@link #contains} 와 같다. */
    endsWith,

    /** {@code >= ? AND <= ?} — 2원소 배열. 한쪽이 {@code null} 이면 단측이다. */
    between,
    /** {@code > ?} */
    gt,
    /** {@code >= ?} */
    gte,
    /** {@code < ?} */
    lt,
    /** {@code <= ?} */
    lte,

    /** {@code IS NULL} — <b>값을 받지 않는다.</b> */
    isNull,
    /** {@code IS NOT NULL} — 〃 */
    isNotNull;

    /**
     * 값을 받는 연산자인가 — api-conventions.md §3.3.
     *
     * <p>받지 않는 둘에 값이 오면 400 이다. 무시하면 <i>"값을 넣었는데 안 걸린다"</i> 가 된다.
     */
    public boolean takesValue() {
        return this != isNull && this != isNotNull;
    }

    /** 값이 배열이어야 하는 연산자인가. */
    public boolean takesList() {
        return this == in || this == between;
    }

    /** 값의 <b>순서</b>를 보는 연산자인가 — {@code FieldSpec.ordered()} 가 여는 문이다. */
    public boolean comparesOrder() {
        return this == between || this == gt || this == gte || this == lt || this == lte;
    }

    /**
     * 이 연산자가 그 자바 타입을 받는가 — api-conventions.md §3.4 의 표 그대로.
     *
     * <p><b>{@code dateString} 계열은 여기서 부등호를 받지 못한다.</b> 자바 타입이 {@code String}
     * 이라 <i>숫자·날짜 계열</i> 과 구분할 근거가 서버에 없다. <b>조용히 문자열 비교가 되는
     * 것보다 400 이 낫다.</b>
     *
     * <p><b>근거를 컬럼이 대면 열린다</b>({@code FieldSpec.ordered()} · 2026-09-02). 이 절의
     * 첫 판은 그 자리를 <i>파생 필드</i> 로 미뤘는데, 파생의 자바 타입도 {@code String} 이라
     * <b>거기서도 똑같이 막혔다</b> — 열어 준 적 없는 문을 가리키고 있었다. 지금은 타입이
     * 아니라 <b>선언</b>이 근거다: 문자열 순서가 곧 값의 순서라고 스펙이 말한 컬럼만 받는다.
     */
    public boolean accepts(Class<?> type) {
        return switch (this) {
            case eq, ne, in, isNull, isNotNull -> true;
            case startsWith, contains, endsWith -> CharSequence.class.isAssignableFrom(type);
            case between, gt, gte, lt, lte -> isOrdered(type);
        };
    }

    private static boolean isOrdered(Class<?> type) {
        return Number.class.isAssignableFrom(type)
                || Temporal.class.isAssignableFrom(type)
                || Date.class.isAssignableFrom(type);
    }
}
