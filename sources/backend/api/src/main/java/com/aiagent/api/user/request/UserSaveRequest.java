package com.aiagent.api.user.request;

import com.aiagent.domain.user.admin.UserSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 마스터 일괄 저장 — frontend/grid.md.
 *
 * <p>{@code rows} 하나뿐이다. 그리드의 {@code toSavePayload} 가 만드는 모양이며 <b>변경된
 * 행만</b> 실린다 — 무변경 행은 오지 않는다({@code RowState}).
 *
 * <p>상한은 <b>전량 조회 한 장</b>과 같다({@code PageSpec.MAX_SIZE}). 한 화면에서 그보다 많이
 * 고칠 수 없으므로 그보다 큰 요청은 화면 밖 경로이며, 상한이 없으면 <b>한 트랜잭션이
 * 무한정 길어진다</b>.
 */
public record UserSaveRequest(@NotNull @Size(max = 1000) @Valid List<UserSaveRow> rows) {}
