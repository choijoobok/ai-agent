package com.ordinary.backoffice.domain.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.domain.user.entity.SysUser;
import com.ordinary.backoffice.domain.user.entity.SysUserPwdHist;
import com.ordinary.backoffice.domain.user.repository.SysUserPwdHistRepository;
import com.ordinary.backoffice.domain.user.repository.SysUserRepository;
import com.ordinary.backoffice.domain.user.service.PasswordChangeService;
import com.ordinary.backoffice.domain.user.service.PasswordHistory;
import com.ordinary.backoffice.domain.user.service.UserErrorCode;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.AuthPasswordProps;
import com.ordinary.backoffice.support.time.BusinessCalendar;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Limit;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 본인 비밀번호 변경 — AUTH-05 · main-shell.md §8.
 *
 * <p><b>여기서 지키는 것은 순서와 갈래다.</b> 실패가 넷이고 서로 다른 조치를 요구하므로
 * (현재 비밀번호 · 무변경 · 정책 · 재사용) 하나로 뭉치면 사용자는 무엇을 고쳐야 하는지
 * 알 수 없다. 그리고 <b>현재 확인이 가장 먼저</b>여야 한다 — 뒤로 밀면 현재 비밀번호를
 * 모르는 사람이 응답으로 <b>정책을 떠볼</b> 수 있다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordChangeServiceTest {

    private static final String USER = "kim";
    private static final Instant NOW = Instant.parse("2026-08-29T01:00:00Z");

    @Mock private SysUserRepository users;
    @Mock private SysUserPwdHistRepository histories;
    @Mock private ConfigLookup configs;

    /**
     * <b>인코더를 mock 하지 않는다.</b> 네 판정 중 둘(무변경 · 재사용)이 {@code matches} 의
     * 결과에 걸려 있어, mock 으로 참/거짓을 지정하면 <b>테스트가 답을 미리 정해 두고</b>
     * 판정 자체는 검사되지 않는다.
     */
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

    private PasswordChangeService service;

    @BeforeEach
    void setUp() {
        /*
          <b>{@code PasswordHistory} 는 mock 이 아니라 진짜다</b>(2026-08-30). 이력을 옮기는
          규칙이 그리로 떨어져 나갔는데(관리자 발급이 같은 규칙을 써야 한다) 그것까지
          mock 으로 두면 <i>옛 해시가 이력이 된다</i> 를 검사하는 아래 두 테스트가
          <b>아무것도 재지 않게</b> 된다 — 레포지토리 mock 은 그대로라 검증 지점은 같다.
        */
        service = new PasswordChangeService(
                users,
                new PasswordHistory(histories, encoder),
                encoder,
                configs,
                new BusinessCalendar("Asia/Seoul", Clock.fixed(NOW, ZoneId.of("Asia/Seoul"))));
        givenPolicy(9, 3, 3);
    }

    @Test
    @DisplayName("바꾸면 옛 해시가 이력이 되고 새 해시가 계정에 남는다")
    void archivesOldAndStoresNew() {
        SysUser user = given("enc:OldPassw0rd!");
        when(histories.findLastSeq(USER)).thenReturn(2);
        when(histories.findByUserIdOrderByChgSeqDesc(eq(USER), any(Limit.class)))
                .thenReturn(List.of());

        service.changePassword(USER, "OldPassw0rd!", "NewPassw0rd!");

        ArgumentCaptor<SysUserPwdHist> saved = ArgumentCaptor.forClass(SysUserPwdHist.class);
        verify(histories).save(saved.capture());
        // 이력에 들어가는 것은 옛 값이다. 새 값을 넣으면 재사용 판정이 방금 정한
        // 비밀번호를 거절한다.
        assertThat(saved.getValue().getPwd()).isEqualTo("enc:OldPassw0rd!");
        assertThat(saved.getValue().getChgSeq()).isEqualTo(3);

        assertThat(user.getPwd()).isEqualTo("enc:NewPassw0rd!");
        assertThat(user.getPwdChgDtm()).isEqualTo(NOW);
    }

    @Test
    @DisplayName("임시 비밀번호 표시가 함께 내려간다 — 안 내리면 같은 화면에 갇힌다")
    void clearsTemporaryFlag() {
        SysUser user = SysUserFixture.asTemporary(given("enc:Temp0rary!"));
        when(histories.findByUserIdOrderByChgSeqDesc(eq(USER), any(Limit.class)))
                .thenReturn(List.of());

        service.changePassword(USER, "Temp0rary!", "NewPassw0rd!");

        assertThat(user.getPwdInitYn()).isFalse();
    }

    @Test
    @DisplayName("현재 비밀번호가 틀리면 거기서 멈춘다 — 정책을 떠볼 수 없다")
    void currentPasswordIsCheckedFirst() {
        given("enc:OldPassw0rd!");

        // 새 비밀번호가 정책에도 미달이지만, 나오는 것은 현재 비밀번호 실패여야 한다.
        assertThatThrownBy(() -> service.changePassword(USER, "wrong", "x"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(UserErrorCode.PWD_MISMATCH);

        verify(histories, never()).save(any());
    }

    @Test
    @DisplayName("지금 쓰는 것과 같으면 거절한다 — 이력에는 아직 없어 재사용 판정이 못 잡는다")
    void rejectsUnchanged() {
        given("enc:Passw0rd!!");

        assertThatThrownBy(() -> service.changePassword(USER, "Passw0rd!!", "Passw0rd!!"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(UserErrorCode.PWD_UNCHANGED);
    }

    @Test
    @DisplayName("정책 미달은 재사용 조회 전에 걸린다 — 읽을 필요가 없다")
    void rejectsWeak() {
        given("enc:OldPassw0rd!");

        assertThatThrownBy(() -> service.changePassword(USER, "OldPassw0rd!", "short1A"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(UserErrorCode.PWD_WEAK);

        verify(histories, never()).findByUserIdOrderByChgSeqDesc(anyString(), any(Limit.class));
    }

    @Test
    @DisplayName("최근 N건 안에 있으면 거절한다 — 솔트가 달라 SQL 로는 못 거른다")
    void rejectsReused() {
        given("enc:OldPassw0rd!");
        when(histories.findByUserIdOrderByChgSeqDesc(eq(USER), any(Limit.class)))
                .thenReturn(List.of(hist(2, "enc:NewPassw0rd!")));

        assertThatThrownBy(() -> service.changePassword(USER, "OldPassw0rd!", "NewPassw0rd!"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(UserErrorCode.PWD_REUSED);
    }

    @Test
    @DisplayName("재사용 금지가 0 이면 이력을 읽지도 지우지도 않는다")
    void reuseZeroSkipsHistoryEntirely() {
        givenPolicy(9, 3, 0);
        given("enc:OldPassw0rd!");
        when(histories.findLastSeq(USER)).thenReturn(0);

        service.changePassword(USER, "OldPassw0rd!", "NewPassw0rd!");

        verify(histories, never()).findByUserIdOrderByChgSeqDesc(anyString(), any(Limit.class));
        // 감사 기록으로는 남긴다 — 지우지 않을 뿐이다.
        verify(histories).save(any());
        verify(histories, never()).deleteUpTo(anyString(), anyInt());
    }

    @Test
    @DisplayName("보관 건수를 넘긴 옛 행을 지운다 — 방금 넣은 것은 남는다")
    void trimsHistoryToPolicy() {
        given("enc:OldPassw0rd!");
        when(histories.findLastSeq(USER)).thenReturn(9);
        when(histories.findByUserIdOrderByChgSeqDesc(eq(USER), any(Limit.class)))
                .thenReturn(List.of());

        service.changePassword(USER, "OldPassw0rd!", "NewPassw0rd!");

        // 새 순번은 10, 보관 3건이면 10·9·8 이 남아야 하므로 7 이하를 지운다.
        verify(histories).deleteUpTo(USER, 7);
    }

    private SysUser given(String encodedPwd) {
        SysUser user = SysUserFixture.user(USER, encodedPwd);
        when(users.findById(USER)).thenReturn(Optional.of(user));
        return user;
    }

    private void givenPolicy(int minLength, int kinds, int reuseBlockCount) {
        when(configs.get(AuthPasswordProps.class))
                .thenReturn(new AuthPasswordProps(
                        minLength,
                        kinds,
                        reuseBlockCount,
                        90,
                        7,
                        24,
                        true,
                        new AuthPasswordProps.Reset(10, 5, 60)));
    }

    private static SysUserPwdHist hist(int seq, String pwd) {
        return SysUserPwdHist.builder().userId(USER).chgSeq(seq).pwd(pwd).build();
    }
}
