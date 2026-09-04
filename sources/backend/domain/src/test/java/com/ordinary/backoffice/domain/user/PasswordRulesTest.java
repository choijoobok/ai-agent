package com.ordinary.backoffice.domain.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.ordinary.backoffice.domain.user.service.PasswordRules;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 비밀번호의 형태 요건 — 43 §6.3.
 *
 * <p>이 판정이 순수 함수인 이유는 <b>세 경로가 같은 규칙을 써야 하기</b> 때문이다 —
 * 본인 변경(AUTH-05) · 관리자 발급(AUTH-06) · 분실 재설정(AUTH-07).
 */
class PasswordRulesTest {

    @Test
    @DisplayName("네 계열을 각각 한 종으로 센다 — 같은 계열을 여러 자 써도 한 종이다")
    void countsKindsNotCharacters() {
        assertThat(PasswordRules.charsetKinds("aaaaaaaa")).isEqualTo(1);
        assertThat(PasswordRules.charsetKinds("aaaaAAAA")).isEqualTo(2);
        assertThat(PasswordRules.charsetKinds("aaaaAAA1")).isEqualTo(3);
        assertThat(PasswordRules.charsetKinds("aaaAAA1!")).isEqualTo(4);
    }

    @Test
    @DisplayName("ASCII 밖의 문자도 한 종이다 — 허용 특수문자 목록을 두지 않은 결과다")
    void nonAsciiCountsAsTheOtherKind() {
        // 목록을 두면 한글·이모지가 **아무 계열도 아닌 문자**가 되어 0종으로 계산되고,
        // 그 비밀번호가 왜 거절되는지 설명할 수 없다.
        assertThat(PasswordRules.charsetKinds("가나다")).isEqualTo(1);
        assertThat(PasswordRules.charsetKinds("abc가")).isEqualTo(2);
    }

    @Test
    @DisplayName("길이와 종류를 함께 본다 — 하나만 채우면 거짓이다")
    void needsBothLengthAndKinds() {
        // 종류는 넉넉한데 짧다.
        assertThat(PasswordRules.satisfies("aA1!", 9, 3)).isFalse();
        // 길지만 한 종뿐이다.
        assertThat(PasswordRules.satisfies("aaaaaaaaaaaa", 9, 3)).isFalse();
        assertThat(PasswordRules.satisfies("aaaaaaaA1", 9, 3)).isTrue();
    }

    @Test
    @DisplayName("빈 문자열은 0종이다 — 세다가 터지지 않는다")
    void emptyIsZero() {
        assertThat(PasswordRules.charsetKinds("")).isZero();
        assertThat(PasswordRules.satisfies("", 1, 1)).isFalse();
    }
}
