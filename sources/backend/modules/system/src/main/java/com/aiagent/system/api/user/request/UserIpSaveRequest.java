// @feat FEAT-501
package com.aiagent.system.api.user.request;

import com.aiagent.domain.user.detail.UserIpSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 접속 IP 저장 — screen/admin/system/user/requirements.md 탭 3. 모양은 {@link UserRoleSaveRequest} 와 같다. */
public record UserIpSaveRequest(
        @NotBlank @Size(max = 30) String userId,
        @NotNull @Size(max = 1000) @Valid List<UserIpSaveRow> rows) {}
