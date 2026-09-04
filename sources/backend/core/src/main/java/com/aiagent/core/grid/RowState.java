package com.aiagent.core.grid;

/**
 * 일괄 저장 페이로드의 행 상태 — grid-standard.md §3.1 · §3.2.
 *
 * <p><b>URL 이 아니라 페이로드 안에 있다.</b> 등록/수정/삭제로 API 를 쪼개지 않으므로 액션도
 * {@code SAVE} 하나다 — 행 상태별 권한은 <b>API 경계에서 집행할 수 없어</b> 권한 화면의
 * 장식이 된다(security-design.md §4).
 *
 * <p><b>무변경 행은 오지 않는다.</b> 넷째 상태를 여기 두면 서버가 <i>"아무것도 하지 않는
 * 행"</i> 을 받아 루프를 돌게 되고, 그 행이 실제로 안 바뀌었는지 검사할 방법이 없다.
 */
public enum RowState {

    /** 추가 — 조회된 적 없는 행이다. 신규 행은 끝까지 신규다(grid-standard.md §3.3). */
    C,

    /** 수정 — 저장된 행의 셀이 바뀌었다. */
    U,

    /** 삭제 — 물리 삭제하는 테이블에만 온다(grid-standard.md §3.5). */
    D
}
