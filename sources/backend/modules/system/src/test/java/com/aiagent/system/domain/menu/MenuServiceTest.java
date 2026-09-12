// @feat FEAT-503
package com.aiagent.system.domain.menu;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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
import com.aiagent.domain.message.entity.SysCacheVersion;
import com.aiagent.domain.message.entity.SysMessage;
import com.aiagent.domain.message.entity.SysMessageKey;
import com.aiagent.domain.message.repository.SysMessageKeyRepository;
import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.domain.searchcond.repository.SysUserSearchCondRepository;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Instant;
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

    @Test
    @DisplayName("새 메뉴는 같은 부모의 마지막 순서와 데이터 메시지 키로 만든다")
    void createsNodeAtTheEnd() {
        SysMenu first = SysMenu.created(null, "FIRST", 1);
        SysMenu second = SysMenu.created(null, "SECOND", 2);
        SysMenu otherParent = SysMenu.created("OTHER", "OTHER_CHILD", 99);
        when(menus.existsById("NEW")).thenReturn(false);
        when(menus.findAll()).thenReturn(List.of(first, second, otherParent));

        service.createNode(null, "NEW");

        org.mockito.ArgumentCaptor<SysMenu> saved = org.mockito.ArgumentCaptor.forClass(SysMenu.class);
        verify(menus).save(saved.capture());
        assertThat(saved.getValue().getMenuCd()).isEqualTo("NEW");
        assertThat(saved.getValue().getSortNo()).isEqualTo(3);
    }

    @Test
    @DisplayName("새 메뉴는 다섯 단까지 허용하고 여섯 단은 저장 전에 거부한다")
    void enforcesDepthLimitWhenCreatingChild() {
        SysMenu one = SysMenu.created(null, "ONE", 1);
        SysMenu two = SysMenu.created("ONE", "TWO", 1);
        SysMenu three = SysMenu.created("TWO", "THREE", 1);
        SysMenu four = SysMenu.created("THREE", "FOUR", 1);
        SysMenu five = SysMenu.created("FOUR", "FIVE", 1);
        when(menus.existsById("SIX")).thenReturn(false);
        when(menus.findById("FIVE")).thenReturn(Optional.of(five));
        when(menus.findAll()).thenReturn(List.of(one, two, three, four, five));

        assertThatThrownBy(() -> service.createNode("FIVE", "SIX"))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.DEPTH_EXCEEDED);
    }

    @Test
    @DisplayName("이미 있는 코드와 화면이 있는 부모 아래 생성은 각각 거부한다")
    void rejectsDuplicateCodeAndChildUnderLeaf() {
        when(menus.existsById("DUP")).thenReturn(true);
        assertThatThrownBy(() -> service.createNode(null, "DUP"))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.DUPLICATE_CODE);

        SysMenu leaf = leaf("LEAF", "/screen");
        when(menus.existsById("CHILD")).thenReturn(false);
        when(menus.findById("LEAF")).thenReturn(Optional.of(leaf));
        assertThatThrownBy(() -> service.createNode("LEAF", "CHILD"))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.CHILD_UNDER_LEAF);
    }

    @Test
    @DisplayName("URL을 가진 메뉴에 자식이 있거나 URL을 비울 권한이 있으면 저장을 거부한다")
    void rejectsInvalidUrlTransitions() {
        SysMenu parent = SysMenu.created(null, "PARENT", 1);
        SysMenu child = SysMenu.created("PARENT", "CHILD", 1);
        when(menus.findById("PARENT")).thenReturn(Optional.of(parent));
        when(menus.findAll()).thenReturn(List.of(parent, child));
        assertThatThrownBy(() -> service.saveNode("PARENT", "/screen", null, true))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.URL_ON_PARENT);

        SysMenu granted = leaf("GRANTED", "/screen");
        when(menus.findById("GRANTED")).thenReturn(Optional.of(granted));
        when(menus.findAll()).thenReturn(List.of(granted));
        SysRoleMenuAuthRepository roles = mock(SysRoleMenuAuthRepository.class);
        when(roles.existsByMenuCd("GRANTED")).thenReturn(true);
        MenuService withGrant = service(roles);
        assertThatThrownBy(() -> withGrant.saveNode("GRANTED", null, null, true))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.URL_REQUIRED_BY_AUTH);
    }

    @Test
    @DisplayName("폴더 사용 여부는 모든 자손에게 함께 전파한다")
    void propagatesUseFlagToDescendants() {
        SysMenu root = SysMenu.created(null, "ROOT", 1);
        SysMenu child = SysMenu.created("ROOT", "CHILD", 1);
        SysMenu grandchild = leaf("GRAND", "/grand");
        grandchild.moveTo("CHILD", 1);
        when(menus.findById("ROOT")).thenReturn(Optional.of(root));
        when(menus.findAll()).thenReturn(List.of(root, child, grandchild));

        service.saveNode("ROOT", null, "folder", false);

        assertThat(root.getUseYn()).isFalse();
        assertThat(child.getUseYn()).isFalse();
        assertThat(grandchild.getUseYn()).isFalse();
    }

    @Test
    @DisplayName("유효한 리프의 URL과 아이콘 변경은 실제 메뉴 속성에 반영한다")
    void updatesLeafUrlAndIcon() {
        SysMenu menu = leaf("EDIT", null);
        when(menus.findById("EDIT")).thenReturn(Optional.of(menu));
        when(menus.findAll()).thenReturn(List.of(menu));

        service.saveNode("EDIT", "/new-screen", "app", true);

        assertThat(menu.getMenuUrl()).isEqualTo("/new-screen");
        assertThat(menu.getIconCd()).isEqualTo("app");
    }

    @Test
    @DisplayName("권한이 없는 리프는 URL을 비워 구조 노드로 되돌릴 수 있다")
    void clearsLeafUrlWhenNoAuthorityExists() {
        SysMenu menu = leaf("CLEAR", "/clear");
        when(menus.findById("CLEAR")).thenReturn(Optional.of(menu));
        when(menus.findAll()).thenReturn(List.of(menu));

        service.saveNode("CLEAR", null, null, true);

        assertThat(menu.getMenuUrl()).isNull();
    }

    @Test
    @DisplayName("없는 메뉴의 속성 변경은 404로 거부한다")
    void rejectsUnknownMenu() {
        assertThatThrownBy(() -> service.saveNode("MISSING", "/missing", null, true))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("형제 최종 목록은 순서를 재작성하고 중복 항목은 거부한다")
    void savesSiblingOrderAndRejectsDuplicates() {
        SysMenu a = SysMenu.created(null, "A", 1);
        SysMenu b = SysMenu.created(null, "B", 2);
        when(menus.findAll()).thenReturn(List.of(a, b));
        when(menus.findById("A")).thenReturn(Optional.of(a));
        when(menus.findById("B")).thenReturn(Optional.of(b));

        service.saveTree(List.of(new MenuSiblingGroup(null, List.of("B", "A"))));
        assertThat(a.getSortNo()).isEqualTo(2);
        assertThat(b.getSortNo()).isEqualTo(1);

        assertThatThrownBy(() -> service.saveTree(List.of(new MenuSiblingGroup(null, List.of("A", "A")))))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.TREE_CHANGED);
    }

    @Test
    @DisplayName("자손 아래로의 이동은 순환을 만들기 전에 거부한다")
    void rejectsCycleWhenMovingUnderDescendant() {
        SysMenu parent = SysMenu.created(null, "PARENT", 1);
        SysMenu child = SysMenu.created("PARENT", "CHILD", 1);
        when(menus.findAll()).thenReturn(List.of(parent, child));
        when(menus.existsById("PARENT")).thenReturn(true);

        assertThatThrownBy(() -> service.saveTree(List.of(
                        new MenuSiblingGroup("CHILD", List.of("PARENT")),
                        new MenuSiblingGroup(null, List.of()))))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.CYCLE);
    }

    @Test
    @DisplayName("리프는 다섯 단까지 이동할 수 있고, 자손까지 여섯 단이 되면 거부한다")
    void validatesTreeMoveDepthIncludingSubtreeHeight() {
        SysMenu one = SysMenu.created(null, "ONE", 1);
        SysMenu two = SysMenu.created("ONE", "TWO", 1);
        SysMenu three = SysMenu.created("TWO", "THREE", 1);
        SysMenu four = SysMenu.created("THREE", "FOUR", 1);
        SysMenu leaf = SysMenu.created(null, "LEAF", 2);
        when(menus.findAll()).thenReturn(List.of(one, two, three, four, leaf));
        when(menus.existsById("LEAF")).thenReturn(true);
        when(menus.findById("LEAF")).thenReturn(Optional.of(leaf));
        when(menus.findById("ONE")).thenReturn(Optional.of(one));

        service.saveTree(List.of(
                new MenuSiblingGroup("FOUR", List.of("LEAF")),
                new MenuSiblingGroup(null, List.of("ONE"))));
        assertThat(leaf.getUpMenuCd()).isEqualTo("FOUR");

        SysMenu child = SysMenu.created("LEAF", "CHILD", 1);
        when(menus.findAll()).thenReturn(List.of(one, two, three, four, leaf, child));
        when(menus.existsById("LEAF")).thenReturn(true);
        assertThatThrownBy(() -> service.saveTree(List.of(
                        new MenuSiblingGroup("FOUR", List.of("LEAF")),
                        new MenuSiblingGroup(null, List.of("ONE")))))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.DEPTH_EXCEEDED);
    }

    @Test
    @DisplayName("삭제는 인가 사실이 남으면 막고 포인터만 남은 리프는 지운다")
    void deletesOnlyDeletableLeaf() {
        SysMenu menu = leaf("DELETE", "/delete");
        when(menus.findById("DELETE")).thenReturn(Optional.of(menu));
        when(menus.existsByUpMenuCd("DELETE")).thenReturn(false);

        SysMenuApiRepository menuApis = mock(SysMenuApiRepository.class);
        SysRoleMenuAuthRepository roleAuths = mock(SysRoleMenuAuthRepository.class);
        SysUserMenuAuthRepository userAuths = mock(SysUserMenuAuthRepository.class);
        when(menuApis.existsByMenuCd("DELETE")).thenReturn(false);
        when(roleAuths.existsByMenuCd("DELETE")).thenReturn(true, false);
        when(userAuths.existsByMenuCd("DELETE")).thenReturn(false);
        MenuService deletable = service(menuApis, roleAuths, userAuths);
        assertThatThrownBy(() -> deletable.deleteNode("DELETE"))
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(MenuErrorCode.NOT_DELETABLE);
        deletable.deleteNode("DELETE");
        verify(menus).delete(menu);
    }

    @Test
    @DisplayName("삭제는 메뉴를 가리키는 사용자 포인터와 이름 데이터를 함께 정리한다")
    void removesDependentPointersAndName() {
        SysMenu menu = leaf("REMOVE", "/remove");
        SysMenuApiRepository menuApis = mock(SysMenuApiRepository.class);
        SysRoleMenuAuthRepository roleAuths = mock(SysRoleMenuAuthRepository.class);
        SysUserMenuAuthRepository userAuths = mock(SysUserMenuAuthRepository.class);
        SysUserFavoriteRepository favorites = mock(SysUserFavoriteRepository.class);
        SysUserSearchCondRepository searchConds = mock(SysUserSearchCondRepository.class);
        SysUserGridPrefRepository gridPrefs = mock(SysUserGridPrefRepository.class);
        SysMessageKeyRepository keys = mock(SysMessageKeyRepository.class);
        SysMessageRepository values = mock(SysMessageRepository.class);
        when(menus.findById("REMOVE")).thenReturn(Optional.of(menu));
        when(menus.existsByUpMenuCd("REMOVE")).thenReturn(false);
        when(values.findByMsgKey(SysMenu.messageKey("REMOVE"))).thenReturn(List.of());
        MenuService deleting = new MenuService(new MenuTreeLockTrigger(), menus, menuApis, roleAuths, userAuths,
                favorites, searchConds, gridPrefs, keys, values, mock(SysCacheVersionRepository.class),
                mock(BusinessCalendar.class));

        deleting.deleteNode("REMOVE");

        verify(favorites).deleteByMenuCd("REMOVE");
        verify(searchConds).deleteByMenuCd("REMOVE");
        verify(gridPrefs).deleteByMenuCd("REMOVE");
        verify(values).deleteByMsgKey(SysMenu.messageKey("REMOVE"));
    }

    @Test
    @DisplayName("이름 값도 지우면 키와 메시지 캐시 버전을 함께 갱신한다")
    void removesNamedMenuAndBumpsMessageVersion() {
        SysMenu menu = leaf("NAMED", "/named");
        SysMessageKeyRepository keys = mock(SysMessageKeyRepository.class);
        SysMessageRepository values = mock(SysMessageRepository.class);
        SysCacheVersionRepository versions = mock(SysCacheVersionRepository.class);
        BusinessCalendar calendar = mock(BusinessCalendar.class);
        SysCacheVersion version = SysCacheVersion.started(SysCacheVersion.MESSAGE, Instant.EPOCH);
        String msgKey = SysMenu.messageKey("NAMED");
        when(menus.findById("NAMED")).thenReturn(Optional.of(menu));
        when(menus.existsByUpMenuCd("NAMED")).thenReturn(false);
        when(values.findByMsgKey(msgKey)).thenReturn(List.of(SysMessage.of(msgKey, "ko", "이름")));
        SysMessageKey key = SysMessageKey.dataKey(msgKey);
        when(keys.findById(msgKey)).thenReturn(Optional.of(key));
        when(versions.findById(SysCacheVersion.MESSAGE)).thenReturn(Optional.of(version));
        when(calendar.now()).thenReturn(Instant.parse("2026-09-12T00:00:00Z"));
        MenuService deleting = new MenuService(new MenuTreeLockTrigger(), menus, mock(SysMenuApiRepository.class),
                mock(SysRoleMenuAuthRepository.class), mock(SysUserMenuAuthRepository.class),
                mock(SysUserFavoriteRepository.class), mock(SysUserSearchCondRepository.class),
                mock(SysUserGridPrefRepository.class), keys, values, versions, calendar);

        deleting.deleteNode("NAMED");

        verify(keys).delete(key);
        assertThat(version.getVersion()).isEqualTo(2L);
    }

    private MenuService service(SysRoleMenuAuthRepository roles) {
        return service(mock(SysMenuApiRepository.class), roles, mock(SysUserMenuAuthRepository.class));
    }

    private MenuService service(
            SysMenuApiRepository menuApis,
            SysRoleMenuAuthRepository roles,
            SysUserMenuAuthRepository users) {
        return new MenuService(new MenuTreeLockTrigger(), menus, menuApis, roles, users,
                mock(SysUserFavoriteRepository.class), mock(SysUserSearchCondRepository.class),
                mock(SysUserGridPrefRepository.class), mock(SysMessageKeyRepository.class),
                mock(SysMessageRepository.class), mock(SysCacheVersionRepository.class), mock(BusinessCalendar.class));
    }

    private static SysMenu leaf(String code, String url) {
        SysMenu menu = SysMenu.created(null, code, 1);
        menu.changeUrl(url);
        return menu;
    }
}
