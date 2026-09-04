package com.aiagent.support.logging;

import java.util.List;

/**
 * 로그 포맷터가 읽는 설정 — <b>정적 자리다</b>.
 *
 * <p><b>P6Spy 가 포맷터를 스스로 만든다.</b> {@code spy.properties} 의 이름으로 리플렉션
 * 생성이라 <b>스프링이 값을 넣어 줄 수 없다</b> — 그래서 기동 중 한 번 여기에 담고,
 * 포맷터는 여기서 읽는다.
 *
 * <p><b>담기지 않으면 아무것도 하지 않는다.</b> 설정이 없다는 것은 이 기능이 꺼져 있다는
 * 뜻이고, 그때 P6Spy 는 애초에 붙지도 않는다 — 기본값이 <i>끈 상태</i> 인 것이 안전한
 * 쪽이다.
 */
public final class SqlLogSettings {

    private static volatile SqlLogSettings current = new SqlLogSettings(false, List.of());

    private final boolean traceCaller;
    private final List<String> excludePatterns;

    private SqlLogSettings(boolean traceCaller, List<String> excludePatterns) {
        this.traceCaller = traceCaller;
        this.excludePatterns = excludePatterns;
    }

    public static void apply(boolean traceCaller, List<String> excludePatterns) {
        List<String> lowered =
                excludePatterns == null
                        ? List.of()
                        : excludePatterns.stream().map(SqlPretty::lower).toList();
        current = new SqlLogSettings(traceCaller, lowered);
    }

    static SqlLogSettings current() {
        return current;
    }

    boolean traceCaller() {
        return traceCaller;
    }

    /** 걸러야 하는가 — 소문자로 견준다. */
    boolean excluded(String sql) {
        if (excludePatterns.isEmpty()) {
            return false;
        }
        String lowered = SqlPretty.lower(sql);
        return excludePatterns.stream().anyMatch(lowered::contains);
    }
}
