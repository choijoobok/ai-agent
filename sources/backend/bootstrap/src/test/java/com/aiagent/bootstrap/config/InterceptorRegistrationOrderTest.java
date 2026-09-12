// @feat FEAT-503
package com.aiagent.bootstrap.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.api.log.UserActionLogInterceptor;
import com.aiagent.system.api.authz.AuthorizationInterceptor;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

/** ARCH-026 — 사용 이력이 인가보다 먼저 등록돼야 거부된 요청도 남는다. */
class InterceptorRegistrationOrderTest {

    @Test
    @DisplayName("TC-5031 사용 이력 인터셉터가 실패 폐쇄 인가 인터셉터보다 먼저 등록된다")
    void accessLogPrecedesAuthorization() {
        UserActionLogInterceptor accessLog = Mockito.mock(UserActionLogInterceptor.class);
        AuthorizationInterceptor authorization = Mockito.mock(AuthorizationInterceptor.class);
        InspectableInterceptorRegistry registry = new InspectableInterceptorRegistry();

        new InterceptorConfig(accessLog, authorization).addInterceptors(registry);

        assertThat(registry.interceptors()).containsExactly(accessLog, authorization);
    }

    private static final class InspectableInterceptorRegistry extends InterceptorRegistry {

        private List<Object> interceptors() {
            return getInterceptors();
        }
    }
}
