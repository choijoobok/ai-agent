// @feat FEAT-503
package com.aiagent.system.domain.menu;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 탭 셋이 함께 쓰는 <b>부모 키</b> — backend/api.md.
 *
 * <p>조건이 아니라 {@code params} 인 이유는 이것이 <i>사용자가 좁힌 것</i> 이 아니라
 * <b>화면의 구조</b>이기 때문이다. 조건 목록에 두면 화이트리스트를 지나며 <b>선택적</b>이
 * 되고, 화면이 빠뜨린 요청 하나가 전 메뉴의 권한 행을 한 판에 쏟는다.
 */
public record MenuCdParams(@NotBlank @Size(max = 30) String menuCd) {}
