package com.aiagent.domain.auth.repository;

import com.aiagent.domain.auth.LoginResultCode;
import com.aiagent.domain.auth.entity.SysLoginLog;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysLoginLogRepository extends JpaRepository<SysLoginLog, Long> {

    /**
     * 한 사람의 최근 이력 — LOG-02 · frontend/tabs.md.
     *
     * <p>{@code IX_SYS_LO_LOGIN_03(USER_ID, CRE_DTM)} 이 이 조회를 위해 있다. CRE_DTM 단독
     * 인덱스로는 <b>전건을 최근 순으로 훑으며</b> 한 사람의 것을 골라내야 한다.
     */
    List<SysLoginLog> findByUserIdOrderByCreDtmDesc(String userId, Limit limit);

    /**
     * 한 사람의 <b>성공한</b> 로그인만 최근 순으로 — screen/admin/system/user/requirements.md(2026-08-31).
     *
     * <p>활성 세션 목록이 <b>어디서 들어왔나</b> 를 채우는 데 쓴다. 세션 스토어는 IP 도
     * User-Agent 도 갖고 있지 않으므로(sys/logs.md 가 그것을 보존 1년으로 갖는다) 세션이 만들어진
     * 무렵의 로그인을 <b>시각으로 짝짓는다</b>.
     *
     * <p><b>성공만 읽는 것이 요점이다.</b> 실패한 시도는 세션을 만들지 않으므로 짝의 후보가
     * 아니고, 섞어 읽으면 <b>비밀번호를 틀린 시도의 IP</b> 가 살아 있는 세션의 값으로
     * 붙는다 — 잠금 직전까지 실패가 여러 건 쌓이는 것이 흔한 경우다.
     *
     * <p>{@code IX_SYS_LO_LOGIN_03(USER_ID, CRE_DTM)} 이 이 조회도 받는다 — 결과 코드는
     * 인덱스에 없으므로 읽은 뒤 걸러지며, 그래서 <b>한도를 넉넉히</b> 준다.
     */
    List<SysLoginLog> findByUserIdAndLoginRsltCdOrderByCreDtmDesc(
            String userId, LoginResultCode loginRsltCd, Limit limit);

    /**
     * 파기 대상의 <b>번호만</b> 한 청크 — LOG-07 · retention.md.
     *
     * <p>{@code IX_SYS_LO_LOGIN_01(CRE_DTM)} 이 이 조건을 받는다. 이 테이블에는 {@code
     * nclob} 이 없어 엔티티로 읽어도 죽지는 않지만, <b>네 대상이 같은 모양이어야</b>
     * 파기 배치가 대상마다 다른 코드를 갖지 않는다(retention.md).
     */
    @Query("select l.loginLogSeq from SysLoginLog l where l.creDtm < :cutoff")
    List<Long> findIdsCreatedBefore(@Param("cutoff") Instant cutoff, Pageable chunk);
}
