package com.ordinary.backoffice.api.sample.singleoffset.request;

import com.ordinary.backoffice.domain.sample.SmplOrderFullSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * ①의 저장 — 68 §3. <b>컬럼 서른을 그리는 화면의 저장이다.</b>
 *
 * <p>③의 {@code SampleOrderSaveRequest} 와 담는 행 타입이 갈리는 이유는
 * {@link SmplOrderFullSaveRow} 가 적어 두었다 — <b>받는 컬럼이 곧 고칠 수 있는 컬럼</b>이라,
 * 하나로 합치면 아홉만 그리는 화면의 저장이 <b>나머지 스물하나를 지운다</b>.
 *
 * <p><b>상한이 있다.</b> 그리드 한 판이 천 행을 넘길 수 없고(grid-standard.md §2.3), 넘겨 오는 요청은
 * 화면이 만든 것이 아니다.
 */
public record SampleOffsetSaveRequest(@NotNull @Size(max = 1000) List<@Valid SmplOrderFullSaveRow> rows) {}
