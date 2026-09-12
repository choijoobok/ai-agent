// @feat FEAT-503
package com.aiagent.system.domain.menu;

import com.aiagent.core.search.InChunks;
import com.aiagent.core.search.PageResponse;
import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.entity.QSysApi;
import com.aiagent.domain.authz.entity.QSysMenuApi;
import com.aiagent.domain.authz.entity.QSysRole;
import com.aiagent.domain.authz.entity.QSysRoleMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserRole;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.menu.MenuUserRow;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.service.MenuPreOrder;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.domain.user.entity.QSysUser;
import com.aiagent.support.time.BusinessCalendar;
import com.querydsl.core.Tuple;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code MENU_TREE} 의 조회 — screen/menu/requirements.md.
 *
 * <h2>{@code QueryDslBuilder} 를 쓰지 않는다</h2>
 *
 * 이 화면에는 <b>서버 조건이 하나도 없다</b>. screen/menu/requirements.md 이 <i>"트리에서 검색은 필터가
 * 아니다"</i> 라고 정했기 때문이다 — 조건에 맞는 노드만 남기면 부모가 사라져 <b>트리가
 * 아니게 된다</b>. 검색은 강조와 이동이며 <b>클라이언트가 한다</b>.
 *
 * <p>그래서 화이트리스트({@code QuerySpec})가 지킬 것이 없다. 조건이 없는 고정 쿼리에
 * 스펙을 만들어 두면 <b>있지도 않은 조건이 있는 것처럼</b> 읽히고, 나중에 누군가 그 스펙에
 * 필드를 더하면 <i>거르지 않는다</i> 는 §4.10 의 결정이 조용히 뒤집힌다.
 *
 * <h2>쿼리가 여럿인 것이 이 클래스의 형태다</h2>
 *
 * 트리 한 번에 <b>파생 셋</b>(매핑 API · 접근 가능 인원 · 매핑 역할)이 붙는데, 셋 다 다른
 * 테이블을 센다. 스칼라 서브쿼리로 얹으면 <b>행마다 세 번</b>이 되고, 조인해 {@code GROUP BY}
 * 하면 페이징 단위가 메뉴가 아니게 될 위험을 매번 확인해야 한다 — screen/code/requirements.md 가 코드 그룹에서
 * 쿼리를 가른 것과 같은 판단이다.
 *
 * <p><b>파생 셋이 삭제 게이트의 근거이기도 하다</b>(screen/menu/requirements.md) — 조회 응답이 이미 갖고 있으므로
 * 화면이 <i>지울 수 있는가</i> 에 답하는 데 왕복이 늘지 않는다.
 */
@Service
@Transactional(readOnly = true)
public class MenuQueryService {

    private static final QSysMenuApi MA = QSysMenuApi.sysMenuApi;
    private static final QSysApi A = QSysApi.sysApi;
    private static final QSysRoleMenuAuth RMA = QSysRoleMenuAuth.sysRoleMenuAuth;
    private static final QSysUserMenuAuth UMA = QSysUserMenuAuth.sysUserMenuAuth;
    private static final QSysUserRole UR = QSysUserRole.sysUserRole;
    private static final QSysRole R = QSysRole.sysRole;
    private static final QSysUser U = QSysUser.sysUser;

    /**
     * 복합 키를 문자열로 이을 때의 구분자.
     *
     * <p><b>값에 나타날 수 없는 문자여야 한다</b> — 구분자가 값에 섞이면 서로 다른 두 행이
     * 같은 키가 된다. 소스에 원시 제어문자를 두면 도구가 파일을 바이너리로 취급하므로
     * 이스케이프로 적고 이름을 붙인다.
     */
    private static final String KEY_SEP = "\0";

    private final JPAQueryFactory query;
    private final SysMenuRepository menus;
    private final MessageService messages;
    private final BusinessCalendar calendar;

    public MenuQueryService(
            JPAQueryFactory query,
            SysMenuRepository menus,
            MessageService messages,
            BusinessCalendar calendar) {
        this.query = query;
        this.menus = menus;
        this.messages = messages;
        this.calendar = calendar;
    }

    // ── 트리 ─────────────────────────────────────────────────────────

    /**
     * 트리 전건 — <b>전위 순회 순서</b>로 낸다(screen/menu/requirements.md).
     *
     * <p><b>페이징하지 않는다</b>({@code mode: 'all'} — backend/api.md). 트리를 페이징하면 <b>부모 없는
     * 자식 페이지</b>가 생기고, 2페이지만 봐서는 그것이 트리인지 알 수 없다. 메뉴는 수십~수백
     * 건이라 전건이 무겁지 않다 — sys/menu.md 가 형제 전체 재작성에서 내린 것과 같은 판단이다.
     *
     * <p><b>순서를 서버가 정하는 것이 결정이다.</b> 응답의 행 순서가 곧 트리의 모양이므로
     * ({@code SORT_NO} 를 컬럼으로 싣지 않는다 — {@link MenuTreeRow}) 클라이언트가 다시
     * 정렬하면 트리가 아니게 된다. 엑셀이 <i>"다시 정렬하면 트리가 아니게 된다"</i> 고 적은
     * 그것과 같은 사실이다(screen/menu/requirements.md).
     *
     * <p><b>고아·순환에 걸린 노드도 목록에 낸다.</b> {@code MenuTreeService} 는 조상 역산이
     * 목적이라 그것들을 빼지만, 여기는 <b>고치러 오는 화면</b>이다 — 화면에서 사라지면 고칠
     * 수단이 없어진다. 순회에 방문 집합을 걸어 <b>터지지 않게</b> 하고, 뿌리에 닿지 못한
     * 나머지는 <b>맨 뒤에 붙인다</b>.
     *
     * @param lang 세션 언어 — 컨트롤러가 준다. 도메인은 요청을 모른다(backend/packages.md)
     */
    public PageResponse<MenuTreeRow> getTree(String lang) {
        List<SysMenu> all = menus.findAll();
        List<String> menuCds = all.stream().map(SysMenu::getMenuCd).toList();

        Map<String, Long> apiCounts = apiCounts(menuCds);
        Map<String, Long> roleCounts = roleCounts(menuCds);
        Map<String, Long> userCounts = accessibleUserCounts(menuCds);

        List<MenuTreeRow> rows = new ArrayList<>(all.size());
        for (SysMenu menu : MenuPreOrder.of(all)) {
            String menuCd = menu.getMenuCd();
            rows.add(new MenuTreeRow(
                    menuCd,
                    menu.getUpMenuCd(),
                    // MENU_NM 은 메뉴명이 아니라 메시지 키다 — `menu.{MENU_CD}`(sys/menu.md).
                    messages.text(menu.getMenuNm(), lang),
                    menu.getMenuUrl(),
                    menu.getIconCd(),
                    menu.getUseYn(),
                    // 선언에서 사라진 메뉴는 ORPHAN 이다 — 화면이 배지를 붙인다(seed.md).
                    menu.getSrcCd(),
                    apiCounts.getOrDefault(menuCd, 0L),
                    // 구조 노드는 권한 대상이 아니라 세는 것이 정의되지 않는다(backend/security.md).
                    menu.getMenuUrl() == null ? 0L : userCounts.getOrDefault(menuCd, 0L),
                    roleCounts.getOrDefault(menuCd, 0L),
                    menu.getRegId(),
                    menu.getRegDtm(),
                    menu.getModId(),
                    menu.getModDtm()));
        }
        return PageResponse.all(rows);
    }

    // ── 탭 1 — 매핑 API ──────────────────────────────────────────────

    /**
     * 이 메뉴가 쓰는 API — <b>{@code 0} 건이면 진단이다</b>(screen/menu/requirements.md).
     *
     * <p><i>"매핑된 API 가 없습니다. 이 화면의 기능을 아무도 쓸 수 없습니다."</i> — sys/menu.md 의
     * <b>미매핑</b>이며 {@code API_CATALOG} 가 반대 축에서 보는 것과 같은 사실이다.
     */
    public PageResponse<MenuApiRow> getApiList(String menuCd) {
        List<MenuApiRow> rows = query.select(A.apiUrl, A.apiNm, A.apiDesc, A.actionCd)
                .from(MA)
                .join(A).on(A.apiUrl.eq(MA.apiUrl))
                .where(MA.menuCd.eq(menuCd))
                .orderBy(A.apiUrl.asc())
                .fetch()
                .stream()
                .map(row -> new MenuApiRow(
                        row.get(A.apiUrl), row.get(A.apiNm), row.get(A.apiDesc), row.get(A.actionCd)))
                .toList();
        return PageResponse.all(rows);
    }

    // ── 탭 3 — 매핑 역할 ─────────────────────────────────────────────

    /**
     * 이 메뉴에 권한을 준 역할 — <b>{@code USE_YN='N'} 인 역할도 나온다</b>(screen/menu/requirements.md).
     *
     * <p>권한 행은 살아 있고 FK 도 살아 있다. 삭제 게이트가 막는 것은 <b>행의 존재</b>이지
     * 역할의 상태가 아니므로, 꺼진 역할을 감추면 <i>"게이트가 막는데 목록은 비었다"</i> 가
     * 된다.
     */
    public PageResponse<MenuRoleRow> getRoleList(String menuCd) {
        Map<String, MenuRoleAccumulator> byRole = new LinkedHashMap<>();
        for (Tuple row : query.select(R.roleId, R.roleNm, R.useYn, RMA.actionCd)
                .from(RMA)
                .join(R).on(R.roleId.eq(RMA.roleId))
                .where(RMA.menuCd.eq(menuCd))
                .orderBy(R.roleId.asc())
                .fetch()) {
            byRole.computeIfAbsent(
                            row.get(R.roleId),
                            unused -> new MenuRoleAccumulator(row.get(R.roleNm), row.get(R.useYn)))
                    .actions
                    .add(row.get(RMA.actionCd));
        }
        List<MenuRoleRow> rows = byRole.entrySet().stream()
                .map(entry -> new MenuRoleRow(
                        entry.getKey(),
                        entry.getValue().roleNm,
                        entry.getValue().useYn,
                        // 선언 순서로 낸다 — DB 가 내는 순서에 기대면 벤더마다 열이 흔들린다.
                        List.copyOf(entry.getValue().actions)))
                .toList();
        return PageResponse.all(rows);
    }

    /** {@link EnumSet} 이라 액션이 {@link ActionType} 선언 순서로 정렬된다. */
    private static final class MenuRoleAccumulator {
        private final String roleNm;
        private final Boolean useYn;
        private final Set<ActionType> actions = EnumSet.noneOf(ActionType.class);

        private MenuRoleAccumulator(String roleNm, Boolean useYn) {
            this.roleNm = roleNm;
            this.useYn = useYn;
        }
    }

    // ── 탭 2 — 사용 가능 사용자 (AUTHZ-13) ───────────────────────────

    /**
     * 이 메뉴에 닿는 사람 — <b>경유마다 한 행</b>이다(screen/menu/requirements.md).
     *
     * <p><b>backend/security.md 의 ①②를 펴고 ③을 하지 않는다.</b> 합집합은 유효 권한 계산의 일이고, 이 탭이
     * 하는 일은 <b>그 앞의 출처를 보여주는 것</b>이다 — 합쳐 버리면 <i>"이 사람의 권한을
     * 회수하려면 어느 역할을 건드려야 하나"</i> 에 답할 수 없다.
     *
     * <p><b>기간으로 거르지 않는다.</b> 만료된 부여도 목록에 내고 상태로 말한다 — 감추면
     * <i>"어제까지 되던 것이 왜 안 되나"</i> 에 답할 것이 없어진다(frontend/tabs.md 의 내 역할 탭과 같은
     * 판단이다).
     *
     * <p><b>게이트 ④(메뉴 생존)도 적용하지 않는다.</b> 이 화면이 그 스위치를 들고 있으므로
     * (screen/menu/requirements.md) 꺼진 메뉴에서 목록이 비면 <i>끄기 전에 누가 쓰고 있었나</i> 를 볼 수 없다.
     */
    public PageResponse<MenuUserRow> getAccessibleUsers(String menuCd) {
        LocalDate today = calendar.today();
        List<MenuUserRow> rows = new ArrayList<>();

        // ① + ② 역할 경유 — 역할이 활성이어야 한다(backend/security.md 의 입력 필터).
        Map<String, MenuUserAccumulator> viaRole = new LinkedHashMap<>();
        for (Tuple row : query.select(
                        U.userId, U.userNm, U.useYn, U.validFromDt, U.validToDt,
                        R.roleId, R.roleNm, RMA.actionCd, UR.validFromDt, UR.validToDt)
                .from(RMA)
                .join(R).on(R.roleId.eq(RMA.roleId))
                .join(UR).on(UR.roleId.eq(RMA.roleId))
                .join(U).on(U.userId.eq(UR.userId))
                .where(RMA.menuCd.eq(menuCd), R.useYn.isTrue())
                .orderBy(U.userNm.asc(), U.userId.asc(), R.roleId.asc())
                .fetch()) {
            String key = row.get(U.userId) + KEY_SEP + row.get(R.roleId);
            viaRole.computeIfAbsent(key, unused -> new MenuUserAccumulator(
                            row.get(U.userId),
                            row.get(U.userNm),
                            usable(row.get(U.useYn), row.get(U.validFromDt), row.get(U.validToDt), today),
                            row.get(R.roleNm),
                            row.get(R.roleId),
                            row.get(UR.validFromDt),
                            row.get(UR.validToDt)))
                    .actions
                    .add(row.get(RMA.actionCd));
        }
        viaRole.values().forEach(accumulator -> rows.add(accumulator.toRow(today)));

        // ① + ② 개인 예외 — 합집합의 **독립 항**이다. 기간이 NOT NULL 이라 분기가 없다.
        Map<String, MenuUserAccumulator> viaPersonal = new LinkedHashMap<>();
        for (Tuple row : query.select(
                        U.userId, U.userNm, U.useYn, U.validFromDt, U.validToDt,
                        UMA.actionCd, UMA.validFromDt, UMA.validToDt)
                .from(UMA)
                .join(U).on(U.userId.eq(UMA.userId))
                .where(UMA.menuCd.eq(menuCd))
                .orderBy(U.userNm.asc(), U.userId.asc())
                .fetch()) {
            /*
              기간까지 키에 넣는다. sys/menu.md 이 개인 예외를 **부여 작업 단위**로 정의했으므로
              같은 사람에게 기간이 다른 예외가 둘 있을 수 있고, 그 둘은 회수 단위가 다르다.
            */
            String key = row.get(U.userId) + KEY_SEP
                    + row.get(UMA.validFromDt) + KEY_SEP + row.get(UMA.validToDt);
            viaPersonal.computeIfAbsent(key, unused -> new MenuUserAccumulator(
                            row.get(U.userId),
                            row.get(U.userNm),
                            usable(row.get(U.useYn), row.get(U.validFromDt), row.get(U.validToDt), today),
                            MenuUserRow.PERSONAL,
                            null,
                            row.get(UMA.validFromDt),
                            row.get(UMA.validToDt)))
                    .actions
                    .add(row.get(UMA.actionCd));
        }
        viaPersonal.values().forEach(accumulator -> rows.add(accumulator.toRow(today)));

        return PageResponse.all(rows);
    }

    /** 계정이 <b>관리자가 정한 뜻으로</b> 살아 있는가 — 잠금·휴면은 보지 않는다(sys/user-role.md). */
    private static boolean usable(Boolean useYn, LocalDate from, LocalDate to, LocalDate today) {
        return Boolean.TRUE.equals(useYn)
                && (from == null || !from.isAfter(today))
                && (to == null || !to.isBefore(today));
    }

    private static final class MenuUserAccumulator {
        private final String userId;
        private final String userNm;
        private final boolean accountUsable;
        private final String via;
        private final String roleId;
        private final LocalDate validFromDt;
        private final LocalDate validToDt;
        private final Set<ActionType> actions = EnumSet.noneOf(ActionType.class);

        private MenuUserAccumulator(
                String userId,
                String userNm,
                boolean accountUsable,
                String via,
                String roleId,
                LocalDate validFromDt,
                LocalDate validToDt) {
            this.userId = userId;
            this.userNm = userNm;
            this.accountUsable = accountUsable;
            this.via = via;
            this.roleId = roleId;
            this.validFromDt = validFromDt;
            this.validToDt = validToDt;
        }

        private MenuUserRow toRow(LocalDate today) {
            return new MenuUserRow(
                    userId,
                    userNm,
                    accountUsable,
                    via,
                    roleId,
                    List.copyOf(actions),
                    state(today),
                    validFromDt,
                    validToDt);
        }

        /** sys/menu.md — <b>양끝 포함</b>이고 {@code null} 은 제한 없음이다(sys/INDEX.md). */
        private MenuUserRow.GrantState state(LocalDate today) {
            if (validFromDt != null && validFromDt.isAfter(today)) {
                return MenuUserRow.GrantState.SCHEDULED;
            }
            if (validToDt != null && validToDt.isBefore(today)) {
                return MenuUserRow.GrantState.EXPIRED;
            }
            return MenuUserRow.GrantState.ACTIVE;
        }
    }

    // ── 파생 셋 (screen/menu/requirements.md) ─────────────────────────────────────

    /** {@code IN} 을 쪼갠다 — 오라클의 1000 한계다(backend/persistence.md). 트리 전건이라 넘을 수 있다. */
    private Map<String, Long> apiCounts(List<String> menuCds) {
        return countBy(menuCds, chunk -> query.select(MA.menuCd, MA.count())
                .from(MA)
                .where(MA.menuCd.in(chunk))
                .groupBy(MA.menuCd)
                .fetch(), MA.menuCd, MA.count());
    }

    /**
     * 매핑 역할 수 — <b>역할 수이지 권한 행 수가 아니다</b>.
     *
     * <p>한 역할이 같은 메뉴에 {@code READ}·{@code SAVE} 를 가지면 행은 둘이고 역할은 하나다.
     * 행을 세면 <i>"매핑 역할 2"</i> 가 되어 탭 3 의 목록 건수와 어긋난다 — <b>같은 수를 두
     * 자리가 다르게 말하면 둘 다 못 믿는다.</b>
     */
    private Map<String, Long> roleCounts(List<String> menuCds) {
        return countBy(menuCds, chunk -> query.select(RMA.menuCd, RMA.roleId.countDistinct())
                .from(RMA)
                .where(RMA.menuCd.in(chunk))
                .groupBy(RMA.menuCd)
                .fetch(), RMA.menuCd, RMA.roleId.countDistinct());
    }

    /**
     * 접근 가능 인원 — <b>합집합을 자바에서 한다</b>(backend/security.md ③).
     *
     * <p>두 경로를 SQL {@code UNION} 으로 합치면 벤더마다 다른 문법을 쓰게 되고(backend/persistence.md),
     * 무엇보다 <b>같은 사람이 두 경로로 오는 것이 정상</b>이라 중복 제거가 계산의 일부다 —
     * {@code EffectiveAuthorityService} 가 같은 모양이며 이유도 같다.
     */
    private Map<String, Long> accessibleUserCounts(List<String> menuCds) {
        if (menuCds.isEmpty()) {
            return Map.of();
        }
        LocalDate today = calendar.today();
        Map<String, Set<String>> byMenu = new HashMap<>();

        for (List<String> chunk : InChunks.split(menuCds)) {
            collect(byMenu, query.select(RMA.menuCd, UR.userId)
                    .from(RMA)
                    .join(R).on(R.roleId.eq(RMA.roleId))
                    .join(UR).on(UR.roleId.eq(RMA.roleId))
                    .join(U).on(U.userId.eq(UR.userId))
                    .where(
                            RMA.menuCd.in(chunk),
                            R.useYn.isTrue(),
                            UR.validFromDt.isNull().or(UR.validFromDt.loe(today)),
                            UR.validToDt.isNull().or(UR.validToDt.goe(today)),
                            U.useYn.isTrue(),
                            U.validFromDt.isNull().or(U.validFromDt.loe(today)),
                            U.validToDt.isNull().or(U.validToDt.goe(today)))
                    .fetch());
            collect(byMenu, query.select(UMA.menuCd, UMA.userId)
                    .from(UMA)
                    .join(U).on(U.userId.eq(UMA.userId))
                    .where(
                            UMA.menuCd.in(chunk),
                            UMA.validFromDt.loe(today),
                            UMA.validToDt.goe(today),
                            U.useYn.isTrue(),
                            U.validFromDt.isNull().or(U.validFromDt.loe(today)),
                            U.validToDt.isNull().or(U.validToDt.goe(today)))
                    .fetch());
        }
        Map<String, Long> counts = new HashMap<>();
        byMenu.forEach((menuCd, users) -> counts.put(menuCd, (long) users.size()));
        return counts;
    }

    private static void collect(Map<String, Set<String>> byMenu, List<Tuple> grants) {
        for (Tuple grant : grants) {
            byMenu.computeIfAbsent(grant.get(0, String.class), key -> new HashSet<>())
                    .add(grant.get(1, String.class));
        }
    }

    /** {@code IN} 쪼개기 + {@code GROUP BY} 수집을 한 자리에 모은다 — 셋이 같은 모양이다. */
    private static Map<String, Long> countBy(
            List<String> menuCds,
            java.util.function.Function<List<String>, List<Tuple>> fetch,
            com.querydsl.core.types.Expression<String> keyPath,
            com.querydsl.core.types.Expression<Long> countPath) {
        if (menuCds.isEmpty()) {
            return Map.of();
        }
        Map<String, Long> counts = new HashMap<>();
        for (List<String> chunk : InChunks.split(menuCds)) {
            for (Tuple row : fetch.apply(chunk)) {
                counts.put(row.get(keyPath), row.get(countPath));
            }
        }
        return counts;
    }
}
