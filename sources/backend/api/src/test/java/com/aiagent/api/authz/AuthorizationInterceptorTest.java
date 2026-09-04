package com.aiagent.api.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.api.auth.SessionKeys;
import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.ApiAuthorityFact;
import com.aiagent.domain.authz.EffectiveAuthority;
import com.aiagent.domain.authz.MenuAction;
import com.aiagent.domain.authz.service.ApiAuthorityRegistry;
import com.aiagent.domain.authz.service.EffectiveAuthorityService;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.service.UserAccountService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.AuthLoginProps;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 인가 판정 — backend/security.md. <b>여기서 검사하는 것은 "무엇이 막히는가" 다.</b>
 *
 * <p>DB 를 띄우지 않는다. 판정의 입력은 <b>기동 시 적재된 맵</b>과 <b>세션의 유효 권한</b>
 * 둘뿐이고 그 둘을 손으로 만들 수 있기 때문이다 — 그것이 <i>요청당 추가 쿼리 0</i> 설계의
 * 부수 효과다. 4벤더 통합 검증은 그 위층이다(backend/persistence.md).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthorizationInterceptorTest {

    private static final String USER = "kim";
    private static final String ORDER_LIST = "/api/service/order/getList";

    @Mock private ApiAuthorityRegistry registry;
    @Mock private EffectiveAuthorityService authorities;
    @Mock private UserAccountService userAccounts;
    @Mock private ConfigLookup configs;

    private AuthorizationInterceptor interceptor;
    private MockHttpSession session;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        Clock fixed = Clock.fixed(Instant.parse("2026-08-29T01:00:00Z"), ZoneId.of("Asia/Seoul"));
        interceptor = new AuthorizationInterceptor(
                registry, authorities, userAccounts, configs,
                new BusinessCalendar("Asia/Seoul", fixed));

        when(configs.get(AuthLoginProps.class))
                .thenReturn(new AuthLoginProps(5, 30, true));
        when(userAccounts.find(anyString())).thenReturn(Optional.of(usableUser()));

        session = new MockHttpSession();
        response = new MockHttpServletResponse();
        authenticate();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // ── 경로 계층 ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("경로 프리픽스가 정책을 정한다")
    class Layers {

        @Test
        @DisplayName("public 은 판정 없이 지나간다 — 세션도 요구하지 않는다")
        void publicPassesWithoutSession() {
            SecurityContextHolder.clearContext();
            assertThat(interceptor.preHandle(get("/api/public/auth/login", null), response, null))
                    .isTrue();
        }

        @Test
        @DisplayName("정적 리소스는 이 판정의 대상이 아니다 — 보호 대상은 화면이 아니라 데이터다")
        void staticResourcesArePassedThrough() {
            SecurityContextHolder.clearContext();
            assertThat(interceptor.preHandle(get("/assets/index-abc123.js", null), response, null))
                    .isTrue();
        }

        @Test
        @DisplayName("common 은 인증만 확인한다 — 권한이 공집합이어도 통과한다")
        void commonRequiresAuthenticationOnly() {
            givenAuthority();

            assertThat(interceptor.preHandle(get("/api/common/code/getList", session), response, null))
                    .isTrue();
            verify(registry, never()).find(anyString());
        }

        @Test
        @DisplayName("세 프리픽스 밖의 /api/** 는 무조건 403 — 미분류가 fail-closed 다")
        void unclassifiedIsDenied() {
            givenAuthority(new MenuAction("ORDER", ActionType.READ));

            assertDenied(get("/api/order/getList", session), AuthzErrorCode.UNCLASSIFIED);
        }

        @Test
        @DisplayName("인증이 없으면 401 이다 — Security 설정이 바뀌어도 조용히 열리지 않는다")
        void missingAuthenticationIsUnauthenticated() {
            SecurityContextHolder.clearContext();

            assertThatThrownBy(() -> interceptor.preHandle(get(ORDER_LIST, session), response, null))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(CommonErrorCode.UNAUTHENTICATED);
        }
    }

    // ── 업무 API 판정 ────────────────────────────────────────────────────

    @Nested
    @DisplayName("업무 API — 403 이 되는 세 가지를 구분한다")
    class ServiceApi {

        @Test
        @DisplayName("SYS_API 미등록 — 고치는 곳은 API 마스터 시드다")
        void notRegistered() {
            givenAuthority(new MenuAction("ORDER", ActionType.READ));
            when(registry.find(ORDER_LIST)).thenReturn(Optional.empty());

            assertDenied(get(ORDER_LIST, session), AuthzErrorCode.NOT_REGISTERED);
        }

        @Test
        @DisplayName("매핑 0건 — 등록됐으나 아무도 권한을 가질 수 없다")
        void notMapped() {
            givenAuthority(new MenuAction("ORDER", ActionType.READ));
            givenFact(ActionType.READ);

            assertDenied(get(ORDER_LIST, session), AuthzErrorCode.NOT_MAPPED);
        }

        @Test
        @DisplayName("매핑은 있으나 유효 권한에 쌍이 없다 — API 는 정상이고 사람에게 권한이 없다")
        void noAuthority() {
            givenAuthority(new MenuAction("ORDER", ActionType.SAVE));
            givenFact(ActionType.READ, "ORDER");

            assertDenied(get(ORDER_LIST, session), AuthzErrorCode.NO_AUTHORITY);
        }

        @Test
        @DisplayName("쌍이 맞으면 통과한다")
        void allowed() {
            givenAuthority(new MenuAction("ORDER", ActionType.READ));
            givenFact(ActionType.READ, "ORDER");

            assertThat(interceptor.preHandle(get(ORDER_LIST, session), response, null)).isTrue();
        }

        @Test
        @DisplayName("여러 메뉴에 매핑된 API 는 하나라도 있으면 통과한다 — OR 이다")
        void anyMappedMenuIsEnough() {
            givenAuthority(new MenuAction("ORDER_STAT", ActionType.READ));
            givenFact(ActionType.READ, "ORDER", "ORDER_STAT");

            assertThat(interceptor.preHandle(get(ORDER_LIST, session), response, null)).isTrue();
        }

        @Test
        @DisplayName("쿼리스트링은 매칭에 참여하지 않는다")
        void queryStringIsIgnored() {
            givenAuthority(new MenuAction("ORDER", ActionType.READ));
            givenFact(ActionType.READ, "ORDER");

            MockHttpServletRequest request = get(ORDER_LIST, session);
            request.setQueryString("page=2&size=50");

            assertThat(interceptor.preHandle(request, response, null)).isTrue();
        }
    }

    // ── 제한 세션 (체인 #5) ──────────────────────────────────────────────

    @Nested
    @DisplayName("제한 세션 — 차단이 아니라 유도다")
    class RestrictedSession {

        @BeforeEach
        void restrict() {
            session.setAttribute(SessionKeys.PASSWORD_CHANGE_REQUIRED, Boolean.TRUE);
        }

        @Test
        @DisplayName("권한이 있어도 막힌다 — 인가 판정보다 앞이다")
        void blocksEvenWithAuthority() {
            givenAuthority(new MenuAction("ORDER", ActionType.READ));
            givenFact(ActionType.READ, "ORDER");

            assertDenied(get(ORDER_LIST, session), AuthzErrorCode.PASSWORD_CHANGE_REQUIRED);
        }

        @Test
        @DisplayName("공통 API 도 막힌다 — 인증만으로 통과하는 층이 아니다")
        void blocksCommonToo() {
            givenAuthority();
            assertDenied(get("/api/common/code/getList", session), AuthzErrorCode.PASSWORD_CHANGE_REQUIRED);
        }

        @Test
        @DisplayName("로그아웃은 열려 있다 — 막다른 세션을 만들지 않는다")
        void logoutStaysOpen() {
            givenAuthority();
            assertThat(interceptor.preHandle(get("/api/common/auth/logout", session), response, null))
                    .isTrue();
        }
    }

    // ── 캐시 ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("세션 캐시 — 신호가 둘이고 함께 본다")
    class Cache {

        @Test
        @DisplayName("신선하면 재계산하지 않는다 — 요청당 추가 쿼리 0")
        void freshCacheIsReused() {
            givenAuthority(new MenuAction("ORDER", ActionType.READ));
            givenFact(ActionType.READ, "ORDER");

            interceptor.preHandle(get(ORDER_LIST, session), response, null);

            verify(authorities, never()).calculate(anyString());
        }

        @Test
        @DisplayName("authzDirty 가 서 있으면 다시 계산하고 플래그를 내린다")
        void dirtyFlagTriggersRecalculation() {
            givenAuthority(new MenuAction("ORDER", ActionType.SAVE));
            AuthzSession.markDirty(session);
            givenRecalculated(new MenuAction("ORDER", ActionType.READ));
            givenFact(ActionType.READ, "ORDER");

            assertThat(interceptor.preHandle(get(ORDER_LIST, session), response, null)).isTrue();
            verify(authorities).calculate(USER);
            // 내리지 않으면 매 요청 다시 계산한다.
            assertThat(session.getAttribute(AuthzSession.DIRTY)).isNull();
        }

        @Test
        @DisplayName("날짜가 바뀌면 아무도 아무것도 바꾸지 않아도 다시 계산한다")
        void dateChangeTriggersRecalculation() {
            // 어제 계산된 캐시. 어제 만료된 부여가 여기 살아 있다.
            AuthzSession.write(
                    session,
                    new EffectiveAuthority(
                            Set.of(new MenuAction("ORDER", ActionType.READ)),
                            LocalDate.of(2026, 8, 28)));
            givenRecalculated();
            givenFact(ActionType.READ, "ORDER");

            assertDenied(get(ORDER_LIST, session), AuthzErrorCode.NO_AUTHORITY);
            verify(authorities).calculate(USER);
        }

        @Test
        @DisplayName("캐시가 아예 없으면 계산한다 — 세션 스토어 재기동 뒤가 그 경우다")
        void missingCacheIsCalculated() {
            givenRecalculated(new MenuAction("ORDER", ActionType.READ));
            givenFact(ActionType.READ, "ORDER");

            assertThat(interceptor.preHandle(get(ORDER_LIST, session), response, null)).isTrue();
        }
    }

    // ── 체인 #2~#4 세션 중 재검사 ────────────────────────────────────────

    @Nested
    @DisplayName("재계산과 같은 순간에 계정 상태를 다시 본다 (체인 #2~#4)")
    class AccountRecheck {

        @Test
        @DisplayName("비활성화된 계정은 세션이 끊긴다 — 403 이 아니라 401 이다")
        void disabledAccountLosesTheSession() {
            AuthzSession.markDirty(session);
            when(userAccounts.find(USER)).thenReturn(Optional.of(disabledUser()));

            assertThatThrownBy(() -> interceptor.preHandle(get(ORDER_LIST, session), response, null))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(CommonErrorCode.UNAUTHENTICATED);

            assertThat(session.isInvalid()).isTrue();
            verify(authorities, never()).calculate(anyString());
        }

        @Test
        @DisplayName("계정이 사라져도 같다 — 세션을 믿지 않는다")
        void deletedAccountLosesTheSession() {
            AuthzSession.markDirty(session);
            when(userAccounts.find(USER)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> interceptor.preHandle(get(ORDER_LIST, session), response, null))
                    .isInstanceOf(BusinessException.class);
            assertThat(session.isInvalid()).isTrue();
        }

        @Test
        @DisplayName("신선한 캐시에서는 재검사가 돌지 않는다 — 매 요청 계정을 조회하지 않는다")
        void freshCacheSkipsTheRecheck() {
            givenAuthority(new MenuAction("ORDER", ActionType.READ));
            givenFact(ActionType.READ, "ORDER");

            interceptor.preHandle(get(ORDER_LIST, session), response, null);

            verify(userAccounts, never()).find(anyString());
        }
    }

    // ── 픽스처 ──────────────────────────────────────────────────────────

    private void authenticate() {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(USER, null, java.util.List.of()));
    }

    private void givenAuthority(MenuAction... grants) {
        AuthzSession.write(session, new EffectiveAuthority(Set.of(grants), LocalDate.of(2026, 8, 29)));
    }

    private void givenRecalculated(MenuAction... grants) {
        when(authorities.calculate(USER))
                .thenReturn(new EffectiveAuthority(Set.of(grants), LocalDate.of(2026, 8, 29)));
    }

    private void givenFact(ActionType action, String... menuCds) {
        when(registry.find(ORDER_LIST))
                .thenReturn(Optional.of(new ApiAuthorityFact(ORDER_LIST, action, Set.of(menuCds))));
    }

    private static MockHttpServletRequest get(String path, MockHttpSession session) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        if (session != null) {
            request.setSession(session);
        }
        return request;
    }

    private void assertDenied(MockHttpServletRequest request, AuthzErrorCode expected) {
        assertThatThrownBy(() -> interceptor.preHandle(request, response, null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(expected);
    }

    private static SysUser usableUser() {
        return SysUser.builder().userId(USER).userNm("김").pwd("{noop}x").localeCd("ko").build();
    }

    private static SysUser disabledUser() {
        SysUser user = usableUser();
        setUseYn(user, false);
        return user;
    }

    private static void setUseYn(SysUser user, boolean value) {
        try {
            var field = SysUser.class.getDeclaredField("useYn");
            field.setAccessible(true);
            field.set(user, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
