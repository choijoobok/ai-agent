package com.aiagent.api.sample.mdvertical.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * ②의 <i>현재 페이지</i> 가 보내는 것 — <b>화면이 주문을 지목한다</b>.
 *
 * <p>조건을 다시 보내게 하지 않는 이유는 화면에 <i>지금 보이는 것</i>이 조건만으로는
 * 재현되지 않기 때문이다 — 컬럼 필터와 정렬이 판에 걸려 있고 서버는 그것을 모른다
 * (grid-column-contract.md §4.1).
 */
public record SampleExcelPageRequest(@NotNull @Size(max = 1000) List<String> ordNos) {}
