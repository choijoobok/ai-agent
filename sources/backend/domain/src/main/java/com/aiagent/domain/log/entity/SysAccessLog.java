package com.aiagent.domain.log.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

/**
 * 사용 이력 — sys/logs.md · backend/packages.md · LOG-01.
 *
 * <p><b>전 요청이 한 행이다</b>(2026-08-28 개정). 2xx 도 4xx 도 5xx 도 남으며, 예외가 나면
 * {@code SYS_LO_EXCEPTION} 에 <b>한 행이 더</b> 붙는다 — 배타가 아니다. 배타였을 때
 * <i>"이 에러가 난 요청의 전문을 보자"</i> 가 언제나 0건이었고 사용자는 그것을
 * <b>로그 유실</b>로 읽었다(screen/log/access/requirements.md).
 *
 * <p><b>감사 4컬럼이 없다</b>(sys/logs.md) — {@code USER_ID + CRE_DTM} 이 곧 "누가 언제" 다.
 * <b>FK 도 없다</b>(sys/logs.md) — 계정이 사라져도 과거 기록의 주체는 남아야 한다.
 *
 * <p>{@code allocationSize} 가 1000 인 것은 {@link
 * com.aiagent.domain.auth.entity.SysLoginLog} 와 같은 이유다 — 고빈도 INSERT 라
 * 기본 50 이면 50건마다 행 락에서 경합한다(backend/persistence.md). 그 대가로 <b>PK 순서가 시간 순서가
 * 아니다</b>: 노드마다 다른 블록을 쥐므로 커서 정렬이 시각을 먼저 보고 PK 는 동률만
 * 가른다(screen/log/access/requirements.md).
 */
@Entity
@Table(name = "SYS_LO_ACCESS")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysAccessLog {

    /** {@code REQUEST_URI} 는 초과분을 절단한다 — sys/logs.md. */
    public static final int REQUEST_URI_MAX = 500;

    @Id
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "sys_sequence")
    @TableGenerator(
            name = "sys_sequence",
            table = "SYS_SEQUENCE",
            pkColumnName = "SEQ_NAME",
            valueColumnName = "NEXT_VAL",
            pkColumnValue = "SYS_LO_ACCESS",
            initialValue = 1,
            allocationSize = 1000)
    @Column(name = "ACCESS_LOG_SEQ")
    private Long accessLogSeq;

    /** 미인증 요청은 {@code null} 이다 — 화면이 {@code (익명)} 으로 그린다(screen/log/access/requirements.md). */
    @Column(name = "USER_ID", length = 30)
    private String userId;

    /**
     * {@code X-Menu-Code} 헤더 값 — <b>클라이언트 주장이다</b>(backend/packages.md · backend/security.md).
     *
     * <p>인가 판정에 쓰지 않는다. 통계·추적 외 용도로 신뢰하지 않으며 그 사실을 화면이
     * 컬럼 헤더 툴팁으로 말한다(screen/log/access/requirements.md) — 말하지 않으면 이 화면의 메뉴별 집계가
     * <b>감사 근거로 인용된다</b>.
     *
     * <p>{@code null} 을 허용한다. 로그인·하트비트는 셸 진입 전이라 현재 메뉴가 존재하지
     * 않는다 — 빈 문자열은 Oracle 에서 {@code null} 이 되어 구분이 성립하지 않는다(backend/persistence.md).
     */
    @Column(name = "MENU_CD", length = 30)
    private String menuCd;

    @Column(name = "REQUEST_URI", length = REQUEST_URI_MAX, nullable = false)
    private String requestUri;

    /**
     * 응답 상태 — <b>전 요청을 받으므로 필요하다</b>(backend/packages.md).
     *
     * <p>없으면 성공과 실패가 섞이고, 이 화면은 *일어난 요청 전부* 를 보여주는 화면이
     * 되지 못한다(screen/log/access/requirements.md).
     */
    @Column(name = "HTTP_STAT", nullable = false)
    private Short httpStat;

    /**
     * 요청 전문 — 쿼리스트링 + 헤더 + body 를 직렬화한 하나의 CLOB.
     *
     * <p><b>마스킹을 거친 값이다</b>(LOG-06 · backend/packages.md). 원문이 아니다.
     *
     * <p>{@code @Lob} 이 아니라 이 조합인 것은 backend/persistence.md 의 실측 때문이다 — {@code @Lob} 은
     * PostgreSQL 에서 {@code oid}, MySQL 에서 {@code tinytext}(255바이트)가 되어 전문이
     * 들어가지 않는다.
     *
     * <p><b>목록 조회가 이 컬럼을 {@code SELECT} 하지 않는다</b>(screen/log/access/requirements.md). 응답 100행 ×
     * 1MB = 100MB 이고, Oracle LOB 성능이 그 앞에서 먼저 무너진다(backend/persistence.md S-2).
     */
    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "PARAMETERS")
    private String parameters;

    @Column(name = "CLIENT_IP", length = 45)
    private String clientIp;

    @Column(name = "TRACE_ID", length = 64)
    private String traceId;

    @Column(name = "CRE_DTM", nullable = false)
    private Instant creDtm;

    @Builder
    private SysAccessLog(
            String userId,
            String menuCd,
            String requestUri,
            Short httpStat,
            String parameters,
            String clientIp,
            String traceId,
            Instant creDtm) {
        this.userId = userId;
        this.menuCd = menuCd;
        this.requestUri = truncate(requestUri);
        this.httpStat = httpStat;
        this.parameters = parameters;
        this.clientIp = clientIp;
        this.traceId = traceId;
        this.creDtm = creDtm;
    }

    private static String truncate(String requestUri) {
        if (requestUri == null || requestUri.length() <= REQUEST_URI_MAX) {
            return requestUri;
        }
        return requestUri.substring(0, REQUEST_URI_MAX);
    }
}
