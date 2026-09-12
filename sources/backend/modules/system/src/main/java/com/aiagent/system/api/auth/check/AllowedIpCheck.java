// @feat FEAT-501
package com.aiagent.system.api.auth.check;

import com.aiagent.domain.auth.LoginResultCode;
import com.aiagent.system.domain.auth.AllowedIpService;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** 로그인 후처리의 접속 IP 판정 — 행이 없으면 제한 없음, 있으면 활성 대역 하나와 일치해야 한다. */
@Component
@Order(15)
public class AllowedIpCheck implements LoginPostCheck {

    private final AllowedIpService allowedIps;

    public AllowedIpCheck(AllowedIpService allowedIps) {
        this.allowedIps = allowedIps;
    }

    @Override
    public Optional<LoginResultCode> check(LoginCandidate candidate) {
        return allowedIps.isAllowed(candidate.user().getUserId(), candidate.clientIp())
                ? Optional.empty()
                : Optional.of(LoginResultCode.FAIL_IP);
    }
}
