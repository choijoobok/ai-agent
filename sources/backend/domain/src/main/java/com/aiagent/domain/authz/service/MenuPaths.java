package com.aiagent.domain.authz.service;

import com.aiagent.domain.authz.entity.SysMenu;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;

/**
 * 메뉴 하나를 <b>조상 경로를 포함한 한 줄</b>로 편다 — {@code 사용자 &gt; 사용자 관리}.
 *
 * <p>main-shell.md §4.2 의 검색 결과가 쓰는 형식이고, 61 §3.8 의 탭 둘(개인 예외 · 유효 권한)이 같은
 * 형식을 요구했다. <b>목록에서는 리프 이름만으로 부족하다</b> — 같은 이름의 리프가 다른
 * 가지에 있을 수 있고, 무엇보다 <i>"이게 어느 화면이지"</i> 를 코드로 되짚게 만든다.
 *
 * <h2>{@link MenuTreeService} 의 조상 역산과 무엇이 다른가</h2>
 *
 * <p>저것은 <b>트리를 만들기 위해</b> 조상을 모으고, 뿌리에 닿지 못하는 리프는 <b>뺀다</b>.
 * 여기는 <b>글자를 만들기 위해</b> 조상을 따라가며 <b>아무것도 빼지 않는다</b> — 고아 메뉴에
 * 부여된 권한도 목록에 나와야 회수할 수 있기 때문이며({@link MenuPreOrder} 와 같은 판단),
 * 조상이 끊긴 자리에서는 <b>거기까지의 경로</b>를 낸다.
 *
 * <p>순환에 대비해 깊이를 제한한다 — 42 §4 의 3층 방어 중 <b>읽는 쪽</b>이다.
 */
public final class MenuPaths {

    /** main-shell.md §4.2 의 검색 결과와 같은 구분자다 — 두 곳이 다르면 같은 메뉴가 다르게 보인다. */
    public static final String SEPARATOR = " > ";

    private MenuPaths() {}

    /**
     * {@code MENU_CD → 표시 경로}. <b>받은 것과 같은 건수</b>를 돌려준다.
     *
     * @param menus 메뉴 전건. 조상을 따라가야 하므로 <b>부분 집합으로는 만들 수 없다</b>
     * @param displayName {@code MENU_NM} 은 메뉴명이 아니라 <b>메시지 키</b>다(42 §4) — 그것을
     *     세션 언어의 글자로 바꾸는 것은 도메인이 아니라 부르는 쪽의 사실이라 함수로 받는다
     */
    public static Map<String, String> of(Collection<SysMenu> menus, UnaryOperator<String> displayName) {
        Map<String, SysMenu> byCode =
                menus.stream().collect(Collectors.toMap(SysMenu::getMenuCd, Function.identity()));

        Map<String, String> paths = new HashMap<>(byCode.size());
        for (SysMenu menu : menus) {
            paths.put(menu.getMenuCd(), path(byCode, menu, displayName));
        }
        return paths;
    }

    private static String path(
            Map<String, SysMenu> byCode, SysMenu leaf, UnaryOperator<String> displayName) {

        List<String> names = new ArrayList<>();
        SysMenu cursor = leaf;
        // 자기 자신을 포함해 최대 MAX_DEPTH 마디 — 순환이면 그 길이에서 멈춘다.
        for (int depth = 0; cursor != null && depth <= SysMenu.MAX_DEPTH; depth++) {
            names.add(displayName.apply(cursor.getMenuNm()));
            String up = cursor.getUpMenuCd();
            cursor = up == null ? null : byCode.get(up);
        }
        // 뿌리부터 읽히도록 뒤집는다 — 모을 때는 리프에서 올라갔다.
        return String.join(SEPARATOR, names.reversed());
    }
}
