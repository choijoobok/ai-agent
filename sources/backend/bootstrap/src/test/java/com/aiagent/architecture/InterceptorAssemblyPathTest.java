// @feat FEAT-503
package com.aiagent.architecture;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** ARCH-026 — 실행 조립은 bootstrap, 실패 폐쇄 판정은 system이 소유한다. */
class InterceptorAssemblyPathTest {

    @Test
    @DisplayName("인터셉터 조립은 bootstrap에만 있고 api에는 남지 않는다")
    void interceptorAssemblyLivesOnlyInBootstrap() {
        assertThatCode(() -> Class.forName("com.aiagent.bootstrap.config.InterceptorConfig"))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> Class.forName("com.aiagent.api.config.InterceptorConfig"))
                .isInstanceOf(ClassNotFoundException.class);
    }
}
