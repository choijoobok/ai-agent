package com.aiagent.domain.auth.entity;

import com.aiagent.domain.auth.LoginResultCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.TableGenerator;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 로그인 이력 — sys/logs.md. 성공·실패에 더해 <b>세션 종료</b>까지 담는다.
 *
 * <p><b>감사 4컬럼이 없다</b>(sys/logs.md) — {@code USER_ID + CRE_DTM} 이 곧 "누가 언제" 다.
 * <b>FK 도 없다</b>(sys/logs.md) — 존재하지 않는 ID 의 시도도 기록해야 한다.
 *
 * <p>{@code allocationSize} 가 1000 인 것은 이력이 <b>고빈도 INSERT</b> 이기 때문이다.
 * {@code TABLE} 전략은 할당 시 행 락을 잡으므로(backend/persistence.md) 기본 50 이면 50건마다 경합한다.
 * 재기동 시 번호에 구멍이 생기지만 <b>이력 PK 에 연속성은 요구되지 않는다</b>(sys/logs.md).
 */
@Entity
@Table(name = "SYS_LO_LOGIN")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysLoginLog {

    /** {@code User-Agent} 는 초과분을 절단한다(sys/logs.md). */
    public static final int USER_AGENT_MAX = 500;

    @Id
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "sys_sequence")
    @TableGenerator(
            name = "sys_sequence",
            table = "SYS_SEQUENCE",
            pkColumnName = "SEQ_NAME",
            valueColumnName = "NEXT_VAL",
            pkColumnValue = "SYS_LO_LOGIN",
            initialValue = 1,
            allocationSize = 1000)
    @Column(name = "LOGIN_LOG_SEQ")
    private Long loginLogSeq;

    /** <b>시도한 ID</b> 다. 없는 ID 도 그대로 남긴다. */
    @Column(name = "USER_ID", length = 30)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "LOGIN_RSLT_CD", length = 20, nullable = false)
    private LoginResultCode loginRsltCd;

    @Column(name = "CLIENT_IP", length = 45)
    private String clientIp;

    @Column(name = "USER_AGENT", length = USER_AGENT_MAX)
    private String userAgent;

    @Column(name = "TRACE_ID", length = 64)
    private String traceId;

    @Column(name = "CRE_DTM", nullable = false)
    private Instant creDtm;

    @Builder
    private SysLoginLog(
            String userId,
            LoginResultCode loginRsltCd,
            String clientIp,
            String userAgent,
            String traceId,
            Instant creDtm) {
        this.userId = userId;
        this.loginRsltCd = loginRsltCd;
        this.clientIp = clientIp;
        this.userAgent = truncate(userAgent);
        this.traceId = traceId;
        this.creDtm = creDtm;
    }

    private static String truncate(String userAgent) {
        if (userAgent == null || userAgent.length() <= USER_AGENT_MAX) {
            return userAgent;
        }
        return userAgent.substring(0, USER_AGENT_MAX);
    }
}
