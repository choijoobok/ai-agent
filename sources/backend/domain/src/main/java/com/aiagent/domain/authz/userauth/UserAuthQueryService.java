package com.aiagent.domain.authz.userauth;

import static com.aiagent.domain.authz.userauth.UserAuthSpec.U;
import static com.aiagent.domain.authz.userauth.UserAuthSpec.USER_PICK_SPEC;

import com.aiagent.core.search.InChunks;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.entity.QSysRole;
import com.aiagent.domain.authz.entity.QSysRoleMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserRole;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.menu.MenuUserRow.GrantState;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.service.MenuActionCatalog;
import com.aiagent.domain.authz.service.MenuPreOrder;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.aiagent.domain.user.admin.AccountStat;
import com.aiagent.support.time.BusinessCalendar;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code USER_AUTH_MGMT} 의 조회 — 61 §4. <b>경로가 둘이다.</b>
 *
 * <table>
 *   <tr><td>{@link #getList}</td><td>좌 pane — 사용자 하나를 고른다. <b>읽기 전용</b>이다</td></tr>
 *   <tr><td>{@link #getMenuTree}</td><td>우 + 하 — <b>한 응답이 둘을 먹인다</b></td></tr>
 * </table>
 *
 * <h2>트리와 예외 목록이 <b>같은 응답</b>에서 나온다</h2>
 *
 * <p>61 §4.4 가 둘을 <i>"같은 데이터의 두 표시"</i> 로 정했다. 그렇다면 <b>원본도 하나여야
 * 한다</b> — 목록을 따로 내려주면 같은 질문에 답이 둘이 되고, 그 둘이 갈리는 순간
 * <i>"트리에는 있는데 목록에 없다"</i> 가 된다.
 *
 * <p>그래서 {@link UserAuthTreeRow#grants} 가 그 메뉴의 개인 예외를 <b>기간과 사유까지</b>
 * 담고, 화면이 그것을 펴서 하단 그리드를 만든다. 저장 API 도 하나다(61 §4.4) — <b>셋이 다
 * 하나</b>여야 <i>트리에서 체크하고 목록에서 기간을 넣은 뒤 한쪽만 저장하는</i> 경로가
 * 열리지 않는다.
 *
 * <h2>{@code QueryDslBuilder} 를 트리에 쓰지 않는다</h2>
 *
 * <p>{@code MENU_TREE}(62 §4.10) · {@code ROLE_AUTH_MGMT}(62 §2.4)와 같은 이유다 —
 * <b>조건에 맞는 노드만 남기면 부모가 사라져 트리가 아니게 된다</b>. 61 §4.3 은 <i>메뉴명</i>
 * 을 조회조건으로 적었지만 그것은 <b>거르기가 아니라 찾아가기</b>이며, 폴더의 파생 3-state
 * 가 <b>보이는 자식만으로</b> 요약해 거짓을 말하는 것을 막는다.
 *
 * <h2>역할 경유는 <b>지금 유효한 것</b>만 낸다</h2>
 *
 * <p>배지가 말해야 하는 것은 <i>"지금 역할로도 갖고 있다"</i> 이므로(61 §4.4), 만료된 역할
 * 부여와 꺼진 역할은 여기 오지 않는다 — 그것을 배지로 내면 <b>관리자가 예외를 주지 않고
 * 넘어간다</b>.
 */
@Service
@Transactional(readOnly = true)
public class UserAuthQueryService {

    private static final QSysUserMenuAuth UMA = QSysUserMenuAuth.sysUserMenuAuth;
    private static final QSysUserRole UR = QSysUserRole.sysUserRole;
    private static final QSysRole R = QSysRole.sysRole;
    private static final QSysRoleMenuAuth RMA = QSysRoleMenuAuth.sysRoleMenuAuth;

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final SysMenuRepository menus;
    private final MessageService messages;
    private final BusinessCalendar calendar;
    private final MenuActionCatalog actions;

    public UserAuthQueryService(
            JPAQueryFactory query,
            QueryDslBuilder builder,
            SysMenuRepository menus,
            MessageService messages,
            BusinessCalendar calendar,
            MenuActionCatalog actions) {
        this.query = query;
        this.builder = builder;
        this.menus = menus;
        this.messages = messages;
        this.calendar = calendar;
        this.actions = actions;
    }

    // ── 좌 pane (61 §4.2) ────────────────────────────────────────────

    /**
     * 사용자 목록 — <b>계정 상태가 함께 실린다</b>.
     *
     * <p>{@code USER_MGMT} 와 <b>같은 파생 규칙</b>을 쓴다({@link AccountStat}) — 같은 계정이
     * 두 화면에서 다른 상태로 보이면 그것이 곧 <i>어느 쪽이 맞나</i> 라는 질문이다.
     */
    public PageResponse<UserPickRow> getList(SearchRequest<Void> request) {
        Built built = builder.build(request, USER_PICK_SPEC, PageMode.offset);

        List<Tuple> found = built.apply(query.select(Projections.tuple(
                        U.userId, U.userNm, U.useYn, U.validFromDt, U.validToDt,
                        U.lockYn, U.dormantYn)))
                .fetch();
        Long total = built.count(query).fetchOne();

        LocalDate today = calendar.today();
        /*
          <b>이 장의 사람들만 센다.</b> 조건이 없는 조회에서 전건을 세면 목록에 없는 사람의
          예외까지 세게 되고, 그 비용은 <b>페이지와 무관하게</b> 자란다 — 62 §2.2 의 보유자
          수가 같은 모양이다(`holderCounts`).
        */
        Map<String, Long> grantCounts = activeGrantCounts(
                found.stream().map(user -> user.get(U.userId)).toList(), today);

        List<UserPickRow> rows = found.stream()
                .map(user -> new UserPickRow(
                        user.get(U.userId),
                        user.get(U.userNm),
                        statOf(user, today),
                        grantCounts.getOrDefault(user.get(U.userId), 0L)))
                .toList();
        return built.respond(rows, total == null ? 0L : total);
    }

    /**
     * <b>지금 유효한</b> 개인 예외의 건수 — 좌 pane 의 컬럼 하나(61 §4.2).
     *
     * <p><b>하단 그리드의 <i>상태</i> 컬럼과 같은 규칙</b>이다({@link #stateOf}) — 기간이
     * 오늘을 품은 행만 센다. 전건을 세면 <b>만료된 예외가 쌓인 계정이 영영 큰 수</b>로
     * 남아, <i>지금 무엇이 되나</i> 를 묻는 화면에서 그 수가 거짓을 말한다.
     *
     * <p><b>고아 부여도 센다.</b> API 가 사라져 미정의가 된 조합이지만(ADR-0022) 그 행은
     * 여전히 하단 목록에 <i>유효</i> 로 서 있고, 세는 규칙이 갈리면 <b>화면에서 눈으로 센
     * 수와 컬럼의 수가 다르다</b> — 지울지는 사람이 판단한다(61 §4.7).
     *
     * <p>기간이 <b>둘 다 필수</b>라(42 §6) {@code null} 분기가 없다 — 역할 부여와 갈리는
     * 자리이며(무기한이 있다) 그쪽의 {@code holderCounts} 는 {@code isNull().or(...)} 를 쓴다.
     */
    private Map<String, Long> activeGrantCounts(List<String> userIds, LocalDate today) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Map<String, Long> counts = new HashMap<>();
        // `IN` 을 쪼갠다 — 페이지 하나가 최대 1000개이고 그것이 오라클의 한계다(db-portability.md §4.6).
        for (List<String> chunk : InChunks.split(userIds)) {
            /*
              엔티티가 아니라 <b>키의 한쪽</b>을 센다 — 복합키 엔티티의 {@code count} 는
              벤더마다 번역이 갈리고, (USER_ID, MENU_CD, ACTION_CD) 가 PK 라 사람별로는
              메뉴 칸 수가 곧 행 수다.
            */
            for (Tuple row : query.select(UMA.userId, UMA.menuCd.count())
                    .from(UMA)
                    .where(
                            UMA.userId.in(chunk),
                            UMA.validFromDt.loe(today),
                            UMA.validToDt.goe(today))
                    .groupBy(UMA.userId)
                    .fetch()) {
                counts.put(row.get(UMA.userId), row.get(UMA.menuCd.count()));
            }
        }
        return counts;
    }

    /**
     * 접근 제어 체인 순서로 <b>먼저 걸린 것 하나</b> — 41 §4.2 · 61 §3.2.1.
     *
     * <p>{@code UserQueryService.statOf} 와 <b>같은 순서를 같은 방향으로</b> 읽는다.
     * 둘을 한 자리로 모으지 않은 것은 <b>읽어 오는 모양이 다르기</b> 때문이다 — 저기는
     * {@code SYS_USER} 전 컬럼을 실은 튜플이고 여기는 일곱 칸이다.
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
        return Boolean.TRUE.equals(user.get(U.dormantYn)) ? AccountStat.DORMANT : AccountStat.NORMAL;
    }

    // ── 우 + 하 (61 §4.4) ────────────────────────────────────────────

    /**
     * 메뉴 계층 × 액션 4열 + 이 사용자의 개인 예외 + 역할 경유 — <b>전건이고 전위 순회다</b>.
     *
     * <p>페이징하지 않는다({@code mode: 'all'}) — <b>계층이 잘리면 부모 없는 자식이 보인다</b>
     * (61 §4.4).
     *
     * @param lang 세션 언어 — 컨트롤러가 준다. 도메인은 요청을 모른다(architecture.md §1)
     */
    public PageResponse<UserAuthTreeRow> getMenuTree(String userId, String lang) {
        List<SysMenu> all = menus.findAll();
        LocalDate today = calendar.today();

        Map<String, Set<ActionType>> defined = actions.definedActions();
        Map<String, List<PersonalGrant>> grants = personalGrants(userId, today);
        Map<String, Map<ActionType, List<String>>> viaRoles = roleGrants(userId, today);

        List<UserAuthTreeRow> rows = new ArrayList<>(all.size());
        for (SysMenu menu : MenuPreOrder.of(all)) {
            String menuCd = menu.getMenuCd();
            rows.add(new UserAuthTreeRow(
                    menuCd,
                    menu.getUpMenuCd(),
                    // MENU_NM 은 메뉴명이 아니라 메시지 키다 — `menu.{MENU_CD}`(42 §4).
                    messages.text(menu.getMenuNm(), lang),
                    // 사이더가 그리는 것과 <b>같은 코드</b>다 — main-shell.md §4.1.
                    menu.getIconCd(),
                    menu.getMenuUrl(),
                    menu.getUseYn(),
                    defined.containsKey(menuCd) ? List.copyOf(defined.get(menuCd)) : List.of(),
                    grants.getOrDefault(menuCd, List.of()),
                    viaRoles.getOrDefault(menuCd, Map.of())));
        }
        return PageResponse.all(rows);
    }

    /**
     * 이 사용자의 개인 예외 <b>전부</b> — 기간으로 거르지 않는다.
     *
     * <p>61 §4.3 이 <i>부여 상태</i> 를 조회조건에서 <b>뺀</b> 이유가 여기 있다: 트리는
     * 만료 배지를 그려야 하므로 전건을 보고, 목록만 걸러져 있으면 <i>"같은 데이터의 두
     * 표시"</i> 라는 원칙이 성립하지 않는다.
     *
     * <p><b>정의에 없는 고아 부여도 그대로 낸다</b> — 화면이 {@code —} 로 그리고 저장에서
     * 빠지지만, 목록에는 보여야 <b>사람이 판단</b>할 수 있다(ADR-0022).
     */
    private Map<String, List<PersonalGrant>> personalGrants(String userId, LocalDate today) {
        Map<String, List<PersonalGrant>> byMenu = new HashMap<>();

        for (Tuple row : query.select(
                        UMA.menuCd, UMA.actionCd, UMA.validFromDt, UMA.validToDt, UMA.grantRsn)
                .from(UMA)
                .where(UMA.userId.eq(userId))
                .orderBy(UMA.menuCd.asc(), UMA.actionCd.asc())
                .fetch()) {

            LocalDate from = row.get(UMA.validFromDt);
            LocalDate to = row.get(UMA.validToDt);
            byMenu.computeIfAbsent(row.get(UMA.menuCd), key -> new ArrayList<>())
                    .add(new PersonalGrant(
                            row.get(UMA.actionCd), stateOf(from, to, today), from, to,
                            row.get(UMA.grantRsn)));
        }
        return byMenu;
    }

    /** 61 §4.7 — <b>양끝 포함</b>이고 판정은 <b>조회 시 계산</b>이다(배치가 갱신하지 않는다). */
    static GrantState stateOf(LocalDate from, LocalDate to, LocalDate today) {
        if (today.isBefore(from)) {
            return GrantState.SCHEDULED;
        }
        return today.isAfter(to) ? GrantState.EXPIRED : GrantState.ACTIVE;
    }

    /**
     * 역할 경유로 <b>지금</b> 갖고 있는 것 — 배지의 원본이다.
     *
     * <p>넷을 함께 본다: 이 사용자의 부여일 것 · 그 역할이 활성일 것(security-design.md §4 ②) · 그 부여가
     * 유효기간 안일 것 · 그 역할이 그 메뉴에 그 액션을 줄 것. 앞의 셋 중 하나라도 빼면
     * <b>지금은 안 되는 것을 된다고 말한다</b>.
     *
     * <p><b>메뉴의 {@code USE_YN} 은 보지 않는다.</b> 그것은 게이트 ④이고(security-design.md §4) 트리는
     * 꺼진 메뉴도 그린다 — 화면이 이름을 흐리게 그리는 것으로 그 사실을 말한다.
     */
    private Map<String, Map<ActionType, List<String>>> roleGrants(String userId, LocalDate today) {
        Map<String, Map<ActionType, List<String>>> byMenu = new HashMap<>();

        for (Tuple row : query.select(RMA.menuCd, RMA.actionCd, R.roleNm)
                .from(UR)
                .join(R).on(R.roleId.eq(UR.roleId))
                .join(RMA).on(RMA.roleId.eq(UR.roleId))
                .where(
                        UR.userId.eq(userId),
                        R.useYn.isTrue(),
                        UR.validFromDt.isNull().or(UR.validFromDt.loe(today)),
                        UR.validToDt.isNull().or(UR.validToDt.goe(today)))
                .orderBy(RMA.menuCd.asc(), RMA.actionCd.asc(), R.roleNm.asc())
                .fetch()) {

            byMenu.computeIfAbsent(row.get(RMA.menuCd), key -> new EnumMap<>(ActionType.class))
                    .computeIfAbsent(row.get(RMA.actionCd), key -> new ArrayList<>())
                    .add(row.get(R.roleNm));
        }
        return byMenu;
    }
}
