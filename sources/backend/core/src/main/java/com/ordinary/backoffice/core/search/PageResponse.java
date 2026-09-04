package com.ordinary.backoffice.core.search;

import java.util.List;

/**
 * 조회 응답 — api-conventions.md §3.9. <b>{@code mode} 가 첫 키다.</b>
 *
 * <p><b>타입을 셋으로 가르지 않는다.</b> 가르면 {@code <DataGrid>} 가 셋을 받아야 한다 —
 * 한 타입에 {@code mode} 한 키가 화면의 분기를 한 곳에 모은다.
 *
 * <p><b>{@code hasNext} 를 셋 다 채우는 것이 요점이다.</b> 그리드 푸터가 한 컴포넌트이므로
 * <i>"다음이 있나"</i> 는 모드와 무관하게 답이 있어야 한다.
 */
public record PageResponse<T>(
        PageMode mode,
        List<T> content,
        Integer size,
        boolean hasNext,
        Long totalElements,
        Integer totalPages,
        String nextCursor,
        String prevCursor) {

    public static <T> PageResponse<T> offset(List<T> content, int size, int page, long total) {
        int pages = size <= 0 ? 0 : (int) Math.ceil((double) total / size);
        return new PageResponse<>(
                PageMode.offset, content, size, (long) (page + 1) * size < total, total, pages, null, null);
    }

    /**
     * 커서형 — api-conventions.md §3.8 · 64 §2.3. <b>{@code totalElements}·{@code totalPages} 가 없다.</b>
     *
     * <p>{@code COUNT} 를 세지 않기로 한 것이 이 모드의 전부다(64 §2.3). 상한도 근사도
     * 아닌 <b>생략</b>이며, 그래서 페이지 번호를 만들 수 없고 푸터가
     * {@code ‹ 이전 · 다음 ›} 이 된다.
     *
     * <p><b>{@code hasNext} 는 {@code nextCursor} 의 유무와 같다.</b> 두 값이 갈릴 수 있게
     * 두면 화면이 <i>다음 버튼은 켜졌는데 누를 토큰이 없는</i> 상태를 만난다.
     */
    public static <T> PageResponse<T> cursor(
            List<T> content, int size, String nextCursor, String prevCursor) {
        return new PageResponse<>(
                PageMode.cursor, content, size, nextCursor != null, null, null, nextCursor, prevCursor);
    }

    /**
     * 전량. {@code size} 는 {@code null} 이고 {@code hasNext} 는 <b>언제나 {@code false}</b> 다.
     *
     * <p>상한을 넘었는지는 <b>부르는 쪽이 판정한다</b> — 조용히 자르면 <i>전량</i> 이
     * 거짓말이 된다(api-conventions.md §3.8).
     */
    public static <T> PageResponse<T> all(List<T> content) {
        return new PageResponse<>(
                PageMode.all, content, null, false, (long) content.size(), null, null, null);
    }
}
