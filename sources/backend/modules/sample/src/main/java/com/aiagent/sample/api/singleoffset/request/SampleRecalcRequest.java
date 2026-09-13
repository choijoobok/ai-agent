// @feat FEAT-503
package com.aiagent.sample.api.singleoffset.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 일괄 재계산 — playbook/INDEX.md 의 실행 <b>둘 중 뒤</b>({@code params} 모달 · 프로그레스 있음).
 *
 * <h2>{@code params} 아래에 있다 (2026-09-02)</h2>
 *
 * <p>두 칸이 <b>맨 위에 있었고, 그래서 이 실행은 한 번도 서버에 닿은 적이 없다</b> —
 * 그리드가 보내는 몸통은 <b>둘로 갈린 봉투</b>다(frontend/grid.md): 대상 행은 {@code targets} 에,
 * 모달이 만든 값은 {@code params} 에 담긴다. 봉투를 펴서 받으면 두 칸 다 {@code null} 이
 * 오고 {@code @NotNull} 이 <b>400</b> 을 내며, 화면에는 <i>입력값을 확인하세요</i> 만 뜬다.
 *
 * <p><b>이 프로젝트에서 {@code params} 를 실제로 받는 첫 자리다.</b> 다른 화면의 실행에는
 * 인자가 없거나({@code UserTargetRequest} 의 주석이 <i>"params 필드가 여기 없다"</i> 고
 * 적어 두었다) 그리드를 거치지 않고 화면이 직접 {@code post} 한다(`NOTI_REQUEST`). 봉투의
 * 안쪽이 한 번도 열린 적이 없었으니 <b>어긋남이 드러날 자리도 없었다</b>.
 *
 * <h2>{@code targets} 를 선언하지 않는다</h2>
 *
 * <p>이 실행의 대상은 <b>기준일에 든 전량</b>이지 화면이 든 행이 아니다({@code target:'none'}
 * — playbook/INDEX.md). 봉투에는 여전히 빈 {@code targets} 가 실려 오지만 <b>읽지 않는 칸을 선언하면
 * 서버가 그것을 쓴다고 말하는 셈</b>이 된다 — {@code UserTargetRequest} 가 {@code params} 를
 * 두지 않은 것과 같은 자리다.
 *
 * <p><b>세율에 상한이 있다.</b> 사람이 {@code 10} 을 <i>10%</i> 로 읽고 치면 금액이 열 배가
 * 되는데, 그 결과는 전량에 반영된 뒤에야 보인다 — 되돌리는 길은 다시 계산하는 것뿐이고
 * 그 사이 사용자는 <b>열 배가 된 금액을 본다</b>.
 */
public record SampleRecalcRequest(@NotNull @Valid Params params) {

    /**
     * 모달의 두 칸 — playbook/INDEX.md.
     *
     * <p><b>{@code @Valid} 가 없으면 여기까지 내려오지 않는다.</b> 중첩 객체의 제약은
     * 바깥에서 그것을 달아 줘야 검사되며, 빠뜨리면 <b>세율 상한이 조용히 사라진다</b>.
     */
    public record Params(
            @NotNull LocalDate baseDt,
            @NotNull @DecimalMin("0.00") @DecimalMax("1.00") BigDecimal vatRate) {}
}
