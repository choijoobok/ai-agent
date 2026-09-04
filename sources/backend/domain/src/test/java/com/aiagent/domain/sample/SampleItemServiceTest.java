package com.aiagent.domain.sample;

import static com.aiagent.domain.sample.SampleOrderServiceTest.order;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.progress.Progress;
import com.aiagent.domain.sample.entity.SmplOrder;
import com.aiagent.domain.sample.entity.SmplOrderItem;
import com.aiagent.domain.sample.repository.SmplOrderItemRepository;
import com.aiagent.domain.sample.repository.SmplOrderRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 품목 금액 재계산 — 68 &sect;5.4 · 30 &sect;6. <b>행&times;디테일 진행률의 실물이다.</b>
 *
 * <p>여기서 세는 것은 <b>구간이 주문마다 갈리는가</b> 다. 갈리지 않으면 진행률 창은
 * 처음부터 끝까지 <i>주문 하나를 도는 것처럼</i> 보이고, 그러면 이 액션이 시연하려는
 * 것이 화면에 나타나지 않는다.
 *
 * <p><b>순서까지 잰다</b>({@code inOrder}). {@code reset} 이 그 주문의 걸음보다
 * <b>먼저</b> 가야 하며, 늦으면 그 사이의 폴링이 <i>새 주문의 건수 대 앞 주문의
 * 전체</i> 를 본다 — 앞이 작았으면 화면은 <b>100% 를 넘긴 막대</b>를 그린다.
 *
 * <p><b>금액이 갚아지는가는 여기서 잴 수 없다.</b> 엔티티의 API 로는 어긋난
 * {@code AMT} 를 만들 수 없고({@code create} — {@code modify} 가 늘 다시 센다), 그
 * 어긋남은 <b>DB 에서 들어온다</b> — 엑셀 업로드 · 연계, 그리고 904 시드의 셋 중
 * 하나다. 손으로 만들 수 없는 상태를 리플렉션으로 지어내 재면 <b>그 검사가 지키는 것은
 * 리플렉션</b>이므로, 이 묶음은 <i>구간이 갈리는가</i> 와 <i>게이트가 서는가</i> 만 잰다.
 */
class SampleItemServiceTest {

    private final SmplOrderRepository orders = mock(SmplOrderRepository.class);
    private final SmplOrderItemRepository items = mock(SmplOrderItemRepository.class);
    private final SampleQueryService queries = mock(SampleQueryService.class);
    private final Progress progress = mock(Progress.class);

    private final SampleItemService service = new SampleItemService(orders, items, queries);

    private static SmplOrderItem item(long ordId, int seq, String qty, String unit) {
        return SmplOrderItem.create(
                ordId,
                seq,
                "SO-%d".formatted(ordId),
                "P-%d".formatted(seq),
                "품목",
                "EA",
                new BigDecimal(qty),
                new BigDecimal(unit),
                LocalDate.of(2026, 9, 10),
                "WAIT",
                true,
                null);
    }

    /*
      <b>이것이 이 액션의 이유다.</b> 주문마다 품목 수가 다르므로 구간의 전체가 갈아
      끼워져야 하고, 소제목이 <i>지금 어느 주문</i>을 말해야 한다 — 막대가 0 으로
      돌아가는 것만 보이면 그것은 진행이 아니라 <b>고장</b>으로 읽힌다.
    */
    @Test
    @DisplayName("주문마다 구간을 다시 연다 — 소제목과 전체가 그 주문의 것이다")
    void resetsPerOrder() {
        SmplOrder first = order("SO-1", "RCV");
        SmplOrder second = order("SO-2", "RCV");
        when(orders.findByOrdIdIn(List.of(1L, 2L))).thenReturn(List.of(first, second));
        /*
          첫 주문은 품목 셋, 둘째는 하나 — <b>전체가 갈리는 것이 요점이다</b>.

          <b>연속 스텁이다.</b> {@code ORD_ID} 는 채번이라 아직 만들어지지 않은 엔티티에는
          없고({@code null}), 그래서 두 주문의 조회를 <i>인자</i>로 가를 수가 없다 —
          가르려면 리플렉션으로 id 를 꽂아야 하는데 그러면 <b>그 검사가 지키는 것은
          리플렉션</b>이 된다. 순서대로 돌려주는 것이 곧 이 서비스가 주문 순서대로
          구간을 연다는 사실이며, 아래 {@code inOrder} 가 그 순서를 잰다.
        */
        when(items.findByOrdIdOrderByItemSeq(first.getOrdId()))
                .thenReturn(
                        List.of(
                                item(1L, 1, "2", "100"),
                                item(1L, 2, "3", "100"),
                                item(1L, 3, "4", "100")),
                        List.of(item(2L, 1, "5", "100")));

        assertThat(service.recalcItems(List.of(1L, 2L), progress)).isEqualTo(4);

        var order = inOrder(progress);
        order.verify(progress).reset("주문 SO-1 (1/2)", 3L);
        order.verify(progress, times(3)).step();
        order.verify(progress).reset("주문 SO-2 (2/2)", 1L);
        order.verify(progress, times(1)).step();
    }

    /*
      <b>화면이 닫아 둔 문을 실행이 열어 주면 안 된다.</b> 확정부터는 금액이 잠기고
      (48 &sect;3.2) 화면의 {@code amountEditable} 이 그렇게 서 있는데, 이 실행이 같은
      금액을 다시 셀 수 있으면 그 게이트는 <b>없는 것</b>이다.
    */
    @Test
    @DisplayName("확정된 주문이 섞이면 전부 거부한다 — 걸음이 하나도 나가지 않는다")
    void rejectsClosedAmount() {
        when(orders.findByOrdIdIn(List.of(1L, 2L)))
                .thenReturn(List.of(order("SO-1", "RCV"), order("SO-2", "CFM")));

        assertThatThrownBy(() -> service.recalcItems(List.of(1L, 2L), progress))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("SO-2");
        // 앞 주문이 먼저 돌지 않는다 — 절반만 반영된 금액은 되돌릴 지점이 없다.
        verify(progress, never()).step();
    }

    @Test
    @DisplayName("사라진 주문이 섞이면 거부한다 — 건수가 어긋난 채로 실행하지 않는다")
    void rejectsMissing() {
        when(orders.findByOrdIdIn(List.of(1L, 9L))).thenReturn(List.of(order("SO-1", "RCV")));

        assertThatThrownBy(() -> service.recalcItems(List.of(1L, 9L), progress))
                .isInstanceOf(BusinessException.class);
    }
}
