package com.ordinary.backoffice.support.logging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * SQL 줄 나누기 — system-logging.md §2.
 *
 * <p><b>이 클래스가 있는 이유는 복사다.</b> 값이 박힌 SQL 을 그대로 DB 툴에 붙여 넣는 것이
 * 기능의 전부이므로, 보기 좋게 만들다가 <b>다른 쿼리로 바꿔 놓으면</b> 전부가 무의미해진다.
 *
 * <p>그 위험이 실재하는 자리가 둘이다 — <b>따옴표 안의 값</b>과 <b>키워드로 시작하는
 * 식별자</b>. 둘 다 조용히 깨진다: 로그는 멀쩡해 보이고, 붙여 넣어 돌려 봐야 안다.
 */
class SqlPrettyTest {

    @Nested
    @DisplayName("절 앞에서 줄을 바꾼다")
    class Breaks {

        @Test
        @DisplayName("select · from · where 가 각자 줄을 갖는다")
        void breaksBeforeClauses() {
            String formatted = SqlPretty.format("select a, b from sys_user where use_yn = 'Y'");

            assertThat(formatted.lines()).hasSize(3);
            assertThat(formatted.lines().map(String::trim))
                    .containsExactly("select a, b", "from sys_user", "where use_yn = 'Y'");
        }

        @Test
        @DisplayName("빈 SQL 은 그대로 빈 것이다 — 줄 하나를 만들어 내지 않는다")
        void keepsEmpty() {
            assertThat(SqlPretty.format("   ")).isEmpty();
        }
    }

    @Nested
    @DisplayName("바꾸지 말아야 할 것")
    class Keeps {

        /**
         * <b>값에 절 이름이 들어 있는 경우가 실제로 있다</b> — 주소 · 메시지 · 사람이 쓴 글.
         * 거기서 줄을 바꾸면 붙여 넣었을 때 <b>다른 쿼리</b>가 된다.
         */
        @Test
        @DisplayName("따옴표 안은 건드리지 않는다 — 붙여 넣으면 다른 쿼리가 된다")
        void keepsQuotedText() {
            String sql = "select a from t where memo = 'order by from where'";

            String formatted = SqlPretty.format(sql);

            assertThat(formatted).contains("'order by from where'");
            assertThat(formatted.lines()).hasSize(3);
        }

        @Test
        @DisplayName("키워드로 시작하는 식별자에서 끊지 않는다 — from_dt 는 from 이 아니다")
        void keepsIdentifiers() {
            String formatted = SqlPretty.format("select from_dt, ordering from t");

            assertThat(formatted.lines().map(String::trim))
                    .containsExactly("select from_dt, ordering", "from t");
        }

        @Test
        @DisplayName("글자를 더하거나 빼지 않는다 — 공백만 달라진다")
        void keepsEveryToken() {
            String sql = "select a,b from t where x = 1 and y = 'z' order by a";

            String squashed =
                    String.join(" ", SqlPretty.format(sql).lines().map(String::trim).toList());

            assertThat(squashed).isEqualTo(sql);
        }
    }
}
