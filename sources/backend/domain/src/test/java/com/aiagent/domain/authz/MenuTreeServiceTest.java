package com.aiagent.domain.authz;

import static com.aiagent.domain.authz.SysMenuFixture.disabledFolder;
import static com.aiagent.domain.authz.SysMenuFixture.folder;
import static com.aiagent.domain.authz.SysMenuFixture.leaf;
import static com.aiagent.domain.authz.SysMenuFixture.menu;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.service.MenuTreeService;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 조상 역산 — AUTHZ-04.
 *
 * <p>이 클래스가 지키는 것은 둘이다. <b>보여야 할 것이 보이는가</b>(조상이 딸려오는가)와
 * <b>보이면 안 되는 것이 안 보이는가</b>(권한 없는 형제). 그리고 셋째로 <b>깨진 데이터에서
 * 터지지 않는가</b> — sys/menu.md 가 순회 코드에 방문 집합과 깊이 상한을 요구한 이유이며, 그것이
 * 없으면 순환 하나가 로그인 전체를 멈춘다.
 */
@ExtendWith(MockitoExtension.class)
class MenuTreeServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 8, 29);

    @Mock private SysMenuRepository menus;

    @Test
    @DisplayName("리프 하나면 그 조상 경로가 통째로 딸려온다 — 개인 예외도 트리에 자연히 나타난다")
    void ancestorsComeAlong() {
        givenMenus(
                folder("SYSTEM", null, 1),
                folder("SYSTEM_USER", "SYSTEM", 1),
                leaf("USER_MGMT", "SYSTEM_USER", 1));

        List<MenuNode> tree = build(grant("USER_MGMT"));

        assertThat(codes(tree)).containsExactly("SYSTEM");
        assertThat(codes(tree.getFirst().children())).containsExactly("SYSTEM_USER");
        assertThat(codes(tree.getFirst().children().getFirst().children()))
                .containsExactly("USER_MGMT");
    }

    @Test
    @DisplayName("권한 없는 형제는 나오지 않는다 — 조상을 공유해도 각자 판정이다")
    void siblingsWithoutGrantAreAbsent() {
        givenMenus(
                folder("SYSTEM", null, 1),
                leaf("USER_MGMT", "SYSTEM", 1),
                leaf("ROLE_MGMT", "SYSTEM", 2));

        List<MenuNode> tree = build(grant("USER_MGMT"));

        assertThat(codes(tree.getFirst().children())).containsExactly("USER_MGMT");
    }

    @Test
    @DisplayName("형제 순서는 SORT_NO 이고 겹치면 MENU_CD 가 가른다 — 순서가 실행계획을 타지 않게")
    void siblingOrderIsDeterministic() {
        givenMenus(
                folder("SYSTEM", null, 1),
                leaf("B_MENU", "SYSTEM", 2),
                leaf("A_MENU", "SYSTEM", 2),
                leaf("FIRST", "SYSTEM", 1));

        List<MenuNode> tree = build(grant("A_MENU", "B_MENU", "FIRST"));

        assertThat(codes(tree.getFirst().children())).containsExactly("FIRST", "A_MENU", "B_MENU");
    }

    @Test
    @DisplayName("구조 노드의 USE_YN='N' 은 트리에서 빼지 않는다 — 게이트는 리프 단독 판정이다")
    void disabledFolderDoesNotHideItsGrantedLeaf() {
        // sys/menu.md — 폴더의 스위치는 자손 전체에 같은 값을 쓰는 일괄 명령이다. 리프가 여전히
        // 켜져 있다는 것은 그 명령이 없었다는 뜻이며, 여기서 조상 값을 한 번 더 보면
        // 같은 사실을 두 곳이 판정하게 된다.
        givenMenus(disabledFolder("SYSTEM", null, 1), leaf("USER_MGMT", "SYSTEM", 1));

        List<MenuNode> tree = build(grant("USER_MGMT"));

        assertThat(codes(tree)).containsExactly("SYSTEM");
        assertThat(codes(tree.getFirst().children())).containsExactly("USER_MGMT");
    }

    @Test
    @DisplayName("메뉴명이 아니라 메시지 키를 낸다 — 번역은 프론트가 한다")
    void carriesTheMessageKey() {
        givenMenus(leaf("USER_MGMT", null, 1));

        assertThat(build(grant("USER_MGMT")).getFirst().menuNm()).isEqualTo("menu.USER_MGMT");
    }

    @Test
    @DisplayName("순환이 있으면 그 가지만 빠지고 나머지 트리는 나온다 — 터지지 않는 것이 요구다")
    void cycleDropsOnlyItsBranch() {
        List<SysMenu> rows = new ArrayList<>(List.of(
                folder("SANE", null, 1),
                leaf("GOOD", "SANE", 1),
                menu("LOOP_A", "LOOP_B", null, 1, true),
                menu("LOOP_B", "LOOP_A", null, 1, true),
                leaf("TRAPPED", "LOOP_A", 1)));
        givenMenus(rows.toArray(SysMenu[]::new));

        List<MenuNode> tree = build(grant("GOOD", "TRAPPED"));

        assertThat(codes(tree)).containsExactly("SANE");
        assertThat(codes(tree.getFirst().children())).containsExactly("GOOD");
    }

    @Test
    @DisplayName("조상이 끊겼으면 그 가지가 빠진다 — 고아를 최상위로 올려 붙이지 않는다")
    void orphanIsDropped() {
        // 올려 붙이면 트리가 그려지긴 하지만, 그 메뉴는 있어야 할 자리와 다른 곳에 나타난다 —
        // 데이터 결함이 화면에서 정상으로 보이는 쪽이 더 나쁘다.
        givenMenus(leaf("ORPHAN", "GONE", 1), leaf("FINE", null, 2));

        assertThat(codes(build(grant("ORPHAN", "FINE")))).containsExactly("FINE");
    }

    @Test
    @DisplayName("깊이 상한을 넘는 가지는 빠진다 — 방문 집합만으로는 잡히지 않는다")
    void depthLimitDropsTheBranch() {
        // 순환이 아니라 그냥 깊은 사슬이다. 방문 집합은 통과하므로 상한이 없으면 그대로 그려진다.
        List<SysMenu> deep = new ArrayList<>();
        deep.add(folder("D1", null, 1));
        for (int level = 2; level <= SysMenu.MAX_DEPTH; level++) {
            deep.add(folder("D" + level, "D" + (level - 1), 1));
        }
        deep.add(leaf("TOO_DEEP", "D" + SysMenu.MAX_DEPTH, 1));
        givenMenus(deep.toArray(SysMenu[]::new));

        assertThat(build(grant("TOO_DEEP"))).isEmpty();
    }

    @Test
    @DisplayName("권한이 비면 트리도 빈다 — 빈 셸은 애초에 로그인이 차단되는 상태다")
    void emptyAuthorityGivesEmptyTree() {
        givenMenus(folder("SYSTEM", null, 1), leaf("USER_MGMT", "SYSTEM", 1));

        assertThat(build(new EffectiveAuthority(Set.of(), TODAY))).isEmpty();
    }

    /**
     * <b>빠진 가지는 로그로만 드러난다.</b> 사용자에게는 <i>"권한은 있는데 메뉴가 없다"</i> 로만
     * 보이고, 그 사람은 원인을 알 수도 고칠 수도 없다 — sys/menu.md 가 조회 중 발견에 <b>에러 로그 +
     * 운영 알림</b>을 요구한 자리다.
     *
     * <p><b>로그를 검사하는 것이 과해 보이지만 그렇지 않다.</b> 위의 세 테스트는 <i>"빠진다"</i>
     * 만 확인하는데, 조립이 루트에서 시작하므로 <b>검사를 통째로 지워도 고아는 빠진다</b> —
     * 실제로 검사를 {@code break} 로 바꿔 넣어 보니 전부 통과했다. 그 검사가 실어 나르는 유일한
     * 값이 로그이므로, 로그를 보지 않으면 그것은 <b>없어도 되는 코드</b>가 된다.
     */
    @Nested
    @DisplayName("깨진 데이터는 error 로그로 드러난다")
    class BrokenDataIsLogged {

        private ListAppender<ILoggingEvent> appender;
        private ch.qos.logback.classic.Logger logger;

        @BeforeEach
        void attach() {
            logger = (ch.qos.logback.classic.Logger)
                    org.slf4j.LoggerFactory.getLogger(MenuTreeService.class);
            appender = new ListAppender<>();
            appender.start();
            logger.addAppender(appender);
        }

        @AfterEach
        void detach() {
            logger.detachAppender(appender);
        }

        @Test
        @DisplayName("순환")
        void cycle() {
            givenMenus(
                    menu("LOOP_A", "LOOP_B", null, 1, true),
                    menu("LOOP_B", "LOOP_A", null, 1, true),
                    leaf("TRAPPED", "LOOP_A", 1));

            build(grant("TRAPPED"));

            assertThat(errors()).anyMatch(message -> message.contains("순환"));
        }

        @Test
        @DisplayName("끊긴 조상")
        void orphan() {
            givenMenus(leaf("ORPHAN", "GONE", 1));

            build(grant("ORPHAN"));

            assertThat(errors()).anyMatch(message -> message.contains("조상이 없다"));
        }

        @Test
        @DisplayName("깊이 상한 초과")
        void tooDeep() {
            List<SysMenu> deep = new ArrayList<>();
            deep.add(folder("D1", null, 1));
            for (int level = 2; level <= SysMenu.MAX_DEPTH; level++) {
                deep.add(folder("D" + level, "D" + (level - 1), 1));
            }
            deep.add(leaf("TOO_DEEP", "D" + SysMenu.MAX_DEPTH, 1));
            givenMenus(deep.toArray(SysMenu[]::new));

            build(grant("TOO_DEEP"));

            assertThat(errors()).anyMatch(message -> message.contains("깊이 상한"));
        }

        @Test
        @DisplayName("멀쩡한 트리는 아무 말도 하지 않는다 — 늘 시끄러우면 아무도 보지 않는다")
        void healthyTreeIsSilent() {
            givenMenus(folder("SYSTEM", null, 1), leaf("USER_MGMT", "SYSTEM", 1));

            build(grant("USER_MGMT"));

            assertThat(errors()).isEmpty();
        }

        private List<String> errors() {
            return appender.list.stream()
                    .filter(event -> event.getLevel() == Level.ERROR)
                    .map(ILoggingEvent::getFormattedMessage)
                    .toList();
        }
    }

    // ── 픽스처 ──────────────────────────────────────────────────────────

    private List<MenuNode> build(EffectiveAuthority authority) {
        return new MenuTreeService(menus).build(authority);
    }

    private void givenMenus(SysMenu... rows) {
        when(menus.findAll()).thenReturn(Arrays.asList(rows));
    }

    private static EffectiveAuthority grant(String... menuCds) {
        return new EffectiveAuthority(
                Arrays.stream(menuCds)
                        .map(menuCd -> new MenuAction(menuCd, ActionType.READ))
                        .collect(Collectors.toSet()),
                TODAY);
    }

    private static List<String> codes(List<MenuNode> nodes) {
        return nodes.stream().map(MenuNode::menuCd).toList();
    }
}
