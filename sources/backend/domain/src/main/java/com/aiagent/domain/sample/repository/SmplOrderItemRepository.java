package com.aiagent.domain.sample.repository;

import com.aiagent.domain.sample.entity.SmplOrderItem;
import com.aiagent.domain.sample.entity.SmplOrderItemId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 샘플 주문 품목 — 48 §4.
 *
 * <p>{@link #countByOrdId} 가 <b>마스터 삭제 게이트</b>의 근거다(grid-standard.md §6.2) — 품목이 하나라도
 * 있으면 주문의 삭제 체크가 열리지 않는다. FK 가 {@code RESTRICT} 라 화면이 잘못 열어도
 * DB 가 막지만, 그 막힘은 <b>저장을 눌러 실패로</b> 드러난다(48 §5.1).
 */
public interface SmplOrderItemRepository extends JpaRepository<SmplOrderItem, SmplOrderItemId> {

    List<SmplOrderItem> findByOrdIdOrderByItemSeq(Long ordId);

    List<SmplOrderItem> findByOrdIdInOrderByOrdIdAscItemSeqAsc(List<Long> ordIds);

    long countByOrdId(Long ordId);

    /**
     * &#9317;의 저장이 고칠 대상 &mdash; <b>주문 여럿의 품목을 한 번에</b> 읽는다.
     *
     * <p>{@code (ORD_NO, ITEM_CD)} 로 가리키므로(48 &sect;4.3) 여기서 받은 목록을 그 쌍으로
     * 색인해 쓴다. 행마다 {@code findById} 를 부르지 않는 것은 왕복 때문만이 아니다 &mdash;
     * 복합 PK 의 {@code ITEM_SEQ} 가 요청에 아예 없다.
     */
    List<SmplOrderItem> findByOrdNoIn(List<String> ordNos);
}
