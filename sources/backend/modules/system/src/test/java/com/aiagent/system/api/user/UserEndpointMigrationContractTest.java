// @feat FEAT-501
package com.aiagent.system.api.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.Method;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

class UserEndpointMigrationContractTest {

    private static final String USER = "com.aiagent.system.api.user.UserController";
    private static final String DETAIL = "com.aiagent.system.api.user.UserDetailController";

    @Test
    @DisplayName("TC-5015 사용자 관리 API는 system 정식 경로 하나만 사용한다")
    void userManagementUsesOnlyTheSystemPath() throws Exception {
        assertPost(USER, "/api/service/system/user", "getList", "/getList");
        assertPost(USER, "/api/service/system/user", "save", "/save");
        assertPost(DETAIL, "/api/service/system/user", "getIpList", "/getIpList");
        assertPost(DETAIL, "/api/service/system/user", "saveIp", "/saveIp");
        assertPost(DETAIL, "/api/service/system/user", "getSessionList", "/getSessionList");
        assertPost(DETAIL, "/api/service/system/user", "killSession", "/killSession");
        assertClassMissing("com.aiagent.api.user.UserController");
        assertClassMissing("com.aiagent.api.user.UserDetailController");
    }

    private static void assertPost(
            String className, String expectedBase, String methodName, String expectedPath)
            throws Exception {
        Class<?> type = Class.forName(className);
        assertThat(type.getAnnotation(RequestMapping.class).value()).containsExactly(expectedBase);
        Method method = java.util.Arrays.stream(type.getDeclaredMethods())
                .filter(candidate -> candidate.getName().equals(methodName))
                .findFirst()
                .orElseThrow();
        assertThat(method.getAnnotation(PostMapping.class).value()).containsExactly(expectedPath);
    }

    private static void assertClassMissing(String className) {
        assertThatThrownBy(() -> Class.forName(className))
                .isInstanceOf(ClassNotFoundException.class);
    }
}
