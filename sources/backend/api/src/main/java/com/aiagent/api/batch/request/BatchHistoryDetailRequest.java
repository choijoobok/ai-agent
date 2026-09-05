package com.aiagent.api.batch.request;

import jakarta.validation.constraints.NotNull;

/**
 * 상세 모달이 여는 것 — screen/batch/history/requirements.md. <b>PK 하나다.</b>
 *
 * <p>{@code ErrorLogDetailRequest} 와 같은 모양이며 이유도 같다(backend/api.md) — 동적 봉투를
 * 태우지 않는다. 조건 목록으로 열면 <b>{@code nclob} 조회가 임의 조건의 조회</b>가 되고,
 * 그 순간 그것을 목록에서 뺀 이유가 무너진다.
 */
public record BatchHistoryDetailRequest(@NotNull Long histId) {}
