// @feat FEAT-501
package com.aiagent.api.auth.check;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiagent.domain.auth.LoginResultCode;
import com.aiagent.domain.authz.EffectiveAuthority;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.service.AllowedIpService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AllowedIpCheckContractTest {

    @Test
    @DisplayName("TC-5011 허용 대역이 없거나 현재 IP를 포함하면 로그인 후처리를 통과한다")
    void unrestrictedOrMatchingAddressPasses() {
        AllowedIpService allowedIps = mock(AllowedIpService.class);
        when(allowedIps.isAllowed("kim", "10.0.0.8")).thenReturn(true);

        assertThat(new AllowedIpCheck(allowedIps).check(candidate("10.0.0.8"))).isEmpty();
    }

    @Test
    @DisplayName("TC-5013 허용 대역 밖 IP는 FAIL_IP로 세션 수립 전에 거부한다")
    void addressOutsideAllowedRangesIsRejected() {
        AllowedIpService allowedIps = mock(AllowedIpService.class);
        when(allowedIps.isAllowed("kim", "10.0.1.8")).thenReturn(false);

        assertThat(new AllowedIpCheck(allowedIps).check(candidate("10.0.1.8")))
                .contains(LoginResultCode.FAIL_IP);
    }

    private static LoginCandidate candidate(String clientIp) {
        SysUser user = mock(SysUser.class);
        when(user.getUserId()).thenReturn("kim");
        return new LoginCandidate(user, () -> mock(EffectiveAuthority.class), clientIp);
    }
}
