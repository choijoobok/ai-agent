package com.aiagent.core.search;

import com.aiagent.core.error.BusinessException;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Ops;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.ComparableExpressionBase;
import com.querydsl.core.types.dsl.Expressions;

/**
 * 커서를 {@code WHERE} 절로 편다 — backend/api.md.
 *
 * <pre>
 * ORDER BY CRE_DTM DESC, ACCESS_LOG_SEQ DESC
 * WHERE  CRE_DTM &lt; ?  OR (CRE_DTM = ? AND ACCESS_LOG_SEQ &lt; ?)
 * </pre>
 *
 * <p><b>튜플 비교를 손으로 편다.</b> 표준 SQL 의 {@code (a, b) < (?, ?)} 는 4벤더 전부가
 * 지원하지 않고 QueryDSL 에도 없다 — {@code OR} 두 조각으로 쓰면 <b>보통의 {@code WHERE}</b>
 * 가 되어 벤더 차이가 사라진다(backend/persistence.md).
 *
 * <p><b>PK 가 함께 있어야 한다.</b> 시각만으로 자르면 같은 초에 들어온 행이 여럿일 때
 * 경계가 흔들려 <b>한 행이 두 페이지에 나오거나 아예 빠진다</b>. {@code allocationSize} 가
 * 1000 이라 PK 순서가 시간 순서가 아니므로(screen/log/access/requirements.md) <b>시각이 먼저고 PK 는 동률만 가른다</b>.
 *
 * <h2>{@code Ops} 로 조립하는 것이 결정이다</h2>
 *
 * <p>{@code path.lt(value)} 를 부르려면 {@link com.querydsl.core.types.dsl.ComparableExpression}
 * 으로 캐스팅해야 하는데 <b>숫자 경로가 그 타입이 아니다</b> — {@code NumberExpression} 은
 * {@link ComparableExpressionBase} 를 직접 상속한다. 정렬 키는 시각이라 통과하고 <b>PK 만
 * 걸려</b> 커서가 전부 400 이 됐다(2026-08-30 실물). 타입별 분기를 늘리는 대신 연산자로
 * 조립한다 — {@code Ops.LT} 는 경로의 자바 타입을 묻지 않는다.
 */
public final class CursorSupport {

    private CursorSupport() {}

    /**
     * @param sortField 커서의 정렬 키. <b>파생 필드는 올 수 없다</b> — {@code Path} 가 없어
     *     비교할 컬럼이 없다. {@link QuerySpec} 이 {@code .sortable()} 에서 이미 막는다
     * @param pk tie-breaker. {@link QuerySpec#pk()} 다
     * @param token 앞 응답이 준 것. <b>{@code scanDir} 이 방향을 정한다</b> — 뒤로 갈 때는
     *     뒤집어 읽고 결과를 되집는다
     */
    public static BooleanExpression predicate(
            FieldSpec sortField, ComparableExpressionBase<?> pk, CursorToken token) {

        if (!token.field().equals(sortField.name())) {
            // 정렬이 바뀌면 커서는 무효다(backend/api.md). 조용히 무시하면 옛 기준점이 새 정렬에
            // 먹혀 결과가 틀리고, 그 틀림은 아무 신호도 내지 않는다.
            throw new BusinessException(
                    SearchErrorCode.INVALID_CURSOR,
                    "커서의 정렬 키가 요청과 다르다 — 커서 " + token.field() + " · 요청 " + sortField.name());
        }
        Expression<?> sort = sortField.path();
        Object sortValue = ValueCoercion.one(token.value(), sortField.javaType(), sortField.name());
        Object pkValue = ValueCoercion.one(token.pk(), pk.getType(), "pk");

        Ops ahead = token.scanDir() == SortDir.desc ? Ops.LT : Ops.GT;

        return compare(ahead, sort, sortValue)
                .or(compare(Ops.EQ, sort, sortValue).and(compare(ahead, pk, pkValue)));
    }

    /**
     * {@code path {op} ?} — 상수는 <b>바인딩 파라미터</b>가 된다({@code Expressions.constant}).
     *
     * <p>값을 문자열로 이어 붙이는 자리가 없으므로 인젝션 표면도 없다 — backend/api.md 이 컬럼에
     * 대해 한 말이 값에 대해서도 성립한다.
     */
    private static BooleanExpression compare(Ops op, Expression<?> path, Object value) {
        return Expressions.predicate(op, path, Expressions.constant(value));
    }
}
