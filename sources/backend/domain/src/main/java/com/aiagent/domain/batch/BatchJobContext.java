package com.aiagent.domain.batch;

import java.util.function.BooleanSupplier;

/**
 * 한 번의 실행이 아는 것 — BATCH-09 · screen/batch/schedule/requirements.md.
 *
 * <p>넷뿐이다. 배치가 <b>자기 등록을 알아야</b> 파라미터를 읽고(sys/batch.md), <b>자기 이력
 * 행을 알아야</b> 로그에 그 번호를 적을 수 있으며, <b>취소를 물을 수 있어야</b> 협조적
 * 중단이 성립한다.
 *
 * <h2>{@link #isCancelRequested()} 가 이 레코드의 존재 이유다</h2>
 *
 * <p>sys/batch.md — 중단은 즉시 일어나지 않는다. 배치는 다른 노드에서 돌 수 있으므로 스레드를
 * 직접 끊을 수 없고, <b>배치가 체크포인트에서 플래그를 읽고 스스로 멈춘다</b>.
 *
 * <pre>{@code
 * for (Order order : targets) {
 *     if (context.isCancelRequested()) {
 *         return BatchJobResult.of("중단 요청으로 " + done + "건에서 멈췄다");
 *     }
 *     ...
 * }
 * }</pre>
 *
 * <p><b>DB 를 매번 읽는다.</b> 요청은 <b>다른 노드의 화면</b>이 세우므로(screen/batch/schedule/requirements.md) 메모리
 * 플래그로는 보이지 않는다 — 캐시하면 <i>중단이 안 먹는다</i> 가 되고, 그것은 운영자가
 * 버튼을 다시 누르게 만드는 정확히 그 상황이다. 체크포인트를 <b>너무 잘게 두지 않는 것</b>
 * 이 구현의 몫이며, 그 균형은 배치가 자기 단위를 안다(주문 하나마다 vs 1000건마다).
 *
 * @param batchId 어느 등록인가 — 같은 구현을 쓰는 형제 등록과 자기를 가르는 값이다
 * @param paramJson {@code PARAM_JSON} <b>원문</b>. {@code null} 일 수 있다 —
 *     파싱은 구현의 몫이다({@link BatchJob} 의 <i>스펙은 코드가 갖는다</i>)
 * @param histId {@code SYS_BATCH_HISTORY.HIST_ID} — 로그에 적어 두면 화면의 행과 이어진다
 * @param cancelCheck 취소 여부를 <b>지금</b> 묻는다. {@link #isCancelRequested()} 로 부른다
 */
public record BatchJobContext(
        String batchId, String paramJson, Long histId, BooleanSupplier cancelCheck) {

    /** 체크포인트에서 부른다 — <b>부르지 않는 구현은 끝까지 돈다</b>({@link BatchJob}). */
    public boolean isCancelRequested() {
        return cancelCheck != null && cancelCheck.getAsBoolean();
    }
}
