package com.aiagent.domain.log.repository;

import com.aiagent.domain.log.entity.SysExceptionLog;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 에러 로그 — 45 §4.3. 조회는 {@code QuerySpec} 을 지난다. */
public interface SysExceptionLogRepository extends JpaRepository<SysExceptionLog, Long> {

    /**
     * 파기 대상의 <b>번호만</b> 한 청크 — LOG-07 · 32 §4-4.
     *
     * <p>{@code ROOT_CAUSE_STACK} 이 {@code nclob} 이라 엔티티로 읽지 않는 이유가 사용
     * 이력과 같다. 인덱스는 {@code IX_SYS_LO_EXCEPTION_01(CRE_DTM)} 이다.
     */
    @Query("select l.exceptionLogSeq from SysExceptionLog l where l.creDtm < :cutoff")
    List<Long> findIdsCreatedBefore(@Param("cutoff") Instant cutoff, Pageable chunk);
}
