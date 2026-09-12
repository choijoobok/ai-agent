// @feat FEAT-503
package com.aiagent.system.domain.apicatalog;

import static com.aiagent.system.domain.apicatalog.ApiCatalogSpec.A;
import static com.aiagent.system.domain.apicatalog.ApiCatalogSpec.API_SPEC;
import static com.aiagent.system.domain.apicatalog.ApiCatalogSpec.M;
import static com.aiagent.system.domain.apicatalog.ApiCatalogSpec.MA;
import static com.aiagent.system.domain.apicatalog.ApiCatalogSpec.MENU_SPEC;

import com.aiagent.core.search.InChunks;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.authz.entity.QSysRole;
import com.aiagent.domain.authz.entity.QSysRoleMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserRole;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.aiagent.domain.user.entity.QSysUser;
import com.aiagent.support.time.BusinessCalendar;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code API_CATALOG} 의 조회 — screen/api-catalog/requirements.md. <b>쓰기가 없다.</b>
 *
 * <p>짝이 되는 {@code ApiCatalogService} 가 없는 것이 이 화면의 형태다 — 원본이 시드이고
 * 시드는 생성되므로(backend/api.md) 여기서 고친 것은 <b>다음 배포에서 사라진다</b>(screen/menu/requirements.md).
 *
 * <h2>이 서비스가 계산하는 것은 시드에 없는 둘이다</h2>
 *
 * {@code SYS_API} 네 컬럼과 매핑 행은 시드가 가지고 있어 git 에서 읽을 수 있다. 그런데 화면이
 * 묻는 <b>매핑 메뉴 수</b>와 <b>접근 가능 인원</b>은 <b>어디에도 없다 — 계산해야 나온다</b>
 * (screen/api-catalog/requirements.md). 이 클래스의 절반이 그 둘이다.
 *
 * <h2>메뉴 경로는 조인이 아니라 메시지 캐시에서 온다</h2>
 *
 * 이름의 원본이 {@code SYS_MESSAGE} 이고({@code menu.{MENU_CD}} — sys/code.md) 폴백(요청 언어 →
 * 기본 언어 → <b>키 문자열</b>)이 이미 {@link MessageService} 하나에 있다(sys/code.md). 게다가
 * 필요한 것은 이름 하나가 아니라 <b>조상까지의 경로</b>라, 조인으로 얻으려면 깊이만큼 셀프
 * 조인을 쌓아야 한다 — 트리를 한 번 읽어 메모리에서 거슬러 오르는 편이 짧다.
 */
@Service
@Transactional(readOnly = true)
public class ApiCatalogQueryService {

    /** 메뉴 경로 구분자 — {@code 시스템 › 이력 · 로그 › 에러 로그}(screen/api-catalog/requirements.md). */
    private static final String PATH_SEPARATOR = " › ";

    private static final QSysRoleMenuAuth RMA = QSysRoleMenuAuth.sysRoleMenuAuth;
    private static final QSysUserMenuAuth UMA = QSysUserMenuAuth.sysUserMenuAuth;
    private static final QSysUserRole UR = QSysUserRole.sysUserRole;
    private static final QSysRole R = QSysRole.sysRole;
    private static final QSysUser U = QSysUser.sysUser;

    private static final Expression<?>[] API = {A.apiUrl, A.apiNm, A.apiDesc, A.actionCd, A.regDtm};

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final SysMenuRepository menus;
    private final MessageService messages;
    private final BusinessCalendar calendar;

    public ApiCatalogQueryService(
            JPAQueryFactory query,
            QueryDslBuilder builder,
            SysMenuRepository menus,
            MessageService messages,
            BusinessCalendar calendar) {
        this.query = query;
        this.builder = builder;
        this.menus = menus;
        this.messages = messages;
        this.calendar = calendar;
    }

    // ── 마스터 ───────────────────────────────────────────────────────

    /**
     * API 마스터 — 쿼리가 둘이다.
     *
     * <p>둘째가 <b>매핑 메뉴 수</b>이며 그것이 <i>미매핑</i> 배지의 근거다(screen/api-catalog/requirements.md). 첫 쿼리에
     * 스칼라 서브쿼리로 얹지 않는 이유는 <b>행마다 한 번씩 도는 것</b>이 되기 때문이고, 조인해
     * {@code GROUP BY} 하면 <b>페이징 단위가 API 가 아니게</b> 될 위험을 매번 다시 확인해야
     * 한다 — screen/code/requirements.md 가 코드 그룹에서 쿼리를 둘로 가른 것과 같은 판단이다.
     *
     * <p><b>{@code offset} 이다.</b> screen/api-catalog/requirements.md 이 엑셀 항목을 <i>현재 페이지 · 전체</i> 둘로 두며
     * <i>"§4.9 의 트리와 달리 페이징이 있다"</i> 고 적었고, 업무 API 가 수백 개로 자라는 것이
     * §6 의 실측 항목이다.
     */
    public PageResponse<ApiCatalogRow> getList(SearchRequest<Void> request) {
        Built built = builder.build(request, API_SPEC, PageMode.offset);

        List<Tuple> apis = built.apply(query.select(Projections.tuple(API))).fetch();
        Long total = built.count(query).fetchOne();

        Map<String, Long> counts = menuCounts(apis.stream().map(row -> row.get(A.apiUrl)).toList());

        List<ApiCatalogRow> rows = new ArrayList<>(apis.size());
        for (Tuple api : apis) {
            String apiUrl = api.get(A.apiUrl);
            rows.add(new ApiCatalogRow(
                    apiUrl,
                    api.get(A.apiNm),
                    api.get(A.apiDesc),
                    api.get(A.actionCd),
                    counts.getOrDefault(apiUrl, 0L),
                    api.get(A.regDtm)));
        }
        return built.respond(rows, total == null ? 0L : total);
    }

    /**
     * {@code API_URL → 그 API 를 쓰는 메뉴 수}.
     *
     * <p><b>{@code 0} 인 API 는 맵에 없다</b> — {@code GROUP BY} 가 행 없는 키를 내지 않으므로
     * 부르는 쪽이 {@code getOrDefault} 로 받는다. 그 없음이 곧 <i>미매핑</i> 이다(screen/api-catalog/requirements.md).
     *
     * <p>{@code IN} 을 쪼갠다 — 페이지 하나가 최대 1000개이고 그것이 오라클의 한계다(backend/persistence.md).
     */
    private Map<String, Long> menuCounts(List<String> apiUrls) {
        if (apiUrls.isEmpty()) {
            return Map.of();
        }
        Map<String, Long> counts = new HashMap<>();
        for (List<String> chunk : InChunks.split(apiUrls)) {
            for (Tuple row : query.select(MA.apiUrl, MA.count())
                    .from(MA)
                    .where(MA.apiUrl.in(chunk))
                    .groupBy(MA.apiUrl)
                    .fetch()) {
                counts.put(row.get(MA.apiUrl), row.get(MA.count()));
            }
        }
        return counts;
    }

    // ── 하단 ─────────────────────────────────────────────────────────

    /**
     * 이 API 를 쓰는 메뉴 — screen/api-catalog/requirements.md.
     *
     * <p><b>페이징하지 않는다</b>({@code all}). 한 API 를 쓰는 화면은 많아야 몇이며, screen/api-catalog/requirements.md 가
     * <i>"0 건이면 §5.4 의 진단을 낸다"</i> 고 적은 것은 <b>이 목록의 크기가 곧 답</b>이라는
     * 뜻이다 — 페이징하면 그 문장이 장마다 달라진다.
     *
     * @param lang 세션 언어 — 컨트롤러가 준다. 도메인은 요청을 모른다(backend/packages.md)
     */
    public PageResponse<ApiMenuRow> getMenuList(SearchRequest<ApiUrlParams> request, String lang) {
        String apiUrl = request.params().apiUrl();
        Built built = builder.build(request, MENU_SPEC, PageMode.all);

        List<Tuple> mappings = built.apply(query.select(Projections.tuple(MA.menuCd, M.useYn)))
                .where(MA.apiUrl.eq(apiUrl))
                .fetch();

        List<String> menuCds = mappings.stream().map(row -> row.get(MA.menuCd)).toList();
        Map<String, SysMenu> byCode = menus.findAll().stream()
                .collect(Collectors.toMap(SysMenu::getMenuCd, Function.identity()));
        Map<String, Long> people = accessibleUserCounts(menuCds);

        List<ApiMenuRow> rows = new ArrayList<>(mappings.size());
        for (Tuple mapping : mappings) {
            String menuCd = mapping.get(MA.menuCd);
            rows.add(new ApiMenuRow(
                    menuCd,
                    path(byCode, menuCd, lang),
                    mapping.get(M.useYn),
                    people.getOrDefault(menuCd, 0L)));
        }
        // `all` 모드는 총 건수를 응답이 스스로 센다 — 여기 넘기는 값은 쓰이지 않는다.
        return built.respond(rows, rows.size());
    }

    /**
     * {@code 시스템 › 이력 · 로그 › 에러 로그} — <b>전체 경로</b>다(screen/api-catalog/requirements.md).
     *
     * <p>메뉴명만으로는 어느 것인지 모른다. <i>목록</i> 이라는 이름의 리프가 모듈마다 있을 수
     * 있고, 이 화면에 오는 사람은 그 메뉴를 <b>모르는 상태</b>다 — 403 하나를 들고 왔을 뿐이다.
     *
     * <p><b>순회에 방문 집합과 깊이 상한을 건다</b>(sys/menu.md 4층 방어의 3층). {@code MenuTreeService}
     * 가 같은 대가를 치른다 — 시드·수동 {@code UPDATE} 로 순환이 들어올 수 있고, 그때 무한
     * 루프 대신 <b>거기까지의 경로</b>가 나온다.
     */
    private String path(Map<String, SysMenu> byCode, String menuCd, String lang) {
        List<String> names = new ArrayList<>();
        Set<String> visited = new HashSet<>();

        String cursor = menuCd;
        while (cursor != null && visited.add(cursor) && names.size() < SysMenu.MAX_DEPTH) {
            SysMenu menu = byCode.get(cursor);
            if (menu == null) {
                break;
            }
            // MENU_NM 은 메뉴명이 아니라 메시지 키다 — `menu.{MENU_CD}`(sys/menu.md).
            names.addFirst(messages.text(menu.getMenuNm(), lang));
            cursor = menu.getUpMenuCd();
        }
        return String.join(PATH_SEPARATOR, names);
    }

    /**
     * {@code MENU_CD → 이 메뉴에 닿는 사람 수} — AUTHZ-13 · screen/api-catalog/requirements.md.
     *
     * <p><b>backend/security.md 의 ①②③ 을 그대로 밟고 ④를 밟지 않는다.</b> 두 출처가 각자 자격 검사를
     * 통과한 행을 내고(①②), 합집합은 <b>여기 자바에서</b> 한다(③) —
     * {@code EffectiveAuthorityService} 가 같은 모양이며 이유도 같다: 두 경로를 SQL
     * {@code UNION} 으로 합치면 벤더마다 다른 문법을 쓰게 되고(backend/persistence.md), 무엇보다 <b>같은 사람이
     * 두 경로로 오는 것이 정상</b>이라 중복 제거가 계산의 일부다.
     *
     * <p><b>게이트 ④(메뉴 생존)를 적용하지 않는 것이 결정이다</b> — {@link ApiMenuRow} 가
     * 적었다. 하단은 <i>사용 여부</i> 컬럼을 나란히 두므로, 인원까지 게이트를 먹이면 두 칸이
     * <b>같은 말을 두 번</b> 하고 관리자는 무엇을 고쳐야 할지 알 수 없다.
     *
     * <p><b>사용자 쪽은 둘만 본다</b> — {@code USE_YN} 과 계정 유효기간이다. sys/user-role.md 가 계정을
     * 못 쓰게 만드는 넷을 <b>축이 다르다</b> 고 갈랐는데, 잠금과 휴면은 <b>일시적이고 스스로
     * 풀린다</b> — 그 둘까지 세면 이 숫자가 <i>인가의 넓이</i> 가 아니라 <i>오늘 아침의 로그인
     * 상태</i> 가 되어 어제와 오늘의 답이 달라진다.
     */
    private Map<String, Long> accessibleUserCounts(List<String> menuCds) {
        if (menuCds.isEmpty()) {
            return Map.of();
        }
        LocalDate businessToday = calendar.today();
        Map<String, Set<String>> byMenu = new HashMap<>();

        for (List<String> chunk : InChunks.split(menuCds)) {
            collect(byMenu, roleGrantees(chunk, businessToday));
            collect(byMenu, personalGrantees(chunk, businessToday));
        }
        return byMenu.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey, entry -> (long) entry.getValue().size()));
    }

    /** ① + ② 의 <b>역할 쪽</b> — 역할이 활성이고 부여가 유효기간 내여야 한다(backend/security.md). */
    private List<Tuple> roleGrantees(List<String> menuCds, LocalDate businessToday) {
        return query.select(RMA.menuCd, UR.userId)
                .from(RMA, UR, R, U)
                .where(
                        RMA.menuCd.in(menuCds),
                        UR.roleId.eq(RMA.roleId),
                        R.roleId.eq(RMA.roleId),
                        R.useYn.isTrue(),
                        UR.validFromDt.isNull().or(UR.validFromDt.loe(businessToday)),
                        UR.validToDt.isNull().or(UR.validToDt.goe(businessToday)),
                        U.userId.eq(UR.userId),
                        usable(businessToday))
                .fetch();
    }

    /**
     * ① + ② 의 <b>개인 예외 쪽</b> — <b>합집합의 독립 항</b>이다(backend/security.md).
     *
     * <p>역할이 하나도 없어도 개인 예외만으로 일하는 사용자가 정당하게 존재한다. 기간이
     * {@code NOT NULL} 이므로 역할 부여와 달리 {@code NULL} 분기가 없다.
     */
    private List<Tuple> personalGrantees(List<String> menuCds, LocalDate businessToday) {
        return query.select(UMA.menuCd, UMA.userId)
                .from(UMA, U)
                .where(
                        UMA.menuCd.in(menuCds),
                        UMA.validFromDt.loe(businessToday),
                        UMA.validToDt.goe(businessToday),
                        U.userId.eq(UMA.userId),
                        usable(businessToday))
                .fetch();
    }

    /** 계정이 <b>관리자가 정한 뜻으로</b> 살아 있는가 — 잠금·휴면은 보지 않는다(sys/user-role.md). */
    private BooleanExpression usable(LocalDate businessToday) {
        return U.useYn.isTrue()
                .and(U.validFromDt.isNull().or(U.validFromDt.loe(businessToday)))
                .and(U.validToDt.isNull().or(U.validToDt.goe(businessToday)));
    }

    /** ③ 합집합 — 같은 사람이 두 경로로 오는 것이 정상이므로 {@link Set} 이 받는다. */
    private static void collect(Map<String, Set<String>> byMenu, List<Tuple> grants) {
        for (Tuple grant : grants) {
            byMenu.computeIfAbsent(grant.get(0, String.class), key -> new HashSet<>())
                    .add(grant.get(1, String.class));
        }
    }
}
