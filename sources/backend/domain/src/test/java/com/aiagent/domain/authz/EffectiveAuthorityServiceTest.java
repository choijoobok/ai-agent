package com.aiagent.domain.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.repository.SysRoleMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysUserMenuAuthRepository;
import com.aiagent.domain.authz.service.EffectiveAuthorityService;
import com.aiagent.support.time.BusinessCalendar;
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

/**
 * 유효 권한 계산 — backend/security.md 의 <b>③ 합집합</b>과 <b>④ 게이트</b>.
 *
 * <p>②(출처 필터)는 JPQL 의 {@code where} 이므로 여기서 검사하지 않는다 — 저장소를 mock 하는
 * 순간 그 절은 실행되지 않는다. 이 테스트가 지키는 것은 <b>자바 쪽에 남은 두 단계</b>이며,
 * 그 둘이 정확히 <b>실수하면 권한 상승이 되는 자리</b>다.
 */
@ExtendWith(MockitoExtension.class)
class EffectiveAuthorityServiceTest {

    private static final String USER = "kim";
    private static final LocalDate TODAY = LocalDate.of(2026, 8, 29);

    @Mock private SysRoleMenuAuthRepository roleGrants;
    @Mock private SysUserMenuAuthRepository personalGrants;
    @Mock private SysMenuRepository menus;

    private EffectiveAuthorityService service;

    @BeforeEach
    void setUp() {
        Clock fixed = Clock.fixed(Instant.parse("2026-08-29T01:00:00Z"), ZoneId.of("Asia/Seoul"));
        service = new EffectiveAuthorityService(
                roleGrants, personalGrants, menus, new BusinessCalendar("Asia/Seoul", fixed));
    }

    @Test
    @DisplayName("합집합의 원소는 쌍이다 — 컬럼별로 합치면 아무도 주지 않은 조합이 생긴다")
    void unionIsOfPairsNotOfColumns() {
        // 역할 A=(주문, READ) · 역할 B=(사용자, SAVE). 컬럼별로 합치면 곱집합이 되어
        // (주문, SAVE) 와 (사용자, READ) 가 생긴다 — 권한 상승이다.
        givenRoleGrants(
                new MenuAction("ORDER", ActionType.READ),
                new MenuAction("USER_MGMT", ActionType.SAVE));
        givenPersonalGrants();
        givenMenus(leaf("ORDER"), leaf("USER_MGMT"));

        EffectiveAuthority authority = service.calculate(USER);

        assertThat(authority.grants()).containsExactlyInAnyOrder(
                new MenuAction("ORDER", ActionType.READ),
                new MenuAction("USER_MGMT", ActionType.SAVE));
        assertThat(authority.allows("ORDER", ActionType.SAVE)).isFalse();
        assertThat(authority.allows("USER_MGMT", ActionType.READ)).isFalse();
    }

    @Test
    @DisplayName("같은 메뉴에 액션이 갈려 있으면 합쳐진다 — 어느 역할에도 없던 조합이 만들어진다")
    void actionsOnTheSameMenuMerge() {
        givenRoleGrants(
                new MenuAction("ORDER", ActionType.READ),
                new MenuAction("ORDER", ActionType.SAVE),
                new MenuAction("ORDER", ActionType.READ)); // 중복은 무해하다
        givenPersonalGrants();
        givenMenus(leaf("ORDER"));

        EffectiveAuthority authority = service.calculate(USER);

        assertThat(authority.grants()).hasSize(2);
        assertThat(authority.allows("ORDER", ActionType.READ)).isTrue();
        assertThat(authority.allows("ORDER", ActionType.SAVE)).isTrue();
    }

    @Test
    @DisplayName("개인 예외는 독립 항이다 — 역할이 하나도 없어도 권한이 생긴다")
    void personalExceptionIsAnIndependentTerm() {
        givenRoleGrants();
        givenPersonalGrants(new MenuAction("ORDER", ActionType.EXPORT));
        givenMenus(leaf("ORDER"));

        EffectiveAuthority authority = service.calculate(USER);

        assertThat(authority.isEmpty()).isFalse();
        assertThat(authority.allows("ORDER", ActionType.EXPORT)).isTrue();
    }

    @Test
    @DisplayName("TC-5021 역할 READ와 기간 내 개인 SAVE는 한 유효 권한으로 합성된다")
    void roleAndPersonalGrantsAreMerged() {
        givenRoleGrants(new MenuAction("ORDER", ActionType.READ));
        givenPersonalGrants(new MenuAction("ORDER", ActionType.SAVE));
        givenMenus(leaf("ORDER"));

        assertThat(service.calculate(USER).grants())
                .containsExactlyInAnyOrder(
                        new MenuAction("ORDER", ActionType.READ),
                        new MenuAction("ORDER", ActionType.SAVE));
    }

    @Test
    @DisplayName("메뉴 USE_YN='N' 은 최종 게이트다 — 역할이 몇 개든 되살릴 수 없다")
    void disabledMenuIsRemovedFromTheResult() {
        givenRoleGrants(
                new MenuAction("ORDER", ActionType.READ),
                new MenuAction("DEAD", ActionType.READ));
        givenPersonalGrants(new MenuAction("DEAD", ActionType.SAVE));
        givenMenus(leaf("ORDER"), disabledLeaf("DEAD"));

        EffectiveAuthority authority = service.calculate(USER);

        assertThat(authority.menuCodes()).containsExactly("ORDER");
    }

    @Test
    @DisplayName("MENU_URL 이 없는 구조 노드는 권한 대상이 아니다 — 게이트가 같은 자리에서 뺀다")
    void structuralNodesAreRemoved() {
        givenRoleGrants(new MenuAction("SYSTEM", ActionType.READ));
        givenPersonalGrants();
        givenMenus(structural("SYSTEM"));

        assertThat(service.calculate(USER).isEmpty()).isTrue();
    }

    @Test
    @DisplayName("모르는 메뉴 코드는 통과시키지 않는다 — 판정의 기본값은 거부다")
    void unknownMenuIsDenied() {
        givenRoleGrants(new MenuAction("GHOST", ActionType.READ));
        givenPersonalGrants();
        givenMenus(leaf("ORDER"));

        assertThat(service.calculate(USER).isEmpty()).isTrue();
    }

    @Test
    @DisplayName("계산 날짜를 함께 담는다 — 아무도 아무것도 바꾸지 않아도 캐시가 낡기 때문이다")
    void carriesTheCalculationDate() {
        givenRoleGrants(new MenuAction("ORDER", ActionType.READ));
        givenPersonalGrants();
        givenMenus(leaf("ORDER"));

        EffectiveAuthority authority = service.calculate(USER);

        assertThat(authority.calcDate()).isEqualTo(TODAY);
        assertThat(authority.isStale(TODAY)).isFalse();
        assertThat(authority.isStale(TODAY.plusDays(1))).isTrue();
    }

    @Test
    @DisplayName("프론트에 나가는 것은 평탄화된 MENU_CD:ACTION 문자열이다")
    void permissionTokens() {
        givenRoleGrants(
                new MenuAction("ORDER", ActionType.SAVE),
                new MenuAction("ORDER", ActionType.READ));
        givenPersonalGrants();
        givenMenus(leaf("ORDER"));

        assertThat(service.calculate(USER).permissionTokens())
                .containsExactly("ORDER:READ", "ORDER:SAVE");
    }

    // ── 픽스처 ──────────────────────────────────────────────────────────

    private void givenRoleGrants(MenuAction... grants) {
        when(roleGrants.findGrantsOfUser(anyString(), any(), anyBoolean())).thenReturn(List.of(grants));
    }

    private void givenPersonalGrants(MenuAction... grants) {
        when(personalGrants.findGrantsOfUser(anyString(), any())).thenReturn(List.of(grants));
    }

    private void givenMenus(SysMenu... rows) {
        when(menus.findAll()).thenReturn(List.of(rows));
    }

    private static SysMenu leaf(String menuCd) {
        return SysMenuFixture.leaf(menuCd, null, 1);
    }

    private static SysMenu disabledLeaf(String menuCd) {
        return SysMenuFixture.disabledLeaf(menuCd, null, 1);
    }

    private static SysMenu structural(String menuCd) {
        return SysMenuFixture.folder(menuCd, null, 1);
    }
}
