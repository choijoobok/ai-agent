package com.aiagent.domain.authz;

import com.aiagent.domain.authz.entity.SysMenu;
import java.lang.reflect.Field;

/**
 * 메뉴 행을 테스트에서 조립한다.
 *
 * <p><b>엔티티에 세터가 없다</b> — 시드와 저장 서비스만 값을 넣는 것이 규약이기 때문이다.
 * 테스트를 위해 그 규약을 깨는 대신 리플렉션으로 조립한다. 조립 방법이 두 테스트에 각자
 * 있으면 필드가 하나 늘 때 한쪽만 고치게 되므로 여기 하나로 둔다.
 */
public final class SysMenuFixture {

    private SysMenuFixture() {}

    /** 리프 — {@code MENU_URL} 이 있으므로 권한 대상이다. */
    public static SysMenu leaf(String menuCd, String upMenuCd, int sortNo) {
        return menu(menuCd, upMenuCd, "/" + menuCd.toLowerCase(), sortNo, true);
    }

    public static SysMenu disabledLeaf(String menuCd, String upMenuCd, int sortNo) {
        return menu(menuCd, upMenuCd, "/" + menuCd.toLowerCase(), sortNo, false);
    }

    /** 구조 노드 — {@code MENU_URL} 이 없다. URL 과 자식은 배타다(backend/security.md). */
    public static SysMenu folder(String menuCd, String upMenuCd, int sortNo) {
        return menu(menuCd, upMenuCd, null, sortNo, true);
    }

    public static SysMenu disabledFolder(String menuCd, String upMenuCd, int sortNo) {
        return menu(menuCd, upMenuCd, null, sortNo, false);
    }

    public static SysMenu menu(
            String menuCd, String upMenuCd, String menuUrl, int sortNo, boolean useYn) {
        try {
            var constructor = SysMenu.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            SysMenu instance = constructor.newInstance();
            set(instance, "menuCd", menuCd);
            set(instance, "upMenuCd", upMenuCd);
            set(instance, "menuNm", "menu." + menuCd);
            set(instance, "menuUrl", menuUrl);
            set(instance, "sortNo", sortNo);
            set(instance, "useYn", useYn);
            return instance;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void set(SysMenu target, String fieldName, Object value)
            throws ReflectiveOperationException {
        Field field = SysMenu.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
