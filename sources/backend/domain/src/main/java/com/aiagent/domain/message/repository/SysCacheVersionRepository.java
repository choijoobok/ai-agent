// @feat FEAT-505
package com.aiagent.domain.message.repository;

import com.aiagent.domain.message.entity.SysCacheVersion;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface SysCacheVersionRepository extends JpaRepository<SysCacheVersion, String> {

    /** DB의 현재 값에 더한다. 서로 다른 키의 저장도 같은 버전 행에서 직렬화된다. */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("update SysCacheVersion v set v.version = v.version + 1, v.modDtm = :now where v.cacheName = :cacheName")
    int incrementVersion(@Param("cacheName") String cacheName, @Param("now") Instant now);

    /** 값 저장 트랜잭션과 함께 증가시킨다. 시드가 없는 최초 저장도 기존 동작대로 생성한다. */
    @Transactional
    default void advance(String cacheName, Instant now) {
        if (incrementVersion(cacheName, now) == 0) {
            saveAndFlush(SysCacheVersion.started(cacheName, now));
        }
    }
}
