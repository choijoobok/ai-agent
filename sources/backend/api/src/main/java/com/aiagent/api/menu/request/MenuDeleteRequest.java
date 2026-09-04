package com.aiagent.api.menu.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 삭제 — screen/menu/requirements.md. <b>한 건이다.</b>
 *
 * <p>다중 선택 삭제가 없다(frontend/grid.md). 게이트가 넷이고 <b>어느 쪽이 막는지 말해야</b> 하는데,
 * 여러 건을 한 번에 받으면 그 문구가 <i>"3건 중 2건이 막혔습니다"</i> 가 되어 무엇을 고쳐야
 * 할지 알 수 없다.
 */
public record MenuDeleteRequest(@NotBlank @Size(max = 30) String menuCd) {}
