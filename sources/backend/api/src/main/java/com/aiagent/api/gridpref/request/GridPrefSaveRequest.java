package com.aiagent.api.gridpref.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 그리드 설정 저장 — UX-06 · frontend/grid.md.
 *
 * <p><b>{@code userId} 가 없다.</b> 대상은 언제나 세션의 주인이다.
 *
 * <p><b>{@code signature} 는 화면이 만든다</b>(frontend/grid.md의 식) — 서버는 컬럼 목록을 모르므로
 * 만들 수 없고, 하는 일은 <b>다음에 읽을 때 같은지 비교하는 것</b>뿐이다.
 */
public record GridPrefSaveRequest(
        @NotBlank @Size(max = 30) String menuCd,
        @NotBlank @Size(max = 30) String gridId,
        @NotBlank String prefJson,
        @NotBlank @Size(max = 64) String signature) {}
