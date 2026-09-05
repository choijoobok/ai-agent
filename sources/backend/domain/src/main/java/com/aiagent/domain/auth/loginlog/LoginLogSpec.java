package com.aiagent.domain.auth.loginlog;

import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.auth.LoginResultCode;
import com.aiagent.domain.auth.entity.QSysLoginLog;
import com.aiagent.domain.user.entity.QSysUser;
import com.querydsl.core.types.dsl.BooleanExpression;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * {@code LOGIN_LOG} 의 화이트리스트 — screen/log/access/requirements.md · backend/api.md.
 *
 * <p>모양이 {@code AccessLogSpec} 과 같다. <b>같은 이유에서 같다</b> — 커서형이라 정렬이
 * {@code creDtm} 하나로 고정되고(screen/log/login/requirements.md), 인덱스가 {@code CRE_DTM} · {@code TRACE_ID}
 * 둘뿐이라(sys/logs.md) IP·추적 ID 가 <b>완전 일치</b>로 좁혀진다.
 *
 * <p><b>사람의 이름과 아이디는 그 예외다</b>(2026-09-01). 둘은 <b>문자열 비교 넷</b>(같음 ·
 * 시작 · 포함 · 끝)을 받는다 — 기간이 필수라 <b>먼저 좁혀지고</b>(screen/log/login/requirements.md), 완전 일치만
 * 열어 두면 조각을 든 사람이 <b>기간을 넓혀 훑는다</b>. IP 를 열지 않는 것과 갈리는 것은
 * 여기다: 대역 검색은 <i>결과만 넓어지는</i> 조건이지만 부분 이름은 <b>다른 답</b>을 낸다.
 *
 * <h2>{@code menuCd} 가 아예 없다</h2>
 *
 * <p>테이블에 컬럼이 없다(sys/logs.md). 로그인은 메뉴 문맥이 없으므로(sys/menu.md) <b>애초에 담을
 * 것이 없었다</b> — 사용 이력이 {@code NULL} 로 푼 것을 이 테이블은 <b>컬럼을 두지 않는
 * 것으로</b> 풀었고, 둘이 어긋나지 않는다.
 *
 * <h2>{@code userAgent} 는 조건도 정렬도 아니다</h2>
 *
 * <p>목록에는 실리지만(screen/log/login/requirements.md — {@code nclob} 이 아니라 {@code VARCHAR} 다) 여기 없다.
 * 500자 문자열에 인덱스가 없어 <b>부분 일치를 열면 그것이 곧 전체 스캔</b>이고, 이 값으로
 * 하는 일은 <i>"같은 사람이 다른 기기에서 들어왔나"</i> 하나라 <b>눈으로 비교하는 대상</b>
 * 이다(screen/log/access/requirements.md).
 */
public final class LoginLogSpec {

    static final QSysLoginLog LL = QSysLoginLog.sysLoginLog;

    /**
     * 사용자명의 출처 — <b>{@code leftJoin} 이라야 하는 것이 이 화면에서 가장 분명하다</b>
     * (2026-09-01).
     *
     * <p>sys/logs.md 가 FK 를 걸지 않은 이유가 <i>"존재하지 않는 주체의 기록도 남아야 한다"</i>
     * 였고 <b>이 테이블이 그 대표 사례</b>다. {@code join} 으로 두면 <b>없는 계정으로의 시도가
     * 통째로 사라지고</b>, 그것은 이 화면의 두 번째 용도(침입 시도 탐지 — screen/log/login/requirements.md)를 없애는
     * 것이다.
     *
     * <p><b>그래서 이름을 붙이는 판단이 바뀌었다.</b> screen/log/login/requirements.md 는 <i>"조인하면 없는 ID 행에서
     * 이름이 비고 그 빈칸이 조회가 덜 됐다 로 읽힌다"</i> 는 이유로 이름을 붙이지 않았는데,
     * 빈칸이 문제였으므로 <b>빈칸을 없애는 것</b>이 답이다 — 화면이 그 칸에 <b>{@code 없는 계정}
     * 배지</b>를 그린다(결과 컬럼의 {@code FAIL_NO_USER} 와 같은 글자·같은 색이며, 같은
     * 공통코드 행에서 온다). 이름을 안 붙이는 것으로 푸는 것보다 <b>말하는 것</b>이 낫다.
     */
    static final QSysUser U = QSysUser.sysUser;

    /**
     * <b>실패 열</b> — {@link LoginResultCode} 의 {@code FAIL_} 접두가 곧 이 묶음이다.
     *
     * <p>이름으로 접두를 보지 않고 <b>집합을 적는다</b>. {@code startsWith("FAIL_")} 로
     * 두면 {@code enum} 에 이름을 더하는 순간 <b>묶음이 조용히 바뀐다</b> — 집합으로 적어
     * 두면 새 코드가 어느 쪽인지 정하지 않은 채로는 <b>기동하지 못한다</b>({@link #GROUPS}).
     */
    private static final Set<LoginResultCode> FAILED = Set.of(
            LoginResultCode.FAIL_NO_USER,
            LoginResultCode.FAIL_PWD,
            LoginResultCode.FAIL_DISABLED,
            LoginResultCode.FAIL_EXPIRED,
            LoginResultCode.FAIL_LOCKED,
            LoginResultCode.FAIL_DORMANT,
            LoginResultCode.FAIL_IP,
            LoginResultCode.FAIL_NO_AUTHORITY,
            LoginResultCode.FAIL_TEMP_EXPIRED,
            LoginResultCode.FAIL_CONCURRENT);

    /**
     * <b>종료 넷</b> — 로그아웃 · 만료 · 강제 · 밀려남.
     *
     * <p><b>만료와 밀려남이 여기 있는 것이 의도다</b>(screen/log/login/requirements.md). 사용자에게는 <i>"갑자기
     * 로그아웃됐다"</i> 이지만 시스템으로서는 <b>정상 종료</b>이며, 실패 쪽에 두면 문의를
     * 받은 운영자가 장애로 읽는다.
     */
    private static final Set<LoginResultCode> CLOSED = Set.of(
            LoginResultCode.LOGOUT,
            LoginResultCode.SESSION_TIMEOUT,
            LoginResultCode.FORCED_LOGOUT,
            LoginResultCode.SESSION_EVICTED);

    /** 성공은 코드 하나다 — 그래서 묶음 후보에 없다({@link #resultGroup} 의 주석). */
    private static final Set<LoginResultCode> SUCCEEDED = Set.of(LoginResultCode.SUCCESS);

    public static final QuerySpec SPEC = QuerySpec.of("loginLog")
            .from(LL)
            .leftJoin(U).on(U.userId.eq(LL.userId))
            // 정렬이 열린 유일한 컬럼이고 커서의 기준점이다 — screen/log/login/requirements.md.
            .col("creDtm", LL.creDtm).sortable()
            // 없는 계정의 시도도 남는다 — 그래서 이 칸이 비어 있을 수 있다(sys/logs.md · screen/log/access/requirements.md).
            .col("userId", LL.userId).nullable()
            /*
              <b>없는 계정의 행에서 {@code null} 이다</b> — 이 테이블에서는 그것이 예외가
              아니라 <b>흔한 일</b>이다(2026-09-01). {@code nullable} 이라야 {@code ne} 가
              그 행을 빼지 않는다(backend/api.md).
            */
            .col("userNm", U.userNm).nullable()
            .col("loginRsltCd", LL.loginRsltCd)
            .col("clientIp", LL.clientIp).nullable()
            .col("traceId", LL.traceId).nullable()
            .col("loginLogSeq", LL.loginLogSeq)
            .derived("rsltGroup", LoginLogSpec::resultGroup)
            .defaultSort("creDtm", SortDir.desc)
            .pk(LL.loginLogSeq)
            .build();

    /**
     * <b>결과 묶음</b> — screen/log/login/requirements.md. 배지의 색 셋과 <b>같은 축</b>이다.
     *
     * <p>코드 열다섯을 콤보에서 하나씩 고르게 하면 <i>"실패 전부"</i> 를 고르는 데 열 번을
     * 누른다. 묶음을 고르면 <b>서버가 코드 집합으로 번역</b>한다 — screen/user/requirements.md 의 계정 상태와
     * 같은 파생 조건이며 72 프로토콜의 두 번째 사례다.
     *
     * <p><b>{@code loginRsltCd} 와 함께 오면 교집합이다.</b> 둘을 하나로 합치지 않는 것은
     * 묶음이 <b>훑기</b>이고 코드가 <b>좁히기</b>이기 때문이다 — 한 콤보에 15 + 2 를 섞으면
     * 목록에서 무엇이 묶음인지 알 수 없다.
     *
     * <p><b>후보에 <i>성공만</i> 이 없다.</b> 성공은 코드 하나라 접을 것이 없고, 그
     * 질문에는 결과 콤보가 <b>한 번의 선택</b>으로 이미 답한다 — 여기 두면 같은 조회를
     * 내는 길이 둘이 되고, 둘이 함께 채워졌을 때 교집합 규칙만 복잡해진다.
     */
    private static BooleanExpression resultGroup(Op op, Object value) {
        if (op != Op.eq) {
            throw new IllegalArgumentException("결과 묶음은 = 만 받는다 — " + op);
        }
        String group = String.valueOf(value).toUpperCase(Locale.ROOT);
        Set<LoginResultCode> codes = GROUPS.get(group);
        if (codes == null) {
            throw new IllegalArgumentException("없는 결과 묶음이다 — " + value);
        }
        return LL.loginRsltCd.in(codes);
    }

    /**
     * 묶음 이름 → 코드 집합.
     *
     * <p><b>셋이 {@link LoginResultCode} 전부를 덮는다.</b> 아래 정적 초기화가 그것을
     * 지킨다 — 코드를 더하면서 묶음을 정하지 않으면 <b>기동이 실패</b>한다. 조용히 두면
     * 새 코드는 <i>실패만</i> 에도 <i>종료만</i> 에도 걸리지 않아, 그 조회를 하는 사람의
     * 목록에서 <b>말없이 빠진다</b>.
     */
    private static final Map<String, Set<LoginResultCode>> GROUPS =
            Map.of("SUCCESS", SUCCEEDED, "FAILED", FAILED, "CLOSED", CLOSED);

    static {
        List<LoginResultCode> uncovered = Arrays.stream(LoginResultCode.values())
                .filter(code -> GROUPS.values().stream().noneMatch(group -> group.contains(code)))
                .toList();
        if (!uncovered.isEmpty()) {
            throw new IllegalStateException(
                    "묶음이 정해지지 않은 로그인 결과 코드가 있다 — " + uncovered + " (screen/log/login/requirements.md)");
        }
    }

    private LoginLogSpec() {}
}
