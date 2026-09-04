package com.aiagent.api.batch.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 중단이 받는 <b>대상</b> — frontend/grid.md · screen/batch/schedule/requirements.md.
 *
 * <p>대상이 <b>{@code HIST_ID} 목록</b>이다. {@code BATCH_ID} 가 아닌 것이 요점이며,
 * 중단은 <b>실행 한 번</b>에 대한 것이지 등록에 대한 것이 아니다 — 같은 배치가 유령 하나와
 * 진행 중 하나를 함께 갖는 경우가 있고(screen/batch/schedule/requirements.md), 그때 {@code BATCH_ID} 로 보내면 어느
 * 실행을 멈추라는 것인지 서버가 고르게 된다.
 *
 * <p><b>화면이 {@code eligible} 로 {@code RUNNING} 만 골라 보낸다</b>(frontend/grid.md). 그래도
 * 서버가 다시 보는 것은 그 사이 배치가 끝날 수 있기 때문이며, 그때는 조용히 건너뛰지
 * 않고 <b>거절</b>한다.
 */
public record BatchCancelRequest(
        @NotEmpty @Size(max = 1000) List<@NotNull Long> targets) {}
