package com.aiagent.domain.authz;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.service.MenuPaths;
import java.util.List;
import java.util.Map;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 메뉴 하나를 <b>조상 경로를 포함한 한 줄</b>로 — 61 §3.8 의 탭 둘이 요구했다.
 *
 * <p><b>재는 것은 빼지 않는가</b>다. {@code MenuTreeService} 의 조상 역산은 뿌리에 닿지
 * 못하는 리프를 <b>뺀다</b>(트리를 만드는 것이 목적이라 그것이 맞다). 여기는 반대다 —
 * 고아 메뉴에 부여된 권한도 목록에 나와야 회수할 수 있고({@code MenuPreOrder} 와 같은
 * 판단), 순환이 들어온 데이터에서 <b>터지면 화면 전체가 안 열린다</b>.
 */
class MenuPathsTest {

    /** 메뉴명은 메시지 키다 — 부르는 쪽이 글자로 바꾼다(42 §4). 여기서는 키를 그대로 쓴다. */
    private static final UnaryOperator<String> AS_IS = key -> key;

    @Test
    @DisplayName("뿌리부터 리프까지 이어 붙인다 — main-shell.md §4.2 의 검색 결과와 같은 형식이다")
    void joinsFromRoot() {
        Map<String, String> paths = MenuPaths.of(
                List.of(menu("USER", null, "사용자"), menu("USER_MGMT", "USER", "사용자 관리")),
                AS_IS);

        assertThat(paths.get("USER_MGMT")).isEqualTo("사용자 > 사용자 관리");
        assertThat(paths.get("USER")).isEqualTo("사용자");
    }

    @Test
    @DisplayName("받은 것과 같은 건수를 돌려준다 — 빼는 것이 없다")
    void keepsEveryMenu() {
        List<SysMenu> all = List.of(
                menu("A", null, "가"), menu("B", "A", "나"), menu("C", "B", "다"));

        assertThat(MenuPaths.of(all, AS_IS)).hasSize(3);
    }

    @Test
    @DisplayName("조상이 없으면 거기까지의 경로를 낸다 — 고아를 감추면 회수할 수단이 사라진다")
    void orphanKeepsWhatItHas() {
        Map<String, String> paths =
                MenuPaths.of(List.of(menu("LOST", "GONE", "떨어진 메뉴")), AS_IS);

        assertThat(paths.get("LOST")).isEqualTo("떨어진 메뉴");
    }

    @Test
    @DisplayName("순환에서 터지지 않는다 — 42 §4 의 3층 방어 중 읽는 쪽이다")
    void surviresACycle() {
        List<SysMenu> loop = List.of(menu("X", "Y", "엑스"), menu("Y", "X", "와이"));

        Map<String, String> paths = MenuPaths.of(loop, AS_IS);

        assertThat(paths).hasSize(2);
        // 깊이 제한에서 멈춘 것이라 길이만 유한하면 된다 — 내용은 순환이므로 뜻이 없다.
        assertThat(paths.get("X")).contains("엑스");
    }

    /**
     * 기본 생성자가 {@code protected} 다 — JPA 만 부르라는 뜻이고 그것이 맞다.
     *
     * <p>{@code SysMenu.created} 는 <b>정렬 순서까지</b> 받는 화면용 생성이라 여기서 필요한
     * 것보다 넓다. {@code SysGrantFixture} 와 같은 방법으로 필드만 채운다.
     */
    private static SysMenu menu(String menuCd, String upMenuCd, String menuNm) {
        SysMenu menu;
        try {
            var constructor = SysMenu.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            menu = constructor.newInstance();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        ReflectionTestUtils.setField(menu, "menuCd", menuCd);
        ReflectionTestUtils.setField(menu, "upMenuCd", upMenuCd);
        ReflectionTestUtils.setField(menu, "menuNm", menuNm);
        return menu;
    }
}
