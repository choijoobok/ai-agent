// @feat FEAT-503
package com.aiagent.bootstrap.config;

import com.aiagent.api.log.UserActionLogInterceptor;
import com.aiagent.system.api.authz.AuthorizationInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 인터셉터 등록 — backend/packages.md.
 *
 * <p><b>등록 순서가 규약이다.</b> 사용 이력 인터셉터({@code UserActionLogInterceptor})가
 * 인가 인터셉터보다 <b>앞</b>에 와야 한다. {@code preHandle} 이 거부해도 이미 {@code true} 를
 * 반환한 인터셉터의 {@code afterCompletion} 은 호출되므로, 앞에 두어야 403 이 사용 이력에
 * 남는다 — 뒤에 두면 <b>인가가 막은 요청이 통째로 사라진다</b>.
 *
 * <p><b>그 한 줄이 붙었다</b>(2026-08-30, 이력 슬라이스). 순서가 이 파일에서만 표현되므로
 * 두 줄의 자리를 바꾸면 403 이 조용히 이력에서 사라진다 — 그것을
 * {@code InterceptorRegistrationOrderTest} 가 지킨다.
 *
 * <p><b>{@code addPathPatterns("/api/**")} 로 좁히지 않는다.</b> 좁히면 패턴에 걸리지 않는
 * 새 경로가 <b>판정 없이 지나간다</b> — 인터셉터가 전부 받고 {@link
 * com.aiagent.api.authz.ApiLayer} 가 분류하는 편이 fail-closed 다.
 */
@Configuration
public class InterceptorConfig implements WebMvcConfigurer {

    private final UserActionLogInterceptor userActionLogInterceptor;
    private final AuthorizationInterceptor authorizationInterceptor;

    public InterceptorConfig(
            UserActionLogInterceptor userActionLogInterceptor,
            AuthorizationInterceptor authorizationInterceptor) {
        this.userActionLogInterceptor = userActionLogInterceptor;
        this.authorizationInterceptor = authorizationInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 이 두 줄의 순서가 규약이다 — 위엣것이 뒤로 가면 인가가 막은 요청이 통째로 사라진다.
        registry.addInterceptor(userActionLogInterceptor);
        registry.addInterceptor(authorizationInterceptor);
    }
}
