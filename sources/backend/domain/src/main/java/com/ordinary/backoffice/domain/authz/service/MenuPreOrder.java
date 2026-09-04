package com.ordinary.backoffice.domain.authz.service;

import com.ordinary.backoffice.domain.authz.entity.SysMenu;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 메뉴 전건을 <b>전위 순회</b>로 편다 — 부모 바로 뒤에 그 자식들이 온다.
 *
 * <p><b>권한 트리 둘이 같은 순서를 봐야 한다</b>(62 §2.4 · 61 §4.4). 역할 쪽과 개인 예외 쪽은
 * <i>같은 컴포넌트</i> 로 정해져 있고(AUTHZ-07), 순서가 갈리면 같은 트리가 두 화면에서 다르게
 * 보인다 — 화면이 정렬하지 않기 때문이다(정렬하면 계층이 깨진다).
 *
 * <h2>고아와 순환을 감추지 않는다</h2>
 *
 * <p>{@code MenuTreeService} 는 <b>조상 역산</b>이 목적이라 뿌리에 닿지 못하는 노드를 뺀다.
 * 여기는 반대다 — <b>권한을 주는 화면에서 사라지면 그 메뉴에 부여된 권한을 회수할 수단이
 * 없어진다</b>. 그래서 닿지 못한 것들을 <b>맨 뒤에 붙인다</b>.
 *
 * <p>순회에 방문 집합과 깊이 제한을 걸어 <b>순환이 들어온 데이터에서도 터지지 않는다</b>
 * (42 §4 의 3층 방어). 재귀가 아니라 명시적 제한인 것은 그 때문이다.
 */
public final class MenuPreOrder {

    /** 42 §4 — {@code UNIQUE(UP_MENU_CD, SORT_NO)} 를 걸 수 없으므로 tie-breaker 가 필수다. */
    private static final Comparator<SysMenu> SIBLING_ORDER =
            Comparator.comparing(SysMenu::getSortNo).thenComparing(SysMenu::getMenuCd);

    private MenuPreOrder() {}

    /** 받은 것과 <b>같은 건수</b>를 돌려준다 — 빼는 것이 없다. */
    public static List<SysMenu> of(List<SysMenu> all) {
        Map<String, List<SysMenu>> childrenOf = new LinkedHashMap<>();
        for (SysMenu menu : all.stream().sorted(SIBLING_ORDER).toList()) {
            childrenOf.computeIfAbsent(key(menu.getUpMenuCd()), unused -> new ArrayList<>())
                    .add(menu);
        }
        List<SysMenu> ordered = new ArrayList<>(all.size());
        Set<String> visited = new HashSet<>();
        walk(childrenOf, key(null), ordered, visited, 0);

        // 뿌리에 닿지 못한 나머지 — 고아이거나 순환이다. 감추지 않고 맨 뒤에 붙인다.
        for (SysMenu menu : all.stream().sorted(SIBLING_ORDER).toList()) {
            if (visited.add(menu.getMenuCd())) {
                ordered.add(menu);
            }
        }
        return ordered;
    }

    private static void walk(
            Map<String, List<SysMenu>> childrenOf,
            String parent,
            List<SysMenu> ordered,
            Set<String> visited,
            int depth) {

        if (depth > SysMenu.MAX_DEPTH) {
            return;
        }
        for (SysMenu menu : childrenOf.getOrDefault(parent, List.of())) {
            if (!visited.add(menu.getMenuCd())) {
                continue;
            }
            ordered.add(menu);
            walk(childrenOf, menu.getMenuCd(), ordered, visited, depth + 1);
        }
    }

    /** 최상위의 부모가 {@code null} 이라 맵의 키가 될 수 없다 — 한 자리에서 바꾼다. */
    private static String key(String upMenuCd) {
        return upMenuCd == null ? "" : upMenuCd;
    }
}
