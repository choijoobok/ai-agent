package com.aiagent.domain.user.admin;

import static com.aiagent.domain.user.admin.UserSpec.U;

import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.aiagent.support.time.BusinessCalendar;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code USER_MGMT} 의 조회 — screen/user/requirements.md. <b>목록이 곧 상세다.</b>
 *
 * <p>편집 폼을 없앤 결과(frontend/grid.md) 이 쿼리 하나가 {@code SYS_USER} 의 모든 컬럼을 낸다 —
 * {@code getDetail} 이 없는 이유이며, 행을 골랐을 때 탭이 부르는 것은 <b>{@code SYS_USER} 밖의
 * 데이터</b>뿐이다(screen/user/requirements.md).
 *
 * <h2>파생 컬럼이 하나뿐이고 그것도 세지 않는다</h2>
 *
 * <p>{@code ROLE_MGMT} 는 마스터 한 번에 {@code COUNT} 셋이 붙었지만(screen/role/requirements.md) 여기는
 * <b>계정 상태 하나</b>이고 그것은 <b>이미 읽은 네 컬럼의 함수</b>다 — 쿼리를 하나도 더하지
 * 않는다.
 *
 * <p><b>역할 나열 컬럼이 없기 때문이다</b>(screen/user/requirements.md). 한 행에 역할명을 이어 붙이려면 문자열
 * 집계가 필요하고 그것이 벤더마다 다르다({@code LISTAGG} · {@code GROUP_CONCAT} ·
 * {@code string_agg} — backend/persistence.md). 그 질문은 <b>보유 역할 탭</b>과 <b>조회조건</b>이 나눠 받는다.
 *
 * <h2>상태는 <b>자바가</b> 계산한다</h2>
 *
 * <p>SQL 의 {@code CASE} 로 펼치면 체인 순서가 <b>두 곳</b>에 표현된다 — 표시(여기)와 조건
 * ({@link UserSpec}). 자바에서 계산하면 순서의 원본은 {@link AccountStat} 하나이고,
 * 스펙의 파생 조건은 그 열거를 <b>보고</b> 번역한다.
 *
 * <p>대가는 <b>정렬</b>이다 — SQL 이 모르는 값이라 {@code ORDER BY} 를 걸 수 없다(screen/user/requirements.md 의
 * 미결). 화면이 그 컬럼의 {@code sortable} 을 켜지 않는 것으로 지킨다.
 */
@Service
@Transactional(readOnly = true)
public class UserQueryService {

    /**
     * 내리는 컬럼 — <b>{@code PWD} 가 없다</b>.
     *
     * <p>해시라도 응답에 담기면 <b>화면에 없어도 브라우저에 있는 값</b>이 된다. 관리자가
     * 비밀번호에 대해 할 수 있는 일은 <b>발급</b> 하나이고(AUTH-07) 그 결과는
     * {@code PWD_INIT_YN} 이 말한다.
     */
    private static final Expression<?>[] USER = {
        U.userId, U.userNm, U.email,
        U.useYn, U.validFromDt, U.validToDt,
        U.lastLoginDtm, U.localeCd,
        U.lockYn, U.lockDtm, U.loginFailCnt,
        U.dormantYn, U.pwdInitYn, U.pwdChgDtm,
        U.regId, U.regDtm, U.modId, U.modDtm
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final UserSpec spec;
    private final BusinessCalendar calendar;

    public UserQueryService(
            JPAQueryFactory query,
            QueryDslBuilder builder,
            UserSpec spec,
            BusinessCalendar calendar) {
        this.query = query;
        this.builder = builder;
        this.spec = spec;
        this.calendar = calendar;
    }

    /** 마스터 목록 — 조건은 {@link UserSpec} 이 연 것뿐이다(backend/api.md). */
    public PageResponse<UserRow> getList(SearchRequest<Void> request) {
        Built built = builder.build(request, spec.userSpec(), PageMode.offset);

        List<Tuple> users = built.apply(query.select(Projections.tuple(USER))).fetch();
        Long total = built.count(query).fetchOne();

        LocalDate today = calendar.today();
        List<UserRow> rows = new ArrayList<>(users.size());
        for (Tuple user : users) {
            rows.add(toRow(user, today));
        }
        return built.respond(rows, total == null ? 0L : total);
    }

    private static UserRow toRow(Tuple user, LocalDate today) {
        return new UserRow(
                user.get(U.userId),
                user.get(U.userNm),
                user.get(U.email),
                statOf(user, today),
                user.get(U.useYn),
                user.get(U.validFromDt),
                user.get(U.validToDt),
                user.get(U.lastLoginDtm),
                user.get(U.localeCd),
                user.get(U.lockYn),
                user.get(U.lockDtm),
                user.get(U.loginFailCnt),
                user.get(U.dormantYn),
                user.get(U.pwdInitYn),
                user.get(U.pwdChgDtm),
                user.get(U.regId),
                user.get(U.regDtm),
                user.get(U.modId),
                user.get(U.modDtm));
    }

    /**
     * 접근 제어 체인 순서로 <b>먼저 걸린 것 하나</b> — screen/user/requirements.md.
     *
     * <p>{@link UserSpec#condition} 과 <b>같은 순서를 같은 방향으로</b> 읽는다. 한쪽만
     * 고치면 <i>목록에는 미사용인데 잠김으로 조회하면 나오는</i> 행이 생기므로, 순서를 바꿀
     * 때는 반드시 둘을 함께 본다.
     */
    private static AccountStat statOf(Tuple user, LocalDate today) {
        if (!Boolean.TRUE.equals(user.get(U.useYn))) {
            return AccountStat.DISABLED;
        }
        LocalDate from = user.get(U.validFromDt);
        LocalDate to = user.get(U.validToDt);
        if ((from != null && from.isAfter(today)) || (to != null && to.isBefore(today))) {
            return AccountStat.EXPIRED;
        }
        if (Boolean.TRUE.equals(user.get(U.lockYn))) {
            return AccountStat.LOCKED;
        }
        if (Boolean.TRUE.equals(user.get(U.dormantYn))) {
            return AccountStat.DORMANT;
        }
        return AccountStat.NORMAL;
    }
}
