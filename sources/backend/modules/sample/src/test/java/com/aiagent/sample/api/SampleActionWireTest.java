// @feat FEAT-503
package com.aiagent.sample.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.sample.api.mdvertical.request.SampleItemRecalcRequest;
import com.aiagent.sample.api.mdvertical.request.SampleShipRequest;
import com.aiagent.sample.api.singleoffset.request.SampleConfirmRequest;
import com.aiagent.sample.api.singleoffset.request.SampleRecalcRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * 실행의 <b>몸통 모양</b> — frontend/grid.md · playbook/INDEX.md.
 *
 * <p><b>여기 있는 JSON 은 그리드가 실제로 보내는 것이다</b>({@code useGridController} 의
 * {@code post(action.url, { targets, params })}). 옮겨 적은 것이 아니라 <b>브라우저의
 * 요청을 그대로</b> 가져왔다 — 손으로 지어낸 몸통으로 재면 <i>지어낸 것이 맞고 화면이
 * 틀린</i> 상태를 통과시킨다.
 *
 * <h2>왜 이 검사가 필요한가</h2>
 *
 * <p>①의 실행 둘은 <b>한 번도 서버에 닿은 적이 없었다</b>(2026-09-02 에 실기동에서 드러났다).
 * 확정은 {@code ordIds} 로, 재계산은 두 칸을 <b>맨 위에</b> 두고 받고 있었는데 그리드는
 * 봉투로 보낸다 — 둘 다 {@code null} 이 되어 <b>400</b> 이 나고, 화면에는 <i>입력값을
 * 확인하세요</i> 만 뜬다.
 *
 * <p><b>그것을 잡아 줄 것이 아무것도 없었다.</b> 이 프로젝트에는 컨트롤러를 HTTP 로 부르는
 * 검사가 없고(단위 검사뿐이다), 단위 검사는 레코드를 <b>손으로 만들어</b> 넘기므로 이름이
 * 어긋난 사실을 볼 수 없다. 어긋남은 <b>몸통이 레코드로 바뀌는 그 한 지점</b>에만 있고,
 * 이 파일이 재는 것이 정확히 그 지점이다.
 */
class SampleActionWireTest {

    /**
     * 스프링이 만드는 것과 <b>같은 기본값</b>이어야 한다.
     *
     * <p>{@code targets} 처럼 <b>서버가 선언하지 않은 칸</b>이 몸통에 실려 오므로, 모르는
     * 칸에서 죽는 설정이면 재계산이 400 이 된다 — 그 기본값이 이 검사의 전제이며 여기서
     * 함께 잰다({@link #recalcWireBinds}).
     */
    private static final ObjectMapper JSON = JsonMapper.builder().build();

    private static final Validator VALIDATOR;

    static {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            VALIDATOR = factory.getValidator();
        }
    }

    /** 확정 — {@code target:'selected'} · {@code toTargets} 가 id 배열을 만든다. */
    @Test
    void confirmWireBinds() {
        String wire = """
                {"targets":["1","2"]}""";

        SampleConfirmRequest request = JSON.readValue(wire, SampleConfirmRequest.class);

        assertThat(request.targets()).containsExactly("1", "2");
        assertThat(violations(request)).isEmpty();
    }

    /**
     * 재계산 — {@code target:'none'} 이라 {@code targets} 는 <b>빈 배열</b>로 오고, 값은
     * {@code params} 아래에 있다.
     *
     * <p>서버가 {@code targets} 를 선언하지 않는다는 것까지 이 한 줄이 잰다 — 모르는 칸이
     * 실려 있어도 <b>바인딩이 성립해야</b> 한다.
     */
    @Test
    void recalcWireBinds() {
        String wire = """
                {"targets":[],"params":{"baseDt":"2026-12-31","vatRate":0.1}}""";

        SampleRecalcRequest request = JSON.readValue(wire, SampleRecalcRequest.class);

        assertThat(request.params().baseDt()).isEqualTo(LocalDate.of(2026, 12, 31));
        assertThat(request.params().vatRate()).isEqualByComparingTo("0.1");
        assertThat(violations(request)).isEmpty();
    }

    /*
      <b>봉투를 편 몸통은 통과하면 안 된다.</b> 이것이 고치기 전의 모양이며, 여기서 값이
      채워지면 <i>서버가 두 모양을 다 받는다</i> 는 뜻이라 어느 쪽이 계약인지 아무도 모르게
      된다.
    */
    @Test
    void flatBodyIsRejected() {
        String wire = """
                {"baseDt":"2026-12-31","vatRate":0.1}""";

        SampleRecalcRequest request = JSON.readValue(wire, SampleRecalcRequest.class);

        assertThat(request.params()).isNull();
        assertThat(violations(request)).hasSize(1);
    }

    /*
      <b>중첩 제약이 실제로 검사되는가</b> — {@code @Valid} 를 빠뜨리면 세율 상한이 조용히
      사라지고, 사람이 10 을 <i>10%</i> 로 읽고 친 그 값이 전량에 반영된다.
    */
    @Test
    void nestedVatRateBoundIsChecked() {
        SampleRecalcRequest request = new SampleRecalcRequest(
                new SampleRecalcRequest.Params(LocalDate.of(2026, 12, 31), new BigDecimal("10")));

        assertThat(violations(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactly("params.vatRate");
    }

    /**
     * 출고 지시 — ③의 실행. <b>①과 같은 어긋남이 여기 남아 있었다.</b>
     *
     * <p>{@code ordIds} 로 받고 있었고, 화면은 {@code toTargets} 로
     * {@code {ordIds: [...]}} 를 만들어 <b>봉투 안에</b> 넣었다 — 서버가 보는 몸통은
     * {@code {"targets":{"ordIds":[…]}}} 이므로 그 칸은 {@code null} 이고 {@code @NotEmpty} 가
     * <b>400</b> 을 낸다. ①을 고친 날(2026-09-02) 이 화면은 빠져 있었다.
     */
    @Test
    void shipWireBinds() {
        String wire = """
                {"targets":["1","2"]}""";

        SampleShipRequest request = JSON.readValue(wire, SampleShipRequest.class);

        assertThat(request.targets()).containsExactly("1", "2");
        assertThat(violations(request)).isEmpty();
    }

    /**
     * 품목 금액 재계산 — ③의 <b>행×디테일</b> 실행(backend/crosscutting.md · playbook/INDEX.md).
     *
     * <p>{@code target:'selected'} 이고 {@code params} 가 없다 — 다시 세는 기준은 품목이
     * 이미 들고 있는 수량과 단가이므로 사람이 줄 값이 없다. 봉투에는 {@code params} 가
     * {@code null} 로 실려 오며, <b>서버가 선언하지 않은 칸이 있어도 바인딩이 성립해야</b>
     * 한다.
     */
    @Test
    void recalcItemsWireBinds() {
        String wire = """
                {"targets":["1005","1009"],"params":null}""";

        SampleItemRecalcRequest request = JSON.readValue(wire, SampleItemRecalcRequest.class);

        assertThat(request.targets()).containsExactly("1005", "1009");
        assertThat(violations(request)).isEmpty();
    }

    /*
      <b>대상 없는 실행은 서버가 막는다.</b> 화면은 0건에서 버튼을 끄지만 그것이 서버의
      방어는 아니며, 막지 않으면 <b>전건을 도는 작업</b>이 아니라 <i>아무것도 하지 않고
      DONE 이 되는 작업</i>이 열린다 — 사용자는 그것을 성공으로 본다.
    */
    @Test
    void recalcItemsRejectsEmptySelection() {
        String wire = """
                {"targets":[],"params":null}""";

        SampleItemRecalcRequest request = JSON.readValue(wire, SampleItemRecalcRequest.class);

        assertThat(violations(request)).hasSize(1);
    }

    private static <T> Set<ConstraintViolation<T>> violations(T target) {
        return VALIDATOR.validate(target);
    }
}
