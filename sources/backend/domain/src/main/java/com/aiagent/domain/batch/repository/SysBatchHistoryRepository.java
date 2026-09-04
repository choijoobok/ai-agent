package com.aiagent.domain.batch.repository;

import com.aiagent.domain.batch.BatchResultCode;
import com.aiagent.domain.batch.entity.SysBatchHistory;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 배치 실행 이력 — sys/batch.md.
 *
 * <p>메서드 셋이 전부 <b>{@code RUNNING} 을 묻는다</b>. 목록·상세·엑셀은
 * {@code QuerySpec} 을 지나고(backend/api.md) 여기 오지 않으므로, 남는 것은 <i>지금 도는 것이
 * 있는가</i> 뿐이다 — 그 질문이 세 화면 동작의 전제다: 즉시 실행의 거부(screen/batch/schedule/requirements.md) ·
 * 삭제 게이트(screen/batch/schedule/requirements.md) · 중단 대상 판정(screen/batch/schedule/requirements.md).
 */
public interface SysBatchHistoryRepository extends JpaRepository<SysBatchHistory, Long> {

    /**
     * 이 배치가 지금 도는가 — 즉시 실행의 <b>실행 중</b> 판정과 삭제 게이트가 함께 쓴다.
     *
     * <p><b>락 테이블이 아니라 이력을 본다.</b> screen/batch/schedule/requirements.md 은 문구에 <i>노드와 시각</i> 을
     * 넣으라고 했고({@code "이미 실행 중입니다 (노드 app-02, 09:14 시작)"}), 그 둘을 함께
     * 갖는 것은 이력 행이다. 락은 <i>잡혔다</i> 만 말한다.
     *
     * <p><b>유령도 여기 걸린다</b>(screen/batch/schedule/requirements.md) — 죽은 프로세스의 {@code RUNNING} 행이 남아
     * 있으면 즉시 실행이 막힌다. 그것을 여기서 풀지 않는 것이 결정이다: 정리는 <b>락 만료
     * 안전망의 일</b>이며, 이 메서드가 만료를 판단하기 시작하면 정리 주체가 둘이 된다.
     */
    List<SysBatchHistory> findByBatchIdAndRsltCd(String batchId, BatchResultCode rsltCd);

    /** 여러 배치를 한 번에 — 마스터 목록의 삭제 게이트가 행마다 부르지 않기 위해서다. */
    @Query("""
            select h.batchId
            from SysBatchHistory h
            where h.batchId in :batchIds
              and h.rsltCd = com.aiagent.domain.batch.BatchResultCode.RUNNING
            """)
    List<String> findRunningBatchIds(@Param("batchIds") List<String> batchIds);

    /**
     * 쿨다운의 기준 시각 — <b>마지막으로 실제로 돈 실행</b>의 시작 시각.
     *
     * <p>락의 {@code RELEASE_DTM} 을 보지 않는 것이 결정이다. 저장소는 선점 실패의 이유를
     * 가르지 않으므로({@code tryAcquire} 가 {@code false} 하나다) <b>쿨다운과 락 선점을
     * 여기서 미리 갈라야</b> {@code SKIP_COOLDOWN} 과 {@code SKIP_LOCK} 이 서로 다른
     * 코드로 남는다 — 하나는 결함이고 하나는 정상이다(screen/batch/schedule/requirements.md).
     *
     * <h2>{@code SKIP_*} 행을 <b>제외한다</b> — 뒤집은 결정이다(2026-08-31)</h2>
     *
     * <p>처음에는 <i>건너뜀도 그 주기에 시도했다는 기록</i>이라는 이유로 포함했다. 그
     * 문장은 맞지만 <b>쿨다운의 기준으로 삼을 이유가 되지 못한다</b> — 재실행 간격은
     * <b>실행과 실행 사이</b>의 거리이고, 건너뜀은 실행이 아니다.
     *
     * <p>포함하면 <b>톱니바퀴가 된다.</b> 쿨다운이 크론 주기보다 길어진 등록에서:
     *
     * <table><caption></caption>
     *   <tr><th>주기</th><th>기준(포함할 때)</th><th>판정</th></tr>
     *   <tr><td>{@code T+300}</td><td>{@code T}</td><td>막힘 → {@code SKIP} 행이 {@code T+300} 에 생긴다</td></tr>
     *   <tr><td>{@code T+600}</td><td><b>{@code T+300}</b></td><td>막힘 → 또 하나가 {@code T+600} 에</td></tr>
     *   <tr><td>{@code T+900}</td><td><b>{@code T+600}</b></td><td>막힘 …</td></tr>
     * </table>
     *
     * <p><b>자기가 만든 행이 자기 다음 판정의 기준</b>이 되어 쿨다운이 주기마다 앞으로
     * 밀린다. 그 배치는 <b>다시는 돌지 않으며</b>, 화면에는 <i>매 주기 건너뜀</i> 만
     * 쌓여 <b>쿨다운이 일하고 있는 것처럼</b> 보인다. 저장 검증이 그 설정을 막지만
     * 시드와 직접 UPDATE 는 그 검증을 지나지 않는다({@code BatchScheduler} 의 기동 재검증이
     * 그래서 있다).
     *
     * <p>제외하면 위 표의 {@code T+600} 에서 기준이 {@code T} 로 남아 <b>제때 다시 돈다</b> —
     * 쿨다운이 정확히 <i>설정한 간격만큼</i> 벌어지고, 그것이 backend/persistence.md 가 정의한 것이다.
     *
     * <p><b>{@code SKIP_LOCK} 도 함께 제외한다.</b> 그것은 <i>다른 노드가 돌았다</i> 는
     * 기록이며, 그 노드의 실제 실행 행이 같은 테이블에 있으므로 기준은 <b>그 행이 준다</b>.
     */
    @Query("""
            select max(h.startDtm)
            from SysBatchHistory h
            where h.batchId = :batchId
              and h.rsltCd not in (
                    com.aiagent.domain.batch.BatchResultCode.SKIP_LOCK,
                    com.aiagent.domain.batch.BatchResultCode.SKIP_COOLDOWN)
            """)
    Optional<Instant> findLastAttemptStart(@Param("batchId") String batchId);

    /**
     * 지금 {@code RUNNING} 인 행 전부 — <b>유령 청소가 훑는 목록</b>이다(screen/batch/schedule/requirements.md).
     *
     * <p>배치별로 묻지 않는다. 유령은 <i>어느 배치인지 이미 아는 상태</i>에서 찾는 것이
     * 아니라 <b>있는 줄도 몰랐던 것</b>을 찾는 일이며, 정상 상태에서 이 목록은 동시에 도는
     * 배치 수(보통 0~3)와 같다 — 전건 조회가 값싼 이유다.
     */
    List<SysBatchHistory> findByRsltCd(BatchResultCode rsltCd);


    /**
     * 중단 대상 — <b>선택된 행을 다시 읽는다</b>.
     *
     * <p>화면이 {@code eligible} 로 이미 걸렀지만(frontend/grid.md) 그것은 <b>고른 시점의 사실</b>이다.
     * 그 사이 배치가 끝났을 수 있고, 그때는 조용히 건너뛰는 것보다 <b>거절</b>이 맞다 —
     * screen/batch/schedule/requirements.md 가 <i>"버튼은 한 번만 먹는다"</i> 로 요청의 유일성을 요구했으므로, 이미 끝난
     * 행에 요청을 세우면 <b>영원히 응답하지 않을 요청</b>이 이력에 남는다.
     */
    List<SysBatchHistory> findByHistIdIn(List<Long> histIds);

    /**
     * 파기 대상의 <b>번호만</b> 한 청크 — LOG-07 · retention.md.
     *
     * <p><b>기준이 {@code START_DTM} 이다</b> — 이 테이블에는 {@code CRE_DTM} 이 없다.
     * 시작한 시각이 곧 그 행이 생긴 시각이며, {@code IX_SYS_BATCH_HISTORY_01(START_DTM)}
     * 이 그 조건을 받는다.
     *
     * <p><b>{@code RUNNING} 을 뺀다.</b> 1년 넘게 {@code RUNNING} 인 행은 유령이고 유령은
     * {@code BatchGhostSweeper} 가 종결시킨다 — 여기서 지워 버리면 <b>그 실행이 있었다는
     * 사실 자체가 사라지고</b>, 마침 그 순간 돌고 있던(시계가 틀어졌거나 파라미터가 이상한)
     * 실행이라면 종료 기록이 갈 곳을 잃는다. 종결은 종결의 일이고 파기는 파기의 일이다.
     *
     * <p><b>파기 배치 자신의 이력도 대상이다</b>(retention.md). 순환이 아니다 — 지우는 것은
     * 1년 전 행이고 지금 도는 실행의 행은 방금 만들어졌다.
     */
    @Query("""
            select h.histId
            from SysBatchHistory h
            where h.startDtm < :cutoff
              and h.rsltCd <> com.aiagent.domain.batch.BatchResultCode.RUNNING
            """)
    List<Long> findIdsStartedBefore(@Param("cutoff") Instant cutoff, Pageable chunk);
}
