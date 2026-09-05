package com.aiagent.domain.auth.loginlog;

import static com.aiagent.domain.auth.loginlog.LoginLogSpec.LL;
import static com.aiagent.domain.auth.loginlog.LoginLogSpec.SPEC;
import static com.aiagent.domain.auth.loginlog.LoginLogSpec.U;

import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.RangeGuard;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.SearchRangeProps;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code LOGIN_LOG} 의 조회 — screen/log/login/requirements.md. <b>쓰기가 없다.</b>
 *
 * <p>쓰는 쪽은 {@code LoginHistoryService} 이고 <b>로그인 흐름이 부른다</b> — 화면이 아니다.
 * 이력 행은 불변이며 지우는 것은 파기 배치의 일이다(screen/log/access/requirements.md · retention.md).
 *
 * <h2>{@code AccessLogQueryService} 보다 짧다 — 그 이유가 전부 설계에 있다</h2>
 *
 * <table><caption></caption>
 * <tr><td>두 번째 쿼리가 없다</td><td>메뉴명을 붙이지 않는다. <b>테이블에 {@code MENU_CD}
 * 가 없기 때문</b>이며(sys/logs.md) 로그인에는 메뉴 문맥이 없다(sys/menu.md)</td></tr>
 * <tr><td>{@code getDetail} 이 없다</td><td>{@code nclob} 컬럼이 하나도 없어 <b>목록이 곧
 * 전부</b>다(screen/log/login/requirements.md)</td></tr>
 * <tr><td>{@code SYS_USER} 를 <b>{@code leftJoin} 한다</b></td><td>2026-09-01 — 이름 칸이
 *     생겼다. 없는 계정의 시도가 <b>사라지지 않게</b> 하는 것이 {@code left} 한 글자이며,
 *     빈칸이 <i>결함처럼</i> 보이던 문제는 화면의 <b>{@code 없는 계정} 배지</b>가 답한다
 * (screen/log/login/requirements.md 의 판단이 바뀐 자리 — {@code LoginLogSpec.U})</td></tr>
 * </table>
 *
 * <h2>남는 것은 기간 문지기 하나다</h2>
 *
 * <p>규칙은 {@link RangeGuard} 가 갖고 여기에는 <b>이 화면의 값</b>만 남는다. 상한을 덮지
 * 않는 것이 사용 이력과 갈리는 자리다 — 저쪽은 행마다 {@code nclob} 이 달려 31일로 좁혔고,
 * 여기는 행이 가벼워 <b>시스템 값 92일을 그대로 쓴다</b>(screen/log/login/requirements.md).
 */
@Service
@Transactional(readOnly = true)
public class LoginLogQueryService {

    /**
     * 목록에 싣는 것 — <b>표시 항목 일곱이 그대로다</b>(screen/log/login/requirements.md).
     *
     * <p>{@code USER_AGENT} 가 여기 있다. {@code VARCHAR(500)} 이라 <b>실을 수 있고</b>,
     * 화면에서 기본 숨김인 것은 크기가 아니라 <b>폭</b> 때문이다 — 한 줄이 200자를 넘어
     * 켜는 순간 다른 컬럼이 전부 밀린다(screen/log/login/requirements.md). 숨김은 화면의 판단이므로 응답에서 빼지
     * 않는다: 빼면 <b>{@code ⚙} 로 켠 컬럼이 빈칸</b>이 된다.
     */
    private static final Expression<?>[] LIST = {
        LL.loginLogSeq,
        LL.creDtm,
        LL.userId,
        // 조인 컬럼이다 — 스펙이 leftJoin 을 갖고 있으므로 여기서는 뽑기만 한다(backend/search.md).
        U.userNm,
        LL.loginRsltCd,
        LL.clientIp,
        LL.userAgent,
        LL.traceId
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final ConfigLookup configs;

    public LoginLogQueryService(
            JPAQueryFactory query, QueryDslBuilder builder, ConfigLookup configs) {
        this.query = query;
        this.builder = builder;
        this.configs = configs;
    }

    /**
     * 목록 — <b>커서형이다</b>(backend/api.md).
     *
     * <p>총 건수를 세지 않는 이유가 사용 이력과 같다(screen/log/login/requirements.md). 보존이 1년이라 이 테이블이
     * 셋 중 <b>행이 가장 많고</b>, {@code COUNT} 는 그 전량을 훑는다.
     *
     * <p><b>언어를 받지 않는다.</b> 결과 코드의 이름은 서버가 붙이지 않고 화면이
     * {@code code.LOGIN_RSLT_CD.{코드}} 로 조립한다(sys/code.md) — 코드값이 곧 셀의 값이며
     * 이름은 <b>메시지 캐시가 프론트에서</b> 붙인다. 메뉴명이 서버에서 온 것과 갈리는데,
     * 저쪽은 원본이 {@code SYS_MENU} 라 조회가 한 번 더 필요했다.
     */
    public PageResponse<LoginLogRow> getList(SearchRequest<Void> request) {
        checkRange(request);
        Built built = builder.build(request, SPEC, PageMode.cursor);

        List<Tuple> found = built.apply(query.select(Projections.tuple(LIST))).fetch();

        List<LoginLogRow> rows = new ArrayList<>(found.size());
        for (Tuple row : found) {
            rows.add(new LoginLogRow(
                    row.get(LL.loginLogSeq),
                    row.get(LL.creDtm),
                    row.get(LL.userId),
                    row.get(U.userNm),
                    row.get(LL.loginRsltCd),
                    row.get(LL.clientIp),
                    row.get(LL.userAgent),
                    row.get(LL.traceId)));
        }
        return built.respondCursor(rows, LoginLogRow::creDtm, LoginLogRow::loginLogSeq);
    }

    /**
     * 기간은 <b>필수 조건이고 상한이 있다</b> — screen/log/access/requirements.md.
     *
     * <p>상한을 덮지 않으므로 시스템 값(92일)이 그대로 온다. 추적 ID 를 넣으면 기간이
     * 선택이 되는 것은 사용 이력과 같다 — {@code TRACE_ID} 에 인덱스가 있다(sys/logs.md).
     */
    private void checkRange(SearchRequest<Void> request) {
        RangeGuard.check(
                request,
                new RangeGuard.Rule(
                        "creDtm",
                        "traceId",
                        configs.get(SearchRangeProps.class).maxDays(),
                        LoginLogErrorCode.RANGE_REQUIRED,
                        LoginLogErrorCode.RANGE_TOO_WIDE));
    }
}
