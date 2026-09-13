// @feat FEAT-503
package com.aiagent.sample.domain;

import static com.aiagent.sample.domain.SampleRules.DEFAULT_CHNL;
import static com.aiagent.sample.domain.SampleRules.DEFAULT_PRIORITY;
import static com.aiagent.sample.domain.SampleRules.DEFAULT_TAG_TYPE;
import static com.aiagent.sample.domain.SampleRules.requireUnlocked;

import com.aiagent.core.error.BusinessException;
import com.aiagent.sample.domain.entity.SmplOrder;
import com.aiagent.sample.domain.entity.SmplOrderTag;
import com.aiagent.sample.domain.repository.SmplOrderRepository;
import com.aiagent.sample.domain.repository.SmplOrderTagRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 주문 <b>한 행</b>의 트랜잭션 — backend/row-transaction.md §4.
 *
 * <h2>왜 빈이 갈렸나</h2>
 *
 * <p>{@code oneTxPerRow} 의 본문은 <b>다른 빈의 {@code @Transactional} 메서드여야 한다</b>.
 * 같은 빈의 메서드를 부르면 프록시를 지나지 않아 애너테이션이 무시되고, <b>예외도 경고도
 * 없이</b> 전건이 한 덩이로 묶인다 — 그러면 이름만 건별이고 동작은 전건이다.
 *
 * <p>{@link SampleOrderService} 는 <b>바깥</b>이라 {@code @Transactional} 이 없다. 걸면 행마다
 * 커밋되지 않고, 게다가 실패를 잡고 계속 돌기 때문에 커밋 시점에
 * {@code UnexpectedRollbackException} 이 나서 <b>499행이 성공한 실행이 통째로 사라진다</b>.
 *
 * <p><b>{@code REQUIRES_NEW} 가 아니다.</b> 바깥에 트랜잭션이 없으므로 기본 전파가 행마다 새
 * 트랜잭션을 연다. {@code REQUIRES_NEW} 는 바깥이 <i>반드시</i> 트랜잭션이어야 할 때의
 * 것이고, 그때는 행마다 <b>커넥션을 둘</b> 잡는다 — 500행이면 풀이 마른다.
 *
 * <h2>여기 있는 것은 쓰기뿐이다</h2>
 *
 * <p>검증과 요청 안의 중복 판정은 <b>바깥에 남는다</b>. 그것들은 트랜잭션이 필요 없고,
 * 무엇보다 <b>채번보다 앞서야</b> 한다 — 검증을 통과하지 못한 행이 번호를 먹으면 그
 * 번호는 아무 주문도 갖지 못한 채 버려진다(screen/sample/single-offset/requirements.md §6-1).
 *
 * <p><b>실패는 필드를 짚어야 한다.</b> 순번만 돌려주면 화면은 붉힐 셀도 표에 적을 줄도 없어
 * <b>빈 표</b>를 띄운다(frontend/save-errors.md).
 */
@Service
public class SampleOrderRowRunner {

    private final SmplOrderRepository orders;
    private final SmplOrderTagRepository tags;
    private final SampleQueryService queries;
    private final Clock clock;

    public SampleOrderRowRunner(
            SmplOrderRepository orders,
            SmplOrderTagRepository tags,
            SampleQueryService queries,
            Clock clock) {
        this.orders = orders;
        this.tags = tags;
        this.queries = queries;
        this.clock = clock;
    }

    /** 컬럼 서른의 저장 한 행 — {@link SampleOrderService#saveFullOrders} 의 본문이다. */
    @Transactional
    public void writeFull(SmplOrderFullSaveRow row) {
        switch (row.rowState()) {
            case C -> createFullOrder(row);
            case U -> updateFullOrder(row);
            case D -> deleteFullOrder(row);
        }
    }

    /**
     * 확정 한 행 — {@link SampleOrderService#confirm} 의 본문이다.
     *
     * <p><b>화면이 이미 걸렀어도 다시 본다</b>({@code eligible}). 고른 뒤 남이 상태를 바꿨을
     * 수 있고, 걸러진 목록은 <b>조회 시점의 값</b>이다.
     *
     * <p><b>사유가 가리키는 칸이 둘이다</b>(screen/sample/single-offset/requirements.md §6-2) —
     * 없어진 주문은 <b>주문번호</b>가, 확정할 수 없는 주문은 <b>주문 상태</b>가 받는다.
     * 잠금도 상태 칸이 받는다: {@code LOCK_YN} 은 화면에서 {@code hidden} 이라 칠할 칸이 없다.
     */
    @Transactional
    public void confirmOne(long ordId) {
        SmplOrder order = orders.findById(ordId).orElseThrow(() -> new BusinessException(
                SampleErrorCode.NOT_FOUND,
                "no such order: " + ordId,
                List.of(new BusinessException.FieldError("ordNo", "없는 주문입니다"))));
        if (!order.confirmable()) {
            throw new BusinessException(
                    SampleErrorCode.NOT_CONFIRMABLE,
                    "not confirmable: " + order.getOrdNo(),
                    List.of(new BusinessException.FieldError(
                            "ordStatCd",
                            Boolean.TRUE.equals(order.getLockYn())
                                    ? "잠긴 주문입니다"
                                    : "접수 상태만 확정할 수 있습니다",
                            order.getOrdStatCd())));
        }
        order.confirm();
    }

    private void createFullOrder(SmplOrderFullSaveRow row) {
        if (orders.existsByOrdNo(row.ordNo())) {
            throw new BusinessException(
                    SampleErrorCode.DUPLICATED,
                    "duplicated: " + row.ordNo(),
                    List.of(new BusinessException.FieldError(
                            "ordNo", "이미 있는 주문번호입니다", row.ordNo())));
        }
        SmplOrder order = SmplOrder.create(
                row.ordNo(),
                row.ordNm(),
                row.custId(),
                row.custNm(),
                row.ordStatCd() == null ? OrderStatus.RCV.name() : row.ordStatCd(),
                row.chnlCd() == null ? DEFAULT_CHNL : row.chnlCd(),
                row.priorityCd() == null ? DEFAULT_PRIORITY : row.priorityCd(),
                row.ordDt(),
                clock.instant());
        applyFull(order, row);
        orders.save(order);
        // 채번이 끝난 뒤라야 태그가 붙을 부모가 있다 — save 가 ORD_ID 를 정한다.
        replaceTags(order.getOrdId(), row);
    }

    private void updateFullOrder(SmplOrderFullSaveRow row) {
        SmplOrder order = queries.require(Long.valueOf(row.ordId()));
        requireUnlocked(order);
        applyFull(order, row);
        replaceTags(order.getOrdId(), row);
    }

    private void deleteFullOrder(SmplOrderFullSaveRow row) {
        SmplOrder order = queries.require(Long.valueOf(row.ordId()));
        requireUnlocked(order);
        if (queries.itemCount(order.getOrdId()) > 0) {
            throw new BusinessException(
                    SampleErrorCode.HAS_ITEMS,
                    "order still has items: " + order.getOrdNo(),
                    List.of(new BusinessException.FieldError(
                            "ordNo", "품목이 남아 있어 지울 수 없습니다", order.getOrdNo())));
        }
        /*
          태그를 먼저 지운다. FK 가 RESTRICT 라(playbook/INDEX.md) 남겨 두면 주문 삭제가 제약 위반으로
          막히고, 그 실패는 "제약 위반" 이라는 읽을 수 없는 문구로만 사용자에게 닿는다.
        */
        tags.deleteByOrdId(order.getOrdId());
        orders.delete(order);
    }

    private void applyFull(SmplOrder order, SmplOrderFullSaveRow row) {
        order.modifyFull(
                row.ordNm(),
                row.custId(),
                row.custNm(),
                row.custGrdCd(),
                row.ordStatCd() == null ? order.getOrdStatCd() : row.ordStatCd(),
                row.chnlCd() == null ? order.getChnlCd() : row.chnlCd(),
                row.priorityCd() == null ? order.getPriorityCd() : row.priorityCd(),
                row.ordDt(),
                row.dlvrYm(),
                row.ordQtyOrZero(),
                row.unitAmtOrZero(),
                row.dcRtOrZero(),
                row.urgentYnOrFalse(),
                row.useYnOrTrue(),
                row.memo(),
                row.rmk());
    }

    /**
     * 태그를 <b>전량 교체</b>한다 &mdash; 화면이 배열을 통째로 보내기 때문이다.
     *
     * <p>diff 를 뜨지 않는 것은 <b>순서가 값이기 때문</b>이다({@code SORT_NO}). 항목 하나를
     * 앞으로 끌면 이름은 하나도 안 바뀌었는데 순서가 전부 바뀌고, 그때 diff 는 <i>바뀐 것이
     * 없다</i> 로 읽는다.
     *
     * <p><b>{@code TAG_SEQ} 와 {@code SORT_NO} 가 같은 값이다.</b> 갈리는 편집(순번을 유지한
     * 채 순서만 바꾸기)은 {@link SampleTagService} 에 있다 &mdash; 어휘가 둘이라 클래스도
     * 둘이며, 두 갈래가 보는 개수 상한은 {@link SampleRules#MAX_TAGS} 하나다.
     */
    private void replaceTags(Long ordId, SmplOrderFullSaveRow row) {
        // 개수는 validateFull 이 채번 앞에서 이미 봤다 — 여기서 또 보면 첫 쓰기가 나간 뒤다.
        List<SmplOrderTagRow> wanted = row.tagListOrEmpty();

        tags.deleteByOrdId(ordId);
        // 지우고 곧바로 같은 키를 넣는다 — flush 를 강제하지 않으면 INSERT 가 먼저 나간다.
        tags.flush();

        List<SmplOrderTag> saved = new ArrayList<>(wanted.size());
        for (int index = 0; index < wanted.size(); index++) {
            SmplOrderTagRow tag = wanted.get(index);
            if (tag == null || tag.tagNm() == null || tag.tagNm().isBlank()) {
                throw new BusinessException(
                        SampleErrorCode.REQUIRED,
                        "tag name is required",
                        List.of(new BusinessException.FieldError("tagList", "태그명이 비어 있습니다")));
            }
            saved.add(SmplOrderTag.of(
                    ordId,
                    index + 1,
                    tag.tagNm().trim(),
                    tag.tagTypeCd() == null ? DEFAULT_TAG_TYPE : tag.tagTypeCd(),
                    index + 1));
        }
        tags.saveAll(saved);
    }
}
