package com.aiagent.domain.sample;

import com.aiagent.core.search.PageSpec;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.sample.entity.SmplOrderItem;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.UiExcelProps;
import com.aiagent.support.excel.ExcelSheetWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 주문 + 품목 <b>합본</b> — playbook/excel-download.md 의 세 번째 갈래이자 그 ADR 이 든 <b>바로 그 사례</b>다.
 *
 * <p>playbook/excel-download.md 는 갈래를 열면서 이렇게 적었다: <i>"입출고 주문은 헤더 1건 + 상품 N건이고
 * 화면은 상단 폼과 하단 그리드로 쪼개 보여주지만, <b>사용자는 헤더와 상품을 합친 엑셀
 * 하나를 원한다</b>. 그리드 데이터를 모아 붙이는 방식으로는 나오지 않는다."</i>
 *
 * <h2>왜 프론트가 못 만드나 — 셋이다</h2>
 *
 * <table><caption></caption>
 *   <tr><td><b>표가 화면에 없다</b></td>
 *       <td>화면의 마스터는 주문 <b>한 줄</b>이고 파일은 주문 × 품목이다. 위 그리드가 든
 *           행을 아무리 모아도 아래 그리드는 <b>고른 주문 하나</b>의 것만 갖는다</td></tr>
 *   <tr><td><b>왕복이 N 이 된다</b></td>
 *       <td>주문마다 품목을 물으면 500건에 왕복이 500 이고, 그중 하나가 실패하면
 *           <b>부분만 담긴 파일</b>이 만들어진다</td></tr>
 *   <tr><td><b>컬럼 스펙이 화면과 무관하다</b></td>
 *       <td>프론트에 이 스펙을 심으면 화면이 <b>자기 것이 아닌 컬럼</b>을 알게 된다</td></tr>
 * </table>
 *
 * <h2>상한이 서버로 넘어온다</h2>
 *
 * <p>프론트 생성에서는 화면이 첫 응답의 총 건수로 판정했지만(frontend/grid.md), 이 갈래는
 * <b>행을 받지 않으므로</b> 셀 수 있는 것이 없다. 같은 설정({@code ui.excel.max-rows})을
 * 여기서 읽는다 — 값이 갈리면 <i>화면에서는 되는데 파일은 잘린</i> 상태가 된다.
 *
 * <p><b>넘으면 자르지 않고 거절한다</b>(playbook/excel-upload.md). 조용히 자르면 사용자는 <i>올린 것이 다
 * 들어간 줄</i> 알고, 그 파일로 다음 일을 한다.
 */
@Service
@Transactional(readOnly = true)
public class SampleExcelService {

    /**
     * 합본의 헤더 — <b>주문 여섯 + 품목 여섯</b>이다.
     *
     * <p>번역 키가 아니라 글자인 것에 주의한다. 서버 생성 엑셀의 문구는 <b>요청의 언어</b>로
     * 만들어야 하는데 그 배선이 아직 없다 — 지금은 한국어 고정이며, 그것이 이 갈래에
     * 남은 미결이다(playbook/INDEX.md).
     */
    private static final List<String> HEADERS = List.of(
            "주문번호", "주문명", "고객명", "주문상태", "주문일", "주문금액",
            "품목순번", "품목코드", "품목명", "단위", "수량", "품목금액");

    private final SampleQueryService queries;
    private final ConfigLookup configs;

    public SampleExcelService(SampleQueryService queries, ConfigLookup configs) {
        this.queries = queries;
        this.configs = configs;
    }

    /**
     * ②의 <i>현재 페이지</i> — 화면이 보고 있는 주문들의 합본이다.
     *
     * <p>주문을 <b>화면이 지목한다</b>({@code ordNos}). 조건을 다시 보내게 하지 않는 것은
     * 화면에 <i>지금 보이는 것</i>이 조건만으로는 재현되지 않기 때문이다 — 컬럼 필터와
     * 정렬이 판에 걸려 있고 그것은 서버가 모른다(frontend/grid.md).
     */
    public byte[] pageWorkbook(List<String> ordNos) {
        List<SmplOrderRow> orders = queries
                .findOrders(EMPTY_REQUEST, limit())
                .stream()
                .filter(order -> ordNos.contains(order.ordNo()))
                .toList();
        return workbook(orders);
    }

    /** ②의 <i>전체</i> — 조회조건 그대로 전량의 합본이다. */
    public byte[] allWorkbook(SearchRequest<Void> request) {
        return workbook(queries.findOrders(request, limit()));
    }

    /**
     * {@code extra} 항목 — <b>품목이 없는 주문</b>이다.
     *
     * <p>조회로는 낼 수 없는 표다: 마스터 그리드는 주문을 내고 디테일은 <b>고른 하나</b>의
     * 품목을 내므로, <i>품목이 하나도 없는 주문들</i> 은 어느 그리드의 결과도 아니다.
     */
    public byte[] noItemWorkbook() {
        return workbook(queries.findOrdersWithoutItems(limit()));
    }

    /**
     * 주문 × 품목으로 편다 — <b>품목이 없는 주문도 한 줄 나온다</b>.
     *
     * <p>안 나오면 그 주문은 파일에서 사라지고, 사용자는 <i>왜 412건이 400건이 됐나</i> 를
     * 묻게 된다. 품목 칸이 빈 줄이 <b>품목이 없다</b>는 답이다.
     */
    private byte[] workbook(List<SmplOrderRow> orders) {
        List<Long> ordIds = orders.stream().map(order -> Long.valueOf(order.ordId())).toList();
        // 한 번에 읽는다 — 주문마다 물으면 왕복이 N 이고 그중 하나의 실패가 파일을 반쪽으로 만든다.
        Map<Long, List<SmplOrderItem>> byOrder = queries.itemsOf(ordIds).stream()
                .collect(Collectors.groupingBy(SmplOrderItem::getOrdId));

        List<List<Object>> rows = new ArrayList<>();
        for (SmplOrderRow order : orders) {
            List<SmplOrderItem> items = byOrder.getOrDefault(Long.valueOf(order.ordId()), List.of());
            if (items.isEmpty()) {
                rows.add(line(order, null));
                continue;
            }
            for (SmplOrderItem item : items) {
                rows.add(line(order, item));
            }
        }

        return ExcelSheetWriter.build(writer -> writer.sheet("주문합본", HEADERS, rows));
    }

    private static List<Object> line(SmplOrderRow order, SmplOrderItem item) {
        List<Object> line = new ArrayList<>(HEADERS.size());
        line.add(order.ordNo());
        line.add(order.ordNm());
        line.add(order.custNm());
        line.add(order.ordStatCd());
        line.add(order.ordDt());
        line.add(order.ordAmt());
        if (item == null) {
            // 빈 칸 여섯 — 값이 없는 것과 값이 0 인 것을 가른다.
            for (int index = 0; index < 6; index += 1) {
                line.add(null);
            }
            return line;
        }
        line.add(item.getItemSeq());
        line.add(item.getItemCd());
        line.add(item.getItemNm());
        line.add(item.getUomCd());
        line.add(item.getQty());
        line.add(item.getAmt());
        return line;
    }

    /** 화면의 내려받기와 <b>같은 설정</b>이다 — 갈리면 화면에서는 되는데 파일이 잘린다. */
    private int limit() {
        return configs.get(UiExcelProps.class).maxRows();
    }

    /**
     * 조건 없이 전량 — <i>현재 페이지</i> 가 이름으로 좁히기 전의 모집단이다.
     *
     * <p>{@code size} 가 {@code null} 이라 기본값이 쓰이지만 {@code PageMode.all} 이면
     * 페이징이 걸리지 않는다 — 자르는 것은 {@link #limit()} 하나다.
     */
    private static final SearchRequest<Void> EMPTY_REQUEST =
            new SearchRequest<>(List.of(), List.of(), new PageSpec(0, null, null), null);
}
