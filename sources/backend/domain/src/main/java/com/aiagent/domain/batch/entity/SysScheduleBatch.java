package com.aiagent.domain.batch.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 배치 등록 — sys/batch.md · screen/batch/schedule/requirements.md. <b>사람이 관리하는 유일한 배치 테이블</b>이다.
 *
 * <p>짝인 {@link SysBatchHistory} 는 러너가 쌓고 감사 컬럼이 없다. 둘의 생애가 다르다는
 * 사실이 이 클래스가 {@link BaseAuditEntity} 를 상속하고 저쪽이 상속하지 않는 것으로
 * 나타난다(sys/batch.md).
 *
 * <h2>{@code BATCH_ID} 가 PK 이자 락 키다</h2>
 *
 * <p>backend/persistence.md 이 그렇게 정했고, 그 결과가 sys/batch.md 의 <i>창고 10개</i> 다 — {@code BEAN_ID} 가
 * 같은 등록이 열이어도 <b>서로 다른 락을 잡는다</b>. 하나가 실패해도 그 창고만 실패로
 * 남으며, 배치 하나가 내부에서 10창고를 순회했다면 나머지에 영향이 갔을 것이다.
 *
 * <p><b>{@code BEAN_ID} 에 UNIQUE 가 없는 것이 그 설계의 집행</b>이다. 중복을 막으면
 * 창고마다 배치 서비스를 하나씩 만들어야 하고, 그것이 정확히 <i>데이터로 끝날 일이 코드
 * 변경이 되는</i> 상황이다.
 *
 * <h2>{@code BATCH_DESC} 가 {@code nullable = false} 다</h2>
 *
 * <p>sys/batch.md 이 <i>"끄면 무슨 일이 생기는가를 적는 자리"</i> 로 정했고 screen/batch/schedule/requirements.md 이
 * <b>비워 둔 채 저장할 수 없게</b> 했다. 운영자가 배치를 끄는 순간은 대개 장애 대응
 * 중이며 그때 소스를 열 시간은 없다 — 그리고 <b>끄는 확인 창이 이 문장을 그대로 읽어
 * 준다</b>(screen/batch/schedule/requirements.md). 비어 있으면 그 확인이 아무 말도 하지 않는다.
 *
 * <h2>{@code USE_YN} 을 여기서 따로 열지 않는다</h2>
 *
 * <p>{@link #apply} 가 전 컬럼을 함께 쓴다 — 그리드 한 행이 한 번에 저장되기 때문이다
 * (frontend/grid.md). {@code SysRole} 과 같은 모양이며, 끄기 전 확인은 <b>화면이 저장 전에</b>
 * 내고(screen/batch/schedule/requirements.md) 엔티티는 자기 행 밖의 일을 알지 않는다.
 */
@Entity
@Table(name = "SYS_SCHEDULE_BATCH")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysScheduleBatch extends BaseAuditEntity {

    /** {@code SYS_DATA_LOCK.LOCK_KEY}(200)에 들어가야 한다 — 락 키로 쓰인다(backend/persistence.md). */
    public static final int BATCH_ID_MAX = 50;

    public static final int BATCH_NM_MAX = 100;

    public static final int BATCH_DESC_MAX = 500;

    public static final int BEAN_ID_MAX = 100;

    public static final int CRON_MAX = 50;

    /** sys/batch.md — 대개 한 줄이고, 넘치면 자식 테이블로 옮길 때가 된 것이다. */
    public static final int PARAM_JSON_MAX = 2000;

    @Id
    @Column(name = "BATCH_ID", length = BATCH_ID_MAX, nullable = false)
    private String batchId;

    /** 관리자 전용 명칭이라 메시지 키가 아니다 — sys/batch.md. */
    @Column(name = "BATCH_NM", length = BATCH_NM_MAX, nullable = false)
    private String batchNm;

    /** <b>필수다</b> — 위 §{@code BATCH_DESC}. */
    @Column(name = "BATCH_DESC", length = BATCH_DESC_MAX, nullable = false)
    private String batchDesc;

    /** {@code BatchJob} 구현의 스프링 빈 이름 — 화면은 고르게 한다(screen/batch/schedule/requirements.md). */
    @Column(name = "BEAN_ID", length = BEAN_ID_MAX, nullable = false)
    private String beanId;

    /** 크론 표현식. 쿨다운과의 관계를 저장이 검증한다(backend/persistence.md · screen/batch/schedule/requirements.md). */
    @Column(name = "CRON", length = CRON_MAX, nullable = false)
    private String cron;

    /** {@code NULL} 허용 — 파라미터 없는 배치가 정상이다(sys/batch.md). */
    @Column(name = "PARAM_JSON", length = PARAM_JSON_MAX)
    private String paramJson;

    /**
     * 장애 안전망 — 업무 규칙이 아니라 인프라 사정이 정한다(backend/persistence.md).
     *
     * <p><b>실행 이력의 유령 판정도 이 값을 쓴다</b>(screen/batch/schedule/requirements.md). 임계값을 새로 만들지 않는
     * 것이 그 절의 결정이며, 그래서 이 컬럼에 소비처가 둘이다.
     */
    @Column(name = "LOCK_EXPIRY_SEC", nullable = false)
    private Integer lockExpirySec;

    /** 쿨다운 — 크론 최소 간격보다 길면 저장이 거부한다(backend/persistence.md · screen/batch/schedule/requirements.md). */
    @Column(name = "LOCK_MIN_INTERVAL_SEC", nullable = false)
    private Integer lockMinIntervalSec;

    /**
     * {@code 'N'} 이면 스케줄러가 <b>등록조차 하지 않는다</b> — screen/batch/schedule/requirements.md.
     *
     * <p>크론이 남아 있어도 돌지 않으며 <b>{@code SKIP} 이력도 남지 않는다.</b>
     * <i>"안 돈다"</i> 와 <i>"건너뛰었다"</i> 는 다른 사건이고, 실행 이력에서 <b>행이
     * 없으면 꺼져 있는 것</b>이다(screen/batch/schedule/requirements.md).
     */
    @Convert(converter = YnConverter.class)
    @Column(name = "USE_YN", length = 1, nullable = false)
    private Boolean useYn;

    /**
     * 사람이 정한다 — sys/batch.md · screen/batch/schedule/requirements.md. <b>드래그가 아니라 숫자다.</b>
     *
     * <p>screen/menu/requirements.md 가 역할 목록에서 이 컬럼을 <b>두지 않기로</b> 한 것과 갈리는 자리다.
     * 배치는 실행 순서가 의미를 갖는 묶음이 있다(마감 → 집계 → 발송).
     *
     * <p><b>중복을 막지 않는다</b> — tie-breaker({@code BATCH_ID})가 순서를 결정적으로
     * 만든다(backend/persistence.md).
     */
    @Column(name = "SORT_NO", nullable = false)
    private Integer sortNo;

    /**
     * 신규 — {@code BATCH_ID} 는 <b>여기서만</b> 정해진다.
     *
     * <p>PK 라 고칠 수 없다(sys/user-role.md). 고치려면 지우고 다시 만드는데, 이 테이블은 <b>물리
     * 삭제를 허용</b>하므로(screen/batch/schedule/requirements.md) 실제로 그 길이 있다 — 역할과 갈리는 점이다.
     */
    public static SysScheduleBatch created(
            String batchId,
            String batchNm,
            String batchDesc,
            String beanId,
            String cron,
            String paramJson,
            int lockExpirySec,
            int lockMinIntervalSec,
            boolean useYn,
            int sortNo) {
        SysScheduleBatch batch = new SysScheduleBatch();
        batch.batchId = batchId;
        batch.apply(
                batchNm, batchDesc, beanId, cron, paramJson,
                lockExpirySec, lockMinIntervalSec, useYn, sortNo);
        return batch;
    }

    /**
     * 수정 — <b>전 컬럼을 함께 쓴다</b>(frontend/grid.md).
     *
     * <p>{@code PARAM_JSON} 은 <b>빈 문자열을 저장하지 않는다.</b> Oracle 에서 빈 문자열과
     * {@code NULL} 이 같은 값이라(backend/persistence.md), 넣는 쪽에서 갈라 두지 않으면 <b>벤더마다 다른
     * 값이 저장</b>된다 — 그러면 <i>"파라미터가 있는 배치"</i> 를 세는 질문의 답이 DB 마다
     * 달라진다.
     */
    public void apply(
            String batchNm,
            String batchDesc,
            String beanId,
            String cron,
            String paramJson,
            int lockExpirySec,
            int lockMinIntervalSec,
            boolean useYn,
            int sortNo) {
        this.batchNm = batchNm;
        this.batchDesc = batchDesc;
        this.beanId = beanId;
        this.cron = cron;
        this.paramJson = paramJson == null || paramJson.isBlank() ? null : paramJson;
        this.lockExpirySec = lockExpirySec;
        this.lockMinIntervalSec = lockMinIntervalSec;
        this.useYn = useYn;
        this.sortNo = sortNo;
    }
}
