package com.aiagent.core.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 목록 처리의 <b>두 끝맺음</b> — aidd-guide/standard/backend/row-transaction.md.
 *
 * <p>여기서 재는 것은 <b>루프와 끝맺음</b>이다. 트랜잭션이 실제로 행마다 커밋되는지는 이
 * 클래스가 열지 않으므로 여기서 잴 수 없고, <b>{@code @Transactional} 이 제자리에 있는지를
 * {@code RowTxConventionTest} 가</b> 잰다. 둘이 합쳐져야 이름이 참이 된다.
 */
class RowTxTest {

    private enum Code implements ErrorCode {
        FIRST,
        SECOND;

        @Override
        public String code() {
            return "err.test." + name().toLowerCase();
        }

        @Override
        public String defaultMessage() {
            return name();
        }

        @Override
        public ErrorType type() {
            return ErrorType.INVALID_REQUEST;
        }
    }

    private static BusinessException reject(Code code, String value) {
        return new BusinessException(
                code,
                code.name(),
                List.of(new BusinessException.FieldError("cd", "안 됩니다", value)));
    }

    /** {@code a} · {@code b} · {@code c} — 가운데가 실패하는 목록이 두 모양의 시험지다. */
    private static final List<String> ROWS = List.of("a", "b", "c");

    private static void failOnB(String row) {
        if ("b".equals(row)) throw reject(Code.FIRST, row);
    }

    @Nested
    @DisplayName("oneTxForAll — 전체에 트랜잭션 하나")
    class OneTxForAll {

        @Test
        @DisplayName("실패가 없으면 조용히 끝난다")
        void staysSilentWhenNothingFails() {
            List<String> touched = new ArrayList<>();
            RowTx.oneTxForAll(ROWS, touched::add);

            assertThat(touched).containsExactly("a", "b", "c");
        }

        /**
         * <b>실패한 행에서 멈추지 않는다.</b> 멈추면 사용자가 저장을 N 번 눌러 오류를 하나씩
         * 발견하고 <i>고칠 것이 몇 개인지</i> 를 끝까지 모른다.
         */
        @Test
        @DisplayName("실패해도 끝까지 돌고 한 번 던진다")
        void keepsGoingAndThrowsOnce() {
            List<String> touched = new ArrayList<>();
            BusinessException thrown = catchThrowableOfType(
                    BusinessException.class,
                    () -> RowTx.oneTxForAll(ROWS, row -> {
                        touched.add(row);
                        failOnB(row);
                    }));

            assertThat(touched).containsExactly("a", "b", "c");
            assertThat(thrown.rowErrors()).hasSize(1);
        }

        /** 화면은 이 순번으로 셀을 붉힌다 — 틀리면 <b>남의 행</b>이 붉어진다. */
        @Test
        @DisplayName("순번은 요청 배열의 것이다")
        void pointsAtTheRequestIndex() {
            BusinessException thrown = catchThrowableOfType(
                    BusinessException.class, () -> RowTx.oneTxForAll(ROWS, RowTxTest::failOnB));

            assertThat(thrown.rowErrors().getFirst().index()).isEqualTo(1);
            assertThat(thrown.rowErrors().getFirst().fields())
                    .extracting(BusinessException.FieldError::value)
                    .containsExactly("b");
        }

        /** 봉투의 {@code code} 는 하나뿐이라 <b>사용자가 처음 만나는 것</b>을 고른다. */
        @Test
        @DisplayName("맨 앞 실패의 코드와 문구가 봉투의 것이 된다")
        void carriesTheFirstFailure() {
            BusinessException thrown = catchThrowableOfType(
                    BusinessException.class,
                    () -> RowTx.oneTxForAll(ROWS, row -> {
                        if ("b".equals(row)) throw reject(Code.FIRST, row);
                        if ("c".equals(row)) throw reject(Code.SECOND, row);
                    }));

            assertThat(thrown.errorCode()).isEqualTo(Code.FIRST);
            assertThat(thrown.getMessage()).isEqualTo("FIRST");
            assertThat(thrown.rowErrors()).hasSize(2);
        }

        @Test
        @DisplayName("업무 예외가 아닌 것은 그대로 올라간다 — 고장은 행의 실패가 아니다")
        void letsUnexpectedFailuresThrough() {
            assertThatThrownBy(() -> RowTx.oneTxForAll(ROWS, row -> {
                        if ("b".equals(row)) throw new IllegalStateException("고장");
                    }))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("oneTxPerRow — 행마다 트랜잭션 하나")
    class OneTxPerRow {

        /**
         * <b>이것이 부분 커밋의 요점이다.</b> 던지면 490건이 성공한 실행도 화면에서
         * <i>실패</i> 로 읽힌다 — 응답이 오류 봉투이기 때문이다.
         */
        @Test
        @DisplayName("실패가 있어도 던지지 않고 돌려준다")
        void reportsInsteadOfThrowing() {
            RowReport report = RowTx.oneTxPerRow(ROWS, RowTxTest::failOnB);

            assertThat(report.total()).isEqualTo(3);
            assertThat(report.done()).isEqualTo(2);
            assertThat(report.failed()).isEqualTo(1);
            assertThat(report.rows()).extracting(BusinessException.RowError::index).containsExactly(1);
        }

        @Test
        @DisplayName("전건이 성공하면 실패 목록이 비고 allDone 이 참이다")
        void tellsWhenEverythingWorked() {
            RowReport report = RowTx.oneTxPerRow(ROWS, row -> {});

            assertThat(report.allDone()).isTrue();
            assertThat(report.done()).isEqualTo(3);
        }

        /** 전건 실패도 <b>같은 모양</b>이다 — 화면이 할 일이 같으므로 경로를 가르지 않는다. */
        @Test
        @DisplayName("전건이 실패해도 던지지 않는다")
        void reportsEvenWhenNothingWorked() {
            RowReport report = RowTx.oneTxPerRow(ROWS, row -> {
                throw reject(Code.FIRST, row);
            });

            assertThat(report.done()).isZero();
            assertThat(report.failed()).isEqualTo(3);
            assertThat(report.allDone()).isFalse();
        }

        @Test
        @DisplayName("업무 예외가 아닌 것은 남은 행을 밀지 않고 올라간다")
        void stopsOnUnexpectedFailures() {
            List<String> touched = new ArrayList<>();

            assertThatThrownBy(() -> RowTx.oneTxPerRow(ROWS, row -> {
                        touched.add(row);
                        if ("b".equals(row)) throw new IllegalStateException("고장");
                    }))
                    .isInstanceOf(IllegalStateException.class);

            assertThat(touched).containsExactly("a", "b");
        }

        @Test
        @DisplayName("빈 목록은 전건 성공이다 — 0/0 이 실패로 읽히지 않게")
        void treatsAnEmptyListAsDone() {
            RowReport report = RowTx.oneTxPerRow(List.<String>of(), row -> {});

            assertThat(report.total()).isZero();
            assertThat(report.allDone()).isTrue();
        }
    }
}
