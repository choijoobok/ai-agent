package com.aiagent.domain.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.grid.RowState;
import com.aiagent.domain.authz.entity.SysUserMenuAuth;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.repository.SysRoleMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysUserMenuAuthRepository;
import com.aiagent.domain.authz.service.MenuActionCatalog;
import com.aiagent.domain.authz.userauth.UserAuthSaveRow;
import com.aiagent.domain.authz.userauth.UserAuthService;
import com.aiagent.domain.user.repository.SysUserRepository;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
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
 * 개인 예외 저장 — screen/user/requirements.md · sys/menu.md 의 원칙 P1.
 *
 * <p><b>여기서 재는 것은 서버가 마지막으로 막는 것들</b>이다. 화면도 같은 것을 막지만 그것은
 * UX 이고(frontend/grid.md), 요청 본문은 조작할 수 있으며 화면 없이 부르는 경로가 늘 있다.
 *
 * <p>가장 미묘한 것이 <b>{@code READ} 불변식의 판정 범위</b>다. 규칙은 screen/menu/requirements.md 와 같은데
 * <b>무엇을 두고 그 규칙을 보는가</b>가 다르다 — 여기서는 <b>역할과 개인 예외의 합집합</b>
 * 이다(backend/security.md ③). 역할이 조회를 주고 있으면 개인 예외에는 저장만 있어도 되고, 그것이 이
 * 화면의 가장 흔한 쓰임이다: <i>이미 볼 수 있는 사람에게 고칠 수 있게만 더해 주는 일</i>.
 *
 * <p>그 판정이 좁으면(역할을 안 보면) <b>정상 운영이 거부</b>되고, 넓으면(아무것도 안 보면)
 * <b>도달할 수 없는 권한</b>이 데이터에 남아 감사에서 거짓말을 한다. 둘 다 조용한 실패라
 * 테스트 말고는 드러나는 자리가 없다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserAuthServiceTest {

    private static final String USER = "mgr1";
    private static final String MENU = "USER_MGMT";
    private static final LocalDate TODAY = LocalDate.of(2026, 8, 30);
    private static final LocalDate FROM = LocalDate.of(2026, 8, 1);
    private static final LocalDate TO = LocalDate.of(2026, 12, 31);
    private static final String REASON = "사용자 운영 위임";

    @Mock private SysUserRepository users;
    @Mock private SysUserMenuAuthRepository grants;
    @Mock private SysRoleMenuAuthRepository roleAuths;
    @Mock private SysMenuRepository menus;
    @Mock private MenuActionCatalog actions;

    private UserAuthService service;

    @BeforeEach
    void setUp() {
        service = new UserAuthService(
                users, grants, roleAuths, menus, actions,
                new BusinessCalendar(
                        "Asia/Seoul",
                        Clock.fixed(Instant.parse("2026-08-30T01:00:00Z"), ZoneId.of("Asia/Seoul"))));

        when(users.existsById(USER)).thenReturn(true);
        when(menus.findAll()).thenReturn(List.of(
                SysMenuFixture.leaf(MENU, "USER", 1),
                SysMenuFixture.folder("USER", null, 1)));
        when(actions.definedActions()).thenReturn(Map.of(
                MENU, EnumSet.of(ActionType.READ, ActionType.SAVE, ActionType.EXPORT)));
        when(grants.findByUserIdOrderByMenuCdAscActionCdAsc(USER)).thenReturn(List.of());
        when(roleAuths.findGrantsOfUser(anyString(), any(), anyBoolean())).thenReturn(List.of());
    }

    // ── READ 불변식 — 판정은 합집합에서 (screen/user/requirements.md) ────────────────────

    @Nested
    @DisplayName("READ 불변식은 합집합에서 판정한다")
    class ReadInvariant {

        @Test
        @DisplayName("역할도 개인 예외도 조회를 주지 않으면 거부한다 — 메뉴는 보이는데 화면에 못 들어간다")
        void rejectsWhenNobodyGrantsRead() {
            assertThatThrownBy(() -> service.save(USER, List.of(add(ActionType.SAVE))))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("조회 없이");

            verify(grants, never()).saveAll(any());
        }

        @Test
        @DisplayName("역할이 조회를 주고 있으면 저장만 줘도 통과한다 — 이 화면의 가장 흔한 쓰임이다")
        void acceptsWhenRoleGrantsRead() {
            when(roleAuths.findGrantsOfUser(anyString(), any(), anyBoolean()))
                    .thenReturn(List.of(new MenuAction(MENU, ActionType.READ)));

            assertThatCode(() -> service.save(USER, List.of(add(ActionType.SAVE))))
                    .doesNotThrowAnyException();

            assertThat(saved()).extracting(SysUserMenuAuth::getActionCd)
                    .containsExactly(ActionType.SAVE);
        }

        @Test
        @DisplayName("같은 요청에 조회를 함께 주면 통과한다 — 반영 뒤의 상태를 본다")
        void acceptsWhenReadComesInTheSameRequest() {
            assertThatCode(() ->
                    service.save(USER, List.of(add(ActionType.SAVE), add(ActionType.READ))))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("역할이 다른 메뉴의 조회를 줄 뿐이면 거부한다 — 메뉴가 다르면 못 들어간다")
        void rejectsWhenRoleGrantsReadOnAnotherMenu() {
            when(roleAuths.findGrantsOfUser(anyString(), any(), anyBoolean()))
                    .thenReturn(List.of(new MenuAction("CODE_MGMT", ActionType.READ)));

            assertThatThrownBy(() -> service.save(USER, List.of(add(ActionType.SAVE))))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("조회만 주는 것은 언제나 통과한다 — 줄이는 쪽에는 전제가 없다")
        void readAloneIsAlwaysFine() {
            assertThatCode(() -> service.save(USER, List.of(add(ActionType.READ))))
                    .doesNotThrowAnyException();
        }
    }

    // ── 줄 수 있는 조합인가 (sys/menu.md) ──────────────────────────────────

    @Nested
    @DisplayName("줄 수 없는 것은 거부한다")
    class Grantable {

        @Test
        @DisplayName("구조 노드에는 줄 수 없다 — MENU_URL 이 없다")
        void rejectsFolder() {
            assertThatThrownBy(() -> service.save(USER, List.of(
                    new UserAuthSaveRow(RowState.C, "USER", ActionType.READ, FROM, TO, REASON))))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("권한을 줄 수 없는 메뉴");
        }

        @Test
        @DisplayName("정의되지 않은 액션은 거부한다 — 트리에서 — 로 그려지는 칸이다")
        void rejectsUndefinedAction() {
            assertThatThrownBy(() -> service.save(USER, List.of(add(ActionType.EXECUTE))))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("정의되지 않은 액션");
        }

        @Test
        @DisplayName("고아 부여는 지울 수 있다 — 막으면 영영 정리하지 못한다(seed.md)")
        void allowsDeletingAnOrphan() {
            /*
              {@code EXECUTE} 는 정의 밖이다. 그런데도 부여 행이 있는 것이 <b>고아</b>이며,
              screen/user/requirements.md 이 <i>잘못 등록한 행 정리</i> 를 셋째 수단으로 적어 두었다 — 지우는
              것까지 막으면 <b>사람이 판단할 길</b>이 사라진다.
            */
            SysUserMenuAuth orphan = grant(ActionType.EXECUTE);
            when(grants.findByUserIdOrderByMenuCdAscActionCdAsc(USER)).thenReturn(List.of(orphan));

            assertThatCode(() -> service.save(USER, List.of(
                    new UserAuthSaveRow(RowState.D, MENU, ActionType.EXECUTE, null, null, null))))
                    .doesNotThrowAnyException();

            verify(grants).deleteAll(List.of(orphan));
        }
    }

    // ── 기간과 사유 (AUTHZ-07) ───────────────────────────────────────

    @Nested
    @DisplayName("기간과 사유는 필수다")
    class Required {

        @Test
        @DisplayName("기간을 비우면 거부한다 — 무기한이라는 선택지가 없다")
        void rejectsMissingPeriod() {
            assertThatThrownBy(() -> service.save(USER, List.of(
                    new UserAuthSaveRow(RowState.C, MENU, ActionType.READ, FROM, null, REASON))))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("부여 기간");
        }

        @Test
        @DisplayName("기간이 뒤집히면 거부한다 — 어느 날도 유효하지 않은 행이 된다")
        void rejectsReversedPeriod() {
            assertThatThrownBy(() -> service.save(USER, List.of(
                    new UserAuthSaveRow(RowState.C, MENU, ActionType.READ, TO, FROM, REASON))))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("뒤집혔다");
        }

        @Test
        @DisplayName("사유를 비우면 거부한다 — 이 행이 곧 감사 기록이다")
        void rejectsBlankReason() {
            assertThatThrownBy(() -> service.save(USER, List.of(
                    new UserAuthSaveRow(RowState.C, MENU, ActionType.READ, FROM, TO, "  "))))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("부여 사유");
        }
    }

    // ── 회수는 삭제가 아니다 (screen/user/requirements.md) ───────────────────────────────

    @Test
    @DisplayName("회수는 같은 행의 종료일을 고친다 — 행을 지우면 사유가 사라진다")
    void revokeUpdatesTheSameRow() {
        SysUserMenuAuth existing = grant(ActionType.READ);
        when(grants.findByUserIdOrderByMenuCdAscActionCdAsc(USER)).thenReturn(List.of(existing));

        service.save(USER, List.of(new UserAuthSaveRow(
                RowState.U, MENU, ActionType.READ, FROM, TODAY.minusDays(1), REASON)));

        assertThat(existing.getValidToDt()).isEqualTo(TODAY.minusDays(1));
        assertThat(existing.getGrantRsn()).isEqualTo(REASON);
        verify(grants, never()).deleteAll(any());
    }

    @Test
    @DisplayName("같은 조합을 두 번 만들려 하면 거부한다 — PK 가 하나다")
    void rejectsDuplicateInOneRequest() {
        assertThatThrownBy(() ->
                service.save(USER, List.of(add(ActionType.READ), add(ActionType.READ))))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("같은 조합");
    }

    @Test
    @DisplayName("없는 계정이면 거부한다 — 화면이 낡았거나 화면 밖 경로다")
    void rejectsUnknownUser() {
        when(users.existsById(USER)).thenReturn(false);

        assertThatThrownBy(() -> service.save(USER, List.of(add(ActionType.READ))))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("없는 계정");
    }

    // ── 조립 ─────────────────────────────────────────────────────────

    private static UserAuthSaveRow add(ActionType action) {
        return new UserAuthSaveRow(RowState.C, MENU, action, FROM, TO, REASON);
    }

    private static SysUserMenuAuth grant(ActionType action) {
        return SysUserMenuAuth.created(USER, MENU, action, FROM, TO, REASON);
    }

    private List<SysUserMenuAuth> saved() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SysUserMenuAuth>> captor = ArgumentCaptor.forClass(List.class);
        verify(grants).saveAll(captor.capture());
        return captor.getValue();
    }
}
