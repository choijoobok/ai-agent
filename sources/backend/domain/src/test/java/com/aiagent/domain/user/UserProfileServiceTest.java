package com.aiagent.domain.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.aiagent.domain.user.entity.SysUser;
import com.aiagent.domain.user.repository.SysUserRepository;
import com.aiagent.domain.user.service.UserProfileService;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * 내 프로필 — USER-05 · main-shell.md §8.
 *
 * <p>재는 것 둘이다 — <b>만료까지 남은 날</b>과 <b>편집 표면</b>. 앞의 것은 화면이 무엇을
 * 안내할지 가르고(0 과 음수가 다른 문구다), 뒤의 것은 <i>본인이 무엇을 고칠 수 있는가</i>
 * 라서 넓어지면 그대로 결함이 된다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserProfileServiceTest {

    private static final String USER = "kim";
    private static final Instant NOW = Instant.parse("2026-08-29T01:00:00Z");

    @Mock private SysUserRepository users;
    @Mock private ConfigLookup configs;

    private UserProfileService service;

    @BeforeEach
    void setUp() {
        service = new UserProfileService(
                users,
                configs,
                new BusinessCalendar("Asia/Seoul", Clock.fixed(NOW, ZoneId.of("Asia/Seoul"))));
        givenPolicy(90);
    }

    @Test
    @DisplayName("만료까지 남은 날을 센다 — 정책 값이 아니라 마지막 변경으로부터의 잔여다")
    void countsDaysToExpiry() {
        given(SysUserFixture.withPwdChangedAt(
                SysUserFixture.user(USER, "enc:x"), NOW.minus(Duration.ofDays(80))));

        assertThat(service.getMyProfile(USER).pwdExpiresInDays()).isEqualTo(10);
    }

    @Test
    @DisplayName("이미 지났으면 음수다 — 0 과 갈라야 다른 문구를 낼 수 있다")
    void expiredIsNegative() {
        given(SysUserFixture.withPwdChangedAt(
                SysUserFixture.user(USER, "enc:x"), NOW.minus(Duration.ofDays(100))));

        assertThat(service.getMyProfile(USER).pwdExpiresInDays()).isNegative();
    }

    @Test
    @DisplayName("주기를 안 쓰거나 바꾼 적이 없으면 null 이다 — 둘 다 보여줄 것이 없다")
    void nullWhenThereIsNothingToShow() {
        // 한 번도 바꾼 적이 없다.
        given(SysUserFixture.user(USER, "enc:x"));
        assertThat(service.getMyProfile(USER).pwdExpiresInDays()).isNull();

        // 주기 만료를 쓰지 않는 설정이다.
        givenPolicy(0);
        given(SysUserFixture.withPwdChangedAt(
                SysUserFixture.user(USER, "enc:x"), NOW.minus(Duration.ofDays(400))));
        assertThat(service.getMyProfile(USER).pwdExpiresInDays()).isNull();
    }

    @Test
    @DisplayName("정책을 함께 내린다 — 규칙을 모른 채 거절당하면 맞출 수 없다")
    void carriesThePolicy() {
        given(SysUserFixture.user(USER, "enc:x"));

        assertThat(service.getMyProfile(USER).passwordRule())
                .isEqualTo(new PasswordRule(9, 3, 3, 90));
    }

    @Test
    @DisplayName("빈 메일은 null 로 저장한다 — 인덱스에 빈 문자열이 쌓이지 않게 한다")
    void blankEmailBecomesNull() {
        SysUser user = given(SysUserFixture.user(USER, "enc:x"));

        service.saveMyProfile(USER, "  김철수  ", "   ");

        assertThat(user.getEmail()).isNull();
        // 이름의 앞뒤 공백도 서버가 다듬는다 — 화면이 빠뜨려도 DB 에 들어가지 않는다.
        assertThat(user.getUserNm()).isEqualTo("김철수");
    }

    @Test
    @DisplayName("본인이 고칠 수 있는 표면은 둘뿐이다 — 계정 상태는 관리자의 축이다")
    void doesNotTouchAccountState() {
        SysUser user = given(SysUserFixture.user(USER, "enc:x"));

        service.saveMyProfile(USER, "김철수", "kim@example.com");

        assertThat(user.getUseYn()).isTrue();
        assertThat(user.getLockYn()).isFalse();
        assertThat(user.getDormantYn()).isFalse();
        // 언어는 설정 모달의 것이다 — 여기서 바꾸면 정본이 둘이 된다(main-shell.md §9.1).
        assertThat(user.getLocaleCd()).isEqualTo("ko");
        assertThat(user.getPwd()).isEqualTo("enc:x");
    }

    private SysUser given(SysUser user) {
        when(users.findById(USER)).thenReturn(Optional.of(user));
        return user;
    }

    private void givenPolicy(int expireDays) {
        when(configs.get(AuthPasswordProps.class))
                .thenReturn(new AuthPasswordProps(
                        9, 3, 3, expireDays, 7, 24, true,
                        new AuthPasswordProps.Reset(10, 5, 60)));
    }
}
