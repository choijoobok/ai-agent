// @feat FEAT-502
package com.aiagent.api.log;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.domain.log.entity.SysAccessLog;
import com.aiagent.domain.log.service.AccessLogService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.RequestCacheProps;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class UserActionLogInterceptorTest {

    private static final Instant NOW = Instant.parse("2026-09-12T00:00:00Z");

    private final AccessLogService accessLogs = mock(AccessLogService.class);
    private final RequestPayloadSerializer serializer = mock(RequestPayloadSerializer.class);
    private final ConfigLookup configs = mock(ConfigLookup.class);
    private final BusinessCalendar calendar = mock(BusinessCalendar.class);
    private final UserActionLogInterceptor interceptor =
            new UserActionLogInterceptor(accessLogs, serializer, configs, calendar);

    @BeforeEach
    void setUp() {
        when(configs.get(RequestCacheProps.class)).thenReturn(new RequestCacheProps(false, 1));
        when(calendar.now()).thenReturn(NOW);
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("kim", null, java.util.List.of()));
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void tc5023RoleAuthorityChangeIsRecordedAsOneGeneralAccessLog() {
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(200);

        interceptor.afterCompletion(roleAuthSave(), response, new Object(), null);

        ArgumentCaptor<SysAccessLog> recorded = ArgumentCaptor.forClass(SysAccessLog.class);
        verify(accessLogs).record(recorded.capture());
        assertThat(recorded.getValue())
                .extracting(
                        SysAccessLog::getUserId,
                        SysAccessLog::getMenuCd,
                        SysAccessLog::getRequestUri,
                        SysAccessLog::getHttpStat,
                        SysAccessLog::getCreDtm)
                .containsExactly("kim", "ROLE_AUTH_MGMT", "/api/service/system/roleAuth/save", (short) 200, NOW);
    }

    @Test
    void tc5026TwoRoleAuthoritySavesLeaveTwoGeneralAccessLogs() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        interceptor.afterCompletion(roleAuthSave(), response, new Object(), null);
        interceptor.afterCompletion(roleAuthSave(), response, new Object(), null);

        verify(accessLogs, times(2)).record(any(SysAccessLog.class));
    }

    private static MockHttpServletRequest roleAuthSave() {
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/api/service/system/roleAuth/save");
        request.addHeader("X-Menu-Code", "ROLE_AUTH_MGMT");
        return request;
    }
}
