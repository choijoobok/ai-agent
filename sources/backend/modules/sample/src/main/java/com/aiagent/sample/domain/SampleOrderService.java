// @feat FEAT-503
package com.aiagent.sample.domain;

import static com.aiagent.sample.domain.SampleRules.DEFAULT_CHNL;
import static com.aiagent.sample.domain.SampleRules.DEFAULT_PRIORITY;
import static com.aiagent.sample.domain.SampleRules.MAX_TAGS;
import static com.aiagent.sample.domain.SampleRules.requireText;
import static com.aiagent.sample.domain.SampleRules.requireUnlocked;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.RowReport;
import com.aiagent.core.error.RowTx;
import com.aiagent.core.grid.RowState;
import com.aiagent.domain.progress.Progress;
import com.aiagent.sample.domain.entity.SmplOrder;
import com.aiagent.sample.domain.repository.SmplOrderRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 주문의 저장과 실행 — playbook/INDEX.md.
 *
 * <h2>저장 단위가 둘이다</h2>
 *
 * <p>마스터와 디테일이 <b>각자 저장한다</b>(playbook/INDEX.md). 한 번에 묶지 않는 이유는 저장 버튼이
 * 그리드마다 따로이기 때문이며(frontend/grid.md), 묶으면 <i>품목만 고쳤는데 주문도 갱신됨</i> 이
 * 되어 감사 컬럼이 거짓말을 한다. 그 갈림이 <b>클래스의 갈림</b>이기도 하다 — 품목은
 * {@link SampleItemService}, 태그의 행 편집은 {@link SampleTagService} 다.
 *
 * <h2>게이트 둘 — 화면이 앞서 막고 여기가 마지막이다</h2>
 *
 * <table><caption></caption>
 *   <tr><td><b>품목이 있으면 삭제 불가</b></td>
 * <td>frontend/grid.md. 화면은 체크박스를 열지 않지만 <b>화면 밖 경로가 실재</b>하고,
 *           FK 의 {@code RESTRICT} 는 <i>제약 위반</i> 이라는 읽을 수 없는 문구로만 답한다</td></tr>
 *   <tr><td><b>잠긴 주문은 수정 불가</b></td>
 * <td>{@code LOCK_YN} 은 상태와 다른 축이다(playbook/INDEX.md) — {@link SampleRules} 가 본다</td></tr>
 * </table>
 *
 * <h2>커밋 경계가 저장마다 다르다</h2>
 *
 * <table><caption></caption>
 *   <tr><td>{@link #saveOrders}</td><td><b>전건 한 덩이</b> — 전건을 먼저 보고 그다음에 쓴다.
 *       섞으면 거부되는 요청이 쓰기를 한 번 내고 돌아가며, 롤백해도 <b>시퀀스는 뛴다</b></td></tr>
 *   <tr><td>{@link #saveFullOrders} · {@link #confirm}</td><td><b>행마다</b>(backend/row-transaction.md §4) —
 *       실패한 행만 되돌아간다. 쓰기는 {@link SampleOrderRowRunner} 가 갖는다</td></tr>
 * </table>
 *
 * <p><b>건별이라고 검증이 사라지지 않는다.</b> 행 하나 안에서 <i>검증 → 쓰기</i> 순서가
 * 그대로 서며, 그래서 <b>채번은 그 행의 검증을 통과한 뒤</b>에 온다. 통과하지 못한 행은
 * 번호를 먹지 않는다 — 먹고 나서 실패하면 그 번호는 <b>아무 주문도 갖지 못한 채 버려진다</b>
 * (screen/sample/single-offset/requirements.md §6-1). 그렇게 생긴 구멍은 정상이다:
 * {@code ORD_ID} 는 <b>식별자이지 연번이 아니다</b>.
 *
 * <p><b>이 둘에 {@code @Transactional} 이 없다.</b> 걸면 행마다 커밋되지 않는다 —
 * {@code RowTxConventionTest} 가 그것을 센다.
 */
@Service
public class SampleOrderService {

    private final SmplOrderRepository orders;
    private final SampleQueryService queries;
    private final SampleOrderRowRunner runner;
    private final Clock clock;

    public SampleOrderService(
            SmplOrderRepository orders,
            SampleQueryService queries,
            SampleOrderRowRunner runner,
            Clock clock) {
        this.orders = orders;
        this.queries = queries;
        this.runner = runner;
        this.clock = clock;
    }

    @Transactional
    public void saveOrders(List<SmplOrderSaveRow> rows) {
        Set<String> seen = new HashSet<>();
        RowTx.oneTxForAll(rows, row -> {
            if (row.ordId() != null && !seen.add(row.ordId())) {
                throw new BusinessException(
                        SampleErrorCode.NOT_FOUND,
                        "same order came twice: " + row.ordId(),
                        List.of(new BusinessException.FieldError(
                                "ordNo", "같은 주문이 두 번 왔습니다", row.ordNo())));
            }
            if (row.rowState() != RowState.D) {
                validate(row);
            }
        });

        RowTx.oneTxForAll(rows, row -> {
            switch (row.rowState()) {
                case C -> createOrder(row);
                case U -> updateOrder(row);
                case D -> deleteOrder(row);
            }
        });
    }

    /**
     * (1)의 저장 — <b>행마다 커밋한다</b>(backend/row-transaction.md §4).
     *
     * <p>{@link #saveOrders} 와 받는 컬럼이 다르고({@link SmplOrderFullSaveRow} 가 이유를 적어
     * 두었다) <b>경계도 다르다</b>. 열 건을 냈는데 셋이 걸렸을 때 일곱을 함께 되돌리면,
     * 사용자는 <b>고칠 것 셋을 찾으려고 열 건을 다시 훑는다</b>.
     *
     * <p><b>검증이 쓰기보다 앞이다</b> — 행 하나 안에서. 그래서 통과하지 못한 행은 번호를
     * 먹지 않는다(클래스 머리말).
     *
     * <p><b>요청 안의 중복은 여기서 본다.</b> 러너는 행 하나만 알고 있어 <i>같은 주문이 두 번
     * 왔다</i> 를 판정할 수 없다 — 그 사실은 <b>배열이 갖는다</b>.
     *
     * @return 몇 건을 했고 무엇이 왜 안 됐나. <b>던지지 않는다</b>
     */
    public RowReport saveFullOrders(List<SmplOrderFullSaveRow> rows) {
        Set<String> seen = new HashSet<>();
        return RowTx.oneTxPerRow(rows, row -> {
            if (row.ordId() != null && !seen.add(row.ordId())) {
                throw new BusinessException(
                        SampleErrorCode.NOT_FOUND,
                        "same order came twice: " + row.ordId(),
                        List.of(new BusinessException.FieldError(
                                "ordNo", "같은 주문이 두 번 왔습니다", row.ordNo())));
            }
            if (row.rowState() != RowState.D) {
                validateFull(row);
            }
            runner.writeFull(row);
        });
    }

    /**
     * 확정 — {@code RCV} 만 간다. <b>프로그레스가 없다</b>(playbook/INDEX.md).
     *
     * <p>고른 행 몇의 상태 하나를 바꾸는 일이라 응답이 곧 끝이며, 그 사실이 <b>같은 {@code X}
     * 액션인 일괄 재계산과 갈리는 지점</b>이다 &mdash; 이 화면이 시연하려는 것이 그 갈림이다.
     *
     * <p><b>행마다 커밋한다.</b> 예전에는 스물 중 하나가 걸리면 <b>스물 전부를 거절</b>했는데,
     * 확정은 행끼리 아무 관계가 없는 일이라 그럴 이유가 없었다 — 그 사이 남이 상태를 바꾼
     * 주문 하나가 나머지 열아홉을 막았다.
     *
     * <p><b>여기서는 아무것도 보지 않는다.</b> 판정도 쓰기도 러너의 트랜잭션 안이어야
     * 하는데, 바깥에서 미리 읽으면 그 값은 <b>커밋 시점의 것이 아니다</b>.
     *
     * @return 몇 건을 확정했고 무엇이 왜 안 됐나
     */
    public RowReport confirm(List<Long> ordIds) {
        return RowTx.oneTxPerRow(ordIds, runner::confirmOne);
    }

    /**
     * 일괄 재계산 &mdash; 68 &sect;3.4. <b>{@link Progress} 를 받는 주문 쪽 저장 메서드다.</b>
     *
     * <p>대상이 {@code target:'all'} 이라 <b>고른 행이 아니라 기준일 이전의 전량</b>이고, 준
     * 세율로 금액을 다시 센다. 세율이 인자인 것이 {@code params} 모달의 존재 이유이며
     * (68 &sect;9.13), 상수를 쓰면 <b>모달의 칸이 아무 일도 하지 않는다</b>.
     *
     * <p><b>한 트랜잭션이다.</b> 절반만 반영된 금액은 <i>다시 돌리면 되는 상태</i> 가 아니라
     * <b>어디까지 됐는지 아무도 모르는 상태</b>이며, 진행률이 {@code FAIL} 로 멈춰도 데이터는
     * 손대기 전 그대로여야 한다.
     *
     * <p><b>갱신 빈도는 {@link Progress} 가 조절한다</b> &mdash; 1% 또는 1초 중 늦은 쪽이라
     * (68 &sect;9.1) 매 행 {@code step()} 을 불러도 {@code UPDATE} 는 백 번이다.
     *
     * <p><b>전체 건수는 여기서 앉힌다</b>({@code progress.reset}). 컨트롤러가
     * {@code totCnt} 를 {@code null} 로 여는 것은 미리 세려면 같은 조건으로 {@code COUNT} 를
     * 한 번 더 돌아야 하기 때문인데, <b>조회하고 나면 그 수를 이미 알고 있다</b> &mdash;
     * 모르는 채로 두면 화면은 끝까지 불확정 막대만 돌리며 퍼센트도 남은 시간도 못 낸다.
     */
    @Transactional
    public int recalculate(LocalDate baseDt, BigDecimal vatRate, Progress progress) {
        List<SmplOrder> targets = orders.findByOrdDtLessThanEqualOrderByOrdIdAsc(baseDt);
        // 소제목은 없다 &mdash; 구간이 하나인 작업이라 창의 제목이 이미 그것을 말한다.
        progress.reset(null, (long) targets.size());
        for (SmplOrder order : targets) {
            long started = System.nanoTime();
            order.applyRecalculation(vatRate, elapsedMs(started));
            progress.step();
        }
        return targets.size();
    }

    /**
     * 출고 지시 — playbook/INDEX.md 의 실행 액션이다(<b>프로그레스 없음</b>).
     *
     * <p>화면이 {@code eligible} 로 대상을 거르지만(frontend/grid.md) 고른 뒤 남이 상태를 바꾸면 그
     * 판정은 <b>낡은 값</b>이다. 여기가 그 마지막 확인이며, <b>하나라도 안 되면 전부
     * 거부한다</b> — 일부만 나가면 사용자가 <i>무엇이 나갔나</i> 를 다시 조회해 세야 한다.
     *
     * @return 상태가 바뀐 건수
     */
    @Transactional
    public int ship(List<Long> ordIds) {
        List<SmplOrder> targets = orders.findByOrdIdIn(ordIds);
        if (targets.size() != ordIds.size()) {
            throw new BusinessException(SampleErrorCode.NOT_FOUND, "some orders are gone");
        }
        for (SmplOrder order : targets) {
            if (!order.shippable()) {
                throw new BusinessException(
                        SampleErrorCode.NOT_SHIPPABLE, "not shippable: " + order.getOrdNo());
            }
        }
        targets.forEach(SmplOrder::ship);
        return targets.size();
    }

    /**
     * 한 행을 다시 세는 데 걸린 시간 &mdash; {@code PROC_MS} 가 되는 값이다.
     *
     * <p><b>0 을 그대로 두지 않는다.</b> 계산이 마이크로초라 반내림하면 전 행이 {@code 0} 이
     * 되고, {@code renderer:'duration'} 은 <b>빈 칸과 구별되지 않는 것</b>을 그리게 된다 &mdash;
     * 어휘의 실물이 되지 못한다(48 &sect;3).
     */
    private static long elapsedMs(long startedNanos) {
        return Math.max(1L, (System.nanoTime() - startedNanos) / 1_000_000L);
    }

    private void createOrder(SmplOrderSaveRow row) {
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
                DEFAULT_CHNL,
                DEFAULT_PRIORITY,
                row.ordDt(),
                clock.instant());
        order.modify(
                row.ordNm(),
                row.custId(),
                row.custNm(),
                order.getOrdStatCd(),
                row.ordDt(),
                row.ordQtyOrZero(),
                row.unitAmtOrZero(),
                row.dcRtOrZero(),
                row.urgentYnOrFalse(),
                row.useYnOrTrue());
        orders.save(order);
    }

    private void updateOrder(SmplOrderSaveRow row) {
        SmplOrder order = queries.require(Long.valueOf(row.ordId()));
        requireUnlocked(order);
        order.modify(
                row.ordNm(),
                row.custId(),
                row.custNm(),
                row.ordStatCd(),
                row.ordDt(),
                row.ordQtyOrZero(),
                row.unitAmtOrZero(),
                row.dcRtOrZero(),
                row.urgentYnOrFalse(),
                row.useYnOrTrue());
    }

    /**
     * 물리 삭제다 — playbook/INDEX.md.
     *
     * <p>품목이 있으면 거부한다(frontend/grid.md). 화면이 이미 막았더라도 여기서 다시 보는 이유는
     * <b>고른 뒤 남이 품목을 넣었을</b> 수 있기 때문이다 — 화면의 {@code itemCnt} 는
     * 조회 시점의 값이다.
     */
    private void deleteOrder(SmplOrderSaveRow row) {
        SmplOrder order = queries.require(Long.valueOf(row.ordId()));
        requireUnlocked(order);
        if (queries.itemCount(order.getOrdId()) > 0) {
            throw new BusinessException(
                    SampleErrorCode.HAS_ITEMS,
                    "order still has items: " + order.getOrdNo(),
                    List.of(new BusinessException.FieldError(
                            "ordNo", "품목이 남아 있어 지울 수 없습니다", order.getOrdNo())));
        }
        orders.delete(order);
    }

    private static void validateFull(SmplOrderFullSaveRow row) {
        requireText(row.ordNo(), "ordNo");
        requireText(row.ordNm(), "ordNm");
        requireText(row.custId(), "custId");
        requireText(row.custNm(), "custNm");
        if (row.ordDt() == null) {
            throw new BusinessException(
                    SampleErrorCode.REQUIRED,
                    "ordDt is required",
                    List.of(new BusinessException.FieldError("ordDt", "필수 값이 비어 있습니다")));
        }
        if (row.ordStatCd() != null) {
            OrderStatus.of(row.ordStatCd());
        }
        /*
          조건부 필수 — DC_RT 가 0 보다 크면 RMK 가 필수다(playbook/INDEX.md). 화면의 required 가
          함수인 것과 같은 규칙이며(frontend/grid.md), 여기서 다시 보는 것은 화면의 판정이 요청에
          실려 오지 않기 때문이다(frontend/grid.md).
        */
        if (row.dcRtOrZero().signum() > 0 && (row.rmk() == null || row.rmk().isBlank())) {
            throw new BusinessException(
                    SampleErrorCode.RMK_REQUIRED,
                    "rmk is required when dcRt > 0",
                    List.of(new BusinessException.FieldError(
                            "rmk", "할인율이 있으면 비고가 필요합니다")));
        }
        /*
          태그 개수 — playbook/INDEX.md. **전건 앞에서 본다**(이 클래스의 머리말): replaceTags 에 두면
          세 행 중 셋째가 넘긴 요청이 앞의 둘을 이미 쓰고 돌아가고, 이 테이블은 채번을
          쓰므로 롤백해도 시퀀스는 뛴다.

          화면의 컬럼 검증이 앞서 막지만(frontend/grid.md 의 1층) 배열은 요청 본문이라 몇 개든
          실릴 수 있고, 전량 교체는 그것을 그대로 인서트로 편다.
        */
        if (row.tagListOrEmpty().size() > MAX_TAGS) {
            throw new BusinessException(
                    SampleErrorCode.TAG_TOO_MANY,
                    "too many tags: " + row.tagListOrEmpty().size(),
                    List.of(new BusinessException.FieldError(
                            "tagList",
                            "태그가 너무 많습니다",
                            String.valueOf(row.tagListOrEmpty().size()))));
        }
    }

    private static void validate(SmplOrderSaveRow row) {
        requireText(row.ordNo(), "ordNo");
        requireText(row.ordNm(), "ordNm");
        requireText(row.custId(), "custId");
        requireText(row.custNm(), "custNm");
        if (row.ordDt() == null) {
            throw new BusinessException(
                    SampleErrorCode.REQUIRED,
                    "ordDt is required",
                    List.of(new BusinessException.FieldError("ordDt", "필수 값이 비어 있습니다")));
        }
        if (row.ordStatCd() != null) {
            // 모르는 상태를 조용히 받지 않는다 — 그 행은 화면에서 정상으로 보인다.
            OrderStatus.of(row.ordStatCd());
        }
    }
}
