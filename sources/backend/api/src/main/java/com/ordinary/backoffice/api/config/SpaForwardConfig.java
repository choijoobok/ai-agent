package com.ordinary.backoffice.api.config;

import java.io.IOException;
import java.time.Duration;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * SPA 라우팅 — 25 §3.
 *
 * <p>React Router 의 클라이언트 라우팅과 정적 리소스 처리가 충돌한다. {@code /login} 에서
 * <b>새로고침</b>하면 서버에 그런 파일이 없어 404 가 난다. 그래서 정적 파일이 아닌 GET 을
 * {@code index.html} 로 넘긴다.
 *
 * <p><b>{@code /api/**} 는 반드시 제외한다.</b> 넘기면 오타 난 API 경로가 200 + HTML 로
 * 응답하고, 프론트는 <i>"JSON 인 줄 알았는데 {@code <!doctype html>} 이 왔다"</i> 로 죽는다 —
 * 원인이 응답 어디에도 없다. 여기서 걸러 404 JSON 이 나가게 한다.
 */
@Configuration
public class SpaForwardConfig implements WebMvcConfigurer {

    private static final String INDEX = "/static/index.html";

    /** 여기로 온 요청은 SPA 로 넘기지 않는다 — 없으면 404 여야 한다. */
    private static final String[] NEVER_FORWARD = {"api/", "actuator/"};

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 해시 파일명이라 내용이 바뀌면 이름이 바뀐다 — 영구 캐시가 안전하다(25 §3).
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).immutable());

        // index.html 은 no-cache 다. 캐시되면 새 번들을 가리키는 스크립트 태그가 갱신되지 않아
        // 배포해도 옛 화면이 남는다.
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache())
                .resourceChain(true)
                .addResolver(new SpaFallbackResolver());
    }

    private static final class SpaFallbackResolver extends PathResourceResolver {

        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = location.createRelative(resourcePath);
            if (requested.exists() && requested.isReadable()) {
                return requested;
            }
            for (String prefix : NEVER_FORWARD) {
                if (resourcePath.startsWith(prefix)) {
                    return null;
                }
            }
            Resource index = new ClassPathResource(INDEX);
            // 프론트를 빼고 빌드하면(-PskipFrontend) index.html 이 없다. 그때는 404 가 맞다 —
            // 없는 파일을 있는 척하면 백엔드만 띄운 개발에서 원인을 찾기 어려워진다.
            return index.exists() ? index : null;
        }
    }
}
