package com.aiagent.domain.authz.userauth;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.RowErrors;
import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.MenuAction;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.entity.SysUserMenuAuth;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.repository.SysRoleMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysUserMenuAuthRepository;
import com.aiagent.domain.authz.service.MenuActionCatalog;
import com.aiagent.domain.user.repository.SysUserRepository;
import com.aiagent.support.time.BusinessCalendar;
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
 * {@code USER_AUTH_MGMT} 의 저장 — screen/user-auth/requirements.md. <b>행 상태가 있는 일괄 저장이다.</b>
 *
 * <h2>{@code RoleAuthService} 와 갈리는 자리</h2>
 *
 * <p>역할 쪽은 <b>켜진 스위치 전부</b>를 받아 서버가 차이를 냈다(screen/menu/requirements.md). 권한이 있거나
 * 없거나 둘뿐이라 <i>수정</i> 이 존재하지 않았기 때문이다.
 *
 * <p>여기는 <b>기간과 사유가 붙는다</b>(sys/menu.md). 같은 조합의 값이 바뀔 수 있으므로 <i>수정</i>
 * 이 실재하고, 그래서 frontend/grid.md 의 보통 일괄 저장 모양이 된다 — screen/user/requirements.md 가 <i>"목록이 원본이고
 * 트리는 그 투영"</i> 이라고 한 것의 서버 쪽 모습이다.
 *
 * <h2>회수는 삭제가 아니다</h2>
 *
 * <p><b>{@code D} 는 잘못 등록한 행 정리뿐</b>이다(screen/user-auth/requirements.md). 회수는 <b>종료일을 어제로</b>
 * 하는 {@code U} 이며, 행을 지우면 <b>사유가 사라진다</b> — 변경 이력 테이블을 두지 않았으므로
 * (sys/logs.md) <i>"누구에게 왜 무엇을 언제까지 줬는가"</i> 를 남기는 것이 이 행뿐이다.
 *
 * <p>그래서 이 서비스는 <b>{@code D} 를 막지 않는다</b>. 막으면 오타로 만든 행을 영영 지울 수
 * 없고, screen/user-auth/requirements.md 이 셋째 수단으로 그것을 적어 두었다 — <b>무엇을 위한 삭제인지는 사람이 안다</b>.
 *
 * <h2>{@code READ} 불변식을 <b>합집합</b>에서 본다 — 역할 쪽과 판정이 다르다</h2>
 *
 * <p>screen/user-auth/requirements.md 의 불변식은 <i>다른 액션이 하나라도 켜져 있으면 {@code READ} 가 켜져 있다</i>
 * 이고, 그 근거는 <b>화면에 못 들어가면 어느 버튼도 누를 수 없다</b>는 것이다.
 *
 * <p>그렇다면 판정 대상은 <b>유효 권한</b>이어야 한다. 유효 권한은 역할과 개인 예외의
 * <b>합집합</b>이므로(backend/security.md ③), <b>역할이 조회를 주고 있으면 개인 예외에는 저장만 있어도
 * 화면에 들어갈 수 있다</b> — 그리고 그것이 이 화면의 흔한 쓰임이다: 이미 볼 수 있는 사람에게
 * <i>고칠 수 있게</i> 만 더해 주는 일.
 *
 * <p>역할 쪽({@code RoleAuthService})이 그 역할 안에서만 본 것은 <b>거기서는 합집합이라는
 * 것이 없기</b> 때문이다 — 역할 하나가 통째로 한 사람에게 갈 수도, 다른 역할과 겹칠 수도
 * 있어 <i>이 역할만으로 성립해야 한다</i> 가 안전한 쪽이었다.
 *
 * <p><b>기간의 겹침까지 보지는 않는다.</b> 개인 {@code SAVE} 가 8월이고 개인 {@code READ} 가
 * 9월이면 8월에는 도달할 수 없는데 여기서 잡지 못한다 — 그 검사는 <b>액션 넷 × 기간 구간</b>
 * 을 교차해야 하고, 무엇보다 <b>역할 부여의 기간까지</b> 함께 봐야 성립한다. screen/user-auth/requirements.md 가
 * 요구한 것은 그 수준이 아니며, 화면이 기간을 한 번에 받아 <b>같은 값을 복사</b>하므로
 * (backend/security.md — 부여 작업 단위로 사유 하나) 정상 경로에서는 생기지 않는다.
 */
@Service
public class UserAuthService {

    private final SysUserRepository users;
    private final SysUserMenuAuthRepository grants;
    private final SysRoleMenuAuthRepository roleAuths;
    private final SysMenuRepository menus;
    private final MenuActionCatalog actions;
    private final BusinessCalendar calendar;

    public UserAuthService(
            SysUserRepository users,
            SysUserMenuAuthRepository grants,
            SysRoleMenuAuthRepository roleAuths,
            SysMenuRepository menus,
            MenuActionCatalog actions,
            BusinessCalendar calendar) {
        this.users = users;
        this.grants = grants;
        this.roleAuths = roleAuths;
        this.menus = menus;
        this.actions = actions;
        this.calendar = calendar;
    }

    /**
     * 일괄 저장 — frontend/grid.md. <b>한 트랜잭션이다</b>(UX-14).
     *
     * <p>순서가 규약이다: <b>행 하나씩 형태를 보고 → 반영하고 → 마지막에 불변식</b>. 불변식은
     * <b>반영 뒤의 상태</b>를 봐야 하므로 행 하나만 보고는 판정할 수 없다 — 같은 요청 안에서
     * {@code READ} 를 지우고 {@code SAVE} 를 더하는 것이 가능하기 때문이다.
     */
    @Transactional
    public void save(String userId, List<UserAuthSaveRow> rows) {
        if (!users.existsById(userId)) {
            throw new BusinessException(UserAuthErrorCode.NOT_FOUND, "없는 계정이다 — " + userId);
        }
        Map<String, Set<ActionType>> definable = actions.definedActions();
        Map<String, SysMenu> menuByCode = new HashMap<>();
        menus.findAll().forEach(menu -> menuByCode.put(menu.getMenuCd(), menu));

        Map<MenuAction, SysUserMenuAuth> current = new HashMap<>();
        for (SysUserMenuAuth row : grants.findByUserIdOrderByMenuCdAscActionCdAsc(userId)) {
            current.put(new MenuAction(row.getMenuCd(), row.getActionCd()), row);
        }

        Set<MenuAction> seen = new HashSet<>();
        List<SysUserMenuAuth> added = new ArrayList<>();
        List<SysUserMenuAuth> removed = new ArrayList<>();

        RowErrors.each(rows, row -> {
            MenuAction pair = new MenuAction(row.menuCd(), row.actionCd());
            /*
              같은 요청 안의 중복은 화면이 만들 수 없지만(PK 가 하나라 목록에 행이 하나다)
              화면 밖 경로가 남는다 — 두 번째의 존재 확인이 첫 번째의 flush 를 만나지 못해
              조용히 덮인다.
            */
            if (!seen.add(pair)) {
                throw new BusinessException(
                        UserAuthErrorCode.DUPLICATE,
                        "같은 요청에 같은 조합이 둘이다 — " + pair,
                        List.of(new BusinessException.FieldError(
                                "menuPath", "같은 메뉴·액션 조합이 두 번 왔습니다", pair.toString())));
            }
            switch (row.rowState()) {
                case C -> {
                    validateGrantable(pair, menuByCode, definable);
                    validateValues(row);
                    if (current.containsKey(pair)) {
                        throw new BusinessException(
                                UserAuthErrorCode.DUPLICATE,
                                "이미 있는 부여다 — " + pair,
                                List.of(new BusinessException.FieldError(
                                        "menuPath", "이미 있는 부여입니다", pair.toString())));
                    }
                    added.add(SysUserMenuAuth.created(
                            userId, row.menuCd(), row.actionCd(),
                            row.validFromDt(), row.validToDt(), row.grantRsn()));
                }
                case U -> {
                    validateGrantable(pair, menuByCode, definable);
                    validateValues(row);
                    require(current.get(pair), pair)
                            .change(row.validFromDt(), row.validToDt(), row.grantRsn());
                }
                case D -> removed.add(require(current.get(pair), pair));
            }
        });
        /*
          <b>불변식이 쓰기보다 앞이다.</b> 트랜잭션 안이라 뒤에 둬도 롤백되지만, 그러면
          거부되는 요청이 <b>INSERT 를 한 번 내고</b> 돌아온다 — 로그에 남고, 시퀀스가 있는
          테이블이면 값이 하나 뛴다. 무엇보다 <i>검증에 걸린 저장이 쓰기를 했다</i> 는 사실
          자체가 읽는 사람을 헷갈리게 한다.

          {@code U} 의 값 갱신은 이미 위에서 일어났다 — 관리되는 엔티티라 미룰 자리가 없고,
          그것은 <b>flush 되기 전</b>이므로 여기서 던지면 나가지 않는다.
        */
        validateReadInvariant(userId, current, added, removed);

        // 빈 목록으로 부르지 않는다 — 아무것도 하지 않는 왕복이 로그에 남는다.
        if (!added.isEmpty()) {
            grants.saveAll(added);
        }
        if (!removed.isEmpty()) {
            grants.deleteAll(removed);
        }
    }

    // ── 검증 (sys/menu.md 원칙 P1) ────────────────────────────────────────

    /**
     * 줄 수 있는 조합인가 — <b>{@code C} 와 {@code U} 에만 건다</b>.
     *
     * <p>{@code D} 에 걸지 않는 것이 요점이다. API 가 사라져 <b>고아가 된 부여</b>는 정의
     * 밖이라 여기서 거부되는데, 그 행을 지우는 것은 <b>사람이 판단해 하는 정리</b>이며
     * screen/user-auth/requirements.md 이 셋째 수단으로 적어 두었다 — 막으면 고아를 영영 지울 수 없다.
     */
    private static void validateGrantable(
            MenuAction pair,
            Map<String, SysMenu> menuByCode,
            Map<String, Set<ActionType>> definable) {

        /*
          <b>{@code MENU_URL IS NULL} 이면 거부한다</b>(sys/menu.md). 구조 노드에는 화면이 스위치를
          그리지 않으므로(screen/user-auth/requirements.md) 정상 경로로는 오지 않는다 — 여기 닿는 것은 화면 밖
          경로이거나, 트리를 열어 둔 사이에 그 메뉴가 폴더가 된 경우다.

          <b>{@code USE_YN} 은 보지 않는다.</b> 꺼진 메뉴에도 예외는 줄 수 있고 게이트 ④에서
          걸릴 뿐이며(backend/security.md), 그것이 <i>켜기 전에 구성한다</i> 는 동선이다.
        */
        SysMenu menu = menuByCode.get(pair.menuCd());
        if (menu == null || menu.getMenuUrl() == null) {
            throw new BusinessException(
                    UserAuthErrorCode.MENU_NOT_AUTHORIZABLE,
                    "권한을 줄 수 없는 메뉴다 — " + pair.menuCd(),
                    List.of(new BusinessException.FieldError(
                            "menuPath", "권한을 줄 수 없는 메뉴입니다", pair.menuCd())));
        }
        if (!definable.getOrDefault(pair.menuCd(), Set.of()).contains(pair.action())) {
            throw new BusinessException(
                    UserAuthErrorCode.ACTION_UNDEFINED,
                    "그 메뉴에 정의되지 않은 액션이다 — " + pair,
                    List.of(new BusinessException.FieldError(
                            "actionCd", "그 메뉴에 정의되지 않은 액션입니다", pair.action().name())));
        }
    }

    /**
     * 기간과 사유 — <b>둘 다 {@code NOT NULL}</b> 이다(sys/menu.md · AUTHZ-07).
     *
     * <p>DB 제약이 이미 막지만 그 실패는 <b>제약 위반 예외</b>로 나가 사용자에게 무슨 칸이
     * 문제인지 말하지 못한다. 여기서 먼저 보는 것이 frontend/grid.md 의 <i>서버가 최종 판정</i> 이다.
     */
    private static void validateValues(UserAuthSaveRow row) {
        if (row.validFromDt() == null || row.validToDt() == null) {
            throw new BusinessException(
                    UserAuthErrorCode.PERIOD_REQUIRED,
                    "부여 기간이 비었다 — " + row.menuCd(),
                    List.of(new BusinessException.FieldError("validFromDt", "필수 값이 비어 있습니다")));
        }
        if (row.validFromDt().isAfter(row.validToDt())) {
            throw new BusinessException(
                    UserAuthErrorCode.PERIOD_REVERSED,
                    "기간이 뒤집혔다 — " + row.validFromDt() + " ~ " + row.validToDt(),
                    List.of(new BusinessException.FieldError(
                            "validToDt", "종료일이 시작일보다 빠릅니다", row.validToDt().toString())));
        }
        if (row.grantRsn() == null || row.grantRsn().isBlank()) {
            throw new BusinessException(
                    UserAuthErrorCode.REASON_REQUIRED,
                    "부여 사유가 비었다 — " + row.menuCd(),
                    List.of(new BusinessException.FieldError("grantRsn", "필수 값이 비어 있습니다")));
        }
    }

    private static SysUserMenuAuth require(SysUserMenuAuth found, MenuAction pair) {
        if (found == null) {
            throw new BusinessException(
                    UserAuthErrorCode.MISSING,
                    "고칠 부여가 없다 — " + pair,
                    List.of(new BusinessException.FieldError(
                            "menuPath", "고칠 부여가 없습니다", pair.toString())));
        }
        return found;
    }

    /**
     * {@code READ} 불변식 — <b>합집합에서 본다</b>(클래스 주석).
     *
     * <p>저장이 반영된 뒤의 개인 예외에 <i>{@code READ} 아닌 액션</i> 이 남아 있는 메뉴마다,
     * <b>개인 {@code READ} 이거나 역할이 주는 {@code READ}</b> 가 있어야 한다. 둘 다 없으면
     * 그 사람은 <b>메뉴는 보이는데 화면에 못 들어가고</b>, 관리자는 트리에서 저장이 켜진 것을
     * 보고 더 헷갈린다.
     */
    private void validateReadInvariant(
            String userId,
            Map<MenuAction, SysUserMenuAuth> before,
            List<SysUserMenuAuth> added,
            List<SysUserMenuAuth> removed) {

        Map<String, Set<ActionType>> personal = new HashMap<>();
        Set<MenuAction> gone = new HashSet<>();
        removed.forEach(row -> gone.add(new MenuAction(row.getMenuCd(), row.getActionCd())));

        before.keySet().stream()
                .filter(pair -> !gone.contains(pair))
                .forEach(pair -> hold(personal, pair.menuCd(), pair.action()));
        added.forEach(row -> hold(personal, row.getMenuCd(), row.getActionCd()));

        Set<String> readViaRole = menusReadableByRole(userId);

        for (Map.Entry<String, Set<ActionType>> entry : personal.entrySet()) {
            Set<ActionType> held = entry.getValue();
            boolean onlyRead = held.size() == 1 && held.contains(ActionType.READ);
            if (held.isEmpty() || onlyRead) {
                continue;
            }
            if (!held.contains(ActionType.READ) && !readViaRole.contains(entry.getKey())) {
                throw new BusinessException(
                        UserAuthErrorCode.READ_REQUIRED,
                        "조회 없이 다른 액션만 남는다 — " + entry.getKey() + " " + held,
                        List.of(new BusinessException.FieldError(
                                "menuPath",
                                "조회 권한 없이 다른 액션만 남습니다",
                                entry.getKey())));
            }
        }
    }

    private static void hold(Map<String, Set<ActionType>> byMenu, String menuCd, ActionType action) {
        byMenu.computeIfAbsent(menuCd, key -> EnumSet.noneOf(ActionType.class)).add(action);
    }

    /**
     * 역할이 <b>지금</b> 조회를 주는 메뉴들.
     *
     * <p><b>유효 권한 계산이 쓰는 그 쿼리를 그대로 부른다</b>({@code findGrantsOfUser} —
     * backend/security.md 의 ① 수집 + ② 필터). 여기서 조건을 다시 적으면 <i>역할이 활성일 것</i>·<i>부여가
     * 유효기간 안일 것</i> 이 <b>두 곳</b>에 표현되고, 한쪽만 고쳤을 때의 증상이
     * <i>"저장은 됐는데 안 된다"</i> 또는 그 반대다.
     *
     * <p><b>게이트 ④(메뉴 {@code USE_YN})는 보지 않는다.</b> 꺼진 메뉴에도 예외는 줄 수 있고
     * 그것이 <i>켜기 전에 구성한다</i> 는 동선이므로, 여기서 걸러 내면 <b>꺼진 메뉴에는
     * 저장 권한을 줄 수 없게</b> 된다.
     */
    private Set<String> menusReadableByRole(String userId) {
        Set<String> menuCds = new HashSet<>();
        for (MenuAction grant : roleAuths.findGrantsOfUser(userId, calendar.today(), true)) {
            if (grant.action() == ActionType.READ) {
                menuCds.add(grant.menuCd());
            }
        }
        return menuCds;
    }
}
