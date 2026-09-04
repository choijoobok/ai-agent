package com.aiagent.domain.user.repository;

import com.aiagent.domain.user.entity.SysUserPwdHist;
import com.aiagent.domain.user.entity.SysUserPwdHistId;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysUserPwdHistRepository extends JpaRepository<SysUserPwdHist, SysUserPwdHistId> {

    /**
     * 최근 것부터 <b>정책 건수만큼만</b> 읽는다(41 §5).
     *
     * <p>{@link Limit} 을 받는 것이 요건이다 — 건수는 {@code SYS_CONFIG} 의 값이라 메서드
     * 이름에 박을 수 없고({@code findTop5…}), 전건을 읽어 자바에서 자르면 오래 쓴 계정의
     * 이력 전부가 메모리에 온다.
     */
    List<SysUserPwdHist> findByUserIdOrderByChgSeqDesc(String userId, Limit limit);

    /** 다음 순번의 근거. 행이 없으면 0 이라 첫 이력은 1 이 된다. */
    @Query("select coalesce(max(h.chgSeq), 0) from SysUserPwdHist h where h.userId = :userId")
    int findLastSeq(@Param("userId") String userId);

    /**
     * 보관 건수를 넘긴 옛 행을 지운다 — 무한 누적할 이유가 없다(41 §5).
     *
     * <p><b>보관 건수와 비교 건수가 같은 값이다.</b> 비교하지 않을 행을 남기면 그것은 아무도
     * 읽지 않는 해시 더미이며, 파기 정책(32 §3)이 지울 것만 늘린다.
     */
    @Modifying
    @Query("delete from SysUserPwdHist h where h.userId = :userId and h.chgSeq <= :oldestKept")
    void deleteUpTo(@Param("userId") String userId, @Param("oldestKept") int oldestKept);
}
