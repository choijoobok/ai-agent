package com.aiagent.domain.log.errorlog;

import static com.aiagent.domain.log.errorlog.ErrorLogSpec.EL;
import static com.aiagent.domain.log.errorlog.ErrorLogSpec.SPEC;
import static com.aiagent.domain.log.errorlog.ErrorLogSpec.U;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.InChunks;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.RangeGuard;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.log.LogText;
import com.aiagent.domain.log.entity.QSysAccessLog;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.SearchRangeProps;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.core.types.dsl.CaseBuilder;
import com.querydsl.core.types.dsl.NumberExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code ERROR_LOG} 의 조회 — screen/log/error/requirements.md. <b>쓰기가 없다.</b>
 *
 * <p>쓰는 쪽은 {@code ExceptionLogRecorder} 이고 <b>예외 처리 흐름이 부른다</b> — 화면이
 * 아니다. 로그인 이력이 {@code LoginHistoryService} 와 갈라진 것과 같은 모양이며, 셋 다
 * 이력 행이 불변이라는 한 가지 사실에서 나온다(screen/log/error/requirements.md).
 *
 * <h2>{@code getDetail} 이 두 테이블을 읽는다 — 이 서비스만 그렇다</h2>
 *
 * <p>스택은 자기 테이블에, <b>전문은 사용 이력에</b> 있다(sys/logs.md). {@code TRACE_ID} 가 둘을
 * 잇고, 보존이 <b>180일 / 90일</b>로 달라 <b>180일 된 오류의 전문은 없다</b>(retention.md).
 *
 * <p><b>그래도 진단은 자립한다.</b> {@code ERR_CD} · {@code ERR_MSG} · 스택이 자기 테이블에
 * 있고, 180일 된 오류에서 필요한 것은 <i>"무엇이 몇 번 났나"</i> 이지 그때 보낸 body 가
 * 아니다 — 그것이 §1.4 의 대가를 받아들인 근거다(screen/log/error/requirements.md).
 *
 * <h2>쿼리가 셋인데 셋 다 이유가 다르다</h2>
 *
 * <table><caption></caption>
 * <tr><td>목록</td><td>커서형 한 번 — {@code size + 1} 건으로 다음 장을 판정한다(screen/log/error/requirements.md)</td></tr>
 * <tr><td>메뉴명</td><td>이름의 원본이 {@code SYS_MESSAGE} 라 조인으로 얻지 못한다(sys/code.md) —
 *     {@code AccessLogQueryService} 와 같다. <b>사용자명은 여기 오지 않는다</b>: 원본이
 *     {@code SYS_USER.USER_NM} 컬럼 그대로라 목록 쿼리의 {@code leftJoin} 이 함께 가져온다
 *     (2026-09-01)</td></tr>
 * <tr><td>전문</td><td><b>{@code getDetail} 에서만</b>. 목록이 부르지 않는다 — 100행마다
 *     사용 이력을 한 번씩 뒤지는 것이 되고, 그 값은 화면에 실리지도 않는다</td></tr>
 * </table>
 */
@Service
@Transactional(readOnly = true)
public class ErrorLogQueryService {

    private static final QSysAccessLog AL = QSysAccessLog.sysAccessLog;


    /**
     * 목록에 싣는 것 — <b>{@code rootCauseStack} 이 없다.</b> 있는가만 {@link #HAS_STACK} 이 낸다.
     *
     * <p>{@code errMsg} 는 <b>있다</b>. {@code VARCHAR(1000)} 이라 실을 수 있고, 실려야
     * <i>"무엇이 났나"</i> 를 목록에서 읽는다 — 그것이 sys/logs.md 가 이 컬럼을 {@code nclob} 으로
     * 두지 않은 이유 전부다(screen/log/error/requirements.md).
     */
    private static final NumberExpression<Integer> HAS_STACK =
            new CaseBuilder().when(EL.rootCauseStack.isNotNull()).then(1).otherwise(0);

    private static final Expression<?>[] LIST = {
        EL.exceptionLogSeq,
        EL.creDtm,
        EL.httpStat,
        EL.errCd,
        EL.errMsg,
        EL.userId,
        // 조인 컬럼이다 — 스펙이 leftJoin 을 갖고 있으므로 여기서는 뽑기만 한다(backend/search-spec.md).
        U.userNm,
        EL.menuCd,
        EL.requestUri,
        HAS_STACK,
        EL.clientIp,
        EL.traceId
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final SysMenuRepository menus;
    private final MessageService messages;
    private final ConfigLookup configs;

    public ErrorLogQueryService(
            JPAQueryFactory query,
            QueryDslBuilder builder,
            SysMenuRepository menus,
            MessageService messages,
            ConfigLookup configs) {
        this.query = query;
        this.builder = builder;
        this.menus = menus;
        this.messages = messages;
        this.configs = configs;
    }

    /**
     * 목록 — 커서형이다(backend/api.md).
     *
     * @param lang 세션 언어 — 컨트롤러가 준다. 도메인은 요청을 모른다(backend/packages.md)
     */
    public PageResponse<ErrorLogRow> getList(SearchRequest<Void> request, String lang) {
        checkRange(request);
        Built built = builder.build(request, SPEC, PageMode.cursor);

        List<Tuple> found = built.apply(query.select(Projections.tuple(LIST))).fetch();
        Map<String, String> menuNames = menuNamesOf(found, lang);

        List<ErrorLogRow> rows = new ArrayList<>(found.size());
        for (Tuple row : found) {
            String menuCd = row.get(EL.menuCd);
            rows.add(new ErrorLogRow(
                    row.get(EL.exceptionLogSeq),
                    row.get(EL.creDtm),
                    row.get(EL.httpStat),
                    row.get(EL.errCd),
                    row.get(EL.errMsg),
                    row.get(EL.userId),
                    row.get(U.userNm),
                    menuCd,
                    menuCd == null ? null : menuNames.get(menuCd),
                    row.get(EL.requestUri),
                    Integer.valueOf(1).equals(row.get(HAS_STACK)),
                    row.get(EL.clientIp),
                    row.get(EL.traceId)));
        }
        return built.respondCursor(rows, ErrorLogRow::creDtm, ErrorLogRow::exceptionLogSeq);
    }

    /**
     * 탭 둘을 <b>한 번에</b> — screen/log/access/requirements.md. <b>동적 봉투를 태우지 않는다</b>(backend/api.md).
     *
     * <p>PK 하나로 한 행을 집는 고정형이다. 조건 목록으로 열면 <b>전문 조회가 임의 조건의
     * 조회</b>가 되고, 그 순간 {@code nclob} 을 목록에서 뺀 이유가 무너진다.
     *
     * <p><b>왕복을 나누지 않는다.</b> 스택을 보다가 전문을 보는 것이 진단의 기본 동선이고,
     * 탭마다 부르면 <b>두 번째가 실패했을 때 절반만 열린 모달</b>이 된다.
     */
    public ErrorLogDetail getDetail(long exceptionLogSeq) {
        Tuple found = query.select(EL.rootCauseStack, EL.traceId)
                .from(EL)
                .where(EL.exceptionLogSeq.eq(exceptionLogSeq))
                .fetchFirst();

        if (found == null) {
            // 조회한 뒤 파기 배치가 지나갔다(retention.md). 목록은 그대로 둔다 — screen/log/access/requirements.md.
            throw new BusinessException(
                    ErrorLogErrorCode.PURGED, "에러 로그 행이 없다 — " + exceptionLogSeq);
        }
        String stack = found.get(EL.rootCauseStack);
        String traceId = found.get(EL.traceId);

        /*
          <b>{@code traceId} 가 없으면 찾을 길이 없다.</b> 실제로 비는 일은 없지만(모든 요청이
          MDC 를 갖는다 — backend/logging.md) 컬럼이 nullable 이므로 여기서 판단해 둔다: 없는 값으로
          조회하면 언제나 0건이고, 그 0건은 <i>파기됨</i> 과 구분되지 않는다.

          <b>PK 를 함께 고르는 것도 같은 이유다.</b> parameters 하나만 고르면 결과가 String
          이고, 그러면 <i>행이 없다</i> 와 <i>전문이 null 이다</i> 가 같은 null 이 된다 —
          전문 없이 남은 정상 행(멀티파트 요청 · 캐싱이 꺼진 구간)이 <b>파기됨</b> 으로
          보인다. 튜플이면 그 둘이 갈린다.
        */
        Tuple access = traceId == null
                ? null
                : query.select(AL.accessLogSeq, AL.parameters)
                        .from(AL)
                        .where(AL.traceId.eq(traceId))
                        .fetchFirst();

        String parameters = access == null ? null : access.get(AL.parameters);
        return new ErrorLogDetail(
                exceptionLogSeq,
                stack,
                LogText.isTruncated(stack),
                parameters,
                access != null,
                LogText.isTruncated(parameters));
    }

    // ── 기간 검사 (screen/log/error/requirements.md) ──────────────────────────────────────────

    /**
     * 기간은 <b>필수 조건이고 상한이 있다</b> — 규칙은 {@link RangeGuard} 가 갖는다.
     *
     * <p><b>상한을 덮지 않는다.</b> 행이 가벼워(전문이 없다) 시스템 값 92일을 그대로 쓰며,
     * 로그인 이력과 같고 사용 이력(31일)과 갈린다.
     *
     * <p><b>추적 ID 를 넣으면 기간이 선택이 된다</b> — 셋 중 이 화면에서 그것이 가장 흔하다.
     * 사용자가 5xx 토스트에서 복사한 값을 들고 오는 것이 이 화면의 주된 동선이며(screen/log/error/requirements.md),
     * 그때 <i>언제 났는지</i> 는 대개 모른다.
     */
    private void checkRange(SearchRequest<Void> request) {
        RangeGuard.check(
                request,
                new RangeGuard.Rule(
                        "creDtm",
                        "traceId",
                        configs.get(SearchRangeProps.class).maxDays(),
                        ErrorLogErrorCode.RANGE_REQUIRED,
                        ErrorLogErrorCode.RANGE_TOO_WIDE));
    }

    // ── 메뉴명 (sys/code.md) ───────────────────────────────────────────────

    /** {@code AccessLogQueryService} 와 같은 규칙이다 — {@code MENU_NM} 은 메시지 키다. */
    private Map<String, String> menuNamesOf(List<Tuple> rows, String lang) {
        Set<String> menuCds = new HashSet<>();
        for (Tuple row : rows) {
            String menuCd = row.get(EL.menuCd);
            if (menuCd != null) {
                menuCds.add(menuCd);
            }
        }
        if (menuCds.isEmpty()) {
            return Map.of();
        }
        Map<String, String> names = new HashMap<>();
        for (List<String> chunk : InChunks.split(List.copyOf(menuCds))) {
            for (SysMenu menu : menus.findAllById(chunk)) {
                names.put(menu.getMenuCd(), messages.text(menu.getMenuNm(), lang));
            }
        }
        return names;
    }
}
