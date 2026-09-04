package com.ordinary.backoffice.domain.batch.entity;

import com.ordinary.backoffice.domain.batch.BatchExecType;
import com.ordinary.backoffice.domain.batch.BatchResultCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.TableGenerator;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

/**
 * 배치 실행 이력 — 46 §6 · 65 §4. <b>이력인데 갱신된다.</b>
 *
 * <p>45 §2.1 이 이력 행을 <i>불변</i> 으로 규정했고 이 테이블만 예외다. 이유는 하나다 —
 * <b>{@code RUNNING} 을 미리 넣기</b> 때문이며(46 §6), 그렇게 하지 않으면 프로세스가
 * 죽었을 때 아무 흔적도 남지 않아 <i>실행 자체가 없었던 것</i> 과 구분되지 않는다.
 *
 * <p>그 대가로 <b>{@code END_DTM} 이 NULL 인 채 오래 남은 행</b>이 생기고, 그것이 곧
 * 비정상 종료의 증거다 — 화면이 {@code LOCK_EXPIRY_SEC} 를 조인해 <b>유령</b>으로
 * 판정한다(65 §4.4). <b>화면이 정리하지는 않는다</b>: 유령을 {@code FAIL} 로 바꾸는 것은
 * 락 만료 안전망의 일이며, 버튼을 두면 정리 주체가 둘이 된다.
 *
 * <h2>감사 4컬럼이 없다</h2>
 *
 * <p>쓰는 주체가 사람이 아니라 러너다(45 §2.1). 대신 {@code NODE_ID} 가 있고 그것이
 * <i>"누가 썼나"</i> 에 답한다 — 46 §2.5 가 세 테이블이 같은 규칙으로 이 값을 만든다고
 * 적었으며, 그래야 <i>락을 잡은 노드</i> 와 <i>배치를 실행한 노드</i> 를 대조할 수 있다.
 *
 * <h2>FK 가 없다</h2>
 *
 * <p>46 §2.2. 등록을 지워도 이 행은 남으며 <b>남아야 한다</b> — 45 §2.2 의 <i>"존재하지
 * 않는 주체의 기록도 남아야 한다"</i> 와 같은 규칙이다. 이력이 삭제 게이트가 되면
 * <b>오래된 배치는 영영 못 지운다</b>(65 §3.8). 대가는 화면의 고아이며 그것을
 * {@code (삭제된 배치)} 로 그린다.
 *
 * <h2>긴 문자열이 <b>둘</b>이다</h2>
 *
 * <p>{@code RSLT_DTL_MSG}(처리한 대상 목록)와 {@code ERR_MSG}(예외 스택). 둘 다
 * {@code nclob} 이라 <b>목록 조회가 SELECT 하지 않고</b>(65 §2.2) 상세 모달의 <b>탭 둘</b>이
 * 된다. 합치지 않는 이유는 축이 다르기 때문이다 — 상세는 <b>성공한 실행에도</b> 남고
 * 오류는 실패한 실행에만 남는다(46 §6.3).
 */
@Entity
@Table(name = "SYS_BATCH_HISTORY")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysBatchHistory {

    /** {@link SysScheduleBatch#BATCH_ID_MAX} 와 같아야 조인이 성립한다. */
    public static final int BATCH_ID_MAX = 50;

    public static final int NODE_ID_MAX = 100;

    /**
     * 한 줄 요약 — <b>{@code nclob} 이 아니다</b>(46 §6.3).
     *
     * <p>{@code nclob} 으로 올리면 목록 컬럼 자격을 잃는다(grid-column-contract.md §5.5 — Oracle 이 {@code CLOB}
     * 의 {@code ORDER BY} 를 막는다). <i>"어느 배치가 몇 건을 처리했나"</i> 는 목록에서
     * 훑는 질문이라 셀에서 사라지면 안 된다. {@code VARCHAR} 이므로 <b>초과분은 절단</b>이다.
     */
    public static final int RSLT_MSG_MAX = 1000;

    @Id
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "sys_sequence")
    @TableGenerator(
            name = "sys_sequence",
            table = "SYS_SEQUENCE",
            pkColumnName = "SEQ_NAME",
            valueColumnName = "NEXT_VAL",
            pkColumnValue = "SYS_BATCH_HISTORY",
            initialValue = 1,
            allocationSize = 1000)
    @Column(name = "HIST_ID")
    private Long histId;

    @Column(name = "BATCH_ID", length = BATCH_ID_MAX, nullable = false)
    private String batchId;

    @Enumerated(EnumType.STRING)
    @Column(name = "EXEC_TYPE_CD", length = 20, nullable = false)
    private BatchExecType execTypeCd;

    /** 중복 실행의 원인을 가르는 유일한 값 — 46 §6 · 31 §8. */
    @Column(name = "NODE_ID", length = NODE_ID_MAX, nullable = false)
    private String nodeId;

    @Column(name = "START_DTM", nullable = false)
    private Instant startDtm;

    /** 진행 중이면 {@code null} — 65 §4.4. */
    @Column(name = "END_DTM")
    private Instant endDtm;

    /**
     * 소요 밀리초 — <b>파생 값이지만 저장한다</b>(46 §6).
     *
     * <p>{@code END_DTM - START_DTM} 으로 계산하면 조회마다 벤더별 시간 차 함수를 쓰게
     * 되고(22) <i>"오래 걸린 배치"</i> 정렬이 인덱스를 못 탄다. 그 정렬이 65 §2.1 이 이
     * 화면에서 정렬을 열어 둔 이유 전부다.
     */
    @Column(name = "ELAPSED_MS")
    private Long elapsedMs;

    @Enumerated(EnumType.STRING)
    @Column(name = "RSLT_CD", length = 20, nullable = false)
    private BatchResultCode rsltCd;

    @Column(name = "RSLT_MSG", length = RSLT_MSG_MAX)
    private String rsltMsg;

    /** 처리한 대상 목록 등 — 46 §6.3 신설. 대개 {@code null} 이다. */
    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "RSLT_DTL_MSG")
    private String rsltDtlMsg;

    /** 실패 시 예외 스택. {@code @Lob} 이 아닌 이유는 db-portability.md §3.1 의 실측이다. */
    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "ERR_MSG")
    private String errMsg;

    /**
     * 중단 요청 시각 — <b>결과가 아니라 요청이다</b>(46 §6.2 · 65 §4.5).
     *
     * <p>배치가 <b>체크포인트에서 읽어 가는 플래그</b>이며, 그래서 이 컬럼을 쓰는 API 가
     * {@code SAVE} 가 아니라 {@code EXECUTE} 다(65 §4.9) — 컬럼 쓰기가 결과 그 자체가
     * 아니라 <b>절차가 지나가는 통로</b>다.
     */
    @Column(name = "CANCEL_REQ_DTM")
    private Instant cancelReqDtm;

    /**
     * 시작 — {@code RUNNING} 으로 INSERT 한다(46 §6).
     *
     * <p>{@code ELAPSED_MS} 도 {@code END_DTM} 도 아직 없다. 여기서 {@code 0} 을 넣지 않는
     * 것이 중요하다 — <i>0ms 만에 끝났다</i> 와 <i>아직 안 끝났다</i> 가 같은 값이 되고,
     * 소요 정렬이 진행 중인 행을 맨 앞에 올린다.
     */
    public static SysBatchHistory started(
            String batchId, BatchExecType execType, String nodeId, Instant startDtm) {
        SysBatchHistory history = new SysBatchHistory();
        history.batchId = batchId;
        history.execTypeCd = execType;
        history.nodeId = nodeId;
        history.startDtm = startDtm;
        history.rsltCd = BatchResultCode.RUNNING;
        return history;
    }

    /**
     * 건너뜀 — 시작하지 않았지만 <b>행은 남는다</b>(46 §6.1).
     *
     * <p>기록하지 않으면 <i>"어제 배치가 안 돌았다"</i> 를 조사할 때 아무 흔적도 없다.
     * 원칙 P1 의 <i>"실패가 시끄러운 쪽"</i> 이다.
     *
     * <p><b>{@code START_DTM} 과 {@code END_DTM} 이 같고 소요가 0</b> 이다. 시작하지 않았으므로
     * 소요를 {@code null} 로 둘 수도 있지만, 그러면 소요 정렬에서 <b>유령과 같은 자리</b>에
     * 선다 — 건너뜀은 끝난 사건이고 유령은 끝나지 않은 사건이라 구분돼야 한다.
     */
    public static SysBatchHistory skipped(
            String batchId,
            BatchExecType execType,
            String nodeId,
            Instant at,
            BatchResultCode rsltCd,
            String rsltMsg) {
        SysBatchHistory history = new SysBatchHistory();
        history.batchId = batchId;
        history.execTypeCd = execType;
        history.nodeId = nodeId;
        history.startDtm = at;
        history.endDtm = at;
        history.elapsedMs = 0L;
        history.rsltCd = rsltCd;
        history.rsltMsg = truncate(rsltMsg);
        return history;
    }

    /**
     * 종료 — {@code RUNNING} 행을 갱신한다.
     *
     * <p><b>{@code CANCEL_REQ_DTM} 을 건드리지 않는다.</b> 중단을 요청했는데 배치가 그것을
     * 읽지 않고 그냥 끝난 경우가 46 §6.2 표의 넷째 줄이며, 그때 {@code RSLT_CD} 는
     * {@code SUCCESS} 이고 요청 시각은 <b>남아 있어야 한다</b> — 화면은 그것을 거짓말하지
     * 않는다(65 §4.5).
     */
    public void finish(
            BatchResultCode rsltCd,
            Instant endDtm,
            String rsltMsg,
            String rsltDtlMsg,
            String errMsg) {
        this.rsltCd = rsltCd;
        this.endDtm = endDtm;
        this.elapsedMs = endDtm.toEpochMilli() - this.startDtm.toEpochMilli();
        this.rsltMsg = truncate(rsltMsg);
        this.rsltDtlMsg = rsltDtlMsg;
        this.errMsg = errMsg;
    }

    /**
     * 유령 판정 — <b>결과를 모른 채 종결시킨다</b>(65 §4.4).
     *
     * <p>{@link #finish} 를 쓰지 않는 것이 요점이다. 그 메서드는 <b>끝난 시각을 안다</b>는
     * 전제로 소요를 계산하는데, 여기서 아는 것은 <i>판정한 시각</i>뿐이다 — 노드는 그보다
     * 앞의 <b>알 수 없는 시점</b>에 죽었다.
     *
     * <table><caption></caption>
     *   <tr><td>{@code END_DTM}</td><td>판정 시각</td>
     *       <td><b>비워 두지 않는다</b> — 종결됐는데 비어 있으면 화면이 진행 중으로 읽는다</td></tr>
     *   <tr><td>{@code ELAPSED_MS}</td><td><b>{@code null}</b></td>
     *       <td>모른다. 판정 시각까지를 소요로 적으면 <i>3일 걸린 배치</i> 가 된다</td></tr>
     * </table>
     *
     * <p><b>{@code RUNNING} 일 때만 먹는다.</b> 노드 둘이 같은 순간에 쓸어도 두 번째는
     * 아무 일도 하지 않으며, 그 사이 배치가 스스로 끝냈다면 <b>그 결과가 이긴다</b> —
     * 실제로 돈 것이 판정보다 언제나 정확하다.
     *
     * @return 이번 호출이 실제로 유령으로 바꿨는가
     */
    public boolean markLost(Instant at, String rsltMsg) {
        if (this.rsltCd != BatchResultCode.RUNNING) {
            return false;
        }
        this.rsltCd = BatchResultCode.LOST;
        this.endDtm = at;
        this.elapsedMs = null;
        this.rsltMsg = truncate(rsltMsg);
        return true;
    }

    /**
     * 중단 요청 — <b>한 번만 먹는다</b>(65 §4.5).
     *
     * <p>이미 요청된 행에 다시 시각을 쓰면 <i>언제 눌렀나</i> 가 뒤로 밀리고, 화면이 그
     * 값으로 <b>버튼을 비활성</b>하며 문구에 시각을 싣기 때문에 두 번째 요청이 첫 번째의
     * 기록을 지우는 셈이 된다. 그래서 값이 있으면 그대로 둔다.
     *
     * @return 이번 호출이 실제로 요청을 세웠는가
     */
    public boolean requestCancel(Instant at) {
        if (this.cancelReqDtm != null) {
            return false;
        }
        this.cancelReqDtm = at;
        return true;
    }

    /** {@code RSLT_MSG} 만 자른다 — {@code nclob} 둘은 길이 제약이 다르다. */
    private static String truncate(String value) {
        if (value == null || value.length() <= RSLT_MSG_MAX) {
            return value;
        }
        return value.substring(0, RSLT_MSG_MAX);
    }
}
