package com.aiagent.domain.log.admin;

import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.log.LogMenuName;
import com.aiagent.domain.log.entity.QSysAccessLog;
import com.aiagent.domain.user.entity.QSysUser;
import com.querydsl.core.types.dsl.BooleanExpression;

/**
 * {@code ACCESS_LOG} 의 화이트리스트 — screen/admin/system/log/access/requirements.md · backend/api.md.
 *
 * <h2>정렬이 하나뿐이다</h2>
 *
 * <p>{@code creDtm} 에만 {@code .sortable()} 이 붙는다. 번호 없는 이동은 직전 페이지의
 * 마지막 행을 기준점으로 다음을 읽으므로 <b>정렬 키가 고정</b>이어야 하고(screen/admin/system/log/access/requirements.md), 나머지
 * 컬럼은 <b>인덱스가 없어 전체 정렬</b>이 된다.
 *
 * <p><b>끄는 것이 기능을 뺀 것이 아니다.</b> <i>"사용자별로 정렬해서 보고 싶다"</i> 는
 * <b>조회조건 {@code userId}</b> 가 답한다 — 정렬이 아니라 <b>거르기</b>가 맞는 도구다.
 *
 * <h2>인덱스가 둘뿐인 것이 조건의 모양을 정했다</h2>
 *
 * <p>고빈도 INSERT 테이블이라 인덱스마다 쓰기 비용이 붙는다(sys/logs.md). 읽기는 하루 몇 번,
 * 쓰기는 초당 수십 건이므로 <b>균형이 쓰기 쪽</b>에 있고, 그래서 {@code CRE_DTM} 과
 * {@code TRACE_ID} 둘만 인덱스다(screen/admin/system/log/access/requirements.md).
 *
 * <table><caption></caption>
 * <tr><td>{@code requestUri}</td><td><b>앞 일치만</b> 연다. URI 는 {@code /api/service/…} 로
 *     시작해 접두가 거의 같은데, 부분 일치를 열면 <b>인덱스도 없는 컬럼에 앞뒤
 *     와일드카드</b>가 붙어 전체 스캔이 된다. 뒷마디로 찾고 싶으면 {@code API_CATALOG} 에서
 *     URL 을 확정해 오는 것이 맞는 동선이다</td></tr>
 * <tr><td>{@code clientIp}</td><td><b>완전 일치만</b>. 대역 검색({@code LIKE '203.0.113.%'})
 *     을 열어도 인덱스가 없어 <b>완전 일치와 비용이 같은데 결과만 넓어진다</b></td></tr>
 * <tr><td>{@code userId}·{@code userNm}·{@code menuCd}·{@code menuNm}</td><td><b>문자열 비교
 *     넷</b>(같음 · 시작 · 포함 · 끝) — 2026-09-01. 사람이 <b>손에 있는 조각</b>으로 찾는
 *     칸이고, <b>기간이 먼저 좁힌다</b>(§2.2 가 기간을 필수로 둔 것이 이 넷을 열 수 있게 한
 *     조건이다). 완전 일치만 열어 두면 <i>"김"</i> 으로 찾을 방법이 없어 사람이 <b>기간을
 *     넓혀 훑는다</b> — 그것이 더 비싸다</td></tr>
 * </table>
 *
 * <h2>사용자와 메뉴가 <b>각각 칸 둘</b>이다 — 2026-09-01</h2>
 *
 * <p>아이디와 이름이 갈렸다. ID 는 <b>목록에서 복사해 오는 값</b>이고 이름은 <b>사람이 기억
 * 하는 값</b>이라, 한 칸에 섞으면 어느 쪽으로 걸릴지 화면이 말할 수 없다(screen/admin/system/user/requirements.md 의
 * {@code userAuth.search.user} 가 합친 것과 <b>갈리는 자리</b>다 — 거기는 후보를 고르는
 * 칸이고 여기는 <b>거르는 칸</b>이다).
 *
 * <p><b>이름은 이 테이블에 없다.</b> 사용자명은 {@code SYS_USER} 를 {@code leftJoin} 해서
 * 얻고({@link #U}), 메뉴명은 <b>두 테이블 건너</b>에 있어 파생 조건이다({@link LogMenuName}).
 *
 * <p><b>{@code 메뉴 없음} 항목이 사라졌다.</b> 메뉴 칸이 콤보에서 텍스트로 바뀌면서
 * {@code in} 배열에 {@code null} 을 담아 {@code IS NULL} 로 펴던 길(screen/admin/system/log/access/requirements.md)이 닫혔다 —
 * 그 물음에 답하는 것은 이제 <b>메뉴 컬럼의 필터</b>다(frontend/grid.md). {@code.nullable()} 은
 * 남는다: {@code ne} 가 <b>메뉴 없는 행을 빼지 않기</b> 위해 그것을 읽는다(backend/api.md).
 *
 * <h2>{@code parameters} 는 화이트리스트에 없다</h2>
 *
 * <p>조건으로도 정렬로도 쓸 수 없다 — 값이 화면에 없고(screen/admin/system/log/access/requirements.md), Oracle 이 {@code CLOB} 을
 * {@code ORDER BY} 에 쓰지 못한다(backend/api.md). <b>여기 없는 것이 그 집행</b>이다.
 */
public final class AccessLogSpec {

    static final QSysAccessLog AL = QSysAccessLog.sysAccessLog;

    /**
     * 사용자명의 출처 — <b>{@code leftJoin} 이라야 한다</b>(2026-09-01).
     *
     * <p>FK 가 없다(sys/logs.md). 계정이 지워진 뒤에도 그 사람의 요청 이력은 남아야 하므로
     * {@code join} 으로 두면 <b>그 행이 목록에서 통째로 사라진다</b> — {@code BatchHistorySpec}
     * 이 배치명에 {@code leftJoin} 을 쓴 것과 같은 이유이며, {@code NotiRequestSpec} 이
     * {@code join} 이어도 됐던 것과 <b>갈리는 자리</b>다(저쪽은 FK 가 있다).
     *
     * <p>{@code USER_ID} 가 {@code SYS_USER} 의 PK 라 <b>행이 늘지 않는다</b>.
     */
    static final QSysUser U = QSysUser.sysUser;

    /** 4xx 부터가 실패다 — {@code HTTP_STAT} 이 성공과 실패를 가르는 유일한 값이다(screen/admin/system/log/access/requirements.md). */
    private static final short FAILURE_FROM = 400;

    public static final QuerySpec SPEC = QuerySpec.of("accessLog")
            .from(AL)
            .leftJoin(U).on(U.userId.eq(AL.userId))
            // 정렬이 열린 유일한 컬럼이고 커서의 기준점이다 — screen/admin/system/log/access/requirements.md.
            .col("creDtm", AL.creDtm).sortable()
            .col("userId", AL.userId).nullable()
            /*
              <b>조인 컬럼이다.</b> 없는 계정·지워진 계정의 행에서 {@code null} 이므로
              {@code nullable} 이며, 그래야 {@code ne} 가 그 행을 빼지 않는다(backend/api.md).
            */
            .col("userNm", U.userNm).nullable()
            .col("menuCd", AL.menuCd).nullable()
            // 이름은 두 테이블 건너에 있다 — 컬럼으로 표현되지 않는다(LogMenuName).
            .derived("menuNm", AccessLogSpec::menuNamed)
            .col("requestUri", AL.requestUri)
            .col("clientIp", AL.clientIp).nullable()
            .col("traceId", AL.traceId).nullable()
            .col("accessLogSeq", AL.accessLogSeq)
            .derived("outcome", AccessLogSpec::outcome)
            .defaultSort("creDtm", SortDir.desc)
            .pk(AL.accessLogSeq)
            .build();

    /** 메뉴명 조건 — 규칙은 {@link LogMenuName} 이 갖고 이음매만 여기 있다(screen/admin/system/log/access/requirements.md). */
    private static BooleanExpression menuNamed(Op op, Object value) {
        return LogMenuName.matches(AL.menuCd, op, value);
    }

    /**
     * <b>성공만 · 실패만</b> — screen/admin/system/log/access/requirements.md 의 <i>상태</i> 조건.
     *
     * <p>{@code HTTP_STAT} 을 그대로 열지 않는다. 운영자가 묻는 것은 <i>"실패한 요청"</i>
     * 이지 <i>"403 인 요청"</i> 이 아니고, 후자는 <b>컬럼 필터가 이 페이지 안에서</b> 답한다
     * (frontend/grid.md).
     *
     * <p><b>기본이 전체다</b> — 조건을 보내지 않으면 거르지 않는다. 이 화면은
     * <i>성공한 요청 목록</i> 이 아니라 <b>일어난 요청 전부</b>이며(screen/admin/system/log/access/requirements.md), 기본을
     * <i>성공만</i> 으로 두면 sys/logs.md 이 감사 이력을 대체한 전제가 화면에서 깨진다.
     */
    private static BooleanExpression outcome(Op op, Object value) {
        if (op != Op.eq) {
            throw new IllegalArgumentException("상태 조건은 = 만 받는다 — " + op);
        }
        return "SUCCESS".equalsIgnoreCase(String.valueOf(value))
                ? AL.httpStat.lt(FAILURE_FROM)
                : AL.httpStat.goe(FAILURE_FROM);
    }

    private AccessLogSpec() {}
}
