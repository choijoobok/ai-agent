package com.aiagent.api.role.request;

import com.aiagent.domain.authz.role.RoleSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 마스터 일괄 저장의 봉투 — frontend/grid.md · screen/menu/requirements.md.
 *
 * <p><b>비어 있으면 400 이다.</b> 저장할 것이 없는데 저장을 부르는 것은 화면의 버그이고,
 * 조용히 성공으로 돌려주면 <i>저장됐다</i> 는 토스트만 남는다.
 */
public record RoleSaveRequest(@NotEmpty @Valid List<RoleSaveRow> rows) {}
