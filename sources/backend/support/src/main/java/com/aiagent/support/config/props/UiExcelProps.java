package com.aiagent.support.config.props;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 엑셀의 행 상한 <b>둘</b> — FILE-05 · sys/code.md · frontend/grid-advanced.md.
 *
 * <h2>내려받기와 올리기가 다른 값이다 (2026-09-02 실측)</h2>
 *
 * <p>한동안 올리기가 내려받기의 값을 그대로 썼다. 근거는 <i>양식이 곧 내려받은 파일이라
 * 두 상한이 갈리면 내려받은 것을 그대로 올렸는데 거절이 성립한다</i> 였는데(playbook/INDEX.md),
 * <b>두 값은 서로 다른 것을 재고 있었다</b> —
 *
 * <ul>
 *   <li><b>내려받기</b>는 브라우저가 만드는 파일의 크기다. 서버는 쿼리 한 번이고 비용은
 *       클라이언트에 있다
 *   <li><b>올리기</b>는 파싱 + <b>한 트랜잭션</b>이다. 실측(로컬 PostgreSQL)에서 파싱은
 *       5만 행이 1.5초로 싸고 <b>저장이 비쌌다</b>: 1천 1.5초 · 5천 4.6초 · 1만 6.5초 ·
 *       2만 12.5초. 5만이면 30초짜리 쓰기 트랜잭션이며 그것은 화면의 저장 버튼이 아니라
 * 배치다(playbook/INDEX.md)
 * </ul>
 *
 * <p>그래서 <b>키를 둘로 갈랐다.</b> 같은 값으로 둘 수 있는 길은 내려받기를 5천으로
 * 내리거나 올리기를 5만으로 올리는 것뿐인데, 앞은 멀쩡한 기능을 깎고 뒤는 사용자를 30초
 * 기다리게 한다. 갈린 값이 만드는 <i>내려받은 것을 그대로 올렸는데 거절</i> 은
 * <b>파일을 읽는 자리에서 행 수를 세어 말해</b> 갚는다(`readWorkbook` 의 `tooManyRows`).
 *
 * <p>올리기 쪽이 서버의 요청 상한보다 <b>작아야 한다</b>({@code SampleFlatItemSaveRequest}
 * 의 {@code @Size}) — 화면이 통과시킨 것을 서버가 거절하면 사용자는 <b>왜 안 되는지</b> 를
 * 알 수 없다.
 *
 * <p><b>프론트가 생성하므로 전량을 메모리에 올린다</b>(frontend/grid-advanced.md). 상한이 없으면 브라우저가
 * 죽으며, <b>서버 생성으로 폴백하지 않는다</b> — 경로가 하나 늘고 사용자가 <i>"왜 어떤
 * 때만 느린가"</i> 를 알 수 없다.
 *
 * <p>넘으면 <b>거부하고 조건을 좁히라고 안내한다.</b> 조용히 자르면 사용자는 <b>일부만
 * 받은 파일을 전부로 알고</b> 쓴다.
 *
 * @param maxRows 엑셀 <i>전체</i> 다운로드가 받을 수 있는 최대 행 수. 넘으면 거부한다.
 * @param maxUploadRows 엑셀 업로드가 한 번에 받는 최대 행 수. 파싱과 저장 한 트랜잭션이
 *     감당하는 선이며, 넘으면 <b>파일을 읽는 자리에서</b> 거부한다.
 */
@ConfigurationProperties(prefix = "sys-config.ui.excel")
@Validated
public record UiExcelProps(
        @NotNull @Min(1) Integer maxRows, @NotNull @Min(1) Integer maxUploadRows) {}
