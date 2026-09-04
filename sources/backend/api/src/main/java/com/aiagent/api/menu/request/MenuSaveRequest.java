package com.aiagent.api.menu.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 속성 저장 — sys/menu.md. <b>없는 것이 이 DTO 의 내용이다.</b>
 *
 * <p>{@code UP_MENU_CD}·{@code SORT_NO}·{@code MENU_NM} 이 <b>여기 없다</b>. 폼에서 감추는
 * 것은 UX 이지 방어가 아니므로(backend/security.md) <b>받지 않는 것</b>으로 막는다 — 조작할 경로가
 * 구조적으로 없다(원칙 P1).
 *
 * @param menuUrl <b>{@code null} 이 폴더</b>다. 화면은 라우트 목록에서 고르며 첫 항목이
 * {@code (없음)} 이다 — URL 을 비워 폴더로 되돌리는 유일한 경로다(screen/menu/requirements.md)
 * @param useYn <b>구조 노드에 놓으면 자손 전체에 쓴다</b>(screen/menu/requirements.md).
 *     <p>{@code Boolean} 인데 {@code @NotNull} 인 것이 의도다 — 원시 타입으로 두면 값이
 *     빠진 요청이 <b>조용히 {@code false}</b> 가 되고, 이 컬럼에서 그것은 <i>메뉴를 끄는
 * 것</i>이다(backend/security.md 의 최종 게이트). 빠뜨린 요청은 400 이어야 한다
 */
public record MenuSaveRequest(
        @NotBlank @Size(max = 30) String menuCd,
        @Size(max = 200) String menuUrl,
        @Size(max = 50) String iconCd,
        @NotNull Boolean useYn) {}
