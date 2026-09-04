package com.aiagent.api.config.request;

import com.aiagent.domain.config.admin.ConfigSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * {@code CONFIG_MGMT} 의 저장 페이로드 — 63 §4.7.
 *
 * <p><b>봉투가 따로 있는 이유는 목록에 {@code @Valid} 를 걸기 위해서다.</b> 컨트롤러가
 * {@code List} 를 직접 받으면 원소 검증이 돌지 않는다.
 *
 * <p><b>빈 목록도 받는다.</b> 화면이 <i>바뀐 행이 없다</i> 를 먼저 말하므로(grid-api-contract.md §6) 여기까지
 * 오지 않지만, 왔을 때 400 을 내면 <b>아무 일도 안 하는 요청이 실패</b>가 된다.
 */
public record ConfigSaveRequest(@NotNull @Valid List<ConfigSaveRow> rows) {}
