package com.aiagent.core.search;

/**
 * {@code LIKE} 패턴을 만드는 유일한 자리 — backend/api.md.
 *
 * <p><b>화면이 와일드카드를 아는 일이 없다.</b> 값에 {@code %} 나 {@code _} 가 들어오면
 * <b>리터럴로 취급하고</b> {@code ESCAPE} 절을 붙인다 — 4벤더 전부 지원한다.
 *
 * <p><b>파생 필드도 여기를 쓴다.</b> 화면 값 하나가 {@code EXISTS} 서브쿼리의 {@code LIKE}
 * 가 되는 경우(screen/admin/system/code/requirements.md 의 <i>메시지 값</i>)에 스펙이 직접 패턴을 만들면 <b>이스케이프가 두
 * 곳</b>에 생기고, 한쪽만 고치면 조용히 갈린다.
 */
public final class LikePattern {

    public static final char ESCAPE = '\\';

    /** {@code startsWith} · {@code contains} · {@code endsWith} 를 패턴 하나로. */
    public static String of(Op op, Object rawValue) {
        String value = escape(rawValue == null ? "" : rawValue.toString());
        return switch (op) {
            case startsWith -> value + "%";
            case contains -> "%" + value + "%";
            case endsWith -> "%" + value;
            default -> throw new IllegalArgumentException("LIKE 연산자가 아니다 — " + op);
        };
    }

    public static String escape(String value) {
        StringBuilder out = new StringBuilder(value.length() + 4);
        for (char c : value.toCharArray()) {
            if (c == ESCAPE || c == '%' || c == '_') {
                out.append(ESCAPE);
            }
            out.append(c);
        }
        return out.toString();
    }

    private LikePattern() {}
}
