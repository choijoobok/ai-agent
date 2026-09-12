package com.aiagent.domain.log.errorlog;

import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.log.LogMenuName;
import com.aiagent.domain.log.entity.QSysExceptionLog;
import com.aiagent.domain.user.entity.QSysUser;
import com.querydsl.core.types.dsl.BooleanExpression;

/**
 * {@code ERROR_LOG} 의 화이트리스트 — screen/log/error/requirements.md · backend/api.md.
 *
 * <h2>정렬이 하나뿐인 것이 셋에 공통이다</h2>
 *
 * <p>{@code creDtm} 에만 {@code .sortable()} 이 붙는다 — 번호 없는 이동의 기준점이
 * 고정이어야 하고(screen/log/error/requirements.md) 나머지 컬럼은 인덱스가 없어 전체 정렬이 된다.
 *
 * <h2>{@code rootCauseStack} 이 여기 없다</h2>
 *
 * <p>조건으로도 정렬로도 쓸 수 없다 — 값이 목록에 없고(screen/log/error/requirements.md), Oracle 이 {@code CLOB} 을
 * {@code ORDER BY} 에 쓰지 못한다(backend/api.md). <b>여기 없는 것이 그 집행</b>이며
 * {@code AccessLogSpec} 의 {@code parameters} 와 같다.
 *
 * <p><b>{@code errMsg} 도 없다.</b> 이쪽은 이유가 다르다 — {@code VARCHAR(1000)} 이라 실을 수
 * 있지만, 문구는 <b>사용자 언어로 남는다</b>(backend/packages.md). 조건으로 열면 같은 사건이 언어마다
 * 다른 문자열이라 <i>"이 오류를 모아 보자"</i> 가 반쪽만 나온다. 그 물음에 답하는 것은
 * {@code errCd} 이며 그것이 <b>문자열 상수</b>인 이유가 이것이다(screen/log/error/requirements.md).
 *
 * <h2>사용자와 메뉴가 <b>각각 칸 둘</b>이다 — 2026-09-01</h2>
 *
 * <p>아이디·이름 넷이 <b>문자열 비교 넷</b>(같음 · 시작 · 포함 · 끝)을 함께 받는다. 근거는
 * {@code AccessLogSpec} 이 갖고 여기서도 같다 — <b>기간이 먼저 좁히므로</b> 부분 일치가
 * 전체 스캔이 되지 않는다(screen/log/error/requirements.md).
 *
 * <p>이름의 출처가 둘로 갈린다. 사용자명은 {@code SYS_USER} 의 <b>컬럼</b>이라
 * {@code leftJoin}({@link #U})이고, 메뉴명은 {@code SYS_MENU} → {@code SYS_MESSAGE} <b>두
 * 테이블 건너</b>라 파생 조건이다({@link LogMenuName}).
 */
public final class ErrorLogSpec {

    static final QSysExceptionLog EL = QSysExceptionLog.sysExceptionLog;

    /**
     * 사용자명의 출처 — <b>{@code leftJoin} 이다</b>(2026-09-01).
     *
     * <p>근거가 {@code AccessLogSpec.U} 와 같다: FK 가 없어(sys/logs.md) 계정이 지워진 뒤에도
     * 오류 이력은 남아야 하고, {@code join} 으로 두면 <b>그 행이 목록에서 사라진다</b>.
     * 이력 셋 중 <b>여기가 그 손실을 가장 감당할 수 없는 화면</b>이다 — 사용자가 {@code traceId}
     * 를 들고 오는데(screen/log/error/requirements.md) 그 한 행이 조인 때문에 없으면 <i>로그 유실</i> 로 읽힌다.
     */
    static final QSysUser U = QSysUser.sysUser;

    /** 4xx 의 아래 끝 — 그 아래는 이 테이블에 오지 않는다(2xx 는 예외가 아니다). */
    private static final short CLIENT_FROM = 400;

    /** 5xx 의 아래 끝이자 <b>스택이 남는 선</b>이다 — screen/log/error/requirements.md. */
    private static final short SERVER_FROM = 500;

    /** 사용자가 고르는 두 값 — 화면의 콤보와 같은 문자열이다(screen/log/error/requirements.md). */
    static final String CLIENT_ERROR = "4XX";

    static final String SERVER_ERROR = "5XX";

    public static final QuerySpec SPEC = QuerySpec.of("errorLog")
            .from(EL)
            .leftJoin(U).on(U.userId.eq(EL.userId))
            // 정렬이 열린 유일한 컬럼이고 커서의 기준점이다 — screen/log/error/requirements.md.
            .col("creDtm", EL.creDtm).sortable()
            .col("errCd", EL.errCd).nullable()
            .col("userId", EL.userId).nullable()
            // 조인 컬럼 — 없는 계정·지워진 계정의 행에서 null 이다(2026-09-01).
            .col("userNm", U.userNm).nullable()
            .col("menuCd", EL.menuCd).nullable()
            // 이름은 두 테이블 건너에 있다 — 컬럼으로 표현되지 않는다(LogMenuName).
            .derived("menuNm", ErrorLogSpec::menuNamed)
            .col("requestUri", EL.requestUri)
            .col("traceId", EL.traceId).nullable()
            .col("exceptionLogSeq", EL.exceptionLogSeq)
            .derived("statusGroup", ErrorLogSpec::statusGroup)
            .defaultSort("creDtm", SortDir.desc)
            .pk(EL.exceptionLogSeq)
            .build();

    /** 메뉴명 조건 — 규칙은 {@link LogMenuName} 이 갖고 이음매만 여기 있다(screen/log/error/requirements.md). */
    private static BooleanExpression menuNamed(Op op, Object value) {
        return LogMenuName.matches(EL.menuCd, op, value);
    }

    /**
     * <b>{@code 4xx 만} · {@code 5xx 만}</b> — screen/log/error/requirements.md 의 <i>상태</i> 조건. 파생 조건의 셋째
     * 사례다({@code AccessLogSpec.outcome} · {@code LoginLogSpec.rsltGroup} 다음).
     *
     * <p><b>{@code HTTP_STAT} 을 범위로 열지 않는다.</b> {@code 400~499} 를 사람이 입력하게
     * 하면 <b>경계를 틀린다</b> — 묶음 둘이면 틀릴 자리가 없다(screen/log/error/requirements.md).
     *
     * <p><b>{@code 5xx 만} 이 이 화면의 가장 흔한 조회다.</b> 403 이 압도적으로 많고 그것은
     * 대개 정상 동작이므로(권한 없는 사람이 눌렀다), <i>"고쳐야 할 것"</i> 만 보려면 5xx 다.
     * <b>그래도 기본은 전체</b>다 — 기본을 5xx 로 두면 403 의 세 갈래를 진단하러 온 사람이
     * (screen/admin/system/log/access/requirements.md) <b>빈 화면</b>을 먼저 본다.
     */
    private static BooleanExpression statusGroup(Op op, Object value) {
        if (op != Op.eq) {
            throw new IllegalArgumentException("상태 조건은 = 만 받는다 — " + op);
        }
        String group = String.valueOf(value);
        if (SERVER_ERROR.equalsIgnoreCase(group)) {
            return EL.httpStat.goe(SERVER_FROM);
        }
        if (CLIENT_ERROR.equalsIgnoreCase(group)) {
            return EL.httpStat.goe(CLIENT_FROM).and(EL.httpStat.lt(SERVER_FROM));
        }
        /*
          <b>모르는 값을 조용히 전체로 흘리지 않는다.</b> 던지면 400 이 되고(FieldSpec 이
          SearchErrors.derivedRejected 로 감싼다 — screen/admin/system/log/access/requirements.md) 사용자는 <i>조건이 틀렸다</i> 를
          듣는다. 흘려보내면 <b>거르지 않은 목록을 거른 것으로 읽는다.</b>
        */
        throw new IllegalArgumentException("상태 묶음은 " + CLIENT_ERROR + " · " + SERVER_ERROR + " 뿐이다 — " + group);
    }

    private ErrorLogSpec() {}
}
