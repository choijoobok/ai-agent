package com.aiagent.core.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 기간 문지기 — screen/log/access/requirements.md. <b>이력 화면 셋이 공유한다.</b>
 *
 * <p>여기서 지키는 것은 <i>막았는가</i> 만이 아니라 <b>무엇으로 막았는가</b> 다. 화면마다
 * {@link ErrorCode} 가 다르고(상한과 보존이 다르므로 문구가 다르다) 그것이 섞이면
 * <b>사용자가 어느 화면의 숫자를 듣는지 알 수 없다</b>.
 */
class RangeGuardTest {

    private enum Code implements ErrorCode {
        REQUIRED("err.test.required"),
        TOO_WIDE("err.test.too-wide");

        private final String code;

        Code(String code) {
            this.code = code;
        }

        @Override
        public String code() {
            return code;
        }

        @Override
        public ErrorType type() {
            return ErrorType.INVALID_REQUEST;
        }

        @Override
        public String defaultMessage() {
            return code;
        }
    }

    private static final RangeGuard.Rule RULE =
            new RangeGuard.Rule("creDtm", "traceId", 31, Code.REQUIRED, Code.TOO_WIDE);

    private static SearchRequest<Void> request(Condition... conditions) {
        return new SearchRequest<>(List.of(conditions), List.of(), null, null);
    }

    private static Condition range(String from, String to) {
        return new Condition("creDtm", Op.between, java.util.Arrays.asList(from, to));
    }

    @Nested
    @DisplayName("기간은 필수다")
    class Required {

        @Test
        @DisplayName("조건이 하나도 없으면 거부한다 — 조건 없는 첫 조회가 보존 기간 전량을 향한다")
        void 빈_요청은_거부() {
            assertThatThrownBy(() -> RangeGuard.check(request(), RULE))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(Code.REQUIRED);
        }

        @Test
        @DisplayName("다른 조건만 있어도 거부한다 — 좁아 보이는 것과 인덱스를 타는 것은 다르다")
        void 다른_조건만으로는_통과하지_못한다() {
            Condition userId = new Condition("userId", Op.eq, "admin");

            assertThatThrownBy(() -> RangeGuard.check(request(userId), RULE))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("추적 ID 를 넣으면 기간이 선택이 된다 — TRACE_ID 에 별도 인덱스가 있다(sys/logs.md)")
        void 추적ID_는_기간을_면제한다() {
            Condition trace = new Condition("traceId", Op.eq, "abc");

            assertThatCode(() -> RangeGuard.check(request(trace), RULE)).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("면제 필드가 없는 규칙에서는 아무것도 면제되지 않는다")
        void 면제_필드가_없으면_면제도_없다() {
            RangeGuard.Rule strict =
                    new RangeGuard.Rule("creDtm", null, 31, Code.REQUIRED, Code.TOO_WIDE);
            Condition trace = new Condition("traceId", Op.eq, "abc");

            assertThatThrownBy(() -> RangeGuard.check(request(trace), strict))
                    .isInstanceOf(BusinessException.class);
        }
    }

    @Nested
    @DisplayName("상한이 있다")
    class Width {

        @Test
        @DisplayName("상한 안이면 통과한다")
        void 좁은_기간은_통과() {
            assertThatCode(() -> RangeGuard.check(
                            request(range("2026-08-01T00:00:00Z", "2026-08-08T00:00:00Z")), RULE))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("상한을 넘으면 거부한다 — 조용히 자르면 좁은 기간을 봤다고 믿은 채 넓은 결론을 낸다")
        void 넓은_기간은_거부() {
            assertThatThrownBy(() -> RangeGuard.check(
                            request(range("2026-06-01T00:00:00Z", "2026-08-08T00:00:00Z")), RULE))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(Code.TOO_WIDE);
        }

        @Test
        @DisplayName("정확히 상한이면 통과한다 — 경계는 여는 쪽이다")
        void 경계는_통과() {
            assertThatCode(() -> RangeGuard.check(
                            request(range("2026-07-08T00:00:00Z", "2026-08-08T00:00:00Z")), RULE))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("한쪽이 열린 범위는 상한 초과로 본다 — 열린 쪽이 곧 무제한이다(backend/api.md)")
        void 단측_범위는_거부() {
            assertThatThrownBy(() -> RangeGuard.check(
                            request(range("2026-08-01T00:00:00Z", null)), RULE))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(Code.TOO_WIDE);
        }

        @Test
        @DisplayName("오프셋이 붙은 값도 읽는다 — 화면이 보내는 것은 +09:00 이다(backend/packages.md)")
        void 오프셋_값도_읽는다() {
            assertThatCode(() -> RangeGuard.check(
                            request(range("2026-08-01T00:00:00+09:00", "2026-08-08T00:00:00+09:00")),
                            RULE))
                    .doesNotThrowAnyException();
        }
    }

    @Test
    @DisplayName("기간 조건이 between 이 아니면 없는 것이다 — 한 점을 물어도 창은 열려 있다")
    void between_이_아니면_기간이_아니다() {
        Condition point = new Condition("creDtm", Op.gte, "2026-08-01T00:00:00Z");

        assertThatThrownBy(() -> RangeGuard.check(request(point), RULE))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(Code.REQUIRED);
    }

    @Test
    @DisplayName("문구에 상한 일수가 실린다 — 로그가 어느 화면의 거부인지 말한다")
    void 문구가_상한을_말한다() {
        assertThatThrownBy(() -> RangeGuard.check(
                        request(range("2026-01-01T00:00:00Z", "2026-08-08T00:00:00Z")), RULE))
                .hasMessageContaining("31");

        assertThat(RULE.maxDays()).isEqualTo(31);
    }
}
