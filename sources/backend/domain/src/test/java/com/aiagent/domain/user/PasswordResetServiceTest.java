package com.aiagent.domain.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.message.MsgKey;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.entity.SysUserPwdReset;
import com.aiagent.domain.user.repository.SysUserPwdResetRepository;
import com.aiagent.domain.user.repository.SysUserRepository;
import com.aiagent.domain.user.service.PasswordHistory;
import com.aiagent.domain.user.service.PasswordResetAttempts;
import com.aiagent.domain.user.service.PasswordResetErrorCode;
import com.aiagent.domain.user.service.PasswordResetService;
import com.aiagent.domain.user.service.UserErrorCode;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.AuthPasswordProps;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 분실 비밀번호 자기 재설정 — AUTH-07 · {@code documents/screen/_standalone/login/requirements.md} §6-3.
 *
 * <p>재는 것은 셋이다. <b>응답이 갈리지 않는가</b>(계정 열거), <b>토큰이 실제로 닫히는가</b>
 * (만료·사용·시도 한도), <b>③이 한 덩어리인가</b>(비밀번호·이력·잠금·사용 표시).
 *
 * <p><b>인코더를 흉내 낸다.</b> BCrypt 는 한 번에 100ms 가 드는데 이 클래스가 재는 것은
 * 해시 알고리즘이 아니라 <i>맞았는가 틀렸는가에 따라 무엇이 달라지는가</i> 다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetServiceTest {

    private static final String USER = "kim";
    private static final Instant NOW = Instant.parse("2026-09-04T01:00:00Z");
    private static final int VALID_MINUTES = 10;
    private static final int TRY_LIMIT = 5;
    private static final int COOLDOWN_SECONDS = 60;

    @Mock private SysUserRepository users;
    @Mock private SysUserPwdResetRepository resets;
    @Mock private PasswordHistory history;
    @Mock private PasswordResetAttempts attempts;
    @Mock private MessageService messages;
    @Mock private ConfigLookup configs;

    private PasswordResetService service;

    /** {@code enc:} 접두만 붙인다 — 맞고 틀림이 눈으로 읽히는 것이 이 테스트의 요건이다. */
    private final PasswordEncoder encoder = new PasswordEncoder() {
        @Override
        public String encode(CharSequence raw) {
            return "enc:" + raw;
        }

        @Override
        public boolean matches(CharSequence raw, String encoded) {
            return encode(raw).equals(encoded);
        }
    };

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(
                users,
                resets,
                history,
                attempts,
                encoder,
                messages,
                configs,
                new BusinessCalendar("Asia/Seoul", Clock.fixed(NOW, ZoneId.of("Asia/Seoul"))));

        when(configs.get(AuthPasswordProps.class)).thenReturn(new AuthPasswordProps(
                9, 3, 3, 90, 7, 24, true,
                new AuthPasswordProps.Reset(VALID_MINUTES, TRY_LIMIT, COOLDOWN_SECONDS)));
        when(messages.text(MsgKey.MAIL_PWD_RESET_SUBJECT, "ko")).thenReturn("인증번호");
        when(messages.text(MsgKey.MAIL_PWD_RESET_BODY, "ko"))
                .thenReturn("{userNm} 님 코드는 {code} 이며 {minutes}분간 유효합니다");
        when(resets.findById(anyString())).thenReturn(Optional.empty());
        when(users.findById(anyString())).thenReturn(Optional.empty());
        when(history.isReused(anyString(), anyString(), anyInt())).thenReturn(false);
    }

    @Nested
    @DisplayName("① 요청 — 응답이 갈리지 않는다")
    class Issue {

        @Test
        @DisplayName("없는 계정이어도 던지지 않는다 — 예외가 곧 계정 열거다")
        void unknownAccountIsSilent() {
            assertThat(service.issue("nobody")).isEmpty();
            verify(resets, never()).save(any());
        }

        @Test
        @DisplayName("메일 주소가 없으면 보낼 것이 없다 — 그래도 같은 빈 값이다")
        void accountWithoutEmail() {
            SysUser user = SysUser.builder()
                    .userId(USER).userNm(USER).pwd("enc:old").localeCd("ko").build();
            when(users.findById(USER)).thenReturn(Optional.of(user));

            assertThat(service.issue(USER)).isEmpty();
            verify(resets, never()).save(any());
        }

        @Test
        @DisplayName("발급하면 수신자의 언어로 코드와 유효 시간을 담는다")
        void composesMail() {
            givenUser();

            PasswordResetService.ResetMail mail = service.issue(USER).orElseThrow();

            assertThat(mail.to()).isEqualTo(USER + "@example.com");
            assertThat(mail.subject()).isEqualTo("인증번호");
            assertThat(mail.body()).contains(USER + " 님 코드는").contains("10분간 유효합니다");
        }

        @Test
        @DisplayName("인증번호는 여섯 자리다 — 앞자리 0 을 잃으면 조합이 열 배 준다")
        void codeIsAlwaysSixDigits() {
            givenUser();

            for (int i = 0; i < 200; i++) {
                String body = service.issue(USER).orElseThrow().body();
                assertThat(body.replaceAll("\\D", "")).hasSizeGreaterThanOrEqualTo(6);
                assertThat(body).containsPattern("코드는 \\d{6} 이며");
            }
        }

        @Test
        @DisplayName("쿨다운 안이면 보내지 않고 토큰도 그대로다 — 재발송 폭주를 막는 자리다")
        void withinCooldown() {
            givenUser();
            SysUserPwdReset token = tokenIssuedAt(NOW.minusSeconds(30), "enc:111111");
            when(resets.findById(USER)).thenReturn(Optional.of(token));

            assertThat(service.issue(USER)).isEmpty();
            assertThat(token.getTokenHash()).isEqualTo("enc:111111");
        }

        @Test
        @DisplayName("쿨다운이 지나면 같은 행을 갈아 끼우고 시도 횟수를 되돌린다")
        void reissueResetsTryCount() {
            givenUser();
            SysUserPwdReset token = tokenIssuedAt(NOW.minusSeconds(90), "enc:111111");
            token.recordFailure();
            token.recordFailure();
            when(resets.findById(USER)).thenReturn(Optional.of(token));

            assertThat(service.issue(USER)).isPresent();
            assertThat(token.getTokenHash()).isNotEqualTo("enc:111111");
            // 되돌리지 않으면 방금 받은 코드가 옛 실패를 물려받아 두 번 만에 막힌다.
            assertThat(token.getTryCnt()).isZero();
            verify(resets, never()).save(any());
        }
    }

    @Nested
    @DisplayName("② 검증 — 토큰이 실제로 닫힌다")
    class Verify {

        @Test
        @DisplayName("발급받은 적이 없으면 만료와 같은 답이다 — 있었다는 사실도 알려주지 않는다")
        void noToken() {
            assertThatThrownBy(() -> service.verify(USER, "123456"))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(PasswordResetErrorCode.CODE_EXPIRED);
        }

        @Test
        @DisplayName("맞으면 통과한다")
        void matches() {
            givenToken(tokenIssuedAt(NOW, "enc:123456"));

            assertThatCode(() -> service.verify(USER, "123456")).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("틀리면 CODE_INVALID 다 — 남은 횟수는 말하지 않는다")
        void mismatchCounts() {
            SysUserPwdReset token = tokenIssuedAt(NOW, "enc:123456");
            givenToken(token);
            when(attempts.recordFailure(USER)).thenReturn(1);

            assertThatThrownBy(() -> service.verify(USER, "999999"))
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(PasswordResetErrorCode.CODE_INVALID);
        }

        @Test
        @DisplayName("세는 일을 직접 하지 않는다 — 던지면 롤백이라 올린 숫자가 함께 지워진다")
        void countsOutsideTheRollingBackTransaction() {
            SysUserPwdReset token = tokenIssuedAt(NOW, "enc:123456");
            givenToken(token);

            assertThatThrownBy(() -> service.verify(USER, "999999"))
                    .isInstanceOf(BusinessException.class);

            // 실물에서만 드러났던 결함이다(2026-09-04) — 브라우저에서 여섯 번을 틀려도
            // 계속 CODE_INVALID 가 나왔다. 이 두 줄이 그 자리를 지킨다.
            verify(attempts).recordFailure(USER);
            assertThat(token.getTryCnt()).isZero();
        }

        @Test
        @DisplayName("한도에 닿는 순간 만료로 갈린다 — 화면이 ①로 되돌려야 하는 자리다")
        void lastTryExpires() {
            givenToken(tokenIssuedAt(NOW, "enc:123456"));
            when(attempts.recordFailure(USER)).thenReturn(TRY_LIMIT);

            assertThatThrownBy(() -> service.verify(USER, "999999"))
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(PasswordResetErrorCode.CODE_EXPIRED);
        }

        @Test
        @DisplayName("이미 한도를 넘긴 토큰은 대조도 하지 않는다")
        void beyondLimit() {
            SysUserPwdReset token = tokenIssuedAt(NOW, "enc:123456");
            for (int i = 0; i < TRY_LIMIT; i++) {
                token.recordFailure();
            }
            givenToken(token);

            assertThatThrownBy(() -> service.verify(USER, "123456"))
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(PasswordResetErrorCode.CODE_EXPIRED);
        }

        @Test
        @DisplayName("만료된 토큰은 맞아도 거부한다")
        void expired() {
            givenToken(new TokenBuilder()
                    .issued(NOW.minus(Duration.ofMinutes(20)))
                    .expires(NOW.minus(Duration.ofMinutes(10)))
                    .hash("enc:123456")
                    .build());

            assertThatThrownBy(() -> service.verify(USER, "123456"))
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(PasswordResetErrorCode.CODE_EXPIRED);
        }

        @Test
        @DisplayName("이미 쓴 토큰은 두 번 쓰이지 않는다")
        void alreadyUsed() {
            SysUserPwdReset token = tokenIssuedAt(NOW, "enc:123456");
            token.markUsed();
            givenToken(token);

            assertThatThrownBy(() -> service.verify(USER, "123456"))
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(PasswordResetErrorCode.CODE_EXPIRED);
        }
    }

    @Nested
    @DisplayName("③ 완료 — 한 덩어리다")
    class Complete {

        @Test
        @DisplayName("비밀번호 · 이력 · 잠금 · 사용 표시가 함께 간다")
        void changesEverythingTogether() {
            SysUser user = givenLockedUser();
            SysUserPwdReset token = tokenIssuedAt(NOW, "enc:123456");
            givenToken(token);

            service.complete(USER, "123456", "NewPassw0rd!");

            assertThat(user.getPwd()).isEqualTo("enc:NewPassw0rd!");
            assertThat(user.getLockYn()).isFalse();
            // 풀면서 실패 횟수도 0 이어야 한다 — 아니면 다음 한 번의 실패로 다시 잠긴다.
            assertThat(user.getLoginFailCnt()).isZero();
            assertThat(token.getUsedYn()).isTrue();
            verify(history).archive(user, 3);
        }

        @Test
        @DisplayName("정책 미달은 거부한다 — 규칙은 본인 변경과 하나다")
        void rejectsWeakPassword() {
            givenUser();
            givenToken(tokenIssuedAt(NOW, "enc:123456"));

            assertThatThrownBy(() -> service.complete(USER, "123456", "short1!"))
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(UserErrorCode.PWD_WEAK);
        }

        @Test
        @DisplayName("최근에 쓴 값은 거부한다")
        void rejectsReuse() {
            givenUser();
            givenToken(tokenIssuedAt(NOW, "enc:123456"));
            when(history.isReused(USER, "NewPassw0rd!", 3)).thenReturn(true);

            assertThatThrownBy(() -> service.complete(USER, "123456", "NewPassw0rd!"))
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(UserErrorCode.PWD_REUSED);
        }

        @Test
        @DisplayName("지금 쓰는 것과 같으면 거부한다 — 이력에는 아직 없어 별도 판정이다")
        void rejectsUnchanged() {
            SysUser user = SysUserFixture.user(USER, "enc:NewPassw0rd!");
            when(users.findById(USER)).thenReturn(Optional.of(user));
            givenToken(tokenIssuedAt(NOW, "enc:123456"));

            assertThatThrownBy(() -> service.complete(USER, "123456", "NewPassw0rd!"))
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(UserErrorCode.PWD_UNCHANGED);
        }

        @Test
        @DisplayName("코드가 틀리면 비밀번호를 건드리지 않는다")
        void wrongCodeChangesNothing() {
            SysUser user = givenUser();
            givenToken(tokenIssuedAt(NOW, "enc:123456"));

            assertThatThrownBy(() -> service.complete(USER, "999999", "NewPassw0rd!"))
                    .isInstanceOf(BusinessException.class);
            assertThat(user.getPwd()).isEqualTo("enc:old");
            verify(history, never()).archive(any(), anyInt());
            // ③도 한 트랜잭션이라 같은 함정에 걸린다 — 여기서도 밖에서 센다.
            verify(attempts).recordFailure(USER);
        }
    }

    // ── 픽스처 ──────────────────────────────────────────────────────────

    private SysUser givenUser() {
        SysUser user = SysUserFixture.user(USER, "enc:old");
        when(users.findById(USER)).thenReturn(Optional.of(user));
        return user;
    }

    private SysUser givenLockedUser() {
        SysUser user = givenUser();
        // 실패 다섯 번이면 잠긴다 — 잠긴 계정이 재설정으로 풀리는 것이 이 화면의 요건이다.
        for (int i = 0; i < 5; i++) {
            user.recordLoginFailure(NOW, 5);
        }
        return user;
    }

    private void givenToken(SysUserPwdReset token) {
        when(resets.findById(USER)).thenReturn(Optional.of(token));
    }

    private SysUserPwdReset tokenIssuedAt(Instant issuedAt, String hash) {
        return new TokenBuilder()
                .issued(issuedAt)
                .expires(issuedAt.plus(Duration.ofMinutes(VALID_MINUTES)))
                .hash(hash)
                .build();
    }

    private static final class TokenBuilder {
        private Instant issued = NOW;
        private Instant expires = NOW.plus(Duration.ofMinutes(VALID_MINUTES));
        private String hash = "enc:123456";

        private TokenBuilder issued(Instant value) {
            this.issued = value;
            return this;
        }

        private TokenBuilder expires(Instant value) {
            this.expires = value;
            return this;
        }

        private TokenBuilder hash(String value) {
            this.hash = value;
            return this;
        }

        private SysUserPwdReset build() {
            return SysUserPwdReset.builder()
                    .userId(USER)
                    .tokenHash(hash)
                    .issueDtm(issued)
                    .expireDtm(expires)
                    .build();
        }
    }
}
