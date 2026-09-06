package com.aiagent.domain.log.admin;

import static com.aiagent.domain.log.admin.AccessLogSpec.AL;
import static com.aiagent.domain.log.admin.AccessLogSpec.SPEC;
import static com.aiagent.domain.log.admin.AccessLogSpec.U;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.InChunks;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.RangeGuard;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.log.LogText;
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
 * {@code ACCESS_LOG} 의 조회 — screen/log/access/requirements.md. <b>쓰기가 없다.</b>
 *
 * <p>짝이 되는 {@code AccessLogAdminService} 가 없다. 이력 행은 불변이며 지우는 것은
 * 파기 배치의 일이다(screen/log/access/requirements.md · retention.md) — 화면에 수단을 두면 <b>파기의 원본이 둘</b>이 된다.
 *
 * <h2>커서형의 첫 사용처다</h2>
 *
 * <p>{@code COUNT} 가 처음으로 비싼 화면이다(screen/log/access/requirements.md). 상한·근사·생략 중 <b>생략</b>을
 * 골랐으므로 총 건수도 페이지 번호도 없고, 다음 장의 존재는 <b>{@code size + 1} 건을 읽어</b>
 * 판정한다({@link Built#respondCursor}).
 *
 * <h2>기간 검사가 이 서비스의 문지기다</h2>
 *
 * <p>조건 없이 열면 첫 조회가 보존 기간 전량(90일)을 향한다. 폼도 막지만 여기서 다시 보는
 * 것은 <b>막는 이유가 부하이기 때문</b>이다 — 화면만 막으면 도구·스크립트가 그대로 지나간다.
 *
 * <h2>전문은 두 번째 호출이다</h2>
 *
 * <p>{@code PARAMETERS} 를 목록에 싣지 않는다(screen/log/access/requirements.md). 셋 중 하나만으로도 실을 수 없다 —
 * Oracle LOB 성능(backend/persistence.md S-2) · 앞 N자 절단의 벤더 차이(backend/persistence.md) · 100행 × 1MB.
 */
@Service
@Transactional(readOnly = true)
public class AccessLogQueryService {

    /**
     * 이 화면의 조회 기간 상한 — <b>시스템 값 92일을 덮는다</b>(screen/log/access/requirements.md).
     *
     * <p>세 이력 테이블 중 유일하게 <b>행마다 {@code nclob} 이 달려 있고</b> 보존이 90일로
     * 가장 짧다 — <i>"가장 큰 테이블에 가장 짧은 창"</i> 이 맞다.
     *
     * <p><b>넓히는 쪽으로는 덮지 않는다.</b> 시스템 값이 31보다 작아지면 그것이 이긴다 —
     * 화면 층은 <i>더 좁게</i> 만 갈 수 있다.
     */
    public static final int MAX_RANGE_DAYS = 31;


    /** 목록에 싣는 것 — <b>{@code parameters} 가 없다.</b> 있는가만 {@link #HAS_PARAMETERS} 가 낸다. */
    private static final NumberExpression<Integer> HAS_PARAMETERS =
            new CaseBuilder().when(AL.parameters.isNotNull()).then(1).otherwise(0);

    private static final Expression<?>[] LIST = {
        AL.accessLogSeq,
        AL.creDtm,
        AL.httpStat,
        AL.userId,
        // 조인 컬럼이다 — 스펙이 leftJoin 을 갖고 있으므로 여기서는 뽑기만 한다(backend/search-spec.md).
        U.userNm,
        AL.menuCd,
        AL.requestUri,
        HAS_PARAMETERS,
        AL.clientIp,
        AL.traceId
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final SysMenuRepository menus;
    private final MessageService messages;
    private final ConfigLookup configs;

    public AccessLogQueryService(
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
     * <p>쿼리가 둘이며 둘째는 <b>메뉴명</b>이다. 조인으로 얻지 않는 것은 이름의 원본이
     * {@code SYS_MESSAGE} 이고({@code menu.{MENU_CD}} — sys/code.md) 폴백(요청 언어 → 기본 언어 →
     * 키 문자열)이 이미 {@link MessageService} 하나에 있기 때문이다 — {@code ApiCatalogQueryService}
     * 가 같은 판단을 했다.
     *
     * <p><b>사용자명은 그 둘째 쿼리에 오지 않는다</b>(2026-09-01). 이름의 원본이
     * {@code SYS_USER.USER_NM} <b>컬럼 그대로</b>라 조인으로 끝나며(스펙의 {@code leftJoin}),
     * 번역도 폴백도 없다 — <b>같은 화면의 두 이름이 다른 길로 오는 것이 우연이 아니다</b>:
     * 갈리는 것은 <i>이름이 어디 있나</i> 이지 <i>어느 컬럼인가</i> 가 아니다.
     *
     * @param lang 세션 언어 — 컨트롤러가 준다. 도메인은 요청을 모른다(backend/packages.md)
     */
    public PageResponse<AccessLogRow> getList(SearchRequest<Void> request, String lang) {
        checkRange(request);
        Built built = builder.build(request, SPEC, PageMode.cursor);

        List<Tuple> found = built.apply(query.select(Projections.tuple(LIST))).fetch();
        Map<String, String> menuNames = menuNamesOf(found, lang);

        List<AccessLogRow> rows = new ArrayList<>(found.size());
        for (Tuple row : found) {
            String menuCd = row.get(AL.menuCd);
            rows.add(new AccessLogRow(
                    row.get(AL.accessLogSeq),
                    row.get(AL.creDtm),
                    row.get(AL.httpStat),
                    row.get(AL.userId),
                    row.get(U.userNm),
                    menuCd,
                    menuCd == null ? null : menuNames.get(menuCd),
                    row.get(AL.requestUri),
                    Integer.valueOf(1).equals(row.get(HAS_PARAMETERS)),
                    row.get(AL.clientIp),
                    row.get(AL.traceId)));
        }
        return built.respondCursor(rows, AccessLogRow::creDtm, AccessLogRow::accessLogSeq);
    }

    /**
     * 전문 하나 — screen/log/access/requirements.md. <b>동적 봉투를 태우지 않는다</b>(backend/api.md).
     *
     * <p>PK 하나로 한 행을 집는 고정형이다. 조건 목록으로 열면 <b>전문 조회가 임의 조건의
     * 조회</b>가 되고, 그 순간 {@code nclob} 을 목록에서 뺀 이유가 무너진다.
     */
    public AccessLogDetail getDetail(long accessLogSeq) {
        String parameters = query.select(AL.parameters)
                .from(AL)
                .where(AL.accessLogSeq.eq(accessLogSeq))
                .fetchOne();

        if (parameters == null && !exists(accessLogSeq)) {
            // 조회한 뒤 파기 배치가 지나갔다(retention.md). 목록은 그대로 둔다 — screen/log/access/requirements.md.
            throw new BusinessException(
                    AccessLogErrorCode.PURGED, "사용 이력 행이 없다 — " + accessLogSeq);
        }
        return new AccessLogDetail(
                accessLogSeq, parameters, LogText.isTruncated(parameters));
    }

    // ── 기간 검사 (screen/log/access/requirements.md) ──────────────────────────────────────────

    /**
     * 기간은 <b>필수 조건이고 상한이 있다</b> — 규칙은 {@link RangeGuard} 가 갖는다.
     *
     * <p>여기 남는 것은 <b>이 화면의 값</b> 둘이다. 상한은 시스템 값과 31일 중 좁은 쪽이고,
     * 추적 ID 를 넣으면 기간이 선택이 된다 — {@code TRACE_ID} 에 별도 인덱스가 있으므로
     * (sys/logs.md) 기간 없이도 인덱스를 탄다. <b>조건 하나가 다른 조건의 필수 여부를 바꾸는
     * 첫 사례</b>이며 72 프로토콜의 입력이다(screen/log/access/requirements.md).
     */
    private void checkRange(SearchRequest<Void> request) {
        int maxDays = Math.min(configs.get(SearchRangeProps.class).maxDays(), MAX_RANGE_DAYS);
        RangeGuard.check(
                request,
                new RangeGuard.Rule(
                        "creDtm",
                        "traceId",
                        maxDays,
                        AccessLogErrorCode.RANGE_REQUIRED,
                        AccessLogErrorCode.RANGE_TOO_WIDE));
    }

    // ── 메뉴명 (sys/code.md) ───────────────────────────────────────────────

    private Map<String, String> menuNamesOf(List<Tuple> rows, String lang) {
        Set<String> menuCds = new HashSet<>();
        for (Tuple row : rows) {
            String menuCd = row.get(AL.menuCd);
            if (menuCd != null) {
                menuCds.add(menuCd);
            }
        }
        if (menuCds.isEmpty()) {
            return Map.of();
        }
        Map<String, String> names = new HashMap<>();
        // 페이지 하나 분량이라 지금은 최대 1000개인데 그것이 오라클의 한계와 같은 값이다(backend/persistence.md).
        for (List<String> chunk : InChunks.split(List.copyOf(menuCds))) {
            for (SysMenu menu : menus.findAllById(chunk)) {
                // MENU_NM 은 메뉴명이 아니라 메시지 키다 — menu.{MENU_CD}(sys/code.md).
                names.put(menu.getMenuCd(), messages.text(menu.getMenuNm(), lang));
            }
        }
        return names;
    }

    /**
     * 전문이 {@code null} 인 것과 행이 없는 것을 가른다.
     *
     * <p>둘을 섞으면 <b>전문 없이 남은 정상 행</b>(멀티파트 요청 · 캐싱이 꺼진 구간)이
     * <i>파기됨</i> 으로 보인다 — 그 둘은 다른 사실이다.
     */
    private boolean exists(long accessLogSeq) {
        return query.selectOne().from(AL).where(AL.accessLogSeq.eq(accessLogSeq)).fetchFirst() != null;
    }
}
