package com.aiagent.api.userauth.request;

import com.aiagent.domain.authz.userauth.UserAuthSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 개인 예외 저장 — screen/admin/system/user/requirements.md.
 *
 * <p><b>{@code userId} 가 본문에 있다.</b> 조회조건이 아니라 <b>화면의 구조</b>이며(backend/api.md)
 * 좌 pane 에서 고른 그 사람이다 — 조건 목록에 두면 화이트리스트를 지나며 <b>선택적</b>이 되어,
 * 빠뜨린 요청 하나가 <i>누구의 권한을 고치는지 모르는 저장</i>이 된다.
 *
 * <p>{@code rows} 는 <b>변경된 행만</b> 실린다({@code RowState} — 무변경 행은 오지 않는다).
 * {@code RoleAuthSaveRequest} 가 <b>켜진 스위치 전부</b>를 받는 것과 갈리는 자리이며, 그
 * 차이의 원인은 <b>여기에 수정이 있다</b>는 것 하나다(screen/menu/requirements.md · {@link UserAuthSaveRow}).
 *
 * <p>상한은 전량 조회 한 장과 같다({@code PageSpec.MAX_SIZE}). 한 사람의 예외가 그보다 많다면
 * 그것은 예외가 아니라 <b>역할</b>이며(sys/menu.md), 화면도 임계치를 넘으면 <i>역할 신설을
 * 검토하세요</i> 를 낸다(screen/user-auth/requirements.md).
 */
public record UserAuthSaveRequest(
        @NotBlank @Size(max = 30) String userId,
        @NotNull @Size(max = 1000) @Valid List<UserAuthSaveRow> rows) {}
