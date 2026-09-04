package com.ordinary.backoffice.api.user.request;

import com.ordinary.backoffice.domain.user.detail.UserRoleSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 보유 역할 저장 — 61 §3.8 탭 1.
 *
 * <p><b>{@code userId} 가 본문에 있다.</b> 마스터에서 고른 그 사람이며 조회조건이 아니라
 * <b>화면의 구조</b>다(api-conventions.md §3.1.1) — {@code UserAuthSaveRequest} 와 같은 모양이고 같은 이유다.
 *
 * <p>상한이 {@code 1000} 인 것은 다른 저장과 맞춘 것이지 <b>여기서 그만큼 오는 일은
 * 없다</b> — 한 사람이 가질 수 있는 역할은 {@code SYS_ROLE} 의 행 수만큼이고, 그 수는
 * 조직의 크기이지 데이터의 크기가 아니다.
 */
public record UserRoleSaveRequest(
        @NotBlank @Size(max = 30) String userId,
        @NotNull @Size(max = 1000) @Valid List<UserRoleSaveRow> rows) {}
