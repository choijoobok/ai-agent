package com.ordinary.backoffice.domain.authz.service;

import com.ordinary.backoffice.domain.authz.EffectiveAuthority;
import com.ordinary.backoffice.domain.authz.MenuNode;
import com.ordinary.backoffice.domain.authz.entity.SysMenu;
import com.ordinary.backoffice.domain.authz.repository.SysMenuRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 조상 역산 — AUTHZ-04 · security-design.md §4.
 *
 * <pre>
 * 유효 권한의 리프 집합 → 각 리프의 조상 경로를 역산 → 합쳐서 트리
 * </pre>
 *
 * <p><b>역할별로 트리를 만들어 병합하지 않는다</b>(security-design.md §4). 합집합을 먼저 구하고 <b>그 리프
 * 집합에서 조상을 한 번</b> 역산한다 — 역할 셋이 같은 폴더 아래를 갖고 있어도 순회는 한 번이다.
 *
 * <p><b>경로 결합이 아니다.</b> 조상은 권한 판정에 참여하지 않으며 <b>표시만</b> 된다
 * (security-design.md §4 가 경로 결합을 기각한 이유 — 개인 예외가 무력화되고 실패가 조용해진다). 그래서
 * 조상의 {@code USE_YN} 도 읽지 않는다: 42 §4 는 구조 노드의 스위치를 <b>자손 전체에 같은
 * 값을 쓰는 일괄 명령</b>으로 정의했으므로, 폴더를 끄면 리프가 꺼져 게이트(④)에서 이미
 * 빠진다. 여기서 조상 값을 한 번 더 보면 <b>같은 사실을 두 곳이 판정</b>하게 된다.
 *
 * <p><b>순회에 방문 집합과 깊이 상한을 건다</b>(42 §4 4층 방어의 3층). 막는 것이 아니라
 * <b>터지지 않게</b> 하는 것이다 — 시드·수동 UPDATE 로 순환이 들어올 수 있고, 그때
 * 무한 루프 대신 <b>그 서브트리만 빠지고 나머지 트리는 나온다</b>.
 */
@Service
public class MenuTreeService {

    private static final Logger log = LoggerFactory.getLogger(MenuTreeService.class);

    /** 42 §4 — {@code UNIQUE(UP_MENU_CD, SORT_NO)} 를 걸 수 없으므로 tie-breaker 가 필수다. */
    private static final Comparator<SysMenu> TREE_ORDER =
            Comparator.comparing(SysMenu::getSortNo).thenComparing(SysMenu::getMenuCd);

    private final SysMenuRepository menus;

    public MenuTreeService(SysMenuRepository menus) {
        this.menus = menus;
    }

    /**
     * 이 사람이 보는 트리.
     *
     * <p>입력은 <b>이미 계산된</b> 유효 권한이다 — 여기서 다시 계산하지 않는다(security-design.md §4 판정은
     * 한 곳에서). 권한이 공집합이면 빈 트리이며, 그 상태는 애초에 로그인이 차단된다.
     */
    @Transactional(readOnly = true)
    public List<MenuNode> build(EffectiveAuthority authority) {
        Map<String, SysMenu> byCode = menus.findAll().stream()
                .collect(Collectors.toMap(SysMenu::getMenuCd, Function.identity()));

        // 리프와 그 조상 전부. 순환·고아에 걸린 리프는 여기 들어오지 못한다.
        Set<String> visible = new HashSet<>();
        for (String leafCd : authority.menuCodes()) {
            List<String> path = pathToRoot(byCode, leafCd);
            if (path != null) {
                visible.addAll(path);
            }
        }

        Map<String, List<SysMenu>> childrenOf = byCode.values().stream()
                .filter(menu -> visible.contains(menu.getMenuCd()))
                .sorted(TREE_ORDER)
                .collect(Collectors.groupingBy(
                        menu -> Objects.requireNonNullElse(menu.getUpMenuCd(), ROOT),
                        LinkedHashMap::new,
                        Collectors.toList()));

        return assemble(ROOT, childrenOf);
    }

    // ── 내부 ────────────────────────────────────────────────────────────

    /** 최상위의 {@code UP_MENU_CD} 는 {@code null} 이고 맵의 키가 될 수 없다. */
    private static final String ROOT = "";

    /**
     * 리프에서 루트까지의 경로. <b>끊겼거나 순환이면 {@code null}</b> 이며 그 리프는 트리에서
     * 빠진다.
     *
     * <p><b>조용히 빼지 않는다</b> — 셋 다 {@code error} 로그다. 셋 다 데이터 결함이고,
     * 사용자에게는 <i>"권한은 있는데 메뉴가 없다"</i> 로만 보여 스스로는 원인을 알 수 없다.
     */
    private static List<String> pathToRoot(Map<String, SysMenu> byCode, String leafCd) {
        List<String> path = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        String cd = leafCd;
        while (cd != null) {
            if (!seen.add(cd)) {
                log.error("메뉴 트리에 순환이 있다 — leaf={} 순환 진입={}. 그 가지를 뺀다", leafCd, cd);
                return null;
            }
            if (path.size() >= SysMenu.MAX_DEPTH) {
                log.error("메뉴 깊이 상한({}) 초과 — leaf={}. 그 가지를 뺀다", SysMenu.MAX_DEPTH, leafCd);
                return null;
            }
            SysMenu menu = byCode.get(cd);
            if (menu == null) {
                log.error("메뉴 조상이 없다 — leaf={} 없는 조상={}. 그 가지를 뺀다", leafCd, cd);
                return null;
            }
            path.add(cd);
            cd = menu.getUpMenuCd();
        }
        return path;
    }

    /**
     * 재귀가 끝나는 것은 {@code childrenOf} 에 <b>루트까지 경로가 성립한 마디만</b> 들어 있기
     * 때문이다 — 순환에 속한 마디는 {@link #pathToRoot} 가 이미 전부 걸러냈다.
     */
    private static List<MenuNode> assemble(String parentCd, Map<String, List<SysMenu>> childrenOf) {
        return childrenOf.getOrDefault(parentCd, List.of()).stream()
                .map(menu -> new MenuNode(
                        menu.getMenuCd(),
                        menu.getMenuNm(),
                        menu.getMenuUrl(),
                        menu.getIconCd(),
                        assemble(menu.getMenuCd(), childrenOf)))
                .toList();
    }
}
