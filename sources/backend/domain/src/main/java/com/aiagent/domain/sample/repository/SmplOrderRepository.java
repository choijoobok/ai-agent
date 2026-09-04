package com.aiagent.domain.sample.repository;

import com.aiagent.domain.sample.entity.SmplOrder;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 샘플 주문 — playbook/INDEX.md. */
public interface SmplOrderRepository extends JpaRepository<SmplOrder, Long> {

    boolean existsByOrdNo(String ordNo);

    /**
     * 업무 키로 여러 주문을 한 번에 &mdash; &#9317;의 저장이 {@code ORD_NO → ORD_ID} 를
     * 푸는 자리다(48 &sect;4.3).
     *
     * <p><b>한 번에 읽는 것이 요점이다.</b> 412행짜리 파일을 행마다 조회하면 왕복이 412 이며,
     * 그중 대부분은 <b>같은 주문</b>을 다시 묻는다.
     */
    List<SmplOrder> findByOrdNoIn(List<String> ordNos);

    List<SmplOrder> findByOrdIdIn(List<Long> ordIds);

    /**
     * 일괄 재계산의 대상 — 기준일 <b>이전</b>의 주문 전량이다(playbook/INDEX.md).
     *
     * <p>순서를 못 박는 것은 진행률 때문이다. 순서가 흔들리면 두 번 돌렸을 때 <i>몇 번째에서
     * 실패했다</i> 가 다른 행을 가리키고, 그 사실을 아는 사람이 아무도 없다.
     */
    List<SmplOrder> findByOrdDtLessThanEqualOrderByOrdIdAsc(LocalDate baseDt);
}
