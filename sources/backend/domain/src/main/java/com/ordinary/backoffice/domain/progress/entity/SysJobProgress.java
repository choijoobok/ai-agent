package com.ordinary.backoffice.domain.progress.entity;

import com.ordinary.backoffice.domain.progress.JobStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

/**
 * 진행률 한 건 — 30 §6 · 46 §8.
 *
 * <p><b>감사 4컬럼이 없다.</b> {@code USER_ID} 는 작성자가 아니라 <b>시작한 사람</b>이고
 * 그것이 곧 인가의 근거다(46 §8.1) — {@code REG_ID} 를 함께 두면 언제나 같은 값인 컬럼이
 * 하나 늘고, 40 §4.2 가 <i>신뢰할 수 없는 컬럼</i> 이라 부른 것이 된다.
 *
 * <p><b>임시 행이다.</b> 업무 이력이 아니라 <i>지금 도는 것</i>을 보여주기 위한 자리이며,
 * 종료 후 보관 기간을 넘기면 지운다(32 §5) — 보존 정책이 아니라 <b>만료 청소</b>다.
 *
 * <p><b>갱신된다.</b> 이력 행의 불변 규약(45 §2.1)에 걸리지 않는 것은 이것이 이력이
 * 아니기 때문이며, {@code SYS_BATCH_HISTORY} 가 같은 이유로 예외인 것과는 자리가 다르다.
 */
@Entity
@Table(name = "SYS_JOB_PROGRESS")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysJobProgress {

    public static final int STEP_MSG_MAX = 500;

    /** 문장이 아니라 <b>이름</b>이라 {@link #STEP_MSG_MAX} 보다 짧다 — 028 의 주석. */
    public static final int SUB_TITLE_MAX = 300;

    @Id
    @Column(name = "JOB_ID", length = 64, nullable = false)
    private String jobId;

    /** 시작한 사람 — 조회에서 세션 사용자와 대조한다(46 §8.1). */
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "JOB_STAT_CD", length = 20, nullable = false)
    private JobStatus jobStatCd;

    @Column(name = "CUR_CNT", nullable = false)
    private long curCnt;

    /**
     * 전체 건수 — <b>모르면 {@code null} 이다</b>(46 §8).
     *
     * <p>0 으로 두면 {@code 0/0} 이 되어 <b>완료로 보인다</b>. 화면은 이 값이 없으면
     * 불확정 막대를 그린다.
     */
    @Column(name = "TOT_CNT")
    private Long totCnt;

    /**
     * 지금 <b>어느 구간</b>인가 — 서버가 임의로 정한다.
     *
     * <p>한 실행이 구간으로 갈릴 때만 쓴다(고른 행마다 딸린 디테일을 도는 실행). 아래
     * {@code STEP_MSG} 와 갈라 두는 것이 요점이다 — 그쪽은 구간 <b>안에서</b> 계속 바뀌므로
     * 한 칸에 둘을 쓰면 <b>어느 행을 보고 있는지가 1초마다 사라진다</b>.
     */
    @Column(name = "SUB_TITLE", length = SUB_TITLE_MAX)
    private String subTitle;

    /** 퍼센트만 있으면 <i>멈춘 것</i>과 <i>느린 것</i>을 구별할 수 없다(68 §9.1). */
    @Column(name = "STEP_MSG", length = STEP_MSG_MAX)
    private String stepMsg;

    /** 실패 사유. {@code @Lob} 이 아닌 이유는 db-portability.md §3.1 의 실측이다. */
    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "ERR_MSG")
    private String errMsg;

    @Column(name = "CRE_DTM", nullable = false)
    private Instant creDtm;

    @Column(name = "MOD_DTM", nullable = false)
    private Instant modDtm;

    /** {@code RUNNING} 사전 등록 — 30 §6. */
    public static SysJobProgress start(String jobId, String userId, Long totCnt, Instant now) {
        SysJobProgress progress = new SysJobProgress();
        progress.jobId = jobId;
        progress.userId = userId;
        progress.jobStatCd = JobStatus.RUNNING;
        progress.curCnt = 0L;
        progress.totCnt = totCnt;
        progress.creDtm = now;
        progress.modDtm = now;
        return progress;
    }

    /**
     * 진행 — <b>건수와 문구를 함께</b> 옮긴다.
     *
     * <p>{@code stepMsg} · {@code subTitle} 이 {@code null} 이면 <b>앞의 것을 남긴다</b>. 매
     * 걸음 문구를 주는 작업은 드물고, 지우면 사용자가 보던 <i>지금 무엇을 하는 중</i>이
     * 사라진다.
     */
    public void progress(long curCnt, String stepMsg, String subTitle, Instant now) {
        this.curCnt = curCnt;
        if (stepMsg != null) {
            this.stepMsg = truncate(stepMsg, STEP_MSG_MAX);
        }
        if (subTitle != null) {
            this.subTitle = truncate(subTitle, SUB_TITLE_MAX);
        }
        this.modDtm = now;
    }

    /**
     * <b>다음 구간으로 넘어간다</b> — 소제목을 바꾸고 건수를 0 으로 되돌린다.
     *
     * <p><b>둘이 한 번에 바뀌어야 한다.</b> 갈라 쓰면 그 사이의 폴링이 <i>새 소제목 + 앞
     * 구간의 건수</i> 를 보는데, 앞 구간이 더 컸으면 화면은 <b>100% 를 넘긴 막대</b>를
     * 그리고 작았으면 <b>이미 끝난 구간</b>을 보인다.
     *
     * <p><b>{@code STEP_MSG} 는 지우지 않는다.</b> 구간이 바뀌면 그 문구는 낡은 것이지만,
     * 비우면 그 줄이 사라져 창의 높이가 흔들린다 — 다음 걸음이 곧 덮어쓰고, 문구가 중요한
     * 작업은 {@code reset} 직후에 그것을 함께 준다.
     *
     * @param subTitle {@code null} 이면 앞의 소제목이 남는다 — 건수만 되돌리는 자리다
     * @param totCnt 이 구간의 전체 건수. <b>모르면 {@code null}</b> — 불확정 막대로 돌아간다
     */
    public void reset(String subTitle, Long totCnt, Instant now) {
        this.curCnt = 0L;
        this.totCnt = totCnt;
        if (subTitle != null) {
            this.subTitle = truncate(subTitle, SUB_TITLE_MAX);
        }
        this.modDtm = now;
    }

    public void complete(Instant now) {
        this.jobStatCd = JobStatus.DONE;
        // 끝났으면 100% 다 — 마지막 flush 가 늦었어도 화면이 99% 에서 멈추지 않는다(30 §6.2).
        if (totCnt != null) {
            this.curCnt = totCnt;
        }
        this.modDtm = now;
    }

    public void fail(String errMsg, Instant now) {
        this.jobStatCd = JobStatus.FAILED;
        this.errMsg = errMsg;
        this.modDtm = now;
    }

    /**
     * {@code VARCHAR} 이므로 초과분은 <b>여기서</b> 자른다.
     *
     * <p>DB 가 자르게 두면 벤더마다 다르다 — 자르는 곳도, 예외로 죽는 것도 있다. 진행률
     * 문구 때문에 <b>작업이 실패하는 것</b>이 가장 나쁜 결과다.
     */
    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
