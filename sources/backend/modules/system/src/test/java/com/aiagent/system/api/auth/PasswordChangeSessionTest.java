// @feat FEAT-501
package com.aiagent.system.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.aiagent.api.auth.SessionKeys;
import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.user.service.PasswordChangeService;
import com.aiagent.domain.user.service.UserErrorCode;
import com.aiagent.system.api.auth.request.PasswordChangeRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

/** TC-5016: 저장 결과와 서버 제한 세션 해제를 함께 검증한다. */
class PasswordChangeSessionTest {
    private final PasswordChangeService service = mock(PasswordChangeService.class);
    private final AuthController controller = new AuthController(
            null, null, null, null, service, null, null, null, null);

    @Test
    void successfulChangeClearsTheServerRestriction() {
        var request = restrictedRequest();
        controller.changePassword(new PasswordChangeRequest("admin", "NewPassw0rd!"), () -> "admin", request);
        verify(service).changePassword("admin", "admin", "NewPassw0rd!");
        assertThat(request.getSession().getAttribute(SessionKeys.PASSWORD_CHANGE_REQUIRED)).isNull();
    }

    @Test
    void failedChangeKeepsTheServerRestriction() {
        var request = restrictedRequest();
        doThrow(new BusinessException(UserErrorCode.PWD_MISMATCH))
                .when(service).changePassword("admin", "wrong", "NewPassw0rd!");
        assertThatThrownBy(() -> controller.changePassword(
                new PasswordChangeRequest("wrong", "NewPassw0rd!"), () -> "admin", request))
                .isInstanceOf(BusinessException.class);
        assertThat(request.getSession().getAttribute(SessionKeys.PASSWORD_CHANGE_REQUIRED)).isEqualTo(true);
    }

    private static MockHttpServletRequest restrictedRequest() {
        var request = new MockHttpServletRequest();
        request.getSession().setAttribute(SessionKeys.PASSWORD_CHANGE_REQUIRED, true);
        return request;
    }
}
