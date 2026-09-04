package com.aiagent.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 시드에 박힌 해시가 <b>문서화된 비밀번호와 실제로 맞는가</b>.
 *
 * <p>이 검사가 없으면 어긋남이 조용하다 — Liquibase 는 문자열을 그대로 넣고, 기동도
 * 성공하며, 아무도 로그인하지 못한다는 사실은 사람이 시도해야 드러난다. 그때는 이미
 * "설치가 안 된다" 는 문의가 된 뒤다.
 *
 * <p>해시를 바꿀 일이 생기면 여기 상수도 함께 바꾸게 된다. 그것이 노림수다.
 */
class SeedAdminPasswordTest {

    /** 시드 주석과 문서가 안내하는 값. 이 둘이 갈리면 이 테스트가 깨진다. */
    private static final String DOCUMENTED_PASSWORD = "Backoffice!1";

    private static final Path SEED =
            Path.of("src/main/resources/db/changelog/data/002-init-admin.yaml");

    /** {@code name: PWD} 바로 다음 줄의 {@code value:} 를 집는다. */
    private static final Pattern PWD_VALUE =
            Pattern.compile("name:\\s*PWD\\s*\\R\\s*-?\\s*value:\\s*\"([^\"]+)\"");

    private final PasswordEncoder encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();

    @Test
    @DisplayName("시드 관리자 해시가 문서화된 비밀번호와 맞는다")
    void seededHashMatchesDocumentedPassword() throws IOException {
        String hash = extractSeededHash();

        assertThat(hash).startsWith("{bcrypt}");
        // 컬럼이 VARCHAR(100) 이다(sys/user-role.md). 알고리즘을 바꾸다 넘치면 저장에서 잘린다.
        assertThat(hash.length()).isLessThanOrEqualTo(100);
        assertThat(encoder.matches(DOCUMENTED_PASSWORD, hash))
                .as("data/002-init-admin.yaml 의 해시가 '%s' 와 맞지 않는다", DOCUMENTED_PASSWORD)
                .isTrue();
    }

    @Test
    @DisplayName("시드 비밀번호가 기본 비밀번호 정책을 만족한다 — 첫 계정이 정책 위반이면 안 된다")
    void seededPasswordSatisfiesDefaultPolicy() {
        // application.yml 의 sys-config.auth.password 기본값(sys/code.md).
        assertThat(DOCUMENTED_PASSWORD.length()).isGreaterThanOrEqualTo(9);
        assertThat(charsetKinds(DOCUMENTED_PASSWORD)).isGreaterThanOrEqualTo(3);
        assertThat(DOCUMENTED_PASSWORD.toLowerCase()).doesNotContain("admin");
    }

    private String extractSeededHash() throws IOException {
        String yaml = Files.readString(SEED, StandardCharsets.UTF_8);
        Matcher matcher = PWD_VALUE.matcher(yaml);
        assertThat(matcher.find()).as("시드에서 PWD 값을 찾지 못했다 — 파일 구조가 바뀌었다").isTrue();
        return matcher.group(1);
    }

    /** 영대·영소·숫자·특수 중 몇 계열을 쓰는가. */
    private static int charsetKinds(String password) {
        boolean upper = password.chars().anyMatch(Character::isUpperCase);
        boolean lower = password.chars().anyMatch(Character::isLowerCase);
        boolean digit = password.chars().anyMatch(Character::isDigit);
        boolean special = password.chars().anyMatch(c -> !Character.isLetterOrDigit(c));
        int kinds = 0;
        for (boolean present : new boolean[] {upper, lower, digit, special}) {
            if (present) {
                kinds++;
            }
        }
        return kinds;
    }
}
