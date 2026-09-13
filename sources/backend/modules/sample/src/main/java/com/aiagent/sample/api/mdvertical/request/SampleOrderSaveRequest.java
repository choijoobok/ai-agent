// @feat FEAT-503
package com.aiagent.sample.api.mdvertical.request;

import com.aiagent.sample.domain.SmplOrderSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 마스터 저장 — frontend/grid.md 의 <b>한 트랜잭션</b>이다. */
public record SampleOrderSaveRequest(
        @Valid @NotNull @Size(max = 1000) List<SmplOrderSaveRow> rows) {}
