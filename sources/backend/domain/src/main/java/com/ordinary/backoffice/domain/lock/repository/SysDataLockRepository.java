package com.ordinary.backoffice.domain.lock.repository;

import com.ordinary.backoffice.domain.lock.entity.SysDataLock;
import com.ordinary.backoffice.domain.lock.entity.SysDataLockId;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysDataLockRepository extends JpaRepository<SysDataLock, SysDataLockId> {

    /**
     * 만료 락 회수 — <b>조건부 DELETE 다</b>(31 §3 의 반드시 지킬 것 3).
     *
     * <p><i>검사 후 삭제</i> 로 짜면 두 노드가 같은 만료 락을 함께 회수하고 <b>둘 다 선점에
     * 성공</b>한다. 조건을 DELETE 안에 넣으면 그 판정이 DB 의 원자적 연산이 된다.
     *
     * <p>{@code RELEASE_DTM} 을 보지 않는다 — 쿨다운이 걸린 해제는 <b>만료를 그 시각으로
     * 낮추므로</b>(31 §5) 회수 조건이 이 한 줄로 닫힌다.
     */
    @Modifying
    @Query("""
            delete from SysDataLock l
            where l.lockType = :type
              and l.lockKey = :key
              and l.expireDtm < :now
            """)
    int deleteExpired(
            @Param("type") String type, @Param("key") String key, @Param("now") Instant now);

    @Modifying
    @Query("delete from SysDataLock l where l.lockType = :type and l.lockKey = :key")
    int deleteLock(@Param("type") String type, @Param("key") String key);

    /**
     * 쿨다운이 남은 락의 <b>만료를 앞당긴다</b> — 지우는 대신이다(31 §5).
     *
     * <p>{@code RELEASE_DTM} 이 미래인 행에만 걸린다. 이미 지난 것은 {@code 0} 이 돌아오고
     * 부르는 쪽이 그때 지운다 — <b>읽고 판단하지 않고 갱신 건수로 판단</b>하므로 두 노드가
     * 동시에 해제해도 결과가 하나다.
     */
    @Modifying
    @Query("""
            update SysDataLock l
               set l.expireDtm = l.releaseDtm
             where l.lockType = :type
               and l.lockKey = :key
               and l.releaseDtm is not null
               and l.releaseDtm > :now
            """)
    int holdForCooldown(
            @Param("type") String type, @Param("key") String key, @Param("now") Instant now);

    /**
     * 하트비트 — <b>{@code NODE_ID} 가 조건에 있는 것이 전부</b>다(31 §5.1).
     *
     * <p>빼면 이미 회수돼 남이 잡은 락의 만료를 <b>옛 주인이 밀어 준다</b>. 그러면 두
     * 노드가 같은 락을 자기 것으로 믿고, 그 상태는 <b>어느 쪽도 눈치채지 못한다</b>.
     *
     * <p>{@code EXPIRE_DTM} 만 민다 — {@code RELEASE_DTM}(쿨다운)은 <b>선점 시각 기준</b>이라
     * 실행이 길어졌다고 함께 밀리면 안 된다.
     */
    @Modifying
    @Query("""
            update SysDataLock l
               set l.expireDtm = :expiresAt
             where l.lockType = :type
               and l.lockKey = :key
               and l.nodeId = :nodeId
            """)
    int heartbeat(
            @Param("type") String type,
            @Param("key") String key,
            @Param("nodeId") String nodeId,
            @Param("expiresAt") Instant expiresAt);

    /** 그 노드가 아직 쥐고 있는 <b>살아 있는</b> 락이 있는가 — 유령 판정(65 §4.4). */
    @Query("""
            select count(l) > 0
            from SysDataLock l
            where l.lockType = :type
              and l.lockKey = :key
              and l.nodeId = :nodeId
              and l.expireDtm > :now
            """)
    boolean existsLive(
            @Param("type") String type,
            @Param("key") String key,
            @Param("nodeId") String nodeId,
            @Param("now") Instant now);
}
