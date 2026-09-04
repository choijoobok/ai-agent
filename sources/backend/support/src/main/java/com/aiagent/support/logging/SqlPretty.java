package com.aiagent.support.logging;

import java.util.List;
import java.util.Locale;

/**
 * SQL 을 <b>읽을 수 있게 줄로 끊는다</b> — system-logging.md §2 의 요구 3.
 *
 * <p><b>Hibernate 의 {@code FormatStyle} 을 쓰지 않는다.</b> 그것은 판의 내부 클래스라
 * 판이 올라갈 때마다 자리가 바뀔 수 있고, 무엇보다 <b>support 가 Hibernate 를 알게
 * 된다</b> — 이 모듈은 core 만 참조한다(architecture.md §1). 여기서 하는 일은 <b>절 앞에서 줄을
 * 바꾸는 것</b> 하나이며, 그 이상은 DB 툴이 훨씬 잘한다.
 *
 * <p><b>따옴표 안은 건드리지 않는다.</b> 값에 {@code from} 이 들어 있는 경우가 실제로
 * 있고(주소·메시지), 거기서 줄을 바꾸면 <b>복사해 붙였을 때 다른 쿼리</b>가 된다 —
 * 이 클래스가 존재하는 이유가 그 복사이므로 그것을 깨면 전부가 무의미하다.
 */
public final class SqlPretty {

    /** 줄을 바꿀 자리. <b>단어 경계로만</b> 맞춘다 — {@code fromDate} 는 {@code from} 이 아니다. */
    private static final List<String> BREAK_BEFORE =
            List.of(
                    "select",
                    "from",
                    "where",
                    "inner join",
                    "left join",
                    "right join",
                    "cross join",
                    "join",
                    "group by",
                    "order by",
                    "having",
                    "limit",
                    "offset",
                    "union all",
                    "union",
                    "insert into",
                    "update",
                    "delete from",
                    "values",
                    "set",
                    "and",
                    "or");

    private SqlPretty() {}

    public static String format(String sql) {
        String text = sql.trim();
        if (text.isEmpty()) {
            return text;
        }

        StringBuilder out = new StringBuilder(text.length() + 32);
        boolean inQuote = false;
        int index = 0;

        while (index < text.length()) {
            char ch = text.charAt(index);
            if (ch == '\'') {
                inQuote = !inQuote;
            }

            if (!inQuote && atWordStart(text, index)) {
                String keyword = keywordAt(text, index);
                if (keyword != null) {
                    if (out.length() > 0) {
                        trimTrailingSpace(out);
                        out.append(System.lineSeparator());
                        // 이어지는 절은 한 칸 들여 둔다 — 첫 절과 나머지가 구분된다.
                        out.append("  ");
                    }
                    out.append(text, index, index + keyword.length());
                    index += keyword.length();
                    continue;
                }
            }

            out.append(ch);
            index += 1;
        }
        return out.toString();
    }

    /** 앞이 단어 글자면 단어의 <b>가운데</b>다 — {@code fromDate} 에서 끊지 않게 한다. */
    private static boolean atWordStart(String text, int index) {
        return index == 0 || !isWordChar(text.charAt(index - 1));
    }

    private static String keywordAt(String text, int index) {
        for (String keyword : BREAK_BEFORE) {
            int end = index + keyword.length();
            if (end <= text.length()
                    && text.regionMatches(true, index, keyword, 0, keyword.length())
                    && endsWord(text, end)) {
                return keyword;
            }
        }
        return null;
    }

    /** 뒤가 단어 글자면 더 긴 단어의 앞부분이다 — {@code ordering} 은 {@code order} 가 아니다. */
    private static boolean endsWord(String text, int end) {
        return end == text.length() || !isWordChar(text.charAt(end));
    }

    /**
     * <b>밑줄과 달러도 단어의 일부다.</b> 빠뜨리면 {@code from_dt} 가 {@code from} 으로
     * 읽혀 <b>컬럼 이름 한가운데서 줄이 바뀐다</b> — 그리고 그 SQL 은 붙여 넣어도 돌지
     * 않는다(2026-08-30 — 테스트가 잡았다).
     */
    private static boolean isWordChar(char ch) {
        return Character.isLetterOrDigit(ch) || ch == '_' || ch == '$';
    }

    /** 로그에서 대소문자를 섞지 않으려는 것이 아니다 — 비교만 소문자로 한다. */
    static String lower(String text) {
        return text.toLowerCase(Locale.ROOT);
    }

    private static void trimTrailingSpace(StringBuilder out) {
        while (out.length() > 0 && out.charAt(out.length() - 1) == ' ') {
            out.setLength(out.length() - 1);
        }
    }
}
