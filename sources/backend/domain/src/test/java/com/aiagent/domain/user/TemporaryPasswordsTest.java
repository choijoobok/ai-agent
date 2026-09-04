package com.aiagent.domain.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.domain.user.service.PasswordRules;
import com.aiagent.domain.user.service.TemporaryPasswords;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 관리자 발급 임시 비밀번호 — AUTH-07 · screen/user/requirements.md.
 *
 * <p><b>재는 것이 둘이다.</b> 만든 값이 <i>정책을 확실히 채우는가</i> 와 <i>사람이 옮겨 적을
 * 수 있는가</i>.
 *
 * <p>앞엣것이 없으면 <b>발급 직후 저장이 실패</b>한다 — 같은 정책을 {@link PasswordRules} 가
 * 검사하므로 둘이 어긋나면 그 자리에서 드러난다. 뒤엣것이 없으면 <b>로그인 실패가 잠금까지
 * 간다</b>: 이 값은 메일 연동이 없는 배포에서 관리자가 <b>읽어서 전하는</b> 값이고(sys/code.md),
 * {@code 0}·{@code O} 를 헷갈려 다섯 번 틀리면 방금 임시 비밀번호를 받은 계정이 잠긴다.
 *
 * <p><b>무작위라서 여러 번 돌린다.</b> 한 번만 보면 <i>우연히 통과한 값</i> 을 보고 있을 수
 * 있다 — 특히 헷갈리는 글자는 풀에서 빠졌으므로 <b>절대 나오면 안 되는</b> 성질이고, 그런
 * 것은 반복해야 재진다.
 */
class TemporaryPasswordsTest {

    /** 한 번의 우연을 통과시키지 않을 만큼. 순수 함수라 빠르다. */
    private static final int ROUNDS = 300;

    @Nested
    @DisplayName("정책을 확실히 채운다")
    class Policy {

        @Test
        @DisplayName("만든 값이 같은 정책의 검사를 통과한다 — 어긋나면 발급 직후 저장이 실패한다")
        void satisfiesTheSameRules() {
            for (int minLength : new int[] {4, 8, 12, 20}) {
                for (int kinds = 1; kinds <= 4; kinds++) {
                    int length = minLength;
                    int required = kinds;
                    IntStream.range(0, 20).forEach(unused -> {
                        String value = TemporaryPasswords.generate(length, required);
                        assertThat(PasswordRules.satisfies(value, length, required))
                                .as("최소 %d자 · %d종", length, required)
                                .isTrue();
                    });
                }
            }
        }

        @Test
        @DisplayName("정책이 짧아도 12자보다 짧지 않다 — 기계가 만들어 잠깐 쓰는 값을 줄일 이유가 없다")
        void neverShorterThanTwelve() {
            IntStream.range(0, ROUNDS).forEach(unused ->
                    assertThat(TemporaryPasswords.generate(4, 1)).hasSizeGreaterThanOrEqualTo(12));
        }

        @Test
        @DisplayName("요구 종류가 범위 밖이어도 만들어 낸다 — 설정이 잘못돼도 발급은 막히지 않는다")
        void clampsCharsetKinds() {
            assertThat(TemporaryPasswords.generate(12, 0)).hasSizeGreaterThanOrEqualTo(12);
            assertThat(TemporaryPasswords.generate(12, 9)).hasSizeGreaterThanOrEqualTo(12);
        }
    }

    @Nested
    @DisplayName("사람이 옮겨 적을 수 있다")
    class Legible {

        /**
         * 서로 헷갈리는 글자들 — screen/user/requirements.md 가 이 값을 <b>화면에 표시</b>하기로 한 결과다.
         *
         * <p>{@code l}(엘)·{@code I}(아이 대문자)·{@code 1} 이 한 묶음이고,
         * {@code O}(오)·{@code 0} 이 한 묶음이다. 전화로 불러 주는 상황을 가정한다.
         */
        private static final String CONFUSING = "0O1lI";

        @Test
        @DisplayName("헷갈리는 글자가 하나도 나오지 않는다 — 다섯 번 틀리면 그 계정이 잠긴다")
        void hasNoConfusingCharacters() {
            IntStream.range(0, ROUNDS).forEach(unused -> {
                String value = TemporaryPasswords.generate(12, 4);
                assertThat(value).doesNotContainAnyWhitespaces();
                for (char c : CONFUSING.toCharArray()) {
                    assertThat(value).as("헷갈리는 글자 %c", c).doesNotContain(String.valueOf(c));
                }
            });
        }

        @Test
        @DisplayName("첫 글자가 계열 순서를 드러내지 않는다 — 섞지 않으면 앞자리가 규칙이 된다")
        void isShuffled() {
            /*
              만드는 방식이 <b>계열마다 한 자씩 먼저 뽑고 채우는 것</b>이라, 섞지 않으면
              첫 글자가 언제나 대문자이고 둘째가 언제나 소문자다. 값이 짧고 수명이 짧아도
              그 패턴을 공짜로 줄 이유는 없다.

              300번 중 <b>한 번이라도</b> 첫 글자가 대문자가 아니면 섞였다고 본다 —
              섞지 않았다면 300번 전부 대문자다.
            */
            boolean varied = IntStream.range(0, ROUNDS)
                    .mapToObj(unused -> TemporaryPasswords.generate(12, 4))
                    .anyMatch(value -> !Character.isUpperCase(value.charAt(0)));

            assertThat(varied).isTrue();
        }
    }

    @Test
    @DisplayName("같은 값을 두 번 내지 않는다 — 두 계정에 같은 비밀번호가 나가면 안 된다")
    void isNotRepeated() {
        long distinct = IntStream.range(0, ROUNDS)
                .mapToObj(unused -> TemporaryPasswords.generate(12, 4))
                .distinct()
                .count();

        assertThat(distinct).isEqualTo(ROUNDS);
    }
}
