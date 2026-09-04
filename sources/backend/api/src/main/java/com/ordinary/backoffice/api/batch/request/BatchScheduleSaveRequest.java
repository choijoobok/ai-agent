package com.ordinary.backoffice.api.batch.request;

import com.ordinary.backoffice.domain.batch.schedule.BatchScheduleSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 마스터 일괄 저장의 봉투 — grid-standard.md §3.1 · 65 §3.10.
 *
 * <p><b>비어 있으면 400 이다.</b> {@code RoleSaveRequest} 와 같은 규칙이며, 조용히
 * 성공으로 돌려주면 <i>저장됐다</i> 는 토스트만 남는다.
 */
public record BatchScheduleSaveRequest(@NotEmpty @Valid List<BatchScheduleSaveRow> rows) {}
