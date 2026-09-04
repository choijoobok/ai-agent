package com.ordinary.backoffice.api.config;

import com.ordinary.backoffice.api.auth.EvictionRecordingStrategy;
import com.ordinary.backoffice.api.error.ApiAuthenticationEntryPoint;
import com.ordinary.backoffice.api.error.ApiAccessDeniedHandler;
import com.ordinary.backoffice.domain.auth.service.LoginHistoryService;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.ConcurrentSessionProps;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.session.SessionRegistryImpl;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.session.ConcurrentSessionFilter;
import org.springframework.security.web.session.SessionInformationExpiredStrategy;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.security.SpringSessionBackedSessionRegistry;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;

/**
 * 인증·인가 필터 체인 — security-design.md §1 · §5 · §8.
 *
 * <p><b>세션 기반이다</b>(JWT 아님). 강제 로그아웃·동시 접속 제어·만료 예고가 요구사항에
 * 있고 그것들은 stateless 토큰으로는 별도 블랙리스트 저장소를 요구한다 — 결국 서버 상태가
 * 생긴다(security-design.md §1).
 *
 * <p><b>계층 마디 하나가 접근 정책을 정리한다</b>(security-design.md §4 · api-conventions.md §2.1) — {@code public} 하나가
 * {@code permitAll} 과 CSRF 예외를 함께 나타내므로 규칙이 흩어지지 않는다.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    /**
     * 보안 헤더의 CSP — security-design.md §8. <b>인라인을 여는 것은 {@code style-src} 하나이고,
     * {@code data:} 를 여는 것은 {@code img-src} 하나다.</b>
     *
     * <p><b>{@code default-src 'self'} 하나로는 화면이 뜨지 않았다</b>(2026-08-30 실측).
     * AntD 와 AG Grid 는 테마·폭·색을 <b>런타임에 인라인 스타일로</b> 넣으므로, 명시하지
     * 않은 {@code style-src} 가 {@code default-src} 로 폴백하면 <b>그 전부가 차단된다</b> —
     * 로그인 화면부터 스타일 없이 뜬다.
     *
     * <p><b>같은 폴백에 아이콘도 걸려 있었다</b>(2026-08-30, {@code CODE_MGMT} 확인 중).
     * AG Grid 는 자기 아이콘을 파일이 아니라 CSS 안의
     * {@code background-image: url("data:image/svg+xml,…")} 로 넣는데, 명시하지 않은
     * {@code img-src} 가 {@code default-src 'self'} 로 폴백하면 <b>{@code data:} 는
     * {@code 'self'} 가 아니므로 차단된다</b> — 판의 정렬 화살표·스피너 자리가 <b>조용히
     * 빈다</b>. 우리 아이콘({@code @ant-design/icons})은 DOM 의 {@code <svg>} 엘리먼트라
     * 애초에 이미지가 아니었고, 그래서 <b>일부만 안 보이는</b> 모양이 되어 판의 스타일로
     * 읽혔다.
     *
     * <p><b>개발에서는 둘 다 보이지 않는다.</b> Vite 가 {@code index.html} 을 주고
     * {@code /api} 만 프록시하므로 이 헤더를 만나지 않는다(25 §4) — <b>단일 JAR 배포에서만</b>
     * 나타나고 그래서 배포 뒤에 처음 발견된다.
     *
     * <h2>nonce 를 고르지 않았다</h2>
     *
     * AntD 의 {@code ConfigProvider csp={{nonce}}} 와 AG Grid 의 nonce 를 함께 쓰면
     * {@code 'unsafe-inline'} 없이 닫을 수 있다. 대가는 <b>요청마다 nonce 를 만들어
     * {@code index.html} 에 심는 것</b>이며, 그러려면 지금 <b>정적 리소스로 나가는 그
     * 파일</b>을 서버가 렌더해야 한다 — 캐시 정책과 서빙 경로가 함께 바뀐다(ADR-0001 의
     * 단일 JAR 배포가 전제한 모양이 아니다). <b>{@code img-src} 에는 해당하지 않는다</b> —
     * nonce 는 인라인 스크립트·스타일의 장치이고 {@code data:} 이미지에는 걸 자리가 없다.
     *
     * <h2>여는 자리를 지시자마다 최소로 둔다</h2>
     *
     * <table>
     *   <tr><td>{@code style-src}</td><td>{@code 'unsafe-inline'}</td>
     *       <td>판이 런타임에 넣는 스타일. 할 수 있는 일은 <b>시각적 변조</b>에 그친다</td></tr>
     *   <tr><td>{@code img-src}</td><td>{@code data:}</td>
     *       <td>판이 CSS 로 넣는 아이콘. <b>이미지로 스크립트가 실행되지 않는다</b> —
     *           SVG 안의 스크립트는 {@code <img>}·{@code background-image} 문맥에서 돌지 않는다</td></tr>
     *   <tr><td>{@code script-src}</td><td><b>열지 않는다</b></td>
     *       <td>{@code default-src} 를 그대로 따라 <b>인라인 스크립트가 막힌다</b> —
     *           XSS 의 주된 경로가 그쪽이다</td></tr>
     * </table>
     *
     * <p><b>{@code data:} 를 {@code default-src} 에 넣지 않는 것이 요점이다.</b> 거기 넣으면
     * {@code script-src} 까지 함께 열려 <b>{@code data:text/javascript} 가 실행 가능해진다</b> —
     * 고치려던 것은 아이콘 하나인데 여는 것은 XSS 의 주된 경로가 된다.
     */
    private static final String CSP =
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";



    /**
     * {@code DelegatingPasswordEncoder} 다 — 해시에 {@code {bcrypt}} 접두가 붙는다.
     *
     * <p>알고리즘을 코드에 고정하지 않으므로 나중에 Argon2id 로 옮길 때 <b>기존 해시를
     * 그대로 둔 채</b> 새로 저장되는 것만 바뀐다(security-design.md §6).
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    /**
     * <b>{@code hideUserNotFoundExceptions} 를 끈다.</b> 기본값(켬)이면 없는 ID 도
     * {@code BadCredentialsException} 이 되어 로그인 이력에서 {@code FAIL_NO_USER} 와
     * {@code FAIL_PWD} 를 가를 수 없다 — 이력의 목적(진단)과 응답의 목적(정보 노출 최소화)이
     * 다르므로 이 비대칭은 의도된 것이다(45 §5.2).
     *
     * <p><b>응답에서 둘을 합치는 책임은 {@code LoginService} 가 진다</b> — 프레임워크가
     * 가려 주는 것에 기대지 않는다.
     */
    @Bean
    public AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        provider.setHideUserNotFoundExceptions(false);
        return new ProviderManager(provider);
    }

    /**
     * 세션 레지스트리 — security-design.md §4-1.
     *
     * <p><b>기본 {@code SessionRegistryImpl} 을 쓸 수 없다.</b> 그것은 <b>JVM 힙의 맵</b>이라
     * 노드가 둘이면 각자 다른 목록을 보고, 계정당 1세션이 <b>노드당 1세션</b>이 된다.
     * {@code SpringSessionBackedSessionRegistry} 는 세션 스토어를 직접 물으므로 JDBC·Redis
     * 양쪽에서 같은 답을 낸다.
     *
     * <p><b>{@code @ConditionalOnBean} 을 쓰지 않는다.</b> 세션 저장소는 <b>자동설정</b>이
     * 만들고 그것은 사용자 설정보다 <b>뒤</b>에 평가되므로, 여기서 조건을 걸면 스토어가
     * 있어도 언제나 거짓이 된다 — 조용히 꺼지는 게이트가 된다. 그래서 {@code ObjectProvider}
     * 로 <b>실행 시점에</b> 묻는다.
     *
     * <p>스토어가 {@code none}(서블릿 컨테이너 세션)이면 인덱스가 없으므로 빈 레지스트리로
     * 떨어진다 — 동작은 "제한 없음" 이고 그 사실은 {@code sessionAuthenticationStrategy} 가
     * 경고로 남긴다.
     *
     * <h2>스토어가 있는데 인덱스가 없으면 <b>기동을 실패시킨다</b> (2026-08-30)</h2>
     *
     * <p><b>폴백을 그 경우까지 열어 두면 안 되는 것이었다.</b> Spring Session 의 Redis 구현은
     * 둘이고 <b>인덱스를 가진 것은 하나</b>다.
     *
     * <table><caption></caption>
     * <tr><td>{@code RedisSessionRepository}</td><td>{@link FindByIndexNameSessionRepository} <b>미구현</b></td></tr>
     * <tr><td>{@code RedisIndexedSessionRepository}</td><td>구현</td></tr>
     * <tr><td>{@code JdbcIndexedSessionRepository}</td><td>구현</td></tr>
     * </table>
     *
     * <p>그리고 {@code spring.session.data.redis.repository-type} 의 <b>기본값이
     * {@code default}</b> — 인덱스 없는 쪽이다. 즉 <b>스토어를 Redis 로 바꾸기만 하면</b>
     * 이 메서드가 조용히 {@link SessionRegistryImpl} 로 떨어지고, 동시 접속 제어가
     * <b>다중화에서 무력해진다</b>(security-design.md §4-1). {@code warn} 한 줄이 남지만 그것도 제어를
     * <i>켜 두었을 때만</i> 찍힌다 — 꺼 둔 배포에는 아무 신호가 없다.
     *
     * <p><b>가르는 기준은 벤더가 아니라 "스토어가 있는가" 다.</b> 스토어 자체가 없으면
     * ({@code none}) 컨테이너 세션이며 그것은 <b>선택된 동작</b>이다. 스토어를 골라 놓고
     * 인덱스가 없는 것은 <b>고르다 만 상태</b>이고, 그 구분이 벤더 이름을 몰라도 성립하므로
     * 다음에 어떤 스토어가 와도 같은 문이 지킨다.
     *
     * <p>ADR-0026 §3 이 나쁜 설정값에 대해 내린 것과 <b>같은 판단</b>이다 —
     * <i>"yml 로 조용히 폴백하지 않는다"</i>. 조용한 폴백이 만드는 것은 <b>제어가 걸려
     * 있다고 믿는 무제한 배포</b>이며, 그것은 배포자가 보아야 할 실패다.
     */
    @Bean
    public SessionRegistry sessionRegistry(
            ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> indexed,
            ObjectProvider<SessionRepository<? extends Session>> stores) {

        FindByIndexNameSessionRepository<? extends Session> repository = indexed.getIfAvailable();
        if (repository != null) {
            return new SpringSessionBackedSessionRegistry<>(repository);
        }
        SessionRepository<? extends Session> store = stores.getIfAvailable();
        if (store != null) {
            throw new IllegalStateException(
                    "세션 스토어 " + store.getClass().getName() + " 에 principal 인덱스가 없다 —"
                            + " 동시 접속 제어와 활성 세션 조회가 다중화에서 동작하지 않는다."
                            + " Redis 라면 spring.session.data.redis.repository-type: indexed 를 둔다"
                            + " (기본값이 default 이며 그것은 인덱스가 없다). security-design.md §4-1 · ADR-0002");
        }
        // 스토어가 아예 없다 — 서블릿 컨테이너 세션이며 "제한 없음" 이 선택된 동작이다.
        return new SessionRegistryImpl();
    }

    /**
     * 로그인 시 세션 ID 를 바꾼다(세션 고정 공격 방어) — 그리고 <b>그 앞에</b> 동시 접속
     * 제어가 붙는다(security-design.md §4-1).
     *
     * <p><b>순서가 규약이다.</b> 밀어내기가 먼저 일어나고 세션 ID 교체가 뒤다 — 뒤바뀌면
     * {@code ConcurrentSessionControl} 이 <b>방금 만든 새 세션</b>을 기존 세션으로 세어
     * 자기가 자기를 밀어낸다.
     *
     * <p><b>{@code RegisterSessionAuthenticationStrategy} 를 넣지 않는다.</b> 등록은 Spring
     * Session 이 principal 인덱스로 이미 하고 있으며, {@code SpringSessionBackedSessionRegistry}
     * 의 등록 메서드는 <b>의도적으로 아무 일도 하지 않는다</b> — 넣으면 하는 일 없는 부품이
     * 하나 늘고 <i>"등록은 어디서 되나"</i> 가 두 곳이 된다.
     */
    @Bean
    public SessionAuthenticationStrategy sessionAuthenticationStrategy(
            SessionRegistry sessionRegistry, LoginHistoryService loginHistoryService, ConfigLookup configs) {

        List<SessionAuthenticationStrategy> chain = new ArrayList<>();
        ConcurrentSessionProps props = configs.get(ConcurrentSessionProps.class);

        if (props.enabled()) {
            if (sessionRegistry instanceof SessionRegistryImpl) {
                // 켜 두었는데 세지 못하는 상태다. 조용히 두면 "제한이 걸려 있다" 고 믿는
                // 배포가 실제로는 무제한이 된다.
                log.warn("동시 접속 제어를 켰으나 세션 스토어가 principal 인덱스를 제공하지 않는다"
                        + " — spring.session 스토어를 jdbc 또는 redis 로 둔다(security-design.md §4-1)");
            }
            EvictionRecordingStrategy concurrent =
                    new EvictionRecordingStrategy(sessionRegistry, loginHistoryService);
            concurrent.setMaximumSessions(props.maxSessions());
            concurrent.setExceptionIfMaximumExceeded(props.preventLogin());
            chain.add(concurrent);
        }

        chain.add(new ChangeSessionIdAuthenticationStrategy());
        return new CompositeSessionAuthenticationStrategy(chain);
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ApiAuthenticationEntryPoint authenticationEntryPoint,
            ApiAccessDeniedHandler accessDeniedHandler,
            SecurityContextRepository securityContextRepository,
            SessionRegistry sessionRegistry,
            SessionInformationExpiredStrategy expiredStrategy)
            throws Exception {

        // 프론트가 XSRF-TOKEN 쿠키를 읽어 X-XSRF-TOKEN 헤더로 보낸다 — axios 기본 동작(security-design.md §5).
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        // null 이면 토큰을 지연 없이 즉시 해석한다. 기본(지연)이면 아무도 값을 읽지 않는 요청에서
        // 쿠키가 내려가지 않아, 로그인 직후 첫 쓰기 요청이 403 으로 튕긴다 — SPA 의 고전적 함정이다.
        csrfHandler.setCsrfRequestAttributeName(null);

        return http
                // 동일 오리진 배포다. 개발은 Vite 프록시로 우회한다(security-design.md §8 · 25 §4).
                .cors(cors -> cors.disable())
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler)
                        .ignoringRequestMatchers("/api/public/**"))
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                // 밀려난 세션을 읽어 끊는 자리. 없으면 expireNow() 가 표시만 남기고
                // 밀려난 사용자가 계속 일한다 — 제어가 조용히 무력해진다(security-design.md §4-1).
                .addFilterBefore(
                        new ConcurrentSessionFilter(sessionRegistry, expiredStrategy),
                        AuthorizationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/public/**").permitAll()
                        // 그 밖의 /api/** 는 인증을 요구한다. 메뉴×액션 판정은 여기가 아니라
                        // 인가 인터셉터의 몫이며(security-design.md §4 판정은 한 곳에서), 그것은 인가 슬라이스다.
                        .requestMatchers("/api/**").authenticated()
                        // 정적 리소스와 SPA 라우트. JS 청크는 막지 않는다 — 보호 대상은
                        // 화면(코드)이 아니라 데이터다(security-design.md §4).
                        .requestMatchers(HttpMethod.GET, "/", "/index.html", "/assets/**", "/favicon.ico")
                        .permitAll()
                        .anyRequest().permitAll())
                .exceptionHandling(handling -> handling
                        // 폼 로그인 리다이렉트가 아니라 401 JSON 이다 — 프론트가 재인증 모달을
                        // 띄운다(frontend-stack.md §9). 302 를 보내면 axios 가 로그인 HTML 을 데이터로 받는다.
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentSecurityPolicy(csp -> csp.policyDirectives(CSP))
                        .referrerPolicy(referrer -> referrer
                                .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.SAME_ORIGIN)))
                // 기본 로그인 폼·베이직 인증을 쓰지 않는다. 인증 진입점은 컨트롤러 하나다.
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .build();
    }
}
