package com.aiagent.domain.user.detail;

import static com.aiagent.domain.user.detail.UserDetailSpec.IP;
import static com.aiagent.domain.user.detail.UserDetailSpec.R;
import static com.aiagent.domain.user.detail.UserDetailSpec.UR;
import static com.aiagent.domain.user.detail.UserDetailSpec.USER_IP_SPEC;
import static com.aiagent.domain.user.detail.UserDetailSpec.USER_ROLE_SPEC;

import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.entity.QSysRole;
import com.aiagent.domain.authz.entity.QSysRoleMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserRole;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.menu.MenuUserRow;
import com.aiagent.domain.authz.menu.MenuUserRow.GrantState;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.service.MenuActionCatalog;
import com.aiagent.domain.authz.service.MenuPaths;
import com.aiagent.domain.authz.service.MenuPreOrder;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.aiagent.support.time.BusinessCalendar;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code USER_MGMT} 의 디테일 탭 넷을 읽는다 — 61 §3.8.
 *
 * <p>다섯째(활성 세션)는 여기 없다. 원천이 DB 가 아니라 <b>세션 스토어</b>라(61 §3.8.2)
 * {@code api} 모듈의 일이며, 도메인이 {@code FindByIndexNameSessionRepository} 를 알면
 * architecture.md §1 이 갈린다.
 *
 * <h2>넷이 한 클래스인 이유</h2>
 *
 * <p>탭마다 서비스를 두면 넷이 <b>같은 부모 키 검증</b>과 <b>같은 계정 존재 확인</b>을 각자
 * 갖는다. 무엇보다 뒤의 둘(개인 예외 · 유효 권한)은 <b>같은 메뉴 전건과 같은 경로 문자열</b>
 * 을 쓰므로 나누면 그 계산이 두 벌이 되고, 두 벌이 갈리면 <i>같은 메뉴가 두 탭에서 다른
 * 이름</i> 으로 보인다.
 *
 * <h2>정렬이 서버에 있는 탭과 화면에 있는 탭이 갈린다</h2>
 *
 * <p>{@link UserDetailSpec} 의 표가 그 기준이다. 여기서 그 결과만 적으면 — <b>보유 역할 ·
 * 접속 IP 는 페이징하고</b>, <b>개인 예외 · 유효 권한은 전건을 낸다</b>({@code mode: 'all'}).
 * 뒤의 둘은 보여줄 컬럼의 절반이 파생이라 {@code ORDER BY} 를 걸 자리가 없다.
 */
@Service
@Transactional(readOnly = true)
public class UserDetailQueryService {

    private static final QSysUserMenuAuth UMA = QSysUserMenuAuth.sysUserMenuAuth;
    private static final QSysUserRole GRANT = QSysUserRole.sysUserRole;
    private static final QSysRole ROLE = QSysRole.sysRole;
    private static final QSysRoleMenuAuth RMA = QSysRoleMenuAuth.sysRoleMenuAuth;

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final SysMenuRepository menus;
    private final MessageService messages;
    private final MenuActionCatalog actions;
    private final BusinessCalendar calendar;

    public UserDetailQueryService(
            JPAQueryFactory query,
            QueryDslBuilder builder,
            SysMenuRepository menus,
            MessageService messages,
            MenuActionCatalog actions,
            BusinessCalendar calendar) {
        this.query = query;
        this.builder = builder;
        this.menus = menus;
        this.messages = messages;
        this.actions = actions;
        this.calendar = calendar;
    }

    // ── 탭 1 — 보유 역할 (USER-03) ───────────────────────────────────

    /**
     * 이 사람이 가진 역할 — <b>기간으로 거르지 않는다</b>.
     *
     * <p>{@code SysUserRoleRepository#findByUserIdOrderByRoleIdAsc} 가 <i>내 역할 탭</i> 에
     * 대해 적어 둔 것과 같은 이유다: 여기서 답해야 하는 것이 <i>"왜 이 메뉴가 안 보이나"</i>
     * 이므로 <b>만료된 부여야말로 보여줘야 할 답</b>이다.
     *
     * <p><b>{@code roleUseYn} 이 함께 온다.</b> 판정은 두 조건의 AND 이고(42 §3.1) 상태 배지는
     * <b>기간만</b> 본다 — 역할이 꺼져 있으면 <i>유효라는데 왜 안 되나</i> 가 되고, 그 답은
     * 이 칸에만 있다.
     */
    public PageResponse<UserRoleRow> getRoleList(SearchRequest<UserIdParams> request) {
        String userId = request.params().userId();
        Built built = builder.build(request, USER_ROLE_SPEC, PageMode.offset);

        List<Tuple> found = built.apply(query.select(Projections.tuple(
                        UR.roleId, R.roleNm, R.roleDesc, R.useYn,
                        UR.validFromDt, UR.validToDt,
                        UR.regId, UR.regDtm, UR.modId, UR.modDtm)))
                .where(UR.userId.eq(userId))
                .fetch();
        Long total = built.count(query).where(UR.userId.eq(userId)).fetchOne();

        LocalDate today = calendar.today();
        List<UserRoleRow> rows = found.stream()
                .map(row -> new UserRoleRow(
                        row.get(UR.roleId),
                        row.get(R.roleNm),
                        row.get(R.roleDesc),
                        row.get(R.useYn),
                        row.get(UR.validFromDt),
                        row.get(UR.validToDt),
                        roleState(row.get(UR.validFromDt), row.get(UR.validToDt), today),
                        row.get(UR.regId),
                        row.get(UR.regDtm),
                        row.get(UR.modId),
                        row.get(UR.modDtm)))
                .toList();
        return built.respond(rows, total == null ? 0L : total);
    }

    /**
     * 42 §3.1 — <b>양끝 포함</b>이고 {@code null} 은 제한 없음이다(40 §4.3).
     *
     * <p>{@code UserAuthQueryService#stateOf} 와 <b>같은 판정을 다른 입력</b>에 한다: 저기는
     * 기간이 {@code NOT NULL} 이라 {@code null} 을 다룰 필요가 없다. 한 자리로 모으면
     * <i>기간이 없는 부여</i> 라는 개념이 개인 예외로 새어 들어간다.
     */
    static GrantState roleState(LocalDate from, LocalDate to, LocalDate today) {
        if (from != null && from.isAfter(today)) {
            return GrantState.SCHEDULED;
        }
        return to != null && to.isBefore(today) ? GrantState.EXPIRED : GrantState.ACTIVE;
    }

    /**
     * 부여할 수 있는 역할의 후보 — <b>전건이고 페이징하지 않는다</b>.
     *
     * <p>{@code SYS_ROLE} 의 행 수는 <b>조직의 크기</b>이지 데이터의 크기가 아니다. 콤보의
     * 후보라 한 판에 다 들어가야 하고, 62 §3.2.2 와 같은 순서로 낸다({@code ROLE_NM,
     * ROLE_ID}) — tie-breaker 없이는 동명 역할에서 순서가 비결정적이다(db-portability.md §4.5).
     *
     * <p><b>꺼진 역할도 낸다</b>({@link RoleCandidate}) — 부여는 되고 판정에서 걸릴 뿐이다.
     */
    public PageResponse<RoleCandidate> getRoleCandidates() {
        return PageResponse.all(query.select(Projections.constructor(
                        RoleCandidate.class, ROLE.roleId, ROLE.roleNm, ROLE.useYn))
                .from(ROLE)
                .orderBy(ROLE.roleNm.asc(), ROLE.roleId.asc())
                .fetch());
    }

    // ── 탭 2 — 개인 예외 (AUTHZ-07 조회) ─────────────────────────────

    /**
     * 이 사람의 개인 예외 <b>전부</b> — 61 §5 가 {@code getUserMenuAuth} 로 이름 지은 경로다.
     *
     * <p>{@code USER_AUTH_MGMT} 의 트리 조회와 <b>API 를 공유하지 않는다</b>. security-design.md §4 의
     * <i>"화면마다 허용 범위가 달라야 한다면 그것은 분리해야 할 두 API"</i> 와 방향이 같으며,
     * 실제로 반환 형태가 다르다 — 저쪽은 <b>메뉴 전건</b>에 체크 상태를 실어야 트리를 그릴 수
     * 있고, 여기는 <b>부여된 행만</b> 나오는 납작한 목록이다.
     *
     * <p><b>페이징하지 않는다.</b> 개인 예외는 <i>예외</i> 라 한 사람에게 많아야 열 몇 줄이고
     * (많으면 그것은 역할이어야 한다 — 42 §6), 보여줄 컬럼 셋이 파생이다({@code menuPath} ·
     * {@code grantState} · {@code menuAuthorizable}).
     */
    public PageResponse<UserGrantRow> getUserMenuAuth(SearchRequest<UserIdParams> request, String lang) {
        String userId = request.params().userId();
        LocalDate today = calendar.today();

        List<SysMenu> all = menus.findAll();
        Map<String, String> paths = MenuPaths.of(all, key -> messages.text(key, lang));
        Map<String, SysMenu> byCode = new HashMap<>();
        all.forEach(menu -> byCode.put(menu.getMenuCd(), menu));

        List<UserGrantRow> rows = new ArrayList<>();
        for (Tuple row : query.select(
                        UMA.menuCd, UMA.actionCd, UMA.validFromDt, UMA.validToDt, UMA.grantRsn,
                        UMA.regId, UMA.regDtm, UMA.modId, UMA.modDtm)
                .from(UMA)
                .where(UMA.userId.eq(userId))
                .orderBy(UMA.menuCd.asc(), UMA.actionCd.asc())
                .fetch()) {

            String menuCd = row.get(UMA.menuCd);
            SysMenu menu = byCode.get(menuCd);
            LocalDate from = row.get(UMA.validFromDt);
            LocalDate to = row.get(UMA.validToDt);
            rows.add(new UserGrantRow(
                    menuCd,
                    /*
                      고아 부여도 낸다 — 메뉴가 사라졌으면 경로를 만들 수 없으므로 코드를
                      그대로 낸다(ADR-0022 의 어휘). 감추면 회수할 수단이 없어진다.
                    */
                    paths.getOrDefault(menuCd, menuCd),
                    menu != null && menu.isAuthorizable(),
                    row.get(UMA.actionCd),
                    stateOf(from, to, today),
                    from,
                    to,
                    row.get(UMA.grantRsn),
                    row.get(UMA.regId),
                    row.get(UMA.regDtm),
                    row.get(UMA.modId),
                    row.get(UMA.modDtm)));
        }
        // 경로 순으로 낸다 — 코드 순은 트리의 순서가 아니라 알파벳 순이다.
        rows.sort(Comparator.comparing(UserGrantRow::menuPath)
                .thenComparing(grant -> grant.actionCd().ordinal()));
        return PageResponse.all(rows);
    }

    /** 개인 예외는 기간이 {@code NOT NULL} 이라 셋 중 하나가 반드시 정해진다 — 42 §6. */
    private static GrantState stateOf(LocalDate from, LocalDate to, LocalDate today) {
        if (today.isBefore(from)) {
            return GrantState.SCHEDULED;
        }
        return today.isAfter(to) ? GrantState.EXPIRED : GrantState.ACTIVE;
    }

    // ── 탭 3 — 접속 IP (AUTH-08) ────────────────────────────────────

    /**
     * 허용 대역 — <b>꺼진 것도 낸다</b>.
     *
     * <p>화면이 켜고 끄는 곳이므로 꺼진 행이 보여야 다시 켤 수 있다. 판정이 이 값을 쓸 때는
     * {@code USE_YN} 으로 거르지만(AUTH-08 핸들러가 설 때) 그것은 <b>다른 질문</b>이다.
     */
    public PageResponse<UserIpRow> getIpList(SearchRequest<UserIdParams> request) {
        String userId = request.params().userId();
        Built built = builder.build(request, USER_IP_SPEC, PageMode.offset);

        List<Tuple> found = built.apply(query.select(Projections.tuple(
                        IP.ipCidr, IP.useYn, IP.validFromDt, IP.validToDt,
                        IP.regId, IP.regDtm, IP.modId, IP.modDtm)))
                .where(IP.userId.eq(userId))
                .fetch();
        Long total = built.count(query).where(IP.userId.eq(userId)).fetchOne();

        List<UserIpRow> rows = found.stream()
                .map(row -> new UserIpRow(
                        row.get(IP.ipCidr),
                        row.get(IP.useYn),
                        row.get(IP.validFromDt),
                        row.get(IP.validToDt),
                        row.get(IP.regId),
                        row.get(IP.regDtm),
                        row.get(IP.modId),
                        row.get(IP.modDtm)))
                .toList();
        return built.respond(rows, total == null ? 0L : total);
    }

    // ── 탭 5 — 유효 권한 (61 §3.8.1) ────────────────────────────────

    /**
     * <i>"이 사용자가 왜 이 메뉴를 못 보나"</i> 에 답한다 — 52 §8 의 미결을 닫는 자리.
     *
     * <p><b>security-design.md §4 파이프라인을 그대로 쓴다</b>(61 §3.8.1 의 요구 1). 화면 전용 계산을 두면
     * 실제 판정과 갈리고, <b>갈리는 순간 이 탭은 진단이 아니라 또 하나의 거짓말</b>이 된다.
     * 그래서 여기서 하는 일은 <b>계산이 아니라 펴는 것</b>이다 — 파이프라인의 ①②를 출처별로
     * 나열하고, ④의 게이트를 {@code menuAuthorizable} 로 각 행에 붙인다.
     *
     * <p><b>③(합집합)을 여기서 하지 않는다.</b> 합치면 <i>어느 부여를 회수해야 하는지</i> 를
     * 잃는다 — {@link EffectiveAuthRow} 가 적어 둔 그대로이며, 합집합이 필요한 곳은 로그인
     * 판정이지 진단 화면이 아니다.
     *
     * <p><b>읽기만 한다.</b> 관리자 세션을 바꾸지 않으며 어떤 캐시도 건드리지 않는다 —
     * security-design.md §4 가 AUTHZ-09 를 되살릴 때의 조건으로 건 것이다(미리보기가 권한 상승 경로가 되면
     * 안 된다).
     */
    public PageResponse<EffectiveAuthRow> getEffectiveAuthList(
            SearchRequest<EffectiveAuthParams> request, String lang) {

        String userId = request.params().userId();
        boolean heldOnly = request.params().heldOnlyOrTrue();
        LocalDate today = calendar.today();

        List<SysMenu> all = menus.findAll();
        Map<String, String> paths = MenuPaths.of(all, key -> messages.text(key, lang));
        Map<String, Set<ActionType>> defined = actions.definedActions();

        Map<String, List<Source>> byMenu = new HashMap<>();
        roleSources(userId, byMenu);
        personalSources(userId, today, byMenu);

        List<EffectiveAuthRow> rows = new ArrayList<>();
        for (SysMenu menu : MenuPreOrder.of(all)) {
            String menuCd = menu.getMenuCd();
            List<Source> sources = byMenu.getOrDefault(menuCd, List.of());
            if (sources.isEmpty() && heldOnly) {
                continue;
            }
            List<ActionType> definedActions = defined.containsKey(menuCd)
                    ? List.copyOf(defined.get(menuCd))
                    : List.of();

            if (sources.isEmpty()) {
                /*
                  <b>없는 것도 보여야 한다</b>(61 §3.8.1 의 요구 2). 전체 모드에서 부여가
                  하나도 없는 메뉴는 이 한 행으로 나오고, 화면이 회색으로 그린다 —
                  가진 것만 보여주면 이 탭은 진단이 아니라 요약이다.
                */
                rows.add(new EffectiveAuthRow(
                        menuCd, paths.getOrDefault(menuCd, menuCd), menu.isAuthorizable(),
                        definedActions, null, null, List.of(), false, null, null, null, null));
                continue;
            }
            for (Source source : sources) {
                boolean active = source.state == GrantState.ACTIVE;
                rows.add(new EffectiveAuthRow(
                        menuCd,
                        paths.getOrDefault(menuCd, menuCd),
                        menu.isAuthorizable(),
                        definedActions,
                        source.via,
                        source.roleId,
                        List.copyOf(source.actions),
                        // ④ — 여기만 AND 다. 부여가 살아 있어도 대상이 죽으면 권한이 아니다.
                        active && menu.isAuthorizable(),
                        source.state,
                        source.validFromDt,
                        source.validToDt,
                        source.grantRsn));
            }
        }
        return PageResponse.all(rows);
    }

    /**
     * ①②의 역할 갈래 — <b>만료된 부여와 꺼진 역할도 낸다</b>.
     *
     * <p>{@code UserAuthQueryService#roleGrants} 와 <b>정반대의 필터</b>다. 저기는 <i>배지</i>
     * 라 <b>지금 되는 것</b>만 말해야 하지만, 여기는 <i>진단</i> 이라 <b>왜 안 되는지</b> 를
     * 말해야 한다 — 만료된 부여를 감추면 <i>"권한을 줬는데 왜 없지"</i> 앞에서 화면이
     * 침묵한다.
     *
     * <p>꺼진 역할의 부여는 <b>상태가 유효인데 {@code effective} 가 거짓</b>인 행으로 나오지
     * 않는다 — 그것을 가르는 것은 {@code menuAuthorizable} 이 아니라 역할의 {@code USE_YN}
     * 이고, 그 사실은 <b>보유 역할 탭</b>이 자기 컬럼으로 말한다. 여기서는 역할명 옆에
     * 그것을 실어 보낼 칸이 없어 <b>부여 자체를 만료로 취급하지 않고 그대로</b> 낸다.
     */
    private void roleSources(String userId, Map<String, List<Source>> byMenu) {
        LocalDate today = calendar.today();
        Map<String, Map<String, Source>> perRole = new HashMap<>();

        for (Tuple row : query.select(
                        RMA.menuCd, RMA.actionCd, ROLE.roleId, ROLE.roleNm,
                        GRANT.validFromDt, GRANT.validToDt)
                .from(GRANT)
                .join(ROLE).on(ROLE.roleId.eq(GRANT.roleId))
                .join(RMA).on(RMA.roleId.eq(GRANT.roleId))
                .where(GRANT.userId.eq(userId), ROLE.useYn.isTrue())
                .orderBy(RMA.menuCd.asc(), ROLE.roleNm.asc(), RMA.actionCd.asc())
                .fetch()) {

            String menuCd = row.get(RMA.menuCd);
            String roleId = row.get(ROLE.roleId);
            Source source = perRole
                    .computeIfAbsent(menuCd, key -> new TreeMap<>())
                    .computeIfAbsent(roleId, key -> {
                        LocalDate from = row.get(GRANT.validFromDt);
                        LocalDate to = row.get(GRANT.validToDt);
                        return new Source(
                                row.get(ROLE.roleNm), roleId,
                                roleState(from, to, today), from, to, null);
                    });
            source.actions.add(row.get(RMA.actionCd));
        }
        perRole.forEach((menuCd, sources) ->
                byMenu.computeIfAbsent(menuCd, key -> new ArrayList<>()).addAll(sources.values()));
    }

    /**
     * ①②의 개인 예외 갈래 — <b>액션마다 기간과 사유가 다르므로 행도 다르다</b>.
     *
     * <p>역할 쪽은 부여 하나가 여러 액션을 한 기간으로 주지만({@code SYS_USER_ROLE} 의 기간이
     * 그 부여의 것이다) 개인 예외는 PK 가 {@code (사용자, 메뉴, 액션)} 이라 <b>액션마다
     * 다른 기간</b>일 수 있다. 같은 기간·사유의 것만 한 행으로 묶는다 — 묶지 않으면 흔한
     * 경우(한 번에 준 셋)가 세 줄이 되고, 다 묶으면 다른 기간이 한 칸에 섞인다.
     */
    private void personalSources(String userId, LocalDate today, Map<String, List<Source>> byMenu) {
        Map<String, Map<String, Source>> perMenu = new HashMap<>();

        for (Tuple row : query.select(
                        UMA.menuCd, UMA.actionCd, UMA.validFromDt, UMA.validToDt, UMA.grantRsn)
                .from(UMA)
                .where(UMA.userId.eq(userId))
                .orderBy(UMA.menuCd.asc(), UMA.validFromDt.asc(), UMA.actionCd.asc())
                .fetch()) {

            String menuCd = row.get(UMA.menuCd);
            LocalDate from = row.get(UMA.validFromDt);
            LocalDate to = row.get(UMA.validToDt);
            String reason = row.get(UMA.grantRsn);
            String key = from + "|" + to + "|" + reason;

            // LinkedHashMap 이라 위 ORDER BY 가 정한 순서(시작일 → 액션)가 그대로 남는다.
            perMenu.computeIfAbsent(menuCd, unused -> new LinkedHashMap<>())
                    .computeIfAbsent(key, unused -> new Source(
                            MenuUserRow.PERSONAL, null, stateOf(from, to, today), from, to, reason))
                    .actions
                    .add(row.get(UMA.actionCd));
        }
        perMenu.forEach((menuCd, sources) ->
                byMenu.computeIfAbsent(menuCd, key -> new ArrayList<>()).addAll(sources.values()));
    }

    /**
     * 한 메뉴에 대한 <b>한 출처</b> — 역할 하나이거나 개인 예외의 한 묶음이다.
     *
     * <p>가변인 것은 액션을 모으는 동안뿐이고, 밖으로 나갈 때 {@link EffectiveAuthRow} 가
     * 복사본을 갖는다.
     */
    private static final class Source {
        private final String via;
        private final String roleId;
        private final GrantState state;
        private final LocalDate validFromDt;
        private final LocalDate validToDt;
        private final String grantRsn;
        /** {@link EnumSet} 이라 {@link ActionType} 선언 순서로 나간다. */
        private final Set<ActionType> actions = EnumSet.noneOf(ActionType.class);

        private Source(
                String via,
                String roleId,
                GrantState state,
                LocalDate validFromDt,
                LocalDate validToDt,
                String grantRsn) {
            this.via = via;
            this.roleId = roleId;
            this.state = state;
            this.validFromDt = validFromDt;
            this.validToDt = validToDt;
            this.grantRsn = grantRsn;
        }
    }
}
