package com.aiagent.domain.sample;

import static com.aiagent.domain.sample.SampleRules.requireText;
import static com.aiagent.domain.sample.SampleRules.requireUnlocked;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.progress.Progress;
import com.aiagent.domain.sample.entity.SmplOrder;
import com.aiagent.domain.sample.entity.SmplOrderItem;
import com.aiagent.domain.sample.repository.SmplOrderItemRepository;
import com.aiagent.domain.sample.repository.SmplOrderRepository;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 품목의 저장과 재계산 — playbook/INDEX.md.
 *
 * <h2>대상을 가리키는 방법이 둘이다</h2>
 *
 * <table><caption></caption>
 *   <tr><td><b>{@link #saveItems}</b></td>
 *       <td>{@code (ORD_ID, ITEM_SEQ)} — 디테일 그리드가 한 주문의 품목만 보낸다</td></tr>
 *   <tr><td><b>{@link #saveFlatItems}</b></td>
 *       <td>{@code (ORD_NO, ITEM_CD)} — 엑셀 한 파일에 여러 주문이 섞이고 {@code ITEM_SEQ} 는
 *           파일에 없다({@link SmplFlatItemSaveRow})</td></tr>
 * </table>
 *
 * <h2>전건을 먼저 보고 그다음에 쓴다</h2>
 *
 * <p>섞으면 거부되는 요청이 쓰기를 한 번 내고 돌아가며, 롤백해도 <b>시퀀스는 뛴다</b> —
 * 이 테이블은 채번을 쓰므로 실제로 일어난다. 412행 중 400번째가 <i>없는 주문번호</i> 이면
 * 앞의 399행이 이미 들어간 채로 실패하고, 사용자는 <b>어디까지 됐는지</b> 를 조회해서
 * 세야 한다(playbook/INDEX.md).
 *
 * <p><b>잠금은 {@link SampleRules} 가 본다</b> — 주문·품목·태그 셋이 같은 문을 지난다.
 */
@Service
public class SampleItemService {

    private final SmplOrderRepository orders;
    private final SmplOrderItemRepository items;
    private final SampleQueryService queries;

    public SampleItemService(
            SmplOrderRepository orders,
            SmplOrderItemRepository items,
            SampleQueryService queries) {
        this.orders = orders;
        this.items = items;
        this.queries = queries;
    }

    /**
     * 디테일 저장 — 대상 주문이 <b>요청 하나에 하나</b>다.
     *
     * <p>행마다 받으면 한 요청에 여러 주문의 품목이 섞일 수 있고, 그러면 <i>이 주문을
     * 저장한다</i> 는 화면의 뜻과 요청이 갈린다.
     */
    @Transactional
    public void saveItems(long ordId, List<SmplOrderItemSaveRow> rows) {
        SmplOrder order = queries.require(ordId);
        requireUnlocked(order);

        // 신규 행의 번호는 서버가 정한다 — 화면이 정하면 두 사람이 같은 번호를 만든다.
        int nextSeq = items.findByOrdIdOrderByItemSeq(ordId).stream()
                .mapToInt(SmplOrderItem::getItemSeq)
                .max()
                .orElse(0) + 1;

        for (SmplOrderItemSaveRow row : rows) {
            switch (row.rowState()) {
                case C -> {
                    items.save(SmplOrderItem.create(
                            ordId,
                            nextSeq,
                            order.getOrdNo(),
                            row.itemCd(),
                            row.itemNm(),
                            row.uomCd(),
                            row.qtyOrZero(),
                            row.unitAmtOrZero(),
                            row.dlvrDt(),
                            row.itemStatCd(),
                            row.useYnOrTrue(),
                            row.rmk()));
                    nextSeq += 1;
                }
                case U -> requireItem(ordId, row.itemSeq())
                        .modify(
                                row.itemCd(),
                                row.itemNm(),
                                row.uomCd(),
                                row.qtyOrZero(),
                                row.unitAmtOrZero(),
                                row.dlvrDt(),
                                row.itemStatCd(),
                                row.useYnOrTrue(),
                                row.rmk());
                case D -> items.delete(requireItem(ordId, row.itemSeq()));
            }
        }
    }

    /**
     * ⑤의 저장 — playbook/INDEX.md. <b>업무 데이터 탭과 엑셀 업로드 탭이 같은 경로를 쓴다.</b>
     *
     * <p>frontend/grid-advanced.md 가 업로드에 새 경로를 두지 않기로 한 자리다: 업로드는 <i>파일을 서버에
     * 올리는 일</i>이 아니라 <b>브라우저가 읽어 그리드에 부은 행을 저장하는 일</b>이라,
     * 업무 탭의 저장과 <b>같은 요청</b>이 된다. 경로를 가르면 같은 표에 규칙이 둘 생기고
     * 그 둘은 반드시 갈린다.
     *
     * <h2>대상을 {@code (ORD_NO, ITEM_CD)} 가 가리킨다</h2>
     *
     * <p>{@link #saveItems} 와 갈리는 유일한 점이며, 이유는 {@link SmplFlatItemSaveRow} 가
     * 적어 두었다 — 한 파일에 여러 주문이 섞이고 {@code ITEM_SEQ} 는 파일에 없다.
     *
     * <p><b>화면이 이미 걸렀어도 다시 본다</b>(frontend/grid.md). 없는 주문번호도 파일 안의 키 중복도
     * 프론트가 먼저 짚지만, 그 판정은 <b>파일을 읽던 시점</b>의 것이다 — 그 사이에 남이
     * 주문을 지웠을 수 있다.
     */
    @Transactional
    public void saveFlatItems(List<SmplFlatItemSaveRow> rows) {
        for (SmplFlatItemSaveRow row : rows) {
            requireText(row.ordNo(), "ordNo");
            requireText(row.itemCd(), "itemCd");
        }

        /*
          같은 (주문번호, 품목코드) 가 두 번 오면 거부한다. 뒤엣것이 앞엣것을 덮어 조용히
          한 행만 남는데, 사용자에게는 두 줄을 다 올렸는데 한 줄만 들어간 것으로 보인다.
        */
        Set<String> seen = new HashSet<>();
        for (SmplFlatItemSaveRow row : rows) {
            if (!seen.add(row.where())) {
                throw new BusinessException(
                        SampleErrorCode.ITEM_DUPLICATED, "same item came twice: " + row.where());
            }
        }

        List<String> ordNos = rows.stream().map(SmplFlatItemSaveRow::ordNo).distinct().toList();
        Map<String, SmplOrder> byOrdNo = new LinkedHashMap<>();
        for (SmplOrder order : orders.findByOrdNoIn(ordNos)) {
            byOrdNo.put(order.getOrdNo(), order);
        }
        Map<String, SmplOrderItem> current = new LinkedHashMap<>();
        for (SmplOrderItem item : items.findByOrdNoIn(ordNos)) {
            current.put(itemKey(item.getOrdNo(), item.getItemCd()), item);
        }

        /*
          주문 안의 다음 번호는 서버가 정한다 — 주문마다 따로 센다. 담는 값이 *지금까지 쓴
          가장 큰 번호* 라 아래에서 merge(+1) 한 결과가 곧 다음 번호이며, 없는 주문은
          merge 가 1 을 넣는다(첫 품목의 번호다).
        */
        Map<Long, Integer> lastSeq = new LinkedHashMap<>();
        for (SmplOrderItem item : current.values()) {
            lastSeq.merge(item.getOrdId(), item.getItemSeq(), Math::max);
        }

        for (SmplFlatItemSaveRow row : rows) {
            SmplOrder order = byOrdNo.get(row.ordNo());
            if (order == null) {
                // playbook/INDEX.md — ORD_NO 가 DB 에 없으면 ORD_ID 를 풀 수 없다. 그 행이 오류다.
                throw new BusinessException(
                        SampleErrorCode.NO_SUCH_ORDER, "no such order: " + row.ordNo());
            }
            requireUnlocked(order);

            SmplOrderItem found = current.get(itemKey(row.ordNo(), row.itemCd()));
            switch (row.rowState()) {
                case C -> {
                    if (found != null) {
                        throw new BusinessException(
                                SampleErrorCode.ITEM_DUPLICATED, "already there: " + row.where());
                    }
                }
                case U, D -> {
                    if (found == null) {
                        throw new BusinessException(
                                SampleErrorCode.NOT_FOUND, "no such item: " + row.where());
                    }
                }
            }
        }

        for (SmplFlatItemSaveRow row : rows) {
            SmplOrder order = byOrdNo.get(row.ordNo());
            SmplOrderItem found = current.get(itemKey(row.ordNo(), row.itemCd()));
            switch (row.rowState()) {
                case C -> {
                    int seq = lastSeq.merge(order.getOrdId(), 1, Integer::sum);
                    items.save(SmplOrderItem.create(
                            order.getOrdId(),
                            seq,
                            order.getOrdNo(),
                            row.itemCd(),
                            row.itemNm(),
                            row.uomCd(),
                            row.qtyOrZero(),
                            row.unitAmtOrZero(),
                            row.dlvrDt(),
                            row.itemStatCd(),
                            row.useYnOrTrue(),
                            row.rmk()));
                }
                case U -> found.modify(
                        row.itemCd(),
                        row.itemNm(),
                        row.uomCd(),
                        row.qtyOrZero(),
                        row.unitAmtOrZero(),
                        row.dlvrDt(),
                        row.itemStatCd(),
                        row.useYnOrTrue(),
                        row.rmk());
                case D -> items.delete(found);
            }
        }
    }

    /**
     * 선택 주문의 <b>품목 금액 재계산</b> — 68 &sect;5.4 · 30 &sect;6.
     *
     * <p><b>이 화면이 행&times;디테일 진행률의 실물이다.</b> 대상은 <i>고른 주문 몇</i> 이고
     * 일은 <i>그 주문마다 딸린 품목 전건</i> 이라, 하나의 퍼센트로는 둘 중 하나만 말할 수
     * 있다 &mdash; 50행 중 3행과 <b>이 주문의 2,000건 중 1,200건</b>은 다른 사실이다.
     *
     * <p>그래서 <b>소제목이 주문을 말하고 막대가 그 주문의 품목을 말한다</b>:
     *
     * <pre>
     * 주문 SO-2026-1005 (1/4)          &larr; progress.reset(&hellip;)
     * [=====&gt;      ] 1,203 / 2,002건 (60%) &middot; 경과 0분 07초
     * </pre>
     *
     * <p><b>{@code reset} 이 구간마다 전체를 갈아 끼운다.</b> 주문마다 품목 수가 다르므로
     * 앞 주문의 전체를 물고 가면 <b>100% 를 넘긴 막대</b>가 나오고(앞이 컸을 때) 또는
     * <b>이미 끝난 구간</b>처럼 보인다(작았을 때). 컨트롤러가 {@code totCnt} 를
     * {@code null} 로 여는 것도 그래서다 &mdash; 전체가 하나가 아니라 <b>구간마다</b> 있다.
     *
     * <h2>게이트가 금액과 같은 자리다</h2>
     *
     * <p>{@code RCV} 만, 잠기지 않은 것만 간다. 화면의 {@code amountEditable} 이 <i>확정부터는
     * 금액이 잠긴다</i> 로 서 있으므로(48 &sect;3.2), 같은 금액을 이 실행으로 다시 셀 수
     * 있으면 <b>화면이 닫아 둔 문을 실행이 열어 준다</b>.
     *
     * <p><b>하나라도 대상이 아니면 전부 거부한다</b> &mdash; 출고 지시와 같다. 절반만 돌면
     * 어디까지 됐는지 아무도 모르고, 이 작업은 멱등이라 <b>전부 다시 돌리는 것</b>이 답이다.
     *
     * <h2>한 트랜잭션이다</h2>
     *
     * <p>진행률이 {@code FAILED} 로 멈춰도 데이터는 손대기 전 그대로여야 한다. 구간마다
     * 커밋하면 <i>3번째 주문에서 실패</i> 가 <b>둘은 반영되고 둘은 아닌</b> 상태가 되는데,
     * 그 상태를 화면에서 알아볼 방법이 없다 &mdash; 진행률은 사라지고 남는 것은 금액뿐이다.
     *
     * @param ordIds 고른 주문들. <b>순서가 소제목의 순서다</b>
     * @param progress 구간을 여는 손잡이 &mdash; {@code reset} 이 주문마다 막대를 되돌린다
     * @return 다시 센 품목 건수(주문 수가 아니다)
     */
    @Transactional
    public int recalcItems(List<Long> ordIds, Progress progress) {
        List<SmplOrder> targets = orders.findByOrdIdIn(ordIds);
        if (targets.size() != ordIds.size()) {
            throw new BusinessException(SampleErrorCode.NOT_FOUND, "some orders are gone");
        }
        for (SmplOrder order : targets) {
            // 화면이 이미 걸렀어도 다시 본다 &mdash; 고른 뒤 남이 확정했을 수 있다(55 &sect;7).
            if (!order.amountOpen()) {
                throw new BusinessException(
                        SampleErrorCode.NOT_RECALCULABLE, "amount is closed: " + order.getOrdNo());
            }
        }

        int done = 0;
        for (int index = 0; index < targets.size(); index++) {
            SmplOrder order = targets.get(index);
            List<SmplOrderItem> lines = items.findByOrdIdOrderByItemSeq(order.getOrdId());
            /*
              <b>구간을 연다.</b> 소제목이 <i>지금 어느 주문</i>을 말하고 전체가 그 주문의
              품목 수로 갈린다 &mdash; 이 한 줄이 없으면 창은 처음부터 끝까지 <b>주문
              하나를 도는 것처럼</b> 보인다.
            */
            progress.reset(subTitle(order, index + 1, targets.size()), (long) lines.size());
            for (SmplOrderItem line : lines) {
                line.recalculate();
                progress.step();
            }
            done += lines.size();
        }
        return done;
    }

    /**
     * 진행률의 소제목 &mdash; <b>서버가 문구를 완성한다</b>(21 &sect;6-1.2).
     *
     * <p>화면은 이 값을 <b>그대로 그린다</b>. 메시지 키로 만들 수 없는 것은 업무 데이터가
     * 섞이기 때문이며(주문번호), 서버의 {@code SYS_MESSAGE} 에는 자리표를 채울 통로가
     * 없다(102 의 주석).
     *
     * <p><b>행의 자리를 함께 적는다</b>({@code n/전체}). 주문번호만 적으면 <i>몇 번째 주문
     * 인가</i> 가 아무 데도 없어, 막대가 0 으로 돌아가는 것이 <b>진행이 아니라 고장</b>으로
     * 읽힌다 &mdash; 하나의 막대로 두 층을 말하는 화면에서는 <b>층의 위치</b>가 그 층의
     * 진행률만큼 중요하다.
     */
    private static String subTitle(SmplOrder order, int position, int total) {
        return "주문 %s (%d/%d)".formatted(order.getOrdNo(), position, total);
    }

    /** {@code ORD_NO}␟{@code ITEM_CD} — 스펙의 tie-breaker 와 같은 키다({@code SampleItemSpec}). */
    private static String itemKey(String ordNo, String itemCd) {
        return ordNo + (char) 31 + itemCd;
    }

    private SmplOrderItem requireItem(long ordId, Integer itemSeq) {
        if (itemSeq == null) {
            throw new BusinessException(SampleErrorCode.NOT_FOUND, "item seq is missing");
        }
        return items.findByOrdIdOrderByItemSeq(ordId).stream()
                .filter(item -> itemSeq.equals(item.getItemSeq()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        SampleErrorCode.NOT_FOUND, "no such item: " + ordId + "/" + itemSeq));
    }
}
