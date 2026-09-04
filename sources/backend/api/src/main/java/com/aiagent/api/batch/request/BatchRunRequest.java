package com.aiagent.api.batch.request;

import com.aiagent.domain.batch.entity.SysScheduleBatch;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 즉시 실행이 받는 <b>대상</b> — frontend/grid.md · screen/batch/schedule/requirements.md.
 *
 * <p>요청 페이로드가 둘로 갈린다: 대상({@code targets})과 호출의 인자({@code params}).
 * <b>{@code params} 가 여기 없다</b> — 즉시 실행은 받을 인자가 없다. 파라미터는 등록에
 * 붙어 있고({@code PARAM_JSON} — sys/batch.md) 실행할 때 고르는 것이 아니다.
 *
 * <p><b>대상이 {@code BATCH_ID} 목록</b>인 이유는 {@code UserTargetRequest} 와 같다 —
 * 서버가 어차피 등록을 다시 읽어야 하고, 화면이 보낸 나머지 값은 쓰지 않는다.
 * 특히 여기서는 <b>미저장 변경이 있으면 화면이 막으므로</b>(screen/batch/schedule/requirements.md 의 {@code validate})
 * 서버가 읽는 값이 화면이 보고 있는 값과 같다는 것을 화면 쪽이 보증한다.
 *
 * <p>상한이 {@code 1000} 인 것은 {@code UserTargetRequest} 와 맞춘 것이지 배치의 사정이
 * 아니다 — 등록이 수십 건이라 실제로는 닿지 않는다.
 */
public record BatchRunRequest(
        @NotEmpty @Size(max = 1000)
                List<@NotBlank @Size(max = SysScheduleBatch.BATCH_ID_MAX) String> targets) {}
