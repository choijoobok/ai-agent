package com.aiagent.domain.sample;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.RowReport;
import com.aiagent.core.grid.RowState;
import com.aiagent.domain.sample.entity.SmplOrder;
import com.aiagent.domain.sample.repository.SmplOrderRepository;
import com.aiagent.domain.sample.repository.SmplOrderTagRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 주문의 저장과 실행 — playbook/INDEX.md.
 *
 * <p>여기서 세는 것은 <b>화면이 이미 막은 것을 서버가 다시 막는가</b> 다. 화면의 게이트는
 * UX 이고 판정은 서버여야 하는데(backend/security.md), 그 이중 방어는 <b>둘 중 하나가 빠져도 평소에는
 * 아무 증상이 없다</b> — 드러나는 것은 화면 밖 경로가 지나간 뒤다.
 *
 * <p>품목과 태그의 행 편집은 서비스가 갈렸으므로 검사도 갈렸다 —
 * {@link SampleItemServiceTest} · {@link SampleTagServiceTest}.
 */
class SampleOrderServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-02T00:00:00Z");

    private final SmplOrderRepository orders = mock(SmplOrderRepository.class);
    private final SmplOrderTagRepository tags = mock(SmplOrderTagRepository.class);
    private final SampleQueryService queries = mock(SampleQueryService.class);

    /**
     * <b>러너는 진짜다.</b> 건별 커밋의 본문이 거기 있어(backend/row-transaction.md §4) 목으로 두면
     * <i>몇 건이 됐나</i> 만 남고 <b>무엇이 쓰였나</b> 가 사라진다 — 태그 상한 검사가
     * 보는 것이 바로 그 쓰기다.
     */
    private final SampleOrderRowRunner runner =
            new SampleOrderRowRunner(orders, tags, queries, Clock.fixed(NOW, ZoneOffset.UTC));

    private final SampleOrderService service =
            new SampleOrderService(orders, queries, runner, Clock.fixed(NOW, ZoneOffset.UTC));

    static SmplOrder order(String ordNo, String stat) {
        return SmplOrder.create(
                ordNo, "이름", "C001", "고객", stat, "WEB", "NORMAL", LocalDate.of(2026, 9, 1), NOW);
    }

    private static SmplOrderSaveRow delete(String ordId) {
        return new SmplOrderSaveRow(
                RowState.D, ordId, null, null, null, null, null, null, null, null, null, null, null);
    }

    /** ①의 수정 한 행 — 태그 개수만 갈아 가며 쓴다. */
    private static SmplOrderFullSaveRow update(String ordId, int tagCount) {
        List<SmplOrderTagRow> tagList = new ArrayList<>();
        for (int index = 0; index < tagCount; index++) {
            tagList.add(new SmplOrderTagRow("태그" + index, "GEN"));
        }
        return new SmplOrderFullSaveRow(
                RowState.U,
                ordId,
                "SO-" + ordId,
                "이름",
                "C001",
                "고객",
                "VIP",
                "RCV",
                "WEB",
                "NORMAL",
                LocalDate.of(2026, 9, 1),
                "202609",
                1,
                new BigDecimal("1000.00"),
                BigDecimal.ZERO,
                false,
                true,
                tagList,
                null,
                null);
    }

    @Nested
    @DisplayName("마스터 삭제 게이트 — frontend/grid.md")
    class DeleteGate {

        /*
          <b>화면이 이미 막았는데 왜 또 보는가.</b> 화면 밖 경로가 실재하고(직접 호출),
          그때 FK 의 RESTRICT 는 <i>제약 위반</i> 이라는 <b>읽을 수 없는 문구</b>로만
          답한다(playbook/INDEX.md) — 사용자에게 그것은 원인도 다음 행동도 말하지 않는다.

          그리고 화면의 itemCnt 는 <b>조회 시점의 값</b>이다: 고른 뒤 남이 품목을 넣었으면
          그 게이트는 낡았다.
        */
        @Test
        @DisplayName("품목이 있으면 거부한다 — FK 가 읽을 수 없는 문구로 답하기 전에")
        void rejectsWhenItemsRemain() {
            SmplOrder target = order("SO-1", "RCV");
            when(queries.require(1L)).thenReturn(target);
            // 채번 전이라 ordId 가 null 이다 — anyLong() 은 null 을 잡지 못한다.
            when(queries.itemCount(any())).thenReturn(3L);

            assertThatThrownBy(() -> service.saveOrders(List.of(delete("1"))))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("SO-1");

            verify(orders, never()).delete(target);
        }

        @Test
        @DisplayName("품목이 없으면 지운다 — 물리 삭제다(playbook/INDEX.md)")
        void deletesWhenEmpty() {
            SmplOrder target = order("SO-2", "RCV");
            when(queries.require(2L)).thenReturn(target);
            when(queries.itemCount(any())).thenReturn(0L);

            service.saveOrders(List.of(delete("2")));

            verify(orders).delete(target);
        }
    }

    @Nested
    @DisplayName("출고 지시 — playbook/INDEX.md")
    class Ship {

        /*
          <b>하나라도 안 되면 전부 거부한다.</b> 일부만 나가면 사용자는 <i>무엇이 나갔나</i>
          를 다시 조회해 세야 하고, 그 확인은 실행 화면이 답해야 할 것이다.
        */
        @Test
        @DisplayName("확정 아닌 것이 섞이면 전부 거부한다 — 일부만 나가면 무엇이 나갔는지 모른다")
        void rejectsMixedSelection() {
            when(orders.findByOrdIdIn(List.of(1L, 2L)))
                    .thenReturn(List.of(order("SO-1", "CFM"), order("SO-2", "RCV")));

            assertThatThrownBy(() -> service.ship(List.of(1L, 2L)))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("SO-2");
        }

        @Test
        @DisplayName("확정만 있으면 전부 출고로 간다")
        void shipsConfirmed() {
            List<SmplOrder> targets = List.of(order("SO-1", "CFM"), order("SO-2", "CFM"));
            when(orders.findByOrdIdIn(List.of(1L, 2L))).thenReturn(targets);

            assertThat(service.ship(List.of(1L, 2L))).isEqualTo(2);
            assertThat(targets).allMatch(order -> "SHP".equals(order.getOrdStatCd()));
        }

        /*
          <b>고른 뒤 남이 지웠다.</b> 조회된 것이 고른 것보다 적으면 그 차이를 조용히
          넘기지 않는다 — 넘기면 <i>3건을 실행합니다</i> 라고 묻고 2건이 나간다.
        */
        @Test
        @DisplayName("사라진 주문이 섞이면 거부한다 — 건수가 어긋난 채로 실행하지 않는다")
        void rejectsMissing() {
            when(orders.findByOrdIdIn(List.of(1L, 9L))).thenReturn(List.of(order("SO-1", "CFM")));

            assertThatThrownBy(() -> service.ship(List.of(1L, 9L)))
                    .isInstanceOf(BusinessException.class);
        }
    }

    /**
     * 태그 개수 상한 — playbook/INDEX.md 의 결정. <b>화면 둘이 한 값을 본다</b>({@code MAX_TAGS}).
     *
     * <p>여기는 ①의 <b>배열 교체</b> 쪽이다. ⑤의 행 편집은 {@link SampleTagServiceTest} 가
     * 세며, <b>둘이 같은 값을 보는지</b>가 이 상수를 {@link SampleRules} 에 둔 이유다 —
     * 갈라 두면 ⑤에서 스물한 개를 만들 수 있고 그러면 <b>①이 그 주문을 저장할 수 없다</b>.
     *
     * <p><b>쓰기 전에 막는지도 함께 본다.</b> 거부되는 요청이 쓰기를 한 번 내고 돌아가면
     * 롤백해도 시퀀스는 뛴다 — 그래서 지우기가 나가지 않았음을 확인한다.
     */
    @Nested
    @DisplayName("태그 개수 상한 — ①의 배열 교체(playbook/INDEX.md)")
    class TagLimit {

        @Test
        @DisplayName("상한까지는 저장한다 — 경계가 맞는 방향으로 선다")
        void acceptsUpToLimit() {
            when(queries.require(1L)).thenReturn(order("SO-1", "RCV"));

            assertThat(service.saveFullOrders(List.of(update("1", SampleRules.MAX_TAGS))).done())
                    .isEqualTo(1);

            verify(tags).saveAll(any());
        }

        /** <b>던지지 않는다.</b> 건별은 실패를 <i>결과</i> 로 답한다(backend/row-transaction.md §4). */
        @Test
        @DisplayName("하나 넘으면 그 행만 실패하고 — 지우기가 나가지 않는다")
        void rejectsOverLimitBeforeWriting() {
            when(queries.require(1L)).thenReturn(order("SO-1", "RCV"));

            RowReport report = service.saveFullOrders(List.of(update("1", SampleRules.MAX_TAGS + 1)));

            assertThat(report.failed()).isEqualTo(1);
            assertThat(report.rows().getFirst().fields().getFirst().field()).isEqualTo("tagList");
            verify(tags, never()).deleteByOrdId(any());
            verify(tags, never()).saveAll(any());
        }
    }

    /**
     * 건별 커밋 — backend/row-transaction.md §4 · screen/sample/single-offset/requirements.md §6-1.
     *
     * <p>여기서 세는 것은 <b>실패한 행이 나머지를 데려가지 않는가</b> 다. 예전에는 스물 중
     * 하나가 걸리면 <b>스물 전부가 거절</b>됐고, 그러면 사용자는 고칠 것 하나를 찾으려고
     * 스물을 다시 훑었다.
     *
     * <p><b>사유가 어느 칸을 짚는지도 함께 센다</b>(§6-2). 순번만 돌려주면 화면은 붉힐 셀도
     * 표에 적을 줄도 없어 <b>빈 표</b>를 띄운다 — 그때 게이트는 초록이다.
     */
    @Nested
    @DisplayName("건별 커밋 — 실패한 행만 되돌아간다")
    class PerRow {

        @Test
        @DisplayName("확정 — 접수 아닌 것이 섞여도 나머지는 확정된다")
        void confirmsTheRest() {
            SmplOrder rcv1 = order("SO-1", "RCV");
            SmplOrder cfm = order("SO-2", "CFM");
            SmplOrder rcv2 = order("SO-3", "RCV");
            when(orders.findById(1L)).thenReturn(Optional.of(rcv1));
            when(orders.findById(2L)).thenReturn(Optional.of(cfm));
            when(orders.findById(3L)).thenReturn(Optional.of(rcv2));

            RowReport report = service.confirm(List.of(1L, 2L, 3L));

            assertThat(report.total()).isEqualTo(3);
            assertThat(report.done()).isEqualTo(2);
            assertThat(report.failed()).isEqualTo(1);
            assertThat(rcv1.getOrdStatCd()).isEqualTo("CFM");
            assertThat(rcv2.getOrdStatCd()).isEqualTo("CFM");
        }

        /** 순번은 <b>요청 배열의 것</b>이다 — 서버는 그 순서를 바꾸지 않는다. */
        @Test
        @DisplayName("확정 — 실패한 행의 순번이 요청 배열의 자리다")
        void keepsRequestOrder() {
            when(orders.findById(1L)).thenReturn(Optional.of(order("SO-1", "CFM")));
            when(orders.findById(2L)).thenReturn(Optional.of(order("SO-2", "RCV")));

            RowReport report = service.confirm(List.of(1L, 2L));

            assertThat(report.rows().getFirst().index()).isZero();
        }

        /** 확정 불가의 이유는 <b>상태</b>다 — 그 칸이 붉어져야 사용자가 무엇을 볼지 안다. */
        @Test
        @DisplayName("확정 — 접수가 아니면 주문 상태 칸을 짚는다")
        void pointsAtStatus() {
            when(orders.findById(1L)).thenReturn(Optional.of(order("SO-1", "DON")));

            RowReport report = service.confirm(List.of(1L));

            BusinessException.FieldError field = report.rows().getFirst().fields().getFirst();
            assertThat(field.field()).isEqualTo("ordStatCd");
            assertThat(field.message()).contains("접수");
            assertThat(field.value()).isEqualTo("DON");
        }

        /**
         * <b>잠금도 상태 칸이 받는다.</b> {@code LOCK_YN} 은 화면에서 {@code hidden} 이라
         * 칠할 칸이 없다 — 없는 칸을 가리키면 표의 줄만 남고 붉은 셀이 서지 않는다.
         */
        @Test
        @DisplayName("확정 — 잠긴 주문도 상태 칸을 짚고 사유만 갈린다")
        void lockedPointsAtStatusToo() {
            SmplOrder locked = mock(SmplOrder.class);
            when(locked.confirmable()).thenReturn(false);
            when(locked.getLockYn()).thenReturn(Boolean.TRUE);
            when(locked.getOrdStatCd()).thenReturn("RCV");
            when(orders.findById(1L)).thenReturn(Optional.of(locked));

            RowReport report = service.confirm(List.of(1L));

            BusinessException.FieldError field = report.rows().getFirst().fields().getFirst();
            assertThat(field.field()).isEqualTo("ordStatCd");
            assertThat(field.message()).contains("잠긴");
        }

        /** 그 사이 남이 지웠다 — <b>식별자가 사라진 것</b>이라 주문번호 칸이 받는다. */
        @Test
        @DisplayName("확정 — 없어진 주문은 주문번호 칸을 짚는다")
        void missingPointsAtOrdNo() {
            when(orders.findById(1L)).thenReturn(Optional.of(order("SO-1", "RCV")));
            when(orders.findById(9L)).thenReturn(Optional.empty());

            RowReport report = service.confirm(List.of(1L, 9L));

            assertThat(report.done()).isEqualTo(1);
            assertThat(report.rows().getFirst().fields().getFirst().field()).isEqualTo("ordNo");
        }

        /**
         * <b>검증이 채번보다 앞이다</b>(§6-1). 통과하지 못한 행이 번호를 먹으면 그 번호는
         * 아무 주문도 갖지 못한 채 버려진다 — 구멍은 감수하는 것이지 만들 이유가 없다.
         */
        @Test
        @DisplayName("저장 — 검증에서 걸린 행은 쓰기까지 가지 않는다")
        void validationComesBeforeWriting() {
            when(queries.require(1L)).thenReturn(order("SO-1", "RCV"));

            RowReport report = service.saveFullOrders(
                    List.of(update("1", SampleRules.MAX_TAGS + 1), update("1", 1)));

            // 첫 행은 태그 상한, 둘째 행은 같은 주문이 두 번 — 둘 다 쓰기 앞에서 걸린다.
            assertThat(report.failed()).isEqualTo(2);
            verify(tags, never()).saveAll(any());
        }

        /**
         * <b>요청 안의 중복은 바깥이 본다.</b> 러너는 행 하나만 알고 있어 <i>같은 주문이 두 번
         * 왔다</i> 를 판정할 수 없다 — 그 사실은 배열이 갖는다.
         */
        @Test
        @DisplayName("저장 — 같은 주문이 두 번 오면 뒤엣것만 실패한다")
        void duplicateFailsOnlyTheSecond() {
            when(queries.require(1L)).thenReturn(order("SO-1", "RCV"));

            RowReport report = service.saveFullOrders(List.of(update("1", 1), update("1", 1)));

            assertThat(report.done()).isEqualTo(1);
            assertThat(report.rows().getFirst().index()).isEqualTo(1);
            assertThat(report.rows().getFirst().fields().getFirst().field()).isEqualTo("ordNo");
        }

        /** 전건이 실패해도 <b>던지지 않는다</b> — 사용자가 할 일이 같다(표를 보고 고쳐 다시 낸다). */
        @Test
        @DisplayName("확정 — 전건이 실패해도 결과로 답한다")
        void allFailedIsStillAReport() {
            when(orders.findById(1L)).thenReturn(Optional.of(order("SO-1", "DON")));
            when(orders.findById(2L)).thenReturn(Optional.of(order("SO-2", "SHP")));

            RowReport report = service.confirm(List.of(1L, 2L));

            assertThat(report.done()).isZero();
            assertThat(report.failed()).isEqualTo(2);
        }

        /**
         * <b>업무 예외가 아닌 것은 잡지 않는다.</b> 그것은 그 행이 틀린 것이 아니라 시스템이
         * 고장 난 것이고, 고장 난 채로 남은 행을 계속 미는 것은 손해를 키운다.
         */
        @Test
        @DisplayName("확정 — 시스템 오류는 그대로 올라간다")
        void systemFailureIsNotARowFailure() {
            when(orders.findById(1L)).thenReturn(Optional.of(order("SO-1", "RCV")));
            when(orders.findById(2L)).thenThrow(new IllegalStateException("connection lost"));

            assertThatThrownBy(() -> service.confirm(List.of(1L, 2L)))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    /**
     * 금액은 <b>서버가 다시 센다</b> — frontend/grid.md · 원칙 P1.
     *
     * <p>화면도 {@code afterEdit} 으로 같은 계산을 하지만 그것은 <i>보여주기</i> 이고,
     * 요청 본문은 조작할 수 있다. 받는 경로를 두지 않은 것과 여기서 다시 세는 것이 한 짝이다.
     */
    @Test
    @DisplayName("금액과 부가세를 서버가 계산한다 — 화면이 보낸 값을 쓰지 않는다")
    void recalculatesAmounts() {
        SmplOrder order = order("SO-1", "RCV");

        order.modify(
                "이름", "C001", "고객", "RCV", LocalDate.of(2026, 9, 1),
                3, new BigDecimal("1000.00"), BigDecimal.ZERO, false, true);

        assertThat(order.getOrdAmt()).isEqualByComparingTo("3000.00");
        assertThat(order.getVatAmt()).isEqualByComparingTo("300.00");
    }
}
