// @feat FEAT-502
package com.aiagent.system.domain.role;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.MenuAction;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.entity.SysRole;
import com.aiagent.domain.authz.entity.SysRoleMenuAuth;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.repository.SysRoleMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysRoleRepository;
import com.aiagent.domain.authz.repository.SysUserRoleRepository;
import com.aiagent.domain.authz.service.MenuActionCatalog;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code ROLE_AUTH_MGMT} 의 저장 — screen/admin/system/role-auth/requirements.md. <b>저장 대상은 트리뿐이다.</b>
 *
 * <p>screen/admin/system/user/requirements.md 의 개인 예외와 갈리는 자리다. 거기서는 <i>"목록이 원본이고 트리는 그 투영"</i>
 * 이었지만 <b>여기는 원본이 트리 하나</b>다 — {@code SYS_ROLE_MENU_AUTH} 에 기간도 사유도
 * 없으므로(sys/menu.md) 넣을 것이 없고, 하단은 <b>읽기 전용</b>이다.
 *
 * <h2>받는 것은 <b>켜진 스위치 전부</b>다</h2>
 *
 * {@code rowState} 가 없다({@link RoleAuthGrant}). 권한은 있거나 없거나 둘뿐이라 <b>켜면 추가,
 * 끄면 삭제</b>이고 <i>수정</i> 이 존재하지 않는다 — 그래서 지금 상태와의 차이가 곧 연산이다.
 *
 * <h2>지우는 범위가 <b>정의된 조합</b>으로 한정된다</h2>
 *
 * 이것이 이 서비스의 핵심 장치다. 트리에서 {@code —} 로 그려지는 칸(그 메뉴에 정의되지 않은
 * 액션 — {@link com.aiagent.domain.authz.service.MenuActionCatalog})은 <b>화면이
 * 표현할 수 없으므로</b> 요청에 실릴 수 없다. 받은 집합을 그대로 <i>전부</i>
 * 로 읽어 나머지를 지우면, API 가 사라져 고아가 된 부여가 <b>조용히 삭제된다</b> —
 * screen/admin/system/user/requirements.md 가 <i>"부여한 뒤에 액션이 사라지면 행은 남는다 · 지우는 것은 사람이 판단한다"</i>
 * 고 정한 것과 정면으로 어긋난다(seed.md — 배포가 운영 결정을 지우지 않는다).
 *
 * <p>그래서 <b>삭제도 추가도 정의된 조합 안에서만</b> 일어난다. 정의 밖의 기존 행은
 * <b>손대지 않고</b>, 정의 밖을 새로 주려는 요청은 <b>거부한다</b>.
 *
 * <h2>{@code READ} 불변식을 서버가 다시 본다</h2>
 *
 * <i>다른 액션이 하나라도 켜져 있으면 {@code READ} 가 켜져 있다</i>(screen/admin/system/user/requirements.md). 화면이 이것을
 * <b>유지</b>하지만 그것은 UX 이고(frontend/grid.md), 여기서 보는 것은 sys/menu.md 의 원칙 P1 이며
 * {@code MENU_URL IS NULL} 거부와 <b>같은 자리</b>다.
 *
 * <p><b>이미 깨진 데이터는 고치지 않는다.</b> 조회는 그대로 보여주고 경고하며(화면의 일),
 * 정리는 저장할 때 일어난다 — <b>조회가 데이터를 바꾸면 안 된다</b>.
 */
@Service
public class RoleAuthService {

    private final SysRoleRepository roles;
    private final SysRoleMenuAuthRepository auths;
    private final SysUserRoleRepository grants;
    private final SysMenuRepository menus;
    private final MenuActionCatalog actions;

    public RoleAuthService(
            SysRoleRepository roles,
            SysRoleMenuAuthRepository auths,
            SysUserRoleRepository grants,
            SysMenuRepository menus,
            MenuActionCatalog actions) {
        this.roles = roles;
        this.auths = auths;
        this.grants = grants;
        this.menus = menus;
        this.actions = actions;
    }

    /**
     * 이 역할의 권한을 <b>보낸 집합으로 맞춘다</b>.
     *
     * @return 유효 권한이 바뀐 사용자들 — 컨트롤러가 세션을 무효화한다(backend/security.md)
     */
    @Transactional
    public Set<String> save(String roleId, List<RoleAuthGrant> wanted) {
        SysRole role = roles.findByRoleIdForUpdate(roleId)
                .orElseThrow(() -> new BusinessException(
                        RoleErrorCode.NOT_FOUND, "없는 역할이다 — " + roleId));

        Set<MenuAction> desired = new LinkedHashSet<>();
        for (RoleAuthGrant grant : wanted) {
            desired.add(new MenuAction(grant.menuCd(), grant.actionCd()));
        }

        /*
          트리를 그릴 때와 <b>같은 사실</b>을 여기서 다시 읽는다. 조회와 저장이 같은
          트랜잭션이 아니므로 그 사이에 시드가 재생성되면 화면이 켠 칸이 여기서 거부될 수
          있다 — 그것이 맞는 동작이다: 줄 수 없게 된 권한을 저장하는 것보다 낫다.
        */
        Map<String, Set<ActionType>> definable = actions.definedActions();
        validate(desired, definable);

        List<SysRoleMenuAuth> current = auths.findByRoleIdOrderByMenuCdAscActionCdAsc(roleId);

        List<SysRoleMenuAuth> removed = new ArrayList<>();
        Set<MenuAction> held = new HashSet<>();
        for (SysRoleMenuAuth row : current) {
            MenuAction pair = new MenuAction(row.getMenuCd(), row.getActionCd());
            held.add(pair);
            if (desired.contains(pair)) {
                continue;
            }
            /*
              <b>정의 밖은 건드리지 않는다.</b> 화면이 {@code —} 로 그려 요청에 실을 수 없는
              칸이므로, 없다고 해서 *끈 것* 이 아니다 — screen/admin/system/user/requirements.md 의 고아 부여다.
            */
            if (isDefinable(definable, pair)) {
                removed.add(row);
            }
        }
        List<SysRoleMenuAuth> added = desired.stream()
                .filter(pair -> !held.contains(pair))
                .map(pair -> SysRoleMenuAuth.created(roleId, pair.menuCd(), pair.action()))
                .toList();

        auths.deleteAll(removed);
        auths.saveAll(added);

        /*
          바뀐 것이 없으면 세션도 건드리지 않는다. 화면은 미저장 변경이 있을 때만 저장을
          보내지만, 두 사람이 같은 것을 저장하면 뒤가 빈 차이가 된다 — 그때 보유자 전원의
          유효 권한을 다시 계산시킬 이유가 없다.

          <b>꺼진 역할이면 아무에게도 영향이 없다</b>(backend/security.md ② — 입력 필터에서 걸린다).
          screen/admin/system/role-auth/requirements.md 가 비활성 역할의 편집을 <i>"가장 안전한 편집"</i> 이라 부른 것이 이것이다.
        */
        if ((removed.isEmpty() && added.isEmpty()) || !Boolean.TRUE.equals(role.getUseYn())) {
            return Set.of();
        }
        return Set.copyOf(grants.findUserIdsByRoleId(roleId));
    }

    // ── 검증 (sys/menu.md 원칙 P1) ────────────────────────────────────────

    private void validate(Set<MenuAction> desired, Map<String, Set<ActionType>> definable) {
        Map<String, Set<ActionType>> byMenu = new HashMap<>();
        for (MenuAction pair : desired) {
            byMenu.computeIfAbsent(pair.menuCd(), key -> new HashSet<>()).add(pair.action());
        }
        Map<String, SysMenu> menuByCode = new HashMap<>();
        menus.findAll().forEach(menu -> menuByCode.put(menu.getMenuCd(), menu));

        for (Map.Entry<String, Set<ActionType>> entry : byMenu.entrySet()) {
            String menuCd = entry.getKey();

            /*
              <b>{@code MENU_URL IS NULL} 이면 거부한다</b>(sys/menu.md). 구조 노드에는 화면이
              스위치를 그리지 않으므로(screen/admin/system/role-auth/requirements.md) 정상 경로로는 오지 않는다 — 여기 닿는 것은
              화면 밖 경로이거나, 트리를 열어 둔 사이에 그 메뉴가 폴더가 된 경우다.

              <b>{@code USE_YN} 은 보지 않는다.</b> 꺼진 메뉴에도 권한은 줄 수 있고 게이트
              ④에서 걸릴 뿐이며(backend/security.md), 그것이 <i>켜기 전에 구성한다</i> 는 동선이다.
            */
            SysMenu menu = menuByCode.get(menuCd);
            if (menu == null || menu.getMenuUrl() == null) {
                throw new BusinessException(
                        RoleErrorCode.MENU_NOT_AUTHORIZABLE,
                        "권한을 줄 수 없는 메뉴다 — " + menuCd);
            }
            Set<ActionType> defined = definable.getOrDefault(menuCd, Set.of());
            for (ActionType action : entry.getValue()) {
                if (!defined.contains(action)) {
                    throw new BusinessException(
                            RoleErrorCode.ACTION_UNDEFINED,
                            "그 메뉴에 정의되지 않은 액션이다 — " + menuCd + " " + action);
                }
            }
            // 불변식 하나 — screen/admin/system/user/requirements.md. 규칙 둘이 아니라 이것 하나이며 양방향이 여기서 나온다.
            if (!entry.getValue().contains(ActionType.READ)) {
                throw new BusinessException(
                        RoleErrorCode.READ_REQUIRED,
                        "READ 없이 다른 액션만 왔다 — " + menuCd + " " + entry.getValue());
            }
        }
    }

    private static boolean isDefinable(Map<String, Set<ActionType>> definable, MenuAction pair) {
        return definable.getOrDefault(pair.menuCd(), Set.of()).contains(pair.action());
    }
}
