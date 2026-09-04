package com.aiagent.domain.progress.repository;

import com.aiagent.domain.progress.JobStatus;
import com.aiagent.domain.progress.entity.SysJobProgress;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 진행률 저장소의 JPA 면 — backend/crosscutting.md 의 {@code jdbc} store 가 이것을 쓴다.
 *
 * <h2>만료 청소가 <b>여기에</b> 있는 것이 요점이다</h2>
 *
 * <p>retention.md 는 <i>"Redis·local store 는 native TTL 로 자동 만료되므로 청소 배치가 필요
 * 없다"</i> 고 적었다. 그 문장이 곧 <b>청소는 저장소마다 다르다</b>는 뜻이며, 그래서
 * {@code JobProgressStore} 인터페이스에 {@code purge} 가 없다 — 두면 Redis 구현이
 * <b>빈 메서드</b>를 갖게 되고, 빈 메서드는 <i>부르면 되는 것</i>처럼 보인다.
 *
 * <p>청소가 <b>배치 등록({@code SYS_SCHEDULE_BATCH})이 아닌</b> 이유도 같다. 등록은
 * 데이터이므로 배포가 Redis 로 갈아탄 날에도 그대로 남고, 그 행은 <b>아무 일도 하지
 * 않으면서 성공으로 끝난다</b> — 켜 두었으니 돌고 있다고 믿게 된다.
 */
public interface SysJobProgressRepository extends JpaRepository<SysJobProgress, String> {

    /**
     * <b>끝난 행</b>을 지운다 — 보관 기간({@code app.progress.ttl})을 넘긴 것.
     *
     * <p>기준이 {@code MOD_DTM} 인 것은 <b>끝난 시각</b>이 거기 있기 때문이다.
     * {@code CRE_DTM} 으로 재면 <b>오래 도는 작업이 끝나자마자 지워진다</b> — 세 시간짜리
     * 작업의 완료 화면을 사용자가 보기도 전에.
     */
    @Modifying(clearAutomatically = true)
    @Query("delete from SysJobProgress p where p.jobStatCd <> :running and p.modDtm < :before")
    int deleteEnded(@Param("running") JobStatus running, @Param("before") Instant before);

    /**
     * <b>{@code RUNNING} 인 채 방치된 행</b>을 지운다 — {@code app.progress.ghost-after}.
     *
     * <p>프로세스가 통째로 죽으면 그 행을 끝낼 주체가 없다({@code BatchGhostSweeper} 가 배치
     * 이력에서 갚는 것과 같은 빚이다). <b>끝난 행만 지우면 이쪽은 영원히 남으므로</b>
     * 무한 누적이 그대로다.
     *
     * <p>하한이 {@code ttl} 과 따로인 것은 <b>지금 도는 작업을 지우면 안 되기</b> 때문이다.
     * 진행률 쓰기는 조절되므로(1% 또는 1초) 멈춘 것처럼 보이는 구간이 정상적으로 있고,
     * 그 구간을 유령으로 읽으면 <b>폴링이 곧바로 없음을 받는다</b> — 화면에는 <i>작업이
     * 사라졌다</i> 로 보인다.
     */
    @Modifying(clearAutomatically = true)
    @Query("delete from SysJobProgress p where p.jobStatCd = :running and p.modDtm < :before")
    int deleteStaleRunning(@Param("running") JobStatus running, @Param("before") Instant before);
}
