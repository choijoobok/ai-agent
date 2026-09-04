package com.aiagent.api.menu.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 신규 노드 — 62 §4.6. <b>칸이 하나다.</b>
 *
 * @param upMenuCd 부모. <b>{@code null} 이 최상위</b>이며 그것이 *최상위 메뉴 추가* 버튼이다 —
 *     버튼을 하나로 두고 라벨을 바꾸지 않는 이유가 62 §4.6 에 있다: 선택 여부에 따라 오가면
 *     <b>누르기 전에는 무엇이 만들어질지 모른다</b>
 * @param menuCd <b>사람이 정하는 유일한 값</b>. 명명 규약은 52 §3.1 이며 중복은 서버가
 *     막는다(grid-edit-validation.md §3.4) — 다른 사람이 방금 만든 것을 클라이언트가 알 수 없다
 */
public record MenuNodeRequest(
        @Size(max = 30) String upMenuCd, @NotBlank @Size(max = 30) String menuCd) {}
