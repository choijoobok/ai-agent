// @feat FEAT-503
package com.aiagent.sample.api.mdvertical.request;

import com.aiagent.sample.domain.SmplOrderItemSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 디테일 저장 — 대상 주문이 <b>요청 하나에 하나</b>다.
 *
 * <p>행마다 받으면 한 요청에 여러 주문의 품목이 섞일 수 있고, 그러면 <i>이 주문을
 * 저장한다</i> 는 화면의 뜻과 요청이 갈린다.
 *
 * <p>{@code ordId} 가 문자열인 것은 {@code bigint} 어휘의 규약이다(frontend/packages.md).
 */
public record SampleItemSaveRequest(
        @NotBlank String ordId,
        @Valid @NotNull @Size(max = 1000) List<SmplOrderItemSaveRow> rows) {}
