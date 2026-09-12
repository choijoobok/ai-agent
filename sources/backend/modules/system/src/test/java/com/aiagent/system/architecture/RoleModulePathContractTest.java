// @feat FEAT-502
package com.aiagent.system.architecture;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** ARCH-022·ARCH-026 — 역할·역할 권한 구현은 system 모듈이 소유한다. */
class RoleModulePathContractTest {

    @Test
    @DisplayName("SLICE-502 역할 구현과 전용 요청 DTO는 system 패키지에만 존재한다")
    void roleImplementationLivesOnlyInSystemModule() {
        assertPresent("com.aiagent.system.domain.role.RoleService");
        assertPresent("com.aiagent.system.domain.role.RoleAuthService");
        assertPresent("com.aiagent.system.domain.role.RoleQueryService");
        assertPresent("com.aiagent.system.api.role.request.RoleSaveRequest");
        assertPresent("com.aiagent.system.api.role.request.RoleAuthSaveRequest");
        assertPresent("com.aiagent.system.api.role.request.RoleMenuTreeRequest");

        assertMissing("com.aiagent.domain.authz.role.RoleService");
        assertMissing("com.aiagent.domain.authz.role.RoleAuthService");
        assertMissing("com.aiagent.domain.authz.role.RoleQueryService");
        assertMissing("com.aiagent.api.role.request.RoleSaveRequest");
        assertMissing("com.aiagent.api.role.request.RoleAuthSaveRequest");
        assertMissing("com.aiagent.api.role.request.RoleMenuTreeRequest");
    }

    private static void assertPresent(String className) {
        assertThatCode(() -> Class.forName(className)).doesNotThrowAnyException();
    }

    private static void assertMissing(String className) {
        assertThatThrownBy(() -> Class.forName(className))
                .isInstanceOf(ClassNotFoundException.class);
    }
}
