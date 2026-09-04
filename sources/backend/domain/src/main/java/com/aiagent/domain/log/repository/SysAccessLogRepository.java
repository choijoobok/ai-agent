package com.aiagent.domain.log.repository;

import com.aiagent.domain.log.entity.SysAccessLog;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 사용 이력 — sys/logs.md. <b>쓰기와 파기만 지난다</b>(조회는 {@code QuerySpec} 이다 — backend/api.md).
 */
public interface SysAccessLogRepository extends JpaRepository<SysAccessLog, Long> {

    /**
     * 파기 대상의 <b>번호만</b> 한 청크 — LOG-07 · retention.md.
     *
     * <p><b>엔티티를 읽지 않는 것이 요점이다.</b> 이 테이블의 {@code PARAMETERS} 는 요청
     * 전문이 통째로 들어간 {@code nclob} 이고(sys/logs.md), 지우려고 천 행을 읽으면 그 본문을
     * <b>전부 메모리에 올린다</b> — 지울 것을 읽느라 죽는다.
     *
     * <p><b>{@code IX_SYS_LO_ACCESS_01(CRE_DTM)}</b> 이 이 조건을 받는다. 017 의 주석이
     * 이미 <i>"보존 배치(retention.md)도 같은 컬럼으로 지운다"</i> 라고 적어 둔 그 인덱스다.
     *
     * <p>{@code Pageable} 이지만 <b>언제나 첫 페이지</b>를 준다 — 지우면서 도는 순환이라
     * offset 을 밀면 <b>지운 만큼 건너뛴다</b>. 한도만 쓰는 셈이다.
     */
    @Query("select l.accessLogSeq from SysAccessLog l where l.creDtm < :cutoff")
    List<Long> findIdsCreatedBefore(@Param("cutoff") Instant cutoff, Pageable chunk);
}
