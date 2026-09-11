// @feat FEAT-501
package com.aiagent.system.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

class AuthEndpointContractTest {

    @Test
    @DisplayName("TC-5011 로그인 공개 계약은 system 정식 경로 하나만 사용한다")
    void loginUsesOnlyTheSystemCanonicalPath() throws Exception {
        assertPost("login", "/api/public/system/auth/login");
    }

    @Test
    @DisplayName("TC-5013 인증 경로는 public·common system 경계 안에만 등록된다")
    void authEndpointsUseTheSystemBoundary() throws Exception {
        assertGet("getPasswordPolicy", "/api/public/system/auth/getPasswordPolicy");
        assertPost("sendResetCode", "/api/public/system/auth/sendResetCode");
        assertPost("verifyResetCode", "/api/public/system/auth/verifyResetCode");
        assertPost("saveResetPassword", "/api/public/system/auth/saveResetPassword");
        assertGet("me", "/api/common/system/auth/getMe");
        assertPost("heartbeat", "/api/common/system/auth/heartbeat");
        assertPost("changePassword", "/api/common/system/auth/changePassword");
        assertPost("logout", "/api/common/system/auth/logout");
    }

    private static void assertPost(String methodName, String expected) throws Exception {
        Method method = find(methodName);
        assertThat(method.getAnnotation(PostMapping.class).value()).containsExactly(expected);
    }

    private static void assertGet(String methodName, String expected) throws Exception {
        Method method = find(methodName);
        assertThat(method.getAnnotation(GetMapping.class).value()).containsExactly(expected);
    }

    private static Method find(String methodName) {
        return java.util.Arrays.stream(AuthController.class.getDeclaredMethods())
                .filter(method -> method.getName().equals(methodName))
                .findFirst()
                .orElseThrow();
    }
}
