package com.aiagent.api.log.request;

/**
 * 엑셀 두 갈래 — grid-standard.md §2.2 의 드롭다운 항목 그대로다.
 *
 * <p><b>ADR-0019 의 셋째(임의 API · 서버 POI)는 여기 없다.</b> 그쪽은 자기 컨트롤러가
 * 있어 {@code SYS_LO_ACCESS} 에 <b>그 요청 자체로</b> 남는다 — 알려 줄 것이 없다.
 */
public enum ExcelScope {

    /** 지금 화면에 보이는 행. 컬럼 필터가 걸려 있으면 걸러진 결과다(grid-column-contract.md §4.1). */
    PAGE,

    /** 조회조건 그대로 전량. {@code ui.excel.max-rows} 상한이 걸린다(ADR-0019). */
    ALL
}
