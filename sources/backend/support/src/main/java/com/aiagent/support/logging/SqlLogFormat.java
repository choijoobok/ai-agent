package com.aiagent.support.logging;

import com.p6spy.engine.spy.appender.MessageFormattingStrategy;

/**
 * 로그 한 줄의 모양 — system-logging.md §2.1.
 *
 * <pre>
 * [27ms] statement &lt;- com.aiagent...UserService.searchPage(UserService.java:88)
 * select
 *   u.user_id, u.login_id
 *   from sys_user u
 *   where u.use_yn = 'Y'
 * </pre>
 *
 * <p><b>한 번의 호출로 전부 담는다.</b> 나눠 찍으면 멀티스레드에서 줄이 뒤섞여, 어느
 * SQL 의 시간인지 알 수 없게 된다.
 *
 * <p><b>{@code sql} 이 이미 값이 박힌 SQL 이다</b> — P6Spy 가 물음표 자리에 실제
 * 파라미터를 넣어 준다(요구 4). 그대로 복사해 DB 툴에서 돌릴 수 있는 것이 이 기능의
 * 전부이며, 그래서 <b>따옴표 안을 건드리지 않는</b> 것이 중요하다({@link SqlPretty}).
 *
 * <p><b>P6Spy 가 리플렉션으로 만든다</b>({@code spy.properties} 의 {@code logMessageFormat}).
 * 인자 없는 생성자가 필요하고, 스프링 빈이 될 수 없어 설정은 {@link SqlLogSettings} 에서
 * 읽는다.
 */
public class SqlLogFormat implements MessageFormattingStrategy {

    @Override
    public String formatMessage(
            int connectionId,
            String now,
            long elapsed,
            String category,
            String prepared,
            String sql,
            String url) {

        if (sql == null || sql.isBlank()) {
            // commit·rollback 은 SQL 이 없다 — 카테고리만 남기면 로그가 그것으로 찬다.
            return "";
        }
        SqlLogSettings settings = SqlLogSettings.current();
        if (settings.excluded(sql)) {
            return "";
        }

        StringBuilder line = new StringBuilder(sql.length() + 128);
        line.append('[').append(elapsed).append("ms] ").append(category);
        if (settings.traceCaller()) {
            line.append(" <- ").append(SqlCaller.find());
        }
        line.append(System.lineSeparator()).append(SqlPretty.format(sql));
        return line.toString();
    }
}
