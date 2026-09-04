package com.aiagent.api.sample.excel.request;

import com.aiagent.domain.sample.SmplFlatItemSaveRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * &#9317;의 저장 &mdash; 68 &sect;8. <b>{@code ordId} 가 요청에 없다.</b>
 *
 * <p>{@code SampleItemSaveRequest} 가 대상 주문을 요청 하나에 하나로 못박은 것과 갈리는
 * 자리이며, 근거는 <b>한 파일에 여러 주문의 품목이 섞이기</b> 때문이다(ADR-0024 의 평면
 * 엑셀 한 장). 부모는 행마다 {@code ORD_NO} 로 온다(48 &sect;4.3).
 *
 * <p><b>상한이 {@code ui.excel.max-rows} 와 같은 층의 값이다.</b> 화면이 파일을 읽을 때
 * 이미 그 상한으로 거절하지만(68 &sect;8.7), 여기가 화면 밖 경로의 마지막이다 &mdash;
 * 여유를 두는 것은 두 상한이 <b>정확히 같은 값일 필요는 없고</b> 서버 쪽이 넉넉해야
 * <i>화면이 통과시킨 것을 서버가 거절</i> 하는 일이 없기 때문이다.
 */
public record SampleFlatItemSaveRequest(
        @Valid @NotNull @Size(max = 20000) List<SmplFlatItemSaveRow> rows) {}
