package com.aiagent.domain.searchcond;

/**
 * 저장된 조회조건 하나 — frontend/search-form.md 의 속성 넷 중 화면이 보는 셋.
 *
 * <p><b>{@code condJson} 을 목록에 함께 싣는다.</b> 항목을 고를 때 다시 부르지 않게 하는
 * 것이 목적이며, 그래도 되는 이유는 조건 하나가 <b>기본값을 뺀 칸만</b> 담아 작기
 * 때문이다(frontend/search-form.md). 따로 부르면 목록과 내용이 어긋나는 순간이 생긴다.
 *
 * <p><b>개수 상한(frontend/search-form.md)이 이 판단을 지탱한다</b> — 수십 개가 되는 물건이 아니다.
 */
public record SavedSearchCond(String condNm, String condJson, boolean dflt, int sortNo) {}
