package com.aiagent.domain.gridpref;

/**
 * 저장된 그리드 설정 하나 — grid-standard.md §5.
 *
 * <p><b>{@code prefJson} 이 전부다.</b> 서버는 그 안을 열어 보지 않으며, 시그니처가 맞는
 * 것만 돌려준다 — 맞지 않으면 아예 {@code null} 이다(UX-13).
 */
public record GridPref(String prefJson) {}
