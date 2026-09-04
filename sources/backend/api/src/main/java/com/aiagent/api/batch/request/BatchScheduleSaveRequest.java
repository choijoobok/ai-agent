package com.aiagent.api.batch.request;

import com.aiagent.domain.batch.schedule.BatchScheduleSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 마스터 일괄 저장의 봉투 — frontend/grid.md · screen/batch/schedule/requirements.md.
 *
 * <p><b>비어 있으면 400 이다.</b> {@code RoleSaveRequest} 와 같은 규칙이며, 조용히
 * 성공으로 돌려주면 <i>저장됐다</i> 는 토스트만 남는다.
 */
public record BatchScheduleSaveRequest(@NotEmpty @Valid List<BatchScheduleSaveRow> rows) {}
