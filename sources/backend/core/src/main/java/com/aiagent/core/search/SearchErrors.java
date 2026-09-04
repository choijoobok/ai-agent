package com.aiagent.core.search;

import com.aiagent.core.error.BusinessException;

/**
 * 조회 위반 예외를 만드는 자리 — 문구를 한 곳에 모은다.
 *
 * <p><b>예외가 나르는 문구는 로그의 것이다</b>(architecture.md §6-1.2). 어느 필드가 문제였는지는
 * 운영자가 봐야 하지만, <b>응답은 코드로 다시 읽어 사용자 언어로 완성된다</b> — 그래서
 * 여기 필드 이름을 담아도 사용자에게 그대로 나가지 않는다.
 */
final class SearchErrors {

    static BusinessException unknownField(String field) {
        return new BusinessException(
                SearchErrorCode.UNKNOWN_FIELD, "화이트리스트에 없는 필드: " + field);
    }

    static BusinessException opTypeMismatch(String field, Op op) {
        return new BusinessException(
                SearchErrorCode.OP_TYPE_MISMATCH, "연산자 " + op + " 가 필드 " + field + " 의 타입을 받지 않는다");
    }

    static BusinessException notSortable(String field) {
        return new BusinessException(SearchErrorCode.NOT_SORTABLE, "정렬 불가 필드: " + field);
    }

    static BusinessException valueRequired(String field, Op op) {
        return new BusinessException(
                SearchErrorCode.INVALID_VALUE, "연산자 " + op + " 는 값을 받지 않는다 — 필드 " + field);
    }

    static BusinessException notAList(String field) {
        return new BusinessException(SearchErrorCode.INVALID_VALUE, "배열이어야 한다 — 필드 " + field);
    }

    static BusinessException emptyIn(String field) {
        return new BusinessException(SearchErrorCode.INVALID_VALUE, "in 배열이 비었다 — 필드 " + field);
    }

    static BusinessException nullNotAllowed(String field) {
        return new BusinessException(
                SearchErrorCode.INVALID_VALUE, "nullable 이 아닌 필드에 null 이 왔다 — " + field);
    }

    static BusinessException betweenArity(String field) {
        return new BusinessException(
                SearchErrorCode.INVALID_VALUE, "between 은 2원소 배열이고 한쪽 이상이 있어야 한다 — " + field);
    }

    static BusinessException uncoercible(Object raw, Class<?> type, String field) {
        return new BusinessException(
                SearchErrorCode.INVALID_VALUE,
                "값 [" + raw + "] 을 " + type.getSimpleName() + " 으로 읽을 수 없다 — 필드 " + field);
    }

    /**
     * 파생 조건의 번역기가 값을 거절했다 — <b>500 이 아니라 400 이다</b>.
     *
     * <p>번역기는 화이트리스트 함수이므로 그것이 거절한 것은 언제나 <b>요청의 문제</b>다.
     * 감싸지 않으면 {@code IllegalArgumentException} 이 그대로 올라가 <i>내부 오류</i> 가
     * 되고, 잘못 보낸 조건 하나가 <b>에러 로그를 5xx 로 채운다</b>(2026-08-30 실측).
     */
    static BusinessException derivedRejected(String field, RuntimeException cause) {
        return new BusinessException(
                SearchErrorCode.INVALID_VALUE, "파생 조건이 값을 받지 않는다 — 필드 " + field
                        + " (" + cause.getMessage() + ")");
    }

    static BusinessException duplicateField(String field) {
        return new BusinessException(
                SearchErrorCode.INVALID_VALUE, "같은 필드가 두 번 왔다 — " + field);
    }

    private SearchErrors() {}
}
