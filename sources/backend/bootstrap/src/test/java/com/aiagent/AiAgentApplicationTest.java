// @feat FEAT-503
package com.aiagent;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class AiAgentApplicationTest {

    @Test
    @DisplayName("TC-5036 활성 프로파일이 없으면 데이터소스 구성 전에 기동을 거부한다")
    void activeProfileIsRequired() {
        assertThatThrownBy(() -> AiAgentApplication.requireActiveProfile(new MockEnvironment()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("활성 프로파일");

        var namedDefault = new MockEnvironment();
        namedDefault.setActiveProfiles("default");
        assertThatThrownBy(() -> AiAgentApplication.requireActiveProfile(namedDefault))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("활성 프로파일");
    }

    @Test
    @DisplayName("TC-5036 명시한 local과 배포 프로파일은 기동을 허용한다")
    void explicitProfileIsAllowed() {
        var local = new MockEnvironment();
        local.setActiveProfiles("local");
        var production = new MockEnvironment();
        production.setActiveProfiles("prod");

        assertThatCode(() -> AiAgentApplication.requireActiveProfile(local)).doesNotThrowAnyException();
        assertThatCode(() -> AiAgentApplication.requireActiveProfile(production)).doesNotThrowAnyException();
    }
}
