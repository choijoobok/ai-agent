package com.ordinary.backoffice.domain.user.admin;

import com.ordinary.backoffice.core.search.Op;
import com.ordinary.backoffice.core.search.QuerySpec;
import com.ordinary.backoffice.core.search.SortDir;
import com.ordinary.backoffice.domain.authz.entity.QSysUserRole;
import com.ordinary.backoffice.domain.user.entity.QSysUser;
import com.ordinary.backoffice.support.time.BusinessCalendar;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.JPAExpressions;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * {@code USER_MGMT} 의 화이트리스트 — 61 §3.3 · api-conventions.md §4.1.
 *
 * <h2>이 스펙만 {@code static} 이 아니다</h2>
 *
 * <p>다른 화면의 스펙은 {@code public static final QuerySpec} 인데 여기는 <b>빈</b>이다.
 * 이유 하나 — <b>계정 상태 파생 조건이 오늘을 봐야 한다</b>(기간 만료). 업무 시간대의 오늘은
 * {@link BusinessCalendar} 만 아는 값이고(40 §4.3), 그것을 {@code static} 초기화가 가질 방법이
 * 없다.
 *
 * <p><b>{@code CURRENT_DATE} 로 도망가지 않는다.</b> 4벤더 다 지원하지만 그 값은 <b>DB 서버의
 * 시간대</b>이며, 40 §4.3 이 {@code app.business-timezone} 을 둔 이유가 정확히 <i>자정 근처에서만
 * 하루가 밀리는</i> 그 버그다. 조건과 표시가 서로 다른 오늘을 보게 두느니 빈이 낫다.
 *
 * <h2>계정 상태는 화면의 값과 SQL 컬럼이 1:1 이 아니다</h2>
 *
 * <p>화면이 보내는 것은 {@link AccountStat} 다섯 중 몇 개이고, 서버가 그것을 <b>네 컬럼의
 * 조건</b>으로 번역한다(61 §3.3). 조회 프로토콜(QRY-01)이 <b>파생 조건을 어떻게 싣는지</b> 의
 * 사례이며 api-conventions.md §3.5 가 <i>"와이어의 문제가 아니라 화이트리스트의 문제"</i> 로 답한 그 자리다 —
 * {@code LoginLogSpec.rsltGroup}(64 §4.6)에 이은 셋째다.
 *
 * <h2>파생 셋이 정렬 대상이 아니다</h2>
 *
 * <p>{@code .sortable()} 을 붙이면 기동이 실패한다({@code QuerySpec.Builder}) — 정렬할
 * {@code Path} 가 없기 때문이다. 화면도 상태 컬럼의 {@code sortable} 을 켜지 않는다:
 * 켜면 400 이고, 그것이 61 §3.2.1 이 <i>"정렬은 미결"</i> 로 남긴 것의 현재 답이다.
 */
@Component
public class UserSpec {

    static final QSysUser U = QSysUser.sysUser;
    static final QSysUserRole UR = QSysUserRole.sysUserRole;

    private final BusinessCalendar calendar;
    private final QuerySpec userSpec;

    public UserSpec(BusinessCalendar calendar) {
        this.calendar = calendar;
        this.userSpec = build();
    }

    /** 마스터 목록의 화이트리스트. */
    public QuerySpec userSpec() {
        return userSpec;
    }

    /**
     * 컬럼 조건과 파생 조건 셋.
     *
     * <p><b>{@code PWD} 가 없다.</b> 조회할 수 있는 것이 곧 조건이 될 수 있는 것이고, 해시로
     * 조건을 걸 일도 없다 — 화이트리스트가 <i>이 화면이 무엇을 물을 수 있는가</i> 를 말한다.
     *
     * <p>기본 정렬이 {@code USER_NM, USER_ID} 다. tie-breaker 없이는 동명이인에서 순서가
     * 비결정적이고(db-portability.md §4.5) 페이징이 그 위에서 돌면 같은 행이 두 장에 나온다.
     */
    private QuerySpec build() {
        return QuerySpec.of("user")
                .from(U)
                .col("userId", U.userId).sortable()
                .col("userNm", U.userNm).sortable()
                .col("email", U.email).sortable().nullable()
                .col("useYn", U.useYn).sortable()
                .col("validFromDt", U.validFromDt).sortable().nullable()
                .col("validToDt", U.validToDt).sortable().nullable()
                .col("lastLoginDtm", U.lastLoginDtm).sortable().nullable()
                .col("localeCd", U.localeCd).sortable()
                .col("lockYn", U.lockYn).sortable()
                .col("lockDtm", U.lockDtm).sortable().nullable()
                .col("loginFailCnt", U.loginFailCnt).sortable()
                .col("dormantYn", U.dormantYn).sortable()
                .col("pwdInitYn", U.pwdInitYn).sortable()
                .col("pwdChgDtm", U.pwdChgDtm).sortable().nullable()
                .col("regDtm", U.regDtm).sortable()
                .col("modDtm", U.modDtm).sortable()
                .derived("accountStat", this::accountStat)
                .derived("roleId", UserSpec::hasRole)
                .derived("roleExpiringInDays", this::roleExpiringIn)
                .defaultSort("userNm", SortDir.asc)
                .defaultSort("userId", SortDir.asc)
                .pk(U.userId)
                .build();
    }

    // ── 파생 (api-conventions.md §3.5) ───────────────────────────────────────────────

    /**
     * 계정 상태 — <b>{@code IN} 과 {@code =} 만 받는다</b>.
     *
     * <p>다섯 값은 <b>서로 배타</b>다(체인 순서로 먼저 걸린 것 하나 — {@link AccountStat}).
     * 그래서 고른 것들의 조건을 {@code OR} 로 잇는 것이 곧 <i>"이 중 하나인 행"</i> 이며,
     * 고르지 않은 값의 조건을 빼는 것만으로 나머지가 걸러진다.
     *
     * <p><b>다섯을 다 고른 것과 조건이 없는 것이 같다.</b> 그 경우에도 표현식을 그대로 만든다 —
     * {@code OR} 다섯이 항진식이라 결과가 같고, 특수 분기를 두면 <i>다섯을 골랐을 때만 다른
     * 길</i>이 하나 생긴다.
     */
    private BooleanExpression accountStat(Op op, Object value) {
        if (op != Op.in && op != Op.eq) {
            throw new IllegalArgumentException("계정 상태는 = 과 IN 만 받는다 — " + op);
        }
        LocalDate today = calendar.today();

        List<BooleanExpression> branches = new ArrayList<>();
        for (AccountStat stat : parse(value)) {
            branches.add(condition(stat, today));
        }
        BooleanExpression any = branches.get(0);
        for (BooleanExpression branch : branches.subList(1, branches.size())) {
            any = any.or(branch);
        }
        return any;
    }

    /**
     * 상태 하나의 SQL — <b>체인 순서가 조건 안에 들어 있다</b>.
     *
     * <p>{@code LOCKED} 는 <i>{@code LOCK_YN='Y'}</i> 가 아니라 <i>사용 중이고 기간 안이며
     * 잠긴</i> 이다. 앞의 것들을 빼지 않으면 <b>미사용이면서 잠긴 계정</b>이 두 값에 다 걸려
     * 표시({@link AccountStat} — 하나만 낸다)와 어긋난다: 목록에는 <i>미사용</i> 으로 나오는데
     * <i>잠김</i> 으로 조회하면 나오는 행이 생긴다.
     */
    private static BooleanExpression condition(AccountStat stat, LocalDate today) {
        BooleanExpression enabled = U.useYn.isTrue();
        BooleanExpression inPeriod = U.validFromDt.isNull().or(U.validFromDt.loe(today))
                .and(U.validToDt.isNull().or(U.validToDt.goe(today)));

        return switch (stat) {
            case DISABLED -> U.useYn.isFalse();
            case EXPIRED -> enabled.and(inPeriod.not());
            case LOCKED -> enabled.and(inPeriod).and(U.lockYn.isTrue());
            case DORMANT -> enabled.and(inPeriod).and(U.lockYn.isFalse()).and(U.dormantYn.isTrue());
            case NORMAL -> enabled.and(inPeriod).and(U.lockYn.isFalse()).and(U.dormantYn.isFalse());
        };
    }

    private static Set<AccountStat> parse(Object value) {
        List<?> raw = value instanceof List<?> list ? list : List.of(value);
        Set<AccountStat> wanted = EnumSet.noneOf(AccountStat.class);
        for (Object item : raw) {
            String name = String.valueOf(item).toUpperCase(Locale.ROOT);
            try {
                wanted.add(AccountStat.valueOf(name));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("없는 계정 상태다 — " + item, e);
            }
        }
        if (wanted.isEmpty()) {
            throw new IllegalArgumentException("계정 상태를 하나는 골라야 한다");
        }
        return wanted;
    }

    /**
     * 특정 역할 보유자 찾기 — 61 §3.2.2 가 <b>역할 나열 컬럼 대신</b> 준 수단이다.
     *
     * <p>문자열 집계는 벤더마다 함수가 다르지만({@code LISTAGG} · {@code GROUP_CONCAT} ·
     * {@code string_agg}) <b>{@code EXISTS} 에는 그 문제가 없다</b>(db-portability.md §4).
     *
     * <p><b>기간을 보지 않는다.</b> 묻는 것이 <i>"이 역할을 가진 사람"</i> 이고 만료된 부여도
     * 그 사실이다 — 오늘 유효한 사람만 보고 싶으면 그 질문에 답하는 것은 {@code ROLE_MGMT} 의
     * 하단 pane 이다(62 §3.4).
     */
    private static BooleanExpression hasRole(Op op, Object value) {
        if (op != Op.eq) {
            throw new IllegalArgumentException("보유 역할은 = 만 받는다 — " + op);
        }
        return JPAExpressions.selectOne()
                .from(UR)
                .where(UR.userId.eq(U.userId), UR.roleId.eq(String.valueOf(value)))
                .exists();
    }

    /**
     * 역할 부여가 <b>N일 안에 끝나는</b> 사람 — 42 §10 의 <i>만료 예고</i> 에 대한 답이다.
     *
     * <p><b>{@code =} 로 받는다.</b> 61 §3.3 은 이 칸을 <i>{@code number} · {@code <=}</i> 로
     * 적었지만 파생 필드의 자바 타입은 {@code String} 이고({@code FieldSpec#javaType}) 부등호는
     * 거기서 거부된다 — 화면이 보내는 것은 <b>일수 하나</b>이고 <i>N일 이내</i> 라는 뜻은
     * <b>번역 함수만 안다</b>는 것이 api-conventions.md §3.5 의 규약이다. 그래서 폼도 숫자 칸이 아니라
     * <b>후보 콤보</b>이며, 그 김에 61 §6 의 <i>기본값 미결</i> 이 <b>기본값 없음</b>으로 닫힌다.
     *
     * <p>범위는 <b>오늘부터</b>다 — 이미 만료된 부여는 예고할 것이 아니라 지난 일이다.
     */
    private BooleanExpression roleExpiringIn(Op op, Object value) {
        if (op != Op.eq) {
            throw new IllegalArgumentException("역할 만료 예정은 = 만 받는다 — " + op);
        }
        int days;
        try {
            days = Integer.parseInt(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("역할 만료 예정은 일수다 — " + value, e);
        }
        if (days < 0) {
            throw new IllegalArgumentException("역할 만료 예정은 음수일 수 없다 — " + days);
        }
        LocalDate today = calendar.today();
        return JPAExpressions.selectOne()
                .from(UR)
                .where(
                        UR.userId.eq(U.userId),
                        UR.validToDt.isNotNull(),
                        UR.validToDt.goe(today),
                        UR.validToDt.loe(today.plusDays(days)))
                .exists();
    }
}
