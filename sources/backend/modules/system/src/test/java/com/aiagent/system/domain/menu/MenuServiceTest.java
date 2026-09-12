// @feat FEAT-503
package com.aiagent.system.domain.menu;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.repository.SysMenuApiRepository;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.repository.SysRoleMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysUserMenuAuthRepository;
import com.aiagent.domain.favorite.repository.SysUserFavoriteRepository;
import com.aiagent.domain.gridpref.repository.SysUserGridPrefRepository;
import com.aiagent.domain.message.repository.SysCacheVersionRepository;
import com.aiagent.domain.message.repository.SysMessageKeyRepository;
import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.domain.searchcond.repository.SysUserSearchCondRepository;
import com.aiagent.support.time.BusinessCalendar;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MenuServiceTest {

    private final SysMenuRepository menus = mock(SysMenuRepository.class);
    private final MenuService service = new MenuService(
            new MenuTreeLockTrigger(), menus, mock(SysMenuApiRepository.class),
            mock(SysRoleMenuAuthRepository.class), mock(SysUserMenuAuthRepository.class),
            mock(SysUserFavoriteRepository.class), mock(SysUserSearchCondRepository.class),
            mock(SysUserGridPrefRepository.class), mock(SysMessageKeyRepository.class),
            mock(SysMessageRepository.class), mock(SysCacheVersionRepository.class), mock(BusinessCalendar.class));

    @Test
    @DisplayName("TC-5032 다른 메뉴가 가진 URL 저장은 409으로 거부하고 원래 URL을 보존한다")
    void rejectsDuplicateUrl() {
        SysMenu editing = leaf("EDITING", null);
        SysMenu owner = leaf("OWNER", "/admin/system/menu");
        when(menus.findById("EDITING")).thenReturn(Optional.of(editing));
        when(menus.findAll()).thenReturn(List.of(editing, owner));

        assertThatThrownBy(() -> service.saveNode("EDITING", "/admin/system/menu", null, true))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.DUPLICATE_URL);
    }

    private static SysMenu leaf(String code, String url) {
        SysMenu menu = SysMenu.created(null, code, 1);
        menu.changeUrl(url);
        return menu;
    }
}
