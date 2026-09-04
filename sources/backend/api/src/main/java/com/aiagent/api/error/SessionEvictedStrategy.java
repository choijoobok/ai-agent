package com.aiagent.api.error;

import com.aiagent.api.auth.AuthErrorCode;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.session.SessionInformationExpiredEvent;
import org.springframework.security.web.session.SessionInformationExpiredStrategy;
import org.springframework.stereotype.Component;

/**
 * 밀려난 세션의 다음 요청에 답한다 — security-design.md §4-1.
 *
 * <p><b>이 자리가 비어 있으면 동시 접속 제어가 조용히 무력해진다.</b> {@code expireNow()} 는
 * 세션을 <b>지우지 않고 표시만</b> 하므로, 이것을 읽어 끊는 쪽이 없으면 밀려난 사용자의
 * {@code SecurityContext} 가 세션에 그대로 남아 <b>계속 일할 수 있다</b>. 기본 동작(로그인
 * 페이지로 리다이렉트)도 SPA 에는 쓸 수 없다 — axios 가 HTML 을 데이터로 받는다.
 *
 * <p>세션을 여기서 <b>무효화</b>하는 것도 필요하다. 표시만 남겨 두면 매 요청 같은 판정을
 * 반복하고, 그 세션 행은 타임아웃까지 스토어에 남는다.
 */
@Component
public class SessionEvictedStrategy implements SessionInformationExpiredStrategy {

    private static final Logger log = LoggerFactory.getLogger(SessionEvictedStrategy.class);

    private final ApiErrorWriter writer;

    public SessionEvictedStrategy(ApiErrorWriter writer) {
        this.writer = writer;
    }

    @Override
    public void onExpiredSessionDetected(SessionInformationExpiredEvent event)
            throws IOException, ServletException {

        HttpSession session = event.getRequest().getSession(false);
        if (session != null) {
            log.info("동시 접속으로 밀려난 세션의 요청 — 세션을 끊는다 user={}",
                    event.getSessionInformation().getPrincipal());
            session.invalidate();
        }
        SecurityContextHolder.clearContext();

        writer.write(event.getResponse(), AuthErrorCode.SESSION_EVICTED);
    }
}
