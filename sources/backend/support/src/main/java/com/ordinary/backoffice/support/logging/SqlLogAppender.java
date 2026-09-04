package com.ordinary.backoffice.support.logging;

import com.p6spy.engine.spy.appender.Slf4JLogger;

/**
 * 빈 줄을 삼킨다 — system-logging.md §2.3.
 *
 * <p>{@link SqlLogFormat} 이 걸러낸 SQL(세션 테이블 등)에는 빈 문자열을 낸다. 판의
 * 기본 appender 는 그것을 <b>그대로 한 줄로</b> 찍으므로, 걸러 낸 만큼 <b>빈 줄이
 * 쌓인다</b> — 노이즈를 지우려던 것이 다른 노이즈가 된다.
 *
 * <p>거르는 판단을 여기가 아니라 포맷터에 둔 것은 그쪽이 <b>SQL 을 이미 손에 쥐고
 * 있기</b> 때문이다. 여기는 낼지 말지만 본다.
 */
public class SqlLogAppender extends Slf4JLogger {

    @Override
    public void logText(String text) {
        if (text != null && !text.isBlank()) {
            super.logText(text);
        }
    }
}
