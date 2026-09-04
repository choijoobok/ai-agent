package com.aiagent.core.search;

/**
 * 페이징 모드 셋 — api-conventions.md §3.8. <b>응답의 첫 키이며 화면은 이것을 보고 푸터를 그린다.</b>
 *
 * <p><b>{@code null} 조합으로 추론하게 두지 않는다.</b> {@code cursor} 의 마지막 장과
 * {@code all} 은 {@code totalPages}·{@code nextCursor} 가 둘 다 {@code null} 이고
 * {@code hasNext} 가 {@code false} 라 구별되지 않는다 — 서버가 한 마디로 말한다.
 */
public enum PageMode {

    /** 대부분. 총 건수를 센다({@code COUNT} 한 번 더) · 서버 정렬 · 번호 네비. */
    offset,

    /**
     * 대용량 이력. 총 건수를 세지 않고 정렬 키가 하나다.
     *
     * <p><b>이력 슬라이스가 만들었다</b>(2026-08-30) — 첫 사용처가 {@code ACCESS_LOG} 다
     * (64 §2.3). {@code COUNT} 가 처음으로 비싼 화면이며, 상한·근사·생략 중 <b>생략</b>을
     * 골랐기 때문에 페이지 번호를 만들 수 없고 푸터가 {@code ‹ 이전 · 다음 ›} 이 된다.
     *
     * <p>정렬 키가 하나인 것은 기준점 때문이다 — 번호 없는 이동은 직전 페이지의 마지막
     * 행을 기준으로 다음을 읽으므로 <b>정렬 키가 고정</b>이어야 한다.
     */
    cursor,

    /** 전량이 작고 페이징이 무의미한 화면. 정렬·필터를 <b>둘 다 클라이언트가</b> 한다. */
    all
}
