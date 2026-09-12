// @feat FEAT-501
package com.aiagent.system.architecture;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** ARCH-022·ARCH-026 — 완료된 인증 슬라이스의 구현은 system 모듈이 소유한다. */
class AuthModulePathContractTest {

    @Test
    @DisplayName("SLICE-501 인증 API와 IP 판정 구현은 system 패키지에만 존재한다")
    void authImplementationLivesOnlyInSystemModule() {
        assertPresent("com.aiagent.system.api.auth.LoginService");
        assertPresent("com.aiagent.system.api.auth.check.AllowedIpCheck");
        assertPresent("com.aiagent.system.domain.auth.AllowedIpService");

        assertMissing("com.aiagent.api.auth.LoginService");
        assertMissing("com.aiagent.api.auth.check.AllowedIpCheck");
        assertMissing("com.aiagent.domain.user.service.AllowedIpService");
    }

    private static void assertPresent(String className) {
        assertThatCode(() -> Class.forName(className)).doesNotThrowAnyException();
    }

    private static void assertMissing(String className) {
        assertThatThrownBy(() -> Class.forName(className))
                .isInstanceOf(ClassNotFoundException.class);
    }
}
