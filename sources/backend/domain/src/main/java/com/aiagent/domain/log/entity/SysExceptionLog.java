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
 * 에러 로그 — 45 §4.2 · architecture.md §6-1.2 · LOG-03.
 *
 * <p><b>{@link SysAccessLog} 와 배타가 아니다</b>(64 §1.4). 예외가 난 요청은 저쪽에 한 행,
 * 여기에 한 행이며 {@code TRACE_ID} 가 둘을 잇는다 — 배타였을 때 <i>"이 에러가 난 요청의
 * 전문을 보자"</i> 가 언제나 0건이었고 사용자는 그것을 <b>로그 유실</b>로 읽었다(64 §2.5).
 *
 * <h2>세 컬럼이 이 테이블의 요점이다</h2>
 *
 * <p>{@code HTTP_STAT} · {@code ERR_CD} · {@code ERR_MSG} 다. 셋 다 <b>응답이 이미 갖고 있는
 * 값</b>이며(architecture.md §6-1 의 {@code code} · {@code message} 와 HTTP 상태) 새로 만드는 것이 아니라
 * <b>버리고 있던 것을 적는다</b>. 없으면 403 홍수 속에서 500 을 찾을 수 없고
 * <i>"같은 오류가 몇 건인가"</i> 를 물을 수 없다 — {@code nclob} 스택으로는 묶을 수 없다
 * (정렬도 그룹도 벤더가 막는다 — db-portability.md §4.5).
 *
 * <p><b>예외 클래스명 컬럼이 없다.</b> {@code ERR_CD} 가 같은 일을 하며, 클래스명은
 * 리팩터링으로 바뀌어 <b>과거 이력과 현재 코드가 어긋난다</b>(64 §5.3).
 *
 * <h2>4xx 는 스택을 남기지 않는다</h2>
 *
 * <p>{@code AccessDeniedException} 의 스택은 인터셉터의 프레임뿐이고 전 행이 같다 —
 * 180일치 노이즈다. {@code ROOT_CAUSE_STACK} 이 {@code null} 이며 그것이 <b>모달의 스택 탭이
 * 비활성으로 뜨는 근거</b>다(64 §5.5).
 *
 * <p><b>401 은 아예 이 테이블에 오지 않는다.</b> 세션 만료는 정상 흐름이고(50 §7.1)
 * 하트비트마다 쌓이면 에러 로그가 만료 로그가 된다 — 그 사건은 로그인 이력의
 * {@code SESSION_TIMEOUT} 이 갖는다(45 §5.1.1).
 *
 * <p>{@code allocationSize} 가 1000 인 것은 {@link SysAccessLog} 와 같은 이유다(ADR-0015).
 * 그 대가로 <b>PK 순서가 시간 순서가 아니므로</b> 커서 정렬이 시각을 먼저 보고 PK 는 동률만
 * 가른다(64 §2.3).
 */
@Entity
@Table(name = "SYS_LO_EXCEPTION")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysExceptionLog {

    /** {@code REQUEST_URI} 는 초과분을 절단한다 — {@link SysAccessLog} 와 같은 길이다. */
    public static final int REQUEST_URI_MAX = 500;

    /** {@code ERR_CD} — {@code ErrorCode.code()} 는 문자열 상수라 실제로는 훨씬 짧다. */
    public static final int ERR_CD_MAX = 50;

    /**
     * {@code ERR_MSG} — 파라미터가 치환된 <b>완성된 문장</b>이 들어온다(architecture.md §6-1.2).
     *
     * <p>{@code nclob} 으로 두면 목록 컬럼으로 쓸 수 없어(64 §2.4) <i>"코드와 완성된 문구가
     * 함께 남는 것이 운영 대응의 값"</i> 이라는 말이 화면에서 성립하지 않는다. 그래서
     * {@code VARCHAR} 이고, {@code VARCHAR} 이므로 <b>초과분은 절단</b>이다.
     */
    public static final int ERR_MSG_MAX = 1000;

    @Id
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "sys_sequence")
    @TableGenerator(
            name = "sys_sequence",
            table = "SYS_SEQUENCE",
            pkColumnName = "SEQ_NAME",
            valueColumnName = "NEXT_VAL",
            pkColumnValue = "SYS_LO_EXCEPTION",
            initialValue = 1,
            allocationSize = 1000)
    @Column(name = "EXCEPTION_LOG_SEQ")
    private Long exceptionLogSeq;

    /** 미인증 요청은 {@code null} 이다 — 화면이 {@code (익명)} 으로 그린다(64 §2.7). */
    @Column(name = "USER_ID", length = 30)
    private String userId;

    /** {@code X-Menu-Code} 헤더 값 — <b>클라이언트 주장이다</b>(architecture.md §6.3 · security-design.md §4). */
    @Column(name = "MENU_CD", length = 30)
    private String menuCd;

    @Column(name = "REQUEST_URI", length = REQUEST_URI_MAX, nullable = false)
    private String requestUri;

    /** <b>4xx 와 5xx 를 가르는 유일한 값</b>이다 — 64 §5.3. */
    @Column(name = "HTTP_STAT", nullable = false)
    private Short httpStat;

    /**
     * {@code ErrorCode.code()} 를 그대로 적는다 — architecture.md §6-1.2.
     *
     * <p><b>403 의 세 갈래를 나르는 것도 이 컬럼</b>이다(security-design.md §4). {@code err.api-not-registered}
     * · {@code err.api-not-mapped} · {@code err.no-authority} 셋은 사용자에게 같은 403 이지만
     * 고치는 곳이 각각 다르며, 화면이 그 갈래를 여기서 읽는다(64 §5.3).
     */
    @Column(name = "ERR_CD", length = ERR_CD_MAX)
    private String errCd;

    /** <b>서버가 번역을 완성해 담은 문장</b>이다 — architecture.md §6-1.2. */
    @Column(name = "ERR_MSG", length = ERR_MSG_MAX)
    private String errMsg;

    /**
     * 근본 원인의 스택 — <b>4xx 는 {@code null}</b> 이다(64 §5.3).
     *
     * <p>{@code @Lob} 이 아니라 이 조합인 것은 db-portability.md §3.1 의 실측 때문이다 — {@code @Lob} 은
     * MySQL 에서 {@code tinytext}(255바이트)가 되어 스택이 들어가지 않는다.
     *
     * <p><b>목록 조회가 이 컬럼을 {@code SELECT} 하지 않는다</b>(64 §2.4) — {@code getDetail}
     * 만 읽는다.
     */
    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "ROOT_CAUSE_STACK")
    private String rootCauseStack;

    @Column(name = "CLIENT_IP", length = 45)
    private String clientIp;

    /** 사용 이력과 이 테이블을 잇는 유일한 끈 — 상세 모달의 전문 탭이 이 값을 쓴다(64 §5.5). */
    @Column(name = "TRACE_ID", length = 64)
    private String traceId;

    @Column(name = "CRE_DTM", nullable = false)
    private Instant creDtm;

    @Builder
    private SysExceptionLog(
            String userId,
            String menuCd,
            String requestUri,
            Short httpStat,
            String errCd,
            String errMsg,
            String rootCauseStack,
            String clientIp,
            String traceId,
            Instant creDtm) {
        this.userId = userId;
        this.menuCd = menuCd;
        this.requestUri = truncate(requestUri, REQUEST_URI_MAX);
        this.httpStat = httpStat;
        this.errCd = truncate(errCd, ERR_CD_MAX);
        this.errMsg = truncate(errMsg, ERR_MSG_MAX);
        this.rootCauseStack = rootCauseStack;
        this.clientIp = clientIp;
        this.traceId = traceId;
        this.creDtm = creDtm;
    }

    /**
     * <b>여기서 자르는 것은 {@code VARCHAR} 셋뿐</b>이다.
     *
     * <p>{@code ROOT_CAUSE_STACK} 은 {@code nclob} 이라 길이 제약이 다르고, 잘렸다는 사실을
     * <b>화면이 말해야 하므로</b> 표시가 붙는다(64 §2.4) — 그 일은 쓰는 쪽이 한다.
     */
    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }
}
