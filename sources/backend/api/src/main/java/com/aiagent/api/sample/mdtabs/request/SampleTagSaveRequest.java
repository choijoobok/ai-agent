package com.aiagent.api.sample.mdtabs.request;

import com.aiagent.domain.sample.SmplTagSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 태그 탭의 저장 &mdash; 68 &sect;7.4. 대상 주문이 <b>요청 하나에 하나</b>다.
 *
 * <p>{@code SampleItemSaveRequest} 와 같은 모양이며 같은 이유다: 행마다 받으면 한 요청에
 * 여러 주문의 태그가 섞이고, 그러면 <i>이 주문을 저장한다</i> 는 화면의 뜻과 요청이 갈린다.
 *
 * <p><b>상한이 품목의 1/10 이다.</b> 태그는 주문 하나에 몇 개짜리 어휘라(48 &sect;4.1)
 * 백을 넘는 요청은 화면이 만든 것이 아니다.
 */
public record SampleTagSaveRequest(
        @NotBlank String ordId,
        @Valid @NotNull @Size(max = 100) List<SmplTagSaveRow> rows) {}
