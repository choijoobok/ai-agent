package com.aiagent.domain.batch.history;

import com.aiagent.domain.batch.entity.SysScheduleBatch;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 하단 pane 이 보는 배치 하나 — screen/batch/schedule/requirements.md. {@code RoleIdParams} 와 같은 자리다.
 *
 * <p><b>조회조건이 아니라 파라미터다.</b> 조건 목록에 담으면 사용자가 지울 수 있는 것이
 * 되고, 그러면 <i>이 배치의 최근 실행</i> 을 묻는 pane 이 <b>전 배치의 최근 실행</b>을
 * 낸다 — backend/api.md 이 둘을 가른 이유가 그것이다.
 */
public record BatchIdParams(
        @NotBlank @Size(max = SysScheduleBatch.BATCH_ID_MAX) String batchId) {}
