package com.aiagent.api.role.request;

import com.aiagent.domain.authz.role.RoleAuthGrant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 권한 트리 저장의 봉투 — screen/role-auth/requirements.md.
 *
 * <p><b>{@code roleId} 가 봉투에 있다.</b> 이 트리는 통째로 한 역할의 것이므로 부여마다 두면
 * <i>한 요청에 여러 역할</i> 이 표현 가능해지고, 그러면 서버가 <b>화면에 없는 조합</b>을
 * 받는다 — 조회의 {@code params} 가 부모 키를 갖는 것과 같은 자리다(backend/api.md).
 *
 * <p><b>{@code grants} 는 비어 있을 수 있다.</b> {@code @NotEmpty} 가 아닌 것이 다른 저장
 * 봉투들과 갈리는 자리이며, <b>권한을 전부 회수하는 것이 정당한 조작</b>이기 때문이다 —
 * 그것이 곧 screen/role-auth/requirements.md 의 셋째 줄(공집합이 되어 차단되는 사람)이 실제로 일어나는 경우다.
 * 비었다고 400 을 내면 <b>전부 끄는 길이 화면에 없어진다.</b>
 */
public record RoleAuthSaveRequest(
        @NotBlank @Size(max = 30) String roleId,
        @NotNull @Valid List<RoleAuthGrant> grants) {}
