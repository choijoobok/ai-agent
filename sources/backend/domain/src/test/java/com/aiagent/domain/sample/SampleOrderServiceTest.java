package com.aiagent.domain.sample;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 주문의 저장과 실행 — 68 §3 · §5.4.
 *
 * <p>여기서 세는 것은 <b>화면이 이미 막은 것을 서버가 다시 막는가</b> 다. 화면의 게이트는
 * UX 이고 판정은 서버여야 하는데(security-design.md §4), 그 이중 방어는 <b>둘 중 하나가 빠져도 평소에는
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

    private final SampleOrderService service =
            new SampleOrderService(orders, tags, queries, Clock.fixed(NOW, ZoneOffset.UTC));

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
    @DisplayName("마스터 삭제 게이트 — grid-standard.md §6.2")
    class DeleteGate {

        /*
          <b>화면이 이미 막았는데 왜 또 보는가.</b> 화면 밖 경로가 실재하고(직접 호출),
          그때 FK 의 RESTRICT 는 <i>제약 위반</i> 이라는 <b>읽을 수 없는 문구</b>로만
          답한다(48 §5.1) — 사용자에게 그것은 원인도 다음 행동도 말하지 않는다.

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
        @DisplayName("품목이 없으면 지운다 — 물리 삭제다(48 §3.4)")
        void deletesWhenEmpty() {
            SmplOrder target = order("SO-2", "RCV");
            when(queries.require(2L)).thenReturn(target);
            when(queries.itemCount(any())).thenReturn(0L);

            service.saveOrders(List.of(delete("2")));

            verify(orders).delete(target);
        }
    }

    @Nested
    @DisplayName("출고 지시 — 68 §5.4")
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
     * 태그 개수 상한 — 48 §8 의 결정. <b>화면 둘이 한 값을 본다</b>({@code MAX_TAGS}).
     *
     * <p>여기는 ①의 <b>배열 교체</b> 쪽이다. ⑤의 행 편집은 {@link SampleTagServiceTest} 가
     * 세며, <b>둘이 같은 값을 보는지</b>가 이 상수를 {@link SampleRules} 에 둔 이유다 —
     * 갈라 두면 ⑤에서 스물한 개를 만들 수 있고 그러면 <b>①이 그 주문을 저장할 수 없다</b>.
     *
     * <p><b>쓰기 전에 막는지도 함께 본다.</b> 거부되는 요청이 쓰기를 한 번 내고 돌아가면
     * 롤백해도 시퀀스는 뛴다 — 그래서 지우기가 나가지 않았음을 확인한다.
     */
    @Nested
    @DisplayName("태그 개수 상한 — ①의 배열 교체(48 §8)")
    class TagLimit {

        @Test
        @DisplayName("상한까지는 저장한다 — 경계가 맞는 방향으로 선다")
        void acceptsUpToLimit() {
            when(queries.require(1L)).thenReturn(order("SO-1", "RCV"));

            service.saveFullOrders(List.of(update("1", SampleRules.MAX_TAGS)));

            verify(tags).saveAll(any());
        }

        @Test
        @DisplayName("하나 넘으면 거부하고 — 지우기가 나가지 않는다")
        void rejectsOverLimitBeforeWriting() {
            when(queries.require(1L)).thenReturn(order("SO-1", "RCV"));

            assertThatThrownBy(() ->
                            service.saveFullOrders(List.of(update("1", SampleRules.MAX_TAGS + 1))))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("too many tags");

            verify(tags, never()).deleteByOrdId(any());
            verify(tags, never()).saveAll(any());
        }
    }

    /**
     * 금액은 <b>서버가 다시 센다</b> — grid-edit-validation.md §2.3 · 원칙 P1.
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
