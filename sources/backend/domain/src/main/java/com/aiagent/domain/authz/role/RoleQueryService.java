package com.aiagent.domain.authz.role;

import static com.aiagent.domain.authz.role.RoleSpec.HOLDER_SPEC;
import static com.aiagent.domain.authz.role.RoleSpec.R;
import static com.aiagent.domain.authz.role.RoleSpec.ROLE_PICK_SPEC;
import static com.aiagent.domain.authz.role.RoleSpec.ROLE_SPEC;
import static com.aiagent.domain.authz.role.RoleSpec.U;
import static com.aiagent.domain.authz.role.RoleSpec.UR;

import com.aiagent.core.search.InChunks;
import com.aiagent.core.search.PageMode;
import com.aiagent.core.search.PageResponse;
import com.aiagent.core.search.SearchRequest;
import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.entity.QSysRoleMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserMenuAuth;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.menu.MenuUserRow;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.service.MenuActionCatalog;
import com.aiagent.domain.authz.service.MenuPreOrder;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.domain.search.Built;
import com.aiagent.domain.search.QueryDslBuilder;
import com.aiagent.support.time.BusinessCalendar;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code ROLE_MGMT}(62 §3) · {@code ROLE_AUTH_MGMT}(62 §2) 의 조회 — <b>클래스가 하나다.</b>
 *
 * <p>두 화면이 <b>같은 테이블 짝</b>을 다른 각도에서 본다. §3 은 <i>역할 자체의 생애</i>,
 * §2 는 <i>그 역할이 무엇을 할 수 있나</i> 인데, <b>하단 pane 은 아예 같은 그리드</b>이며
 * 62 §3.7 이 <i>"경로도 같아야 한다"</i> 고 못박았다 — 서비스를 가르면 그 하나가 두 곳에
 * 생기거나, 한쪽이 다른 쪽을 부르는 이상한 의존이 된다.
 *
 * <h2>쿼리가 여럿인 것이 이 클래스의 형태다</h2>
 *
 * 마스터 한 번에 <b>파생 셋</b>(보유 인원 · 유효 인원 · 권한 건수)이 붙는데 셋 다 다른 것을
 * 센다. 스칼라 서브쿼리로 얹으면 <b>행마다 세 번</b>이 되고, 조인해 {@code GROUP BY} 하면
 * 페이징 단위가 역할이 아니게 될 위험을 매번 확인해야 한다 — 63 §2 가 코드 그룹에서, 62 §4
 * 가 메뉴 트리에서 내린 것과 같은 판단이다.
 *
 * <h2>권한 트리는 {@code QueryDslBuilder} 를 쓰지 않는다</h2>
 *
 * {@code MENU_TREE} 와 같은 이유다(62 §4.10) — <b>조건에 맞는 노드만 남기면 부모가 사라져
 * 트리가 아니게 된다</b>. 62 §2.3 은 <i>메뉴명</i> 을 <i>(트리 조회 조건)</i> 으로 적었지만,
 * 여기서 거르면 그것 말고 <b>하나가 더 깨진다</b>: 폴더의 파생 3-state 는 <b>저장 전 편집에
 * 반응해야 하는 값</b>이라(§2.4 — {@code SAVE} 를 켜면 {@code READ} 열의 요약이 바뀐다)
 * <b>자손 전부가 클라이언트에 있어야</b> 다시 계산된다. 걸러 내려보내면 화면이 그 계산을
 * 할 수 없고, 폴더가 <i>보이는 자식만으로</i> 요약해 <b>거짓을 말한다</b>.
 *
 * <p>그래서 트리는 언제나 전건이고, 메뉴명은 <b>강조와 이동</b>이다 — {@code MENU_TREE} 와
 * 같은 어휘이므로 두 화면을 오가는 사람이 배우는 것은 하나다.
 */
@Service
@Transactional(readOnly = true)
public class RoleQueryService {

    private static final QSysRoleMenuAuth RMA = QSysRoleMenuAuth.sysRoleMenuAuth;
    private static final QSysUserMenuAuth UMA = QSysUserMenuAuth.sysUserMenuAuth;
    private static final Expression<?>[] ROLE = {
        R.roleId, R.roleNm, R.roleDesc, R.useYn, R.regId, R.regDtm, R.modId, R.modDtm
    };

    private static final Expression<?>[] HOLDER = {
        U.userId, U.userNm, U.useYn, U.validFromDt, U.validToDt, UR.validFromDt, UR.validToDt
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final SysMenuRepository menus;
    private final MessageService messages;
    private final BusinessCalendar calendar;
    private final MenuActionCatalog actions;

    public RoleQueryService(
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

    // ── ROLE_MGMT 마스터 (62 §3.2) ──────────────────────────────────

    /**
     * 역할 목록 — <b>파생 셋을 함께 낸다</b>(62 §3.2.1).
     *
     * <p>61 §3.2.2 가 <b>역할 나열 컬럼을 기각</b>한 것은 문자열 집계가 벤더마다 다르기
     * 때문이다({@code LISTAGG} · {@code GROUP_CONCAT} · {@code string_agg} — db-portability.md §4).
     * <b>{@code COUNT} 에는 그 문제가 없다</b> — 그래서 세는 것은 컬럼으로 둔다.
     *
     * <p>셋 중 둘이 <b>삭제 게이트의 근거</b>다(§3.5). 조회 응답이 이미 갖고 있으므로
     * <b>자식이 화면에 없어도 게이트가 닫힌다</b> — {@code SYS_ROLE_MENU_AUTH} 는 이 화면에
     * 디테일이 없고(편집은 §2 다) grid-standard.md §6.2 의 <i>"디테일이 전부 도착한 뒤 판정"</i> 이 그대로는
     * 성립하지 않는 첫 화면이다.
     */
    public PageResponse<RoleRow> getList(SearchRequest<Void> request) {
        Built built = builder.build(request, ROLE_SPEC, PageMode.offset);

        List<Tuple> roles = built.apply(query.select(Projections.tuple(ROLE))).fetch();
        Long total = built.count(query).fetchOne();

        List<String> roleIds = roles.stream().map(row -> row.get(R.roleId)).toList();
        Map<String, Long> holders = holderCounts(roleIds, false);
        Map<String, Long> active = holderCounts(roleIds, true);
        Map<String, Long> auths = authCounts(roleIds);

        List<RoleRow> rows = new ArrayList<>(roles.size());
        for (Tuple role : roles) {
            String roleId = role.get(R.roleId);
            rows.add(new RoleRow(
                    roleId,
                    role.get(R.roleNm),
                    role.get(R.roleDesc),
                    role.get(R.useYn),
                    holders.getOrDefault(roleId, 0L),
                    active.getOrDefault(roleId, 0L),
                    auths.getOrDefault(roleId, 0L),
                    role.get(R.regId),
                    role.get(R.regDtm),
                    role.get(R.modId),
                    role.get(R.modDtm)));
        }
        return built.respond(rows, total == null ? 0L : total);
    }

    // ── ROLE_AUTH_MGMT 왼쪽 목록 (62 §2.2) ──────────────────────────

    /** 고르기만 하는 목록 — 보유 인원 하나만 붙는다({@link RolePickRow}). */
    public PageResponse<RolePickRow> getRoleList(SearchRequest<Void> request) {
        Built built = builder.build(request, ROLE_PICK_SPEC, PageMode.offset);

        List<Tuple> roles =
                built.apply(query.select(Projections.tuple(R.roleId, R.roleNm, R.useYn))).fetch();
        Long total = built.count(query).fetchOne();

        Map<String, Long> holders =
                holderCounts(roles.stream().map(row -> row.get(R.roleId)).toList(), false);

        List<RolePickRow> rows = roles.stream()
                .map(role -> new RolePickRow(
                        role.get(R.roleId),
                        role.get(R.roleNm),
                        role.get(R.useYn),
                        holders.getOrDefault(role.get(R.roleId), 0L)))
                .toList();
        return built.respond(rows, total == null ? 0L : total);
    }

    // ── 권한 트리 (62 §2.4) ─────────────────────────────────────────

    /**
     * 메뉴 계층 × 액션 4열 — <b>전건이고 전위 순회다</b>.
     *
     * <p>페이징하지 않는다({@code mode: 'all'}) — <b>계층이 잘리면 부모 없는 자식이 보인다</b>
     * (61 §4.4). 조건으로도 거르지 않는다(클래스 주석).
     *
     * <p><b>고아·순환에 걸린 노드도 낸다.</b> {@code MenuTreeService} 는 조상 역산이 목적이라
     * 그것들을 빼지만, 권한을 주는 화면에서 사라지면 <b>그 메뉴에 부여된 권한을 회수할 수단이
     * 없어진다</b> — 62 §4 의 트리와 같은 판단이며 순회에 방문 집합을 걸어 터지지 않게 한다.
     *
     * @param lang 세션 언어 — 컨트롤러가 준다. 도메인은 요청을 모른다(architecture.md §1)
     */
    public PageResponse<RoleAuthTreeRow> getMenuTree(String roleId, String lang) {
        List<SysMenu> all = menus.findAll();

        Map<String, Set<ActionType>> defined = actions.definedActions();
        Map<String, Set<ActionType>> granted = grantedActions(roleId);

        List<RoleAuthTreeRow> rows = new ArrayList<>(all.size());
        for (SysMenu menu : MenuPreOrder.of(all)) {
            String menuCd = menu.getMenuCd();
            rows.add(new RoleAuthTreeRow(
                    menuCd,
                    menu.getUpMenuCd(),
                    // MENU_NM 은 메뉴명이 아니라 메시지 키다 — `menu.{MENU_CD}`(42 §4).
                    messages.text(menu.getMenuNm(), lang),
                    // 사이더가 그리는 것과 <b>같은 코드</b>다 — main-shell.md §4.1.
                    menu.getIconCd(),
                    menu.getMenuUrl(),
                    menu.getUseYn(),
                    ordered(defined.get(menuCd)),
                    ordered(granted.get(menuCd))));
        }
        return PageResponse.all(rows);
    }

    /** 이 역할이 준 것 — <b>정의에 없는 고아 부여도 그대로 낸다</b>({@link RoleAuthTreeRow}). */
    private Map<String, Set<ActionType>> grantedActions(String roleId) {
        Map<String, Set<ActionType>> byMenu = new HashMap<>();
        for (Tuple row : query.select(RMA.menuCd, RMA.actionCd)
                .from(RMA)
                .where(RMA.roleId.eq(roleId))
                .fetch()) {
            byMenu.computeIfAbsent(row.get(RMA.menuCd), key -> EnumSet.noneOf(ActionType.class))
                    .add(row.get(RMA.actionCd));
        }
        return byMenu;
    }

    /** {@link EnumSet} 이라 {@link ActionType} 선언 순서로 나간다 — DB 순서에 기대지 않는다. */
    private static List<ActionType> ordered(Set<ActionType> actions) {
        return actions == null ? List.of() : List.copyOf(actions);
    }

    // ── 하단 pane — 두 화면이 같은 그리드 (62 §2.5 · §3.4) ──────────

    /**
     * 이 역할을 가진 사람 — AUTHZ-13 의 역방향 조회.
     *
     * <p><b>기간으로 거르지 않는다</b>(62 §2.5). 만료된 부여도 <b>다시 유효해질 수 있으므로</b>
     * 목록에 내고 상태로 말한다 — 감추면 <i>"영향 없다고 해서 지웠는데 다음 달에 문제가
     * 생겼다"</i> 가 된다.
     *
     * <p><b>공집합 판정의 입력 둘이 여기서 붙는다</b>({@link RoleHolderRow}). 저장 확인의
     * 셋째 줄이 그것으로 계산되며(§2.5 · §3.6), 그래서 <b>새 API 를 만들지 않는다</b> —
     * 목업이 <i>"계산의 입력이 §1 의 하단 그리드다"</i> 라고 적은 그 경로다.
     */
    public PageResponse<RoleHolderRow> getAffectedUsers(SearchRequest<RoleIdParams> request) {
        String roleId = request.params().roleId();
        Built built = builder.build(request, HOLDER_SPEC, PageMode.offset);

        List<Tuple> holders = built.apply(query.select(Projections.tuple(HOLDER)))
                .where(UR.roleId.eq(roleId))
                .fetch();
        Long total = built.count(query).where(UR.roleId.eq(roleId)).fetchOne();

        LocalDate today = calendar.today();
        List<String> userIds = holders.stream().map(row -> row.get(U.userId)).toList();
        Set<String> withPersonal = usersWithPersonalGrant(userIds, today);
        Set<String> withOtherRole = usersWithOtherRole(userIds, roleId, today);

        List<RoleHolderRow> rows = new ArrayList<>(holders.size());
        for (Tuple holder : holders) {
            String userId = holder.get(U.userId);
            LocalDate from = holder.get(UR.validFromDt);
            LocalDate to = holder.get(UR.validToDt);
            rows.add(new RoleHolderRow(
                    userId,
                    holder.get(U.userNm),
                    usable(holder.get(U.useYn), holder.get(U.validFromDt), holder.get(U.validToDt), today),
                    grantState(from, to, today),
                    from,
                    to,
                    withPersonal.contains(userId),
                    withOtherRole.contains(userId)));
        }
        return built.respond(rows, total == null ? 0L : total);
    }

    /**
     * 계정이 <b>관리자가 정한 뜻으로</b> 살아 있는가 — 잠금·휴면은 보지 않는다(41 §4.2).
     *
     * <p>넷 중 뒤의 둘은 <b>일시적이고 스스로 풀린다</b>. 그것까지 <i>계정 상태</i> 한 칸에
     * 접으면 <i>"어제는 정상이었는데"</i> 가 되고, 이 화면이 답해야 하는 <b>부여의 영향</b>과
     * 섞인다.
     */
    private static boolean usable(Boolean useYn, LocalDate from, LocalDate to, LocalDate today) {
        return Boolean.TRUE.equals(useYn)
                && (from == null || !from.isAfter(today))
                && (to == null || !to.isBefore(today));
    }

    /** 42 §3.1 — <b>양끝 포함</b>이고 {@code null} 은 제한 없음이다(40 §4.3). */
    private static MenuUserRow.GrantState grantState(LocalDate from, LocalDate to, LocalDate today) {
        if (from != null && from.isAfter(today)) {
            return MenuUserRow.GrantState.SCHEDULED;
        }
        if (to != null && to.isBefore(today)) {
            return MenuUserRow.GrantState.EXPIRED;
        }
        return MenuUserRow.GrantState.ACTIVE;
    }

    /**
     * <b>공집합 판정의 입력 ①</b> — 지금 유효한 개인 예외를 <b>살아 있는 리프 위에</b> 가진 사람.
     *
     * <p>단순히 <i>{@code SYS_USER_MENU_AUTH} 에 행이 있는가</i> 로 두면 안 된다. 유효 권한은
     * 게이트 ④를 지나므로(security-design.md §4) <b>만료된 예외나 꺼진 메뉴의 예외는 합집합에 들어가지
     * 않는다</b> — 그것을 <i>있음</i> 으로 세면 차단될 사람을 <b>안전하다고 말한다</b>.
     */
    private Set<String> usersWithPersonalGrant(List<String> userIds, LocalDate today) {
        if (userIds.isEmpty()) {
            return Set.of();
        }
        Set<String> authorizable = authorizableMenus();
        if (authorizable.isEmpty()) {
            return Set.of();
        }
        Set<String> found = new HashSet<>();
        for (List<String> chunk : InChunks.split(userIds)) {
            found.addAll(query.select(UMA.userId)
                    .from(UMA)
                    .where(
                            UMA.userId.in(chunk),
                            UMA.menuCd.in(authorizable),
                            UMA.validFromDt.loe(today),
                            UMA.validToDt.goe(today))
                    .fetch());
        }
        return found;
    }

    /**
     * <b>공집합 판정의 입력 ②</b> — <i>이 역할 말고</i> 살아 있는 권한을 주는 역할을 가진 사람.
     *
     * <p>넷을 함께 본다: 다른 역할일 것 · 그 역할이 활성일 것(security-design.md §4 ②) · 그 부여가 유효기간
     * 안일 것 · 그 역할이 <b>살아 있는 리프에</b> 부여를 하나라도 가질 것(게이트 ④). 마지막
     * 하나를 빼면 <b>권한이 하나도 없는 역할</b>을 가진 사람이 안전한 것으로 세어진다.
     */
    private Set<String> usersWithOtherRole(List<String> userIds, String roleId, LocalDate today) {
        if (userIds.isEmpty()) {
            return Set.of();
        }
        Set<String> authorizable = authorizableMenus();
        if (authorizable.isEmpty()) {
            return Set.of();
        }
        Set<String> found = new HashSet<>();
        for (List<String> chunk : InChunks.split(userIds)) {
            found.addAll(query.select(UR.userId)
                    .from(UR)
                    .join(R).on(R.roleId.eq(UR.roleId))
                    .join(RMA).on(RMA.roleId.eq(UR.roleId))
                    .where(
                            UR.userId.in(chunk),
                            UR.roleId.ne(roleId),
                            R.useYn.isTrue(),
                            RMA.menuCd.in(authorizable),
                            UR.validFromDt.isNull().or(UR.validFromDt.loe(today)),
                            UR.validToDt.isNull().or(UR.validToDt.goe(today)))
                    .fetch());
        }
        return found;
    }

    /** 게이트 ④를 통과하는 메뉴 — 리프이고 살아 있는 것(security-design.md §4 · {@code SysMenu#isAuthorizable}). */
    private Set<String> authorizableMenus() {
        Set<String> codes = new HashSet<>();
        for (SysMenu menu : menus.findAll()) {
            if (menu.isAuthorizable()) {
                codes.add(menu.getMenuCd());
            }
        }
        return codes;
    }

    // ── 파생 셋 (62 §3.2.1) ─────────────────────────────────────────

    /**
     * 보유 인원 · 유효 인원 — <b>같은 쿼리에 조건 하나가 더 붙는다</b>.
     *
     * @param onlyActive 참이면 오늘 유효한 부여만 센다. 게이트가 보는 것은 <b>거짓</b> 쪽이며
     *     (62 §3.5 — FK 는 날짜를 보지 않는다) 운영자가 궁금한 것은 참 쪽이다
     */
    private Map<String, Long> holderCounts(List<String> roleIds, boolean onlyActive) {
        if (roleIds.isEmpty()) {
            return Map.of();
        }
        LocalDate today = calendar.today();
        /*
          <b>기간 조건이 있거나 없거나</b>다. {@code null} 을 넘기면 QueryDSL 이 그 조각을
          무시하므로(가변 인자의 규약) 분기가 표현식 하나로 접힌다 — 같은 쿼리를 두 번
          적으면 한쪽만 고치는 실수가 난다.
        */
        BooleanExpression valid = onlyActive
                ? UR.validFromDt.isNull().or(UR.validFromDt.loe(today))
                        .and(UR.validToDt.isNull().or(UR.validToDt.goe(today)))
                : null;

        Map<String, Long> counts = new HashMap<>();
        // `IN` 을 쪼갠다 — 페이지 하나가 최대 1000개이고 그것이 오라클의 한계다(db-portability.md §4.6).
        for (List<String> chunk : InChunks.split(roleIds)) {
            // 엔티티가 아니라 <b>키의 한쪽</b>을 센다 — 복합키 엔티티의 count 는 벤더마다
            // 번역이 갈리고, (USER_ID, ROLE_ID) 가 PK 라 역할별로는 사용자 수가 곧 행 수다.
            for (Tuple row : query.select(UR.roleId, UR.userId.count())
                    .from(UR)
                    .where(UR.roleId.in(chunk), valid)
                    .groupBy(UR.roleId)
                    .fetch()) {
                counts.put(row.get(UR.roleId), row.get(UR.userId.count()));
            }
        }
        return counts;
    }

    /**
     * 권한 건수 — <b>행 수이지 메뉴 수가 아니다</b>.
     *
     * <p>62 §4.11 의 <i>매핑 역할</i> 이 {@code countDistinct} 인 것과 갈리는 자리다. 거기서는
     * 같은 수를 탭 3 의 목록이 다시 세지만, 여기 <b>권한 건수는 목록이 없다</b> — 세는 것이
     * 곧 {@code SYS_ROLE_MENU_AUTH} 의 행이고, 그것이 <b>FK 가 막는 것</b>과 같은 단위다(§3.5).
     */
    private Map<String, Long> authCounts(List<String> roleIds) {
        if (roleIds.isEmpty()) {
            return Map.of();
        }
        Map<String, Long> counts = new HashMap<>();
        for (List<String> chunk : InChunks.split(roleIds)) {
            for (Tuple row : query.select(RMA.roleId, RMA.menuCd.count())
                    .from(RMA)
                    .where(RMA.roleId.in(chunk))
                    .groupBy(RMA.roleId)
                    .fetch()) {
                counts.put(row.get(RMA.roleId), row.get(RMA.menuCd.count()));
            }
        }
        return counts;
    }
}
