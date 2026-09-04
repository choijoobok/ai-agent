package com.aiagent.api.auth.check;

import com.aiagent.domain.auth.LoginResultCode;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 휴면 계정(USER-08) — 41 §4.2 · §4.4.
 *
 * <p>배치가 굳힌 {@code DORMANT_YN} 을 본다. {@code LAST_LOGIN_DTM} 에서 파생하지 않는 이유는
 * <b>휴면이 로그인을 막는 상태</b>라서다 — 막으면 마지막 로그인 시각이 갱신되지 않으므로
 * 본인 재인증으로 풀었다는 사실을 기록할 곳이 필요하다.
 */
@Component
@Order(10)
public class DormantAccountCheck implements LoginPostCheck {

    @Override
    public Optional<LoginResultCode> check(LoginCandidate candidate) {
        return Boolean.TRUE.equals(candidate.user().getDormantYn())
                ? Optional.of(LoginResultCode.FAIL_DORMANT)
                : Optional.empty();
    }
}
