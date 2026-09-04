package com.ordinary.backoffice.api.log.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 엑셀을 내렸다 — ADR-0019 · grid-standard.md §2.2.
 *
 * <p><b>이 요청은 자기 자신이 기록이다.</b> 컨트롤러가 저장하는 것이 아니라
 * {@code UserActionLogInterceptor} 가 <b>모든 {@code /api/**} 요청</b>을 남기며(45 §4.1)
 * 그 행의 {@code PARAMETERS} 에 이 body 가 그대로 들어간다.
 *
 * <h2>{@code menuCd} 를 받지 않는다</h2>
 *
 * <p>ADR-0019 는 payload 를 {@code {menuCd, rowCount, columnKeys}} 로 적었다. <b>첫째를
 * 뺀다</b> — 그 값은 이미 {@code X-Menu-Code} 헤더로 와서 {@code SYS_LO_ACCESS.MENU_CD}
 * <b>컬럼</b>이 되며(architecture.md §6.3 · 45 §4.1), body 에도 담으면 <b>같은 사실이 한 행에 두 벌</b>
 * 생긴다. 둘이 어긋나는 날 어느 쪽이 맞는지 알 수 없고, 이력 화면이 메뉴로 거를 때 보는
 * 것은 <b>컬럼 쪽</b>이다(64 §3.2.1).
 *
 * <h2>{@code scope} 를 더한다</h2>
 *
 * <p>대신 <b>어느 항목을 눌렀는가</b>를 받는다(grid-standard.md §2.2 의 드롭다운 둘). {@code rowCount} 만
 * 으로는 <i>100건짜리 화면의 현재 페이지</i> 와 <i>마침 100건이던 전량</i> 이 같아 보이는데,
 * ADR-0019 가 <b>전량에만 상한을 둔</b> 이유가 그 둘의 위험이 다르기 때문이다.
 *
 * @param scope 현재 페이지인가 전량인가. <b>트리는 언제나 {@link ExcelScope#ALL}</b> 이다 —
 *     페이지가 없어 둘이 같다(62 §4.9)
 * @param rowCount 파일에 들어간 행 수. 0건은 파일을 만들지 않으므로 오지 않는다(grid-standard.md §2.2)
 * @param columnKeys 내려간 컬럼의 <b>식별자</b>다 — 화면에 보이는 이름이 아니다. Phase 12 의
 *     PII 판정이 이것을 읽는다(ADR-0019 · 27 §5). 사용자가 끈 컬럼은 여기 없다
 */
public record ExcelLogRequest(
        @NotNull ExcelScope scope,
        @NotNull @Min(1) Integer rowCount,
        @NotEmpty @Size(max = 200) List<@NotNull @Size(max = 100) String> columnKeys) {}
