package com.aiagent.api.role.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 권한 트리 조회의 요청 — screen/role/requirements.md. <b>{@code SearchRequest} 가 아니다.</b>
 *
 * <p>받을 것이 {@code roleId} 하나뿐이다. 트리는 <b>페이징도 정렬도 조건도 없고</b>(screen/user/requirements.md)
 * 메뉴명은 <b>강조와 이동</b>이라 클라이언트가 한다({@code RoleQueryService} 의 주석) —
 * 받을 것이 없는 자리에 봉투를 두면 <i>조건을 보내면 걸릴 것</i> 이라는 기대를 만든다.
 * {@code MENU_TREE} 의 {@code getTree} 가 봉투를 쓰지 않는 것과 같은 판단이다(screen/role/requirements.md).
 */
public record RoleMenuTreeRequest(@NotBlank @Size(max = 30) String roleId) {}
