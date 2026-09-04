package com.ordinary.backoffice.api.batch.response;

import java.time.Instant;
import java.util.List;

/**
 * 즉시 실행의 응답 — grid-api-contract.md §9 · 65 §3.7. <b>건별이다.</b>
 *
 * <p>그 절이 <i>"응답: 모달 — 성공/실패를 건별로 낸다"</i> 고 적었다. 여러 건을 골라
 * 누르면 어떤 것은 시작하고 어떤 것은 이미 돌고 있으며, <b>첫 실패에서 예외를 던지면
 * 나머지가 시작조차 못 한다</b> — 그래서 이 경로만 오류를 예외가 아니라 값으로 나른다.
 *
 * <h2>문구를 서버가 짓지 않는다</h2>
 *
 * <p>65 §3.7 이 요구한 문구는 <i>"이미 실행 중입니다 (노드 {@code app-02}, 09:14 시작)"</i>
 * 이고, 그 안에 <b>노드와 시각</b>이 들어간다. 서버가 완성된 문장을 내려보내면 그것은
 * <b>서버의 언어</b>로 굳고(architecture.md §6-1.2 가 오류 문구에서 감수한 대가), 이 화면은 오류 응답이
 * 아니라 <b>정상 응답</b>이라 그 대가를 감수할 이유가 없다.
 *
 * <p>그래서 값만 내려보내고 화면이 메시지 키에 끼운다 — {@code label(key, params)} 가
 * {@code {node}} · {@code {time}} 을 치환한다.
 *
 * @param items 요청한 순서 그대로 — 화면이 자기 선택과 짝지어 읽는다
 */
public record BatchRunResponse(List<Item> items) {

    /**
     * 한 건의 결과.
     *
     * @param started 시작했는가. {@code false} 면 아래 둘이 이유를 나른다
     * @param runningNodeId 이미 도는 노드 — <b>{@code null} 일 수 있다</b>. 락은 잡혀 있는데
     *     {@code RUNNING} 이력이 없는 경우이며(락이 방금 잡혔거나 해제 직전이다) 화면은
     *     그때 노드 없는 문구를 낸다
     * @param runningStartedAt 그 실행의 시작 시각 — 운영자가 <b>얼마나 기다려야 하는지</b>
     *     를 재는 값이다. 31 §8 이 {@code NODE_ID} 를 남긴 것과 같은 이유로 함께 간다
     */
    public record Item(
            String batchId, boolean started, String runningNodeId, Instant runningStartedAt) {}
}
