// @feat FEAT-502
package com.aiagent.domain.authz.role;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.entity.SysRole;
import com.aiagent.domain.authz.entity.SysRoleMenuAuth;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.repository.SysRoleMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysRoleRepository;
import com.aiagent.domain.authz.repository.SysUserRoleRepository;
import com.aiagent.domain.authz.service.MenuActionCatalog;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.jpa.repository.Lock;

class RoleAuthServiceTest {

    private static final String ROLE = "OPS";

    private final SysRoleRepository roles = mock(SysRoleRepository.class);
    private final SysRoleMenuAuthRepository auths = mock(SysRoleMenuAuthRepository.class);
    private final SysUserRoleRepository holders = mock(SysUserRoleRepository.class);
    private final SysMenuRepository menus = mock(SysMenuRepository.class);
    private final MenuActionCatalog actions = mock(MenuActionCatalog.class);
    private final RoleAuthService service =
            new RoleAuthService(roles, auths, holders, menus, actions);

    @BeforeEach
    void setUp() {
        when(roles.findByRoleIdForUpdate(ROLE))
                .thenReturn(Optional.of(SysRole.created(ROLE, "운영", null, true)));
        when(menus.findAll()).thenReturn(List.of(leaf("A", 1), leaf("B", 2), leaf("C", 3)));
        when(actions.definedActions()).thenReturn(Map.of(
                "A", Set.of(ActionType.READ),
                "B", Set.of(ActionType.READ),
                "C", Set.of(ActionType.READ)));
    }

    @Test
    @DisplayName("TC-5023 역할 권한 회수는 보유자 전원을 세션 무효화 대상으로 돌려준다")
    void changedRoleReturnsEveryHolder() {
        SysRoleMenuAuth held = grant("A");
        when(auths.findByRoleIdOrderByMenuCdAscActionCdAsc(ROLE)).thenReturn(List.of(held));
        when(holders.findUserIdsByRoleId(ROLE)).thenReturn(List.of("kim", "lee"));

        assertThat(service.save(ROLE, List.of())).containsExactlyInAnyOrder("kim", "lee");
        verify(auths).deleteAll(List.of(held));
    }

    @Test
    @DisplayName("TC-5026 같은 역할의 동시 전체 저장은 나중 스냅샷이 이기고 병합하지 않는다")
    void laterFullSnapshotWinsWithoutMerging() {
        SysRoleMenuAuth a = grant("A");
        SysRoleMenuAuth b = grant("B");
        when(auths.findByRoleIdOrderByMenuCdAscActionCdAsc(ROLE))
                .thenReturn(List.of(a), List.of(a, b));
        when(holders.findUserIdsByRoleId(ROLE)).thenReturn(List.of("kim"));

        service.save(ROLE, List.of(wanted("A"), wanted("B")));
        service.save(ROLE, List.of(wanted("B"), wanted("C")));

        verify(roles, times(2)).findByRoleIdForUpdate(ROLE);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SysRoleMenuAuth>> removed = ArgumentCaptor.forClass(List.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SysRoleMenuAuth>> added = ArgumentCaptor.forClass(List.class);
        verify(auths, times(2)).deleteAll(removed.capture());
        verify(auths, times(2)).saveAll(added.capture());

        assertThat(removed.getAllValues().get(1)).containsExactly(a);
        assertThat(added.getAllValues().get(1))
                .extracting(SysRoleMenuAuth::getMenuCd)
                .containsExactly("C");
    }

    @Test
    @DisplayName("TC-5026 같은 역할 저장은 역할 행 쓰기 잠금으로 실제 동시 요청을 직렬화한다")
    void roleRowUsesPessimisticWriteLock() throws Exception {
        Lock lock = SysRoleRepository.class
                .getMethod("findByRoleIdForUpdate", String.class)
                .getAnnotation(Lock.class);

        assertThat(lock).isNotNull();
        assertThat(lock.value()).isEqualTo(LockModeType.PESSIMISTIC_WRITE);
    }

    private static SysMenu leaf(String code, int order) {
        SysMenu menu = SysMenu.created(null, code, order);
        menu.changeUrl("/" + code.toLowerCase());
        return menu;
    }

    private static SysRoleMenuAuth grant(String menuCd) {
        return SysRoleMenuAuth.created(ROLE, menuCd, ActionType.READ);
    }

    private static RoleAuthGrant wanted(String menuCd) {
        return new RoleAuthGrant(menuCd, ActionType.READ);
    }
}
