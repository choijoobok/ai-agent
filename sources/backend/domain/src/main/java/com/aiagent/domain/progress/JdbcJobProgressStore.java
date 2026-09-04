package com.aiagent.domain.progress;

import com.aiagent.domain.progress.entity.SysJobProgress;
import com.aiagent.domain.progress.repository.SysJobProgressRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * DB 에 담는 진행률 — backend/crosscutting.md 의 {@code jdbc} store.
 *
 * <p><b>쓰기마다 자기 트랜잭션이다</b>({@code REQUIRES_NEW}). 진행률은 <b>작업의 트랜잭션과
 * 운명을 함께하면 안 된다</b> — 같이 묶이면 도는 동안 아무것도 커밋되지 않아 화면이
 * <i>0% 에서 멈춘 것</i>을 보고, 작업이 실패해 롤백되면 <b>실패 사유까지 함께 사라진다</b>.
 * 그러면 사용자에게 남는 것은 영영 {@code RUNNING} 인 행 하나다.
 *
 * <p><b>throttle 은 여기가 아니다</b>({@link Progress}). 이 클래스는 <i>쓰라면 쓴다</i> 이고
 * 언제 쓸지는 부르는 쪽이 정한다 — 저장소마다 다른 조절을 갖게 두면 <b>같은 작업이
 * 배포 형태에 따라 다른 정밀도</b>로 보인다.
 *
 * <h2>설정이 없으면 이것이다</h2>
 *
 * <p>{@code app.progress.store} 가 비어 있으면 이 빈이 뜬다({@code matchIfMissing}) — backend/crosscutting.md
 * 이 템플릿의 기본 가정을 <i>다중화인데 Redis 가 없는 배포</i>로 잡았고, 그 답이
 * {@code jdbc} 이기 때문이다. <b>기본값이 문서가 아니라 코드에 있어야</b> 둘이 갈리지 않는다
 * (실제로 갈려 있었다 — backend/crosscutting.md 의 예시가 오래 {@code caffeine} 이었다).
 *
 * <p><b>아직 없는 값을 적으면 기동이 죽는다.</b> {@code redis} 라 적어도 구현이 없으니 빈이
 * 없고, {@link JobProgressStore} 를 받는 자리가 실패한다 — Boot 의 실패 분석기가 <i>이 조건
 * 때문에 빠졌다</i> 를 프로퍼티 이름과 함께 찍는다. <b>모르는 값을 조용히 삼키지 않는 것이
 * 요점이다</b>: 삼키면 Redis 를 쓰는 줄 알고 배포한 클러스터가 사실은 DB 를 쓰면서 <b>잘
 * 돌고</b>, 그 착각은 한참 뒤 엉뚱한 자리에서만 드러난다.
 */
@Component
@ConditionalOnProperty(name = "app.progress.store", havingValue = "jdbc", matchIfMissing = true)
public class JdbcJobProgressStore implements JobProgressStore {

    private final SysJobProgressRepository repository;
    private final Clock clock;

    public JdbcJobProgressStore(SysJobProgressRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void start(String jobId, String userId, Long totCnt) {
        repository.save(SysJobProgress.start(jobId, userId, totCnt, now()));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void progress(String jobId, long curCnt, String stepMsg, String subTitle) {
        repository.findById(jobId).ifPresent(row -> row.progress(curCnt, stepMsg, subTitle, now()));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reset(String jobId, String subTitle, Long totCnt) {
        repository.findById(jobId).ifPresent(row -> row.reset(subTitle, totCnt, now()));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(String jobId) {
        repository.findById(jobId).ifPresent(row -> row.complete(now()));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(String jobId, String errMsg) {
        repository.findById(jobId).ifPresent(row -> row.fail(errMsg, now()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<JobProgressView> find(String jobId, String userId) {
        return repository
                .findById(jobId)
                // 남의 것은 <b>없는 것</b>이다 — sys/batch.md.
                .filter(row -> row.getUserId().equals(userId))
                .map(row -> new JobProgressView(
                        row.getJobId(),
                        row.getJobStatCd(),
                        row.getCurCnt(),
                        row.getTotCnt(),
                        row.getSubTitle(),
                        row.getStepMsg(),
                        row.getErrMsg(),
                        row.getModDtm()));
    }

    /**
     * 만료된 행을 지운다 — retention.md 의 <i>만료 청소</i>. 부르는 것은 {@link JdbcProgressSweeper}.
     *
     * <p><b>{@link JobProgressStore} 에 없는 메서드다.</b> Redis·Caffeine 은 native TTL 로
     * 스스로 만료하므로(retention.md) 인터페이스에 두면 그쪽이 <b>빈 메서드</b>를 갖게 되고, 빈
     * 메서드는 <i>부르면 되는 것</i>처럼 보인다 — 청소는 저장소의 성질이지 저장소의 계약이
     * 아니다.
     *
     * <p><b>한 트랜잭션이다.</b> 둘로 가르면 앞이 지워지고 뒤가 실패한 상태가 남는데, 다음
     * 주기가 어차피 같은 것을 다시 지우므로 그 중간 상태에 값이 없다.
     *
     * @param endedBefore 끝난 행의 하한 — {@code app.progress.ttl}
     * @param staleBefore {@code RUNNING} 인 채 방치된 행의 하한 — {@code app.progress.ghost-after}
     * @return 지운 행 수
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int purge(Instant endedBefore, Instant staleBefore) {
        return repository.deleteEnded(JobStatus.RUNNING, endedBefore)
                + repository.deleteStaleRunning(JobStatus.RUNNING, staleBefore);
    }

    private Instant now() {
        return clock.instant();
    }
}
