package com.ordinary.backoffice.domain.user.detail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.grid.RowState;
import com.ordinary.backoffice.domain.authz.entity.SysUserRole;
import com.ordinary.backoffice.domain.authz.repository.SysRoleRepository;
import com.ordinary.backoffice.domain.authz.repository.SysUserRoleRepository;
import com.ordinary.backoffice.domain.user.entity.SysUserIpAllow;
import com.ordinary.backoffice.domain.user.repository.SysUserIpAllowRepository;
import com.ordinary.backoffice.domain.user.repository.SysUserRepository;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * 디테일 탭의 저장 — 61 §3.8 탭 1 · 탭 3.
 *
 * <p><b>재는 것이 셋이다.</b> <i>회수와 삭제가 갈리는가</i> · <i>거부되는 요청이 쓰기를 하지
 * 않는가</i> · <i>형식 검사가 들어오는 것에만 걸리는가</i>.
 *
 * <p>첫째가 이 화면의 핵심이다. 42 §3.1 이 <b>회수는 삭제가 아니라 {@code VALID_TO_DT}</b>
 * 라고 정했고 61 §4.7 이 <b>행 삭제는 잘못 등록한 행 정리</b> 로 남겨 두었다 — 둘을 섞으면
 * <i>"누가 언제까지 무슨 역할을 가졌는가"</i> 가 사라진다. 변경 이력 테이블이 없으므로
 * (ADR-0010) 그 기록을 갖는 것이 이 행뿐이다.
 *
 * <p>셋째는 <b>조용한 함정</b>이다. 형식 검사를 삭제 행에도 걸면, 검사가 뒤에 바뀌었을 때
 * <b>예전에 들어간 값이 지울 수 없는 행</b>이 된다 — 그 상태에서 관리자가 할 수 있는 일이
 * 아무것도 없다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserDetailServiceTest {

    private static final String USER = "dev1";
    private static final String ROLE = "DEVELOPER";
    private static final LocalDate FROM = LocalDate.of(2026, 8, 1);
    private static final LocalDate TO = LocalDate.of(2026, 12, 31);

    @Mock private SysUserRepository users;
    @Mock private SysRoleRepository roles;
    @Mock private SysUserRoleRepository grants;
    @Mock private SysUserIpAllowRepository ipAllows;

    private UserDetailService service;

    @BeforeEach
    void setUp() {
        service = new UserDetailService(users, roles, grants, ipAllows);
        when(users.existsById(anyString())).thenReturn(true);
        when(roles.existsById(anyString())).thenReturn(true);
        when(grants.findByUserIdOrderByRoleIdAsc(anyString())).thenReturn(List.of());
        when(ipAllows.findByUserIdOrderByIpCidrAsc(anyString())).thenReturn(List.of());
    }

    // ── 탭 1 — 보유 역할 ───────────────────────────────────────────

    @Nested
    @DisplayName("보유 역할 — 회수와 삭제가 갈린다")
    class Roles {

        @Test
        @DisplayName("기간을 비운 부여가 통과한다 — null 이 무기한이고 그것이 다수다(42 §3.1)")
        void openEndedGrantIsAllowed() {
            service.saveRoles(USER, List.of(new UserRoleSaveRow(RowState.C, ROLE, null, null)));

            ArgumentCaptor<List<SysUserRole>> saved = captor();
            verify(grants).saveAll(saved.capture());
            assertThat(saved.getValue()).singleElement().satisfies(row -> {
                assertThat(row.getValidFromDt()).isNull();
                assertThat(row.getValidToDt()).isNull();
            });
        }

        @Test
        @DisplayName("회수는 U 이고 행이 남는다 — 종료일을 어제로 하는 것이 회수다(42 §3.1)")
        void revokeKeepsTheRow() {
            SysUserRole existing = SysUserRole.granted(USER, ROLE, FROM, TO);
            when(grants.findByUserIdOrderByRoleIdAsc(USER)).thenReturn(List.of(existing));

            LocalDate yesterday = LocalDate.of(2026, 8, 30);
            service.saveRoles(USER, List.of(new UserRoleSaveRow(RowState.U, ROLE, FROM, yesterday)));

            assertThat(existing.getValidToDt()).isEqualTo(yesterday);
            // 회수인데 지웠다면 여기서 걸린다 — 사유도 기간도 함께 사라진다.
            verify(grants, never()).deleteAll(org.mockito.ArgumentMatchers.anyList());
        }

        @Test
        @DisplayName("삭제는 잘못 등록한 행 정리다 — 막지 않는다(61 §4.7 의 셋째 줄)")
        void deleteIsAllowed() {
            SysUserRole existing = SysUserRole.granted(USER, ROLE, FROM, TO);
            when(grants.findByUserIdOrderByRoleIdAsc(USER)).thenReturn(List.of(existing));

            service.saveRoles(USER, List.of(new UserRoleSaveRow(RowState.D, ROLE, null, null)));

            ArgumentCaptor<List<SysUserRole>> removed = captor();
            verify(grants).deleteAll(removed.capture());
            assertThat(removed.getValue()).containsExactly(existing);
        }

        @Test
        @DisplayName("이미 가진 역할을 또 주면 거부한다 — PK 가 (사용자, 역할) 하나다(42 §3.2)")
        void duplicateGrantIsRejected() {
            when(grants.findByUserIdOrderByRoleIdAsc(USER))
                    .thenReturn(List.of(SysUserRole.granted(USER, ROLE, FROM, TO)));

            assertThatThrownBy(() -> service.saveRoles(
                            USER, List.of(new UserRoleSaveRow(RowState.C, ROLE, FROM, TO))))
                    .isInstanceOf(BusinessException.class);
            /*
              <b>거부되는 요청이 쓰기를 하지 않는다.</b> 트랜잭션 안이라 롤백되지만, 나갔다
              돌아오는 것과 아예 나가지 않는 것은 다르다 — 로그에 남고, 읽는 사람은
              <i>검증에 걸린 저장이 INSERT 를 했다</i> 를 보게 된다.
            */
            verify(grants, never()).saveAll(org.mockito.ArgumentMatchers.anyList());
        }

        @Test
        @DisplayName("한 요청에 같은 역할이 둘이면 거부한다 — 두 번째가 첫 번째를 조용히 덮는다")
        void duplicateWithinOneRequestIsRejected() {
            assertThatThrownBy(() -> service.saveRoles(
                            USER,
                            List.of(
                                    new UserRoleSaveRow(RowState.C, ROLE, FROM, TO),
                                    new UserRoleSaveRow(RowState.C, ROLE, null, null))))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("없는 부여를 고치려 하면 거부한다 — 다른 사람이 먼저 정리했다")
        void editingMissingGrantIsRejected() {
            assertThatThrownBy(() -> service.saveRoles(
                            USER, List.of(new UserRoleSaveRow(RowState.U, ROLE, FROM, TO))))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("기간이 뒤집히면 거부한다 — 그 부여는 어느 날도 유효하지 않다(40 §4.3)")
        void reversedPeriodIsRejected() {
            assertThatThrownBy(() -> service.saveRoles(
                            USER, List.of(new UserRoleSaveRow(RowState.C, ROLE, TO, FROM))))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("같은 날 하루짜리 부여는 통과한다 — 양끝 포함이다(40 §4.3)")
        void singleDayGrantIsAllowed() {
            assertThatCode(() -> service.saveRoles(
                            USER, List.of(new UserRoleSaveRow(RowState.C, ROLE, FROM, FROM))))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("없는 역할은 거부한다 — 화면이 낡았거나 화면 밖 경로다")
        void unknownRoleIsRejected() {
            when(roles.existsById(ROLE)).thenReturn(false);

            assertThatThrownBy(() -> service.saveRoles(
                            USER, List.of(new UserRoleSaveRow(RowState.C, ROLE, FROM, TO))))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("없는 계정은 거부한다 — FK 가 막기 전에 우리가 먼저 말한다")
        void unknownUserIsRejected() {
            when(users.existsById(USER)).thenReturn(false);

            assertThatThrownBy(() -> service.saveRoles(USER, List.of()))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("빈 목록은 아무도 재계산시키지 않는다 — 이름만 고친 저장이 그 경우다")
        void emptySaveMarksNobody() {
            assertThat(service.saveRoles(USER, List.of())).isEmpty();
        }

        @Test
        @DisplayName("바꾼 것이 있으면 그 사람 하나를 낸다 — 개인 예외와 같이 대상이 하나다")
        void changedSaveMarksTheUser() {
            assertThat(service.saveRoles(
                            USER, List.of(new UserRoleSaveRow(RowState.C, ROLE, FROM, TO))))
                    .containsExactly(USER);
        }
    }

    // ── 탭 3 — 접속 IP ────────────────────────────────────────────

    @Nested
    @DisplayName("접속 IP — 형식은 들어오는 것에만 건다")
    class Ips {

        @Test
        @DisplayName("첫 대역을 전부 지우는 것을 막지 않는다 — 행이 없으면 제한 없음이다(41 §7)")
        void clearingEveryRangeIsAllowed() {
            SysUserIpAllow existing = SysUserIpAllow.created(USER, "10.0.0.0/8", true, null, null);
            when(ipAllows.findByUserIdOrderByIpCidrAsc(USER)).thenReturn(List.of(existing));

            assertThatCode(() -> service.saveIps(
                            USER, List.of(new UserIpSaveRow(RowState.D, "10.0.0.0/8", null, null, null))))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("삭제에는 형식을 보지 않는다 — 검사가 바뀌면 못 지우는 행이 생긴다")
        void deleteSkipsFormatCheck() {
            SysUserIpAllow legacy = SysUserIpAllow.created(USER, "sales-office", true, null, null);
            when(ipAllows.findByUserIdOrderByIpCidrAsc(USER)).thenReturn(List.of(legacy));

            assertThatCode(() -> service.saveIps(
                            USER, List.of(new UserIpSaveRow(RowState.D, "sales-office", null, null, null))))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("형식이 아니면 거부한다 — DDL 에 둘 수 없는 검사다(db-portability.md §4)")
        void malformedRangeIsRejected() {
            assertThatThrownBy(() -> service.saveIps(
                            USER, List.of(new UserIpSaveRow(RowState.C, "192.168.0", true, null, null))))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("사용 여부를 비워 보내면 켜진 것으로 읽는다 — 끄려고 추가하는 일은 없다")
        void missingUseYnDefaultsToOn() {
            service.saveIps(USER, List.of(new UserIpSaveRow(RowState.C, "10.1.2.3", null, null, null)));

            ArgumentCaptor<List<SysUserIpAllow>> saved = captor();
            verify(ipAllows).saveAll(saved.capture());
            assertThat(saved.getValue()).singleElement().satisfies(
                    row -> assertThat(row.getUseYn()).isTrue());
        }

        @Test
        @DisplayName("기간이 뒤집히면 거부한다 — 그 대역은 어느 날도 허용되지 않는다(40 §4.3)")
        void reversedPeriodIsRejected() {
            assertThatThrownBy(() -> service.saveIps(
                            USER,
                            List.of(new UserIpSaveRow(
                                    RowState.C,
                                    "10.1.2.3",
                                    true,
                                    LocalDate.of(2026, 9, 2),
                                    LocalDate.of(2026, 9, 1)))))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("같은 날 하루짜리 허용은 통과한다 — 양끝 포함이다(40 §4.3)")
        void singleDayPeriodPasses() {
            LocalDate day = LocalDate.of(2026, 9, 1);

            assertThatCode(() -> service.saveIps(
                            USER,
                            List.of(new UserIpSaveRow(RowState.C, "10.1.2.3", true, day, day))))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("기간을 비우면 제한이 없다 — 기간이 없던 기존 행과 같은 뜻이다(41 §7)")
        void emptyPeriodMeansNoLimit() {
            service.saveIps(
                    USER, List.of(new UserIpSaveRow(RowState.C, "10.1.2.3", true, null, null)));

            ArgumentCaptor<List<SysUserIpAllow>> saved = captor();
            verify(ipAllows).saveAll(saved.capture());
            assertThat(saved.getValue()).singleElement().satisfies(row -> {
                assertThat(row.getValidFromDt()).isNull();
                assertThat(row.getValidToDt()).isNull();
            });
        }

        @Test
        @DisplayName("같은 대역을 두 번 넣으면 거부한다 — PK 가 (사용자, 대역) 하나다(41 §7)")
        void duplicateRangeIsRejected() {
            when(ipAllows.findByUserIdOrderByIpCidrAsc(USER))
                    .thenReturn(List.of(SysUserIpAllow.created(USER, "10.0.0.0/8", true, null, null)));

            assertThatThrownBy(() -> service.saveIps(
                            USER, List.of(new UserIpSaveRow(RowState.C, "10.0.0.0/8", true, null, null))))
                    .isInstanceOf(BusinessException.class);
        }
    }

    // ── 형식 판정 (41 §7) ─────────────────────────────────────────

    @Nested
    @DisplayName("IP · CIDR 판정 — 접두 길이의 상한이 계열에서 나온다")
    class Format {

        @Test
        @DisplayName("IPv4 · IPv6 · CIDR 을 받는다")
        void acceptsLiterals() {
            assertThat(UserDetailService.isIpOrCidr("192.168.0.10")).isTrue();
            assertThat(UserDetailService.isIpOrCidr("10.0.0.0/8")).isTrue();
            assertThat(UserDetailService.isIpOrCidr("10.0.0.0/0")).isTrue();
            assertThat(UserDetailService.isIpOrCidr("2001:db8::1")).isTrue();
            assertThat(UserDetailService.isIpOrCidr("2001:db8::/32")).isTrue();
            assertThat(UserDetailService.isIpOrCidr("::1/128")).isTrue();
        }

        @Test
        @DisplayName("IPv4 에 /64 는 거부한다 — 상한을 상수 하나로 두면 통과한다")
        void prefixLimitFollowsTheFamily() {
            assertThat(UserDetailService.isIpOrCidr("1.2.3.4/64")).isFalse();
            assertThat(UserDetailService.isIpOrCidr("1.2.3.4/32")).isTrue();
            assertThat(UserDetailService.isIpOrCidr("2001:db8::/129")).isFalse();
        }

        @Test
        @DisplayName("호스트명을 받지 않는다 — 받으면 DNS 가 도는 순간 그것이 저장된다")
        void rejectsHostNames() {
            assertThat(UserDetailService.isIpOrCidr("office.example.com")).isFalse();
            assertThat(UserDetailService.isIpOrCidr("localhost")).isFalse();
        }

        @Test
        @DisplayName("접두가 비었거나 부호가 붙으면 거부한다 — parseInt 는 그것들을 다르게 다룬다")
        void rejectsOddPrefixes() {
            assertThat(UserDetailService.isIpOrCidr("10.0.0.0/")).isFalse();
            assertThat(UserDetailService.isIpOrCidr("10.0.0.0/+8")).isFalse();
            assertThat(UserDetailService.isIpOrCidr("10.0.0.0/ 8")).isFalse();
            assertThat(UserDetailService.isIpOrCidr("10.0.0.0/-1")).isFalse();
            assertThat(UserDetailService.isIpOrCidr("10.0.0.0/99999999999")).isFalse();
        }

        @Test
        @DisplayName("빈 값과 잘린 주소를 거부한다")
        void rejectsEmptyAndTruncated() {
            assertThat(UserDetailService.isIpOrCidr(null)).isFalse();
            assertThat(UserDetailService.isIpOrCidr("  ")).isFalse();
            assertThat(UserDetailService.isIpOrCidr("192.168.0")).isFalse();
            assertThat(UserDetailService.isIpOrCidr("999.1.1.1")).isFalse();
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> ArgumentCaptor<List<T>> captor() {
        return ArgumentCaptor.forClass(List.class);
    }
}
