package com.ordinary.backoffice.domain.authz;

import static com.ordinary.backoffice.domain.authz.SysGrantFixture.personalGrant;
import static com.ordinary.backoffice.domain.authz.SysGrantFixture.role;
import static com.ordinary.backoffice.domain.authz.SysGrantFixture.userRole;
import static com.ordinary.backoffice.domain.authz.SysMenuFixture.leaf;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.ordinary.backoffice.domain.authz.entity.SysRole;
import com.ordinary.backoffice.domain.authz.entity.SysUserRole;
import com.ordinary.backoffice.domain.authz.repository.SysMenuRepository;
import com.ordinary.backoffice.domain.authz.repository.SysRoleRepository;
import com.ordinary.backoffice.domain.authz.repository.SysUserMenuAuthRepository;
import com.ordinary.backoffice.domain.authz.repository.SysUserRoleRepository;
import com.ordinary.backoffice.domain.authz.service.MyAuthorityService;
import com.ordinary.backoffice.support.time.BusinessCalendar;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * 내 역할 — AUTHZ-04 · main-shell.md §8.
 *
 * <p><b>유효 권한 계산과 방향이 반대라는 것이 이 테스트의 전부다.</b>
 * {@link com.ordinary.backoffice.domain.authz.service.EffectiveAuthorityService} 는 만료·비활성을
 * <b>걸러 버리고</b>, 여기는 <i>왜 할 수 없는가</i> 를 보이려고 <b>걸러진 것까지 남긴다</b> —
 * 그것을 감추면 <i>어제까지 되던 것이 왜 안 되나</i> 에 답할 것이 없어진다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MyAuthorityServiceTest {

    private static final String USER = "kim";
    private static final LocalDate TODAY = LocalDate.of(2026, 8, 29);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    @Mock private SysUserRoleRepository userRoles;
    @Mock private SysRoleRepository roles;
    @Mock private SysUserMenuAuthRepository personalGrants;
    @Mock private SysMenuRepository menus;

    private MyAuthorityService service;

    @BeforeEach
    void setUp() {
        Clock fixed = Clock.fixed(Instant.parse("2026-08-29T01:00:00Z"), SEOUL);
        service = new MyAuthorityService(
                userRoles,
                roles,
                personalGrants,
                menus,
                new BusinessCalendar("Asia/Seoul", fixed));
        when(userRoles.findByUserIdOrderByRoleIdAsc(USER)).thenReturn(List.of());
        when(personalGrants.findByUserIdOrderByMenuCdAscActionCdAsc(USER)).thenReturn(List.of());
        when(roles.findAllById(any())).thenReturn(List.of());
        when(menus.findAllById(any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("만료된 부여도 남긴다 — 감추면 왜 안 되는지 물을 곳이 없어진다")
    void keepsExpiredGrants() {
        givenRoles(role("ADMIN", true), userRole(USER, "ADMIN", TODAY.minusDays(30), TODAY.minusDays(1)));

        List<MyRoleGrant> found = service.getMyAuthority(USER).roles();

        assertThat(found).hasSize(1);
        assertThat(found.get(0).effective()).isFalse();
        // 역할은 켜져 있다 — 문제는 기간이며 화면이 그 둘을 갈라 말해야 한다.
        assertThat(found.get(0).roleUseYn()).isTrue();
    }

    @Test
    @DisplayName("기간 양끝을 포함한다 — 마지막 날에도 유효하다")
    void periodIsInclusive() {
        givenRoles(role("ADMIN", true), userRole(USER, "ADMIN", TODAY, TODAY));

        assertThat(service.getMyAuthority(USER).roles().get(0).effective()).isTrue();
    }

    @Test
    @DisplayName("기간이 NULL 이면 무기한이다 — 9999-12-31 을 채우지 않기로 한 결과다")
    void nullPeriodMeansUnlimited() {
        givenRoles(role("ADMIN", true), userRole(USER, "ADMIN", null, null));

        assertThat(service.getMyAuthority(USER).roles().get(0).effective()).isTrue();
    }

    @Test
    @DisplayName("역할이 꺼져 있으면 기간이 남아도 유효하지 않다 — 갈라야 어디로 갈지 안다")
    void disabledRoleIsNotEffectiveEvenInPeriod() {
        givenRoles(role("ADMIN", false), userRole(USER, "ADMIN", null, null));

        MyRoleGrant found = service.getMyAuthority(USER).roles().get(0);
        assertThat(found.effective()).isFalse();
        assertThat(found.roleUseYn()).isFalse();
    }

    @Test
    @DisplayName("역할이 지워졌어도 부여를 감추지 않는다 — 있다는 사실 자체를 못 보게 된다")
    void keepsGrantWhenRoleRowIsGone() {
        when(userRoles.findByUserIdOrderByRoleIdAsc(USER))
                .thenReturn(List.of(userRole(USER, "GHOST", null, null)));
        when(roles.findAllById(any())).thenReturn(List.of());

        MyRoleGrant found = service.getMyAuthority(USER).roles().get(0);
        assertThat(found.roleId()).isEqualTo("GHOST");
        assertThat(found.effective()).isFalse();
    }

    @Test
    @DisplayName("개인 예외는 메뉴명 자리에 메시지 키를 싣는다 — 이름의 원본은 SYS_MESSAGE 다")
    void personalGrantCarriesMessageKey() {
        when(personalGrants.findByUserIdOrderByMenuCdAscActionCdAsc(USER))
                .thenReturn(List.of(personalGrant(
                        USER, "USER_MGMT", ActionType.SAVE, TODAY.minusDays(1), TODAY.plusDays(1))));
        when(menus.findAllById(any())).thenReturn(List.of(leaf("USER_MGMT", null, 1)));

        MyMenuGrant found = service.getMyAuthority(USER).grants().get(0);
        assertThat(found.menuNm()).isEqualTo("menu.USER_MGMT");
        assertThat(found.actionCd()).isEqualTo(ActionType.SAVE);
        assertThat(found.effective()).isTrue();
        // 사유는 부여할 때 필수다 — 받은 사람이 볼 수 없으면 그 마찰이 기록으로만 남는다.
        assertThat(found.grantRsn()).isNotBlank();
    }

    @Test
    @DisplayName("기준일을 함께 낸다 — 브라우저의 오늘로 판정하면 자정 전후가 어긋난다")
    void carriesBusinessToday() {
        assertThat(service.getMyAuthority(USER).businessToday()).isEqualTo(TODAY);
    }

    private void givenRoles(SysRole role, SysUserRole grant) {
        when(userRoles.findByUserIdOrderByRoleIdAsc(USER)).thenReturn(List.of(grant));
        when(roles.findAllById(any())).thenReturn(List.of(role));
    }
}
