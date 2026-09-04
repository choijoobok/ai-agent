package com.aiagent.domain.authz;

import com.aiagent.domain.authz.entity.SysRole;
import com.aiagent.domain.authz.entity.SysUserMenuAuth;
import com.aiagent.domain.authz.entity.SysUserRole;
import java.lang.reflect.Field;
import java.time.LocalDate;

/**
 * 부여 행을 테스트에서 조립한다 — {@link SysMenuFixture} 와 같은 이유다.
 *
 * <p>이 셋은 <b>생성자가 없다</b>. 부여를 만드는 화면(AUTHZ-05·07)이 아직 없어 엔티티에
 * 쓰기 경로를 열지 않았기 때문이며, 그 화면이 오면 여기가 아니라 엔티티에 생성자가 생긴다.
 */
public final class SysGrantFixture {

    private SysGrantFixture() {}

    public static SysRole role(String roleId, boolean useYn) {
        SysRole role = instantiate(SysRole.class);
        set(role, SysRole.class, "roleId", roleId);
        set(role, SysRole.class, "roleNm", roleId + " 역할");
        set(role, SysRole.class, "roleDesc", null);
        set(role, SysRole.class, "useYn", useYn);
        return role;
    }

    /** 기간은 NULL 을 허용한다 — 무기한 부여가 정상이다(42 §3.1). */
    public static SysUserRole userRole(String userId, String roleId, LocalDate from, LocalDate to) {
        SysUserRole grant = instantiate(SysUserRole.class);
        set(grant, SysUserRole.class, "userId", userId);
        set(grant, SysUserRole.class, "roleId", roleId);
        set(grant, SysUserRole.class, "validFromDt", from);
        set(grant, SysUserRole.class, "validToDt", to);
        return grant;
    }

    /** 개인 예외는 기간도 사유도 필수다 — 마찰이 있어야 한다(42 §6). */
    public static SysUserMenuAuth personalGrant(
            String userId, String menuCd, ActionType action, LocalDate from, LocalDate to) {
        SysUserMenuAuth grant = instantiate(SysUserMenuAuth.class);
        set(grant, SysUserMenuAuth.class, "userId", userId);
        set(grant, SysUserMenuAuth.class, "menuCd", menuCd);
        set(grant, SysUserMenuAuth.class, "actionCd", action);
        set(grant, SysUserMenuAuth.class, "validFromDt", from);
        set(grant, SysUserMenuAuth.class, "validToDt", to);
        set(grant, SysUserMenuAuth.class, "grantRsn", "TF 지원");
        return grant;
    }

    private static <T> T instantiate(Class<T> type) {
        try {
            var constructor = type.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void set(Object target, Class<?> owner, String name, Object value) {
        try {
            Field field = owner.getDeclaredField(name);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
