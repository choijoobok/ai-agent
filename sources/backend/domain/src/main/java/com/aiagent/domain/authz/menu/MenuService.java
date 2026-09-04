package com.aiagent.domain.authz.menu;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.repository.SysMenuApiRepository;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.repository.SysRoleMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysUserMenuAuthRepository;
import com.aiagent.domain.favorite.repository.SysUserFavoriteRepository;
import com.aiagent.domain.gridpref.repository.SysUserGridPrefRepository;
import com.aiagent.domain.searchcond.repository.SysUserSearchCondRepository;
import com.aiagent.domain.message.entity.SysCacheVersion;
import com.aiagent.domain.message.entity.SysMessageKey;
import com.aiagent.domain.message.repository.SysCacheVersionRepository;
import com.aiagent.domain.message.repository.SysMessageKeyRepository;
import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.support.time.BusinessCalendar;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * {@code MENU_TREE} 의 쓰기 — sys/menu.md · screen/menu/requirements.md. <b>네 연산이 전부 락 하나를 지난다.</b>
 *
 * <pre>
 * createNode   신규 노드      — 선택 노드의 자식, 형제의 맨 끝
 * saveNode     속성 편집      — URL · 아이콘 · 사용 여부(전파)
 * saveTree     위치 변경      — 형제 목록을 통째로 받는다
 * deleteNode   삭제           — 게이트 넷, 즐겨찾기는 함께 지운다
 * </pre>
 *
 * <h2>왜 넷 다 락인가 — sys/menu.md 는 위치 변경만 적었다</h2>
 *
 * 락의 근거는 <b>불변식이 여러 행에 걸린다</b>는 것이고(backend/persistence.md), 이 화면에는 그런 불변식이
 * <b>둘</b>이다.
 *
 * <table>
 *   <tr><th>불변식</th><th>걸리는 행</th><th>깨는 조합</th></tr>
 *   <tr><td>순환 금지</td><td>조상 사슬 전체</td>
 * <td>두 이동이 서로의 조상을 옮긴다 — sys/menu.md 가 적은 그것</td></tr>
 *   <tr><td><b>URL 과 자식은 배타</b></td><td>부모와 자식</td>
 *       <td><b>A 가 N 에 URL 을 채우는 동안 B 가 N 아래에 자식을 만든다</b> —
 *           각자의 검사는 통과하고 합쳐진 결과만 위반이다</td></tr>
 * </table>
 *
 * <p>둘째가 같은 모양의 write-skew 다. sys/menu.md 가 위치 변경만 적은 것은 <b>순환을 말하던
 * 자리</b>였기 때문이며, 같은 문서가 URL↔자식 배타도 <i>"다른 행을 봐야 하므로 DB 제약으로
 * 표현할 수 없다"</i> 고 적어 두었다 — 그 문장이 곧 여기서 락이 필요하다는 말이다.
 *
 * <p><b>대가가 없다시피 하다.</b> 메뉴는 드물게 바뀌는 마스터이고(sys/menu.md) 락 하나가 트리
 * 전역이라 경합 자체가 거의 없다. 반대로 <b>연산마다 락 여부가 갈리면</b> 어느 것이 보호되고
 * 어느 것이 아닌지를 매번 다시 따져야 한다.
 *
 * <h2>{@code @Transactional} 이 메서드에 없다</h2>
 *
 * 락 트리거가 트랜잭션을 연다({@code WAIT} — backend/persistence.md). 여기 클래스에 트랜잭션을 붙이면
 * <b>락 구간에 트랜잭션이 걸쳐</b> 애스펙트의 런타임 검사가 거부한다. 그래서 이 클래스의
 * 공개 메서드는 <b>락 안에서 도는 몸통</b>이고, 트랜잭션 경계는 락이 갖는다.
 */
@Service
public class MenuService {

    private final MenuTreeLockTrigger lock;
    private final SysMenuRepository menus;
    private final SysMenuApiRepository menuApis;
    private final SysRoleMenuAuthRepository roleAuths;
    private final SysUserMenuAuthRepository userAuths;
    private final SysUserFavoriteRepository favorites;
    private final SysUserSearchCondRepository searchConds;
    private final SysUserGridPrefRepository gridPrefs;
    private final SysMessageKeyRepository messageKeys;
    private final SysMessageRepository messageValues;
    private final SysCacheVersionRepository versions;
    private final BusinessCalendar calendar;

    public MenuService(
            MenuTreeLockTrigger lock,
            SysMenuRepository menus,
            SysMenuApiRepository menuApis,
            SysRoleMenuAuthRepository roleAuths,
            SysUserMenuAuthRepository userAuths,
            SysUserFavoriteRepository favorites,
            SysUserSearchCondRepository searchConds,
            SysUserGridPrefRepository gridPrefs,
            SysMessageKeyRepository messageKeys,
            SysMessageRepository messageValues,
            SysCacheVersionRepository versions,
            BusinessCalendar calendar) {
        this.lock = lock;
        this.menus = menus;
        this.menuApis = menuApis;
        this.roleAuths = roleAuths;
        this.userAuths = userAuths;
        this.favorites = favorites;
        this.searchConds = searchConds;
        this.gridPrefs = gridPrefs;
        this.messageKeys = messageKeys;
        this.messageValues = messageValues;
        this.versions = versions;
        this.calendar = calendar;
    }

    // ── 신규 (screen/menu/requirements.md) ───────────────────────────────────────────────

    /**
     * 노드를 만든다 — 모달이 받는 칸은 {@code MENU_CD} 하나다(screen/menu/requirements.md).
     *
     * <p>나머지 여섯은 <b>사람이 정하는 값이 아니다</b>: 부모는 선택 노드, {@code SORT_NO} 는
     * 형제의 맨 끝, {@code MENU_NM} 은 {@code menu.{MENU_CD}}, {@code USE_YN} 은 {@code 'Y'},
     * URL·아이콘은 <b>만든 뒤 셀에서</b> 채운다.
     *
     * <p><b>맨 앞이 아니라 맨 끝이다</b>(sys/menu.md) — 맨 앞에 넣으면 형제 전체의 {@code SORT_NO}
     * 를 밀어야 하고, 그것은 방금 만든 노드 하나 때문에 형제 전부를 다시 쓰는 일이다. 다른
     * 자리로 옮기려면 드래그한다.
     *
     * @param upMenuCd {@code null} 이면 최상위 — <b>모듈 노드</b>가 된다(sys/menu.md)
     */
    public void createNode(String upMenuCd, String menuCd) {
        lock.withLock(() -> {
            if (menus.existsById(menuCd)) {
                // 다른 사람이 방금 만든 것을 클라이언트가 알 수 없다 — 서버 검증이다(frontend/grid.md).
                throw new BusinessException(
                        MenuErrorCode.DUPLICATE_CODE, "이미 있는 메뉴 코드다 — " + menuCd);
            }
            if (upMenuCd != null) {
                SysMenu parent = require(upMenuCd);
                // URL 이 있는 노드에는 자식을 만들 수 없다 — 먼저 URL 을 비운다(backend/security.md).
                if (parent.getMenuUrl() != null) {
                    throw new BusinessException(
                            MenuErrorCode.CHILD_UNDER_LEAF,
                            "화면이 있는 메뉴에는 하위를 둘 수 없다 — " + upMenuCd);
                }
                // 새 노드가 리프이므로 부모의 깊이 + 1 이 곧 그 리프의 단수다.
                requireDepth(depthOf(upMenuCd, parentsOf(menus.findAll())) + 1);
            }
            menus.save(SysMenu.created(upMenuCd, menuCd, nextSortNo(upMenuCd)));

            /*
              이름의 자리를 함께 만든다 — 없으면 `MESSAGE_MGMT` 에서 채울 수단이 없다
              (SYS_MESSAGE 가 SYS_MESSAGE_KEY 를 FK 로 참조한다).

              **`dataKey` 다.** 사람이 만든 키가 아니라 **메뉴 행이 있는 한 살아 있는 키**이며
              소스에 상수가 없는 것이 정상이다(sys/message.md) — `created` 로 만들면 죽은 키
              목록이 메뉴 수만큼 부풀고, `generateMessageSeed` 가 `menu.` 접두를 아예
              건드리지 않으므로(seed.md) **다음 생성도 그것을 고쳐 주지 않는다**.
            */
            String msgKey = SysMenu.messageKey(menuCd);
            if (!messageKeys.existsById(msgKey)) {
                messageKeys.save(SysMessageKey.dataKey(msgKey));
            }
            // 값은 넣지 않는다 — 이름이 키 문자열로 보이는 것이 *아직 안 채웠다* 의 표시다.
            return null;
        });
    }

    /** 형제의 맨 끝 — {@code 0} 건이면 {@code 1} 이다(sys/menu.md). */
    private int nextSortNo(String upMenuCd) {
        return menus.findAll().stream()
                        .filter(menu -> java.util.Objects.equals(menu.getUpMenuCd(), upMenuCd))
                        .mapToInt(SysMenu::getSortNo)
                        .max()
                        .orElse(0)
                + 1;
    }

    // ── 속성 (screen/menu/requirements.md) ────────────────────────────────────────

    /**
     * URL · 아이콘 · 사용 여부 — <b>위치도 메뉴명도 받지 않는다</b>(sys/menu.md).
     *
     * <p>{@code UP_MENU_CD}·{@code SORT_NO}·{@code MENU_NM} 을 인자로 두지 않으므로 조작할
     * 경로가 <b>구조적으로 없다</b>(원칙 P1). 폼에서 감추는 것은 UX 이지 방어가 아니다.
     *
     * <p><b>사용 여부는 자손 전체에 쓴다</b>(screen/menu/requirements.md). 전파는 <b>아래로만</b> 하며, 조상의
     * 값은 <i>마지막 일괄 명령의 기록</i>이다 — 게이트는 여전히 리프 자신의 값만 본다(backend/security.md).
     * 조상의 값을 게이트로 읽으면 backend/security.md 가 기각한 <b>경로 결합</b>이 {@code USE_YN} 이라는
     * 이름으로 되살아난다.
     */
    public void saveNode(String menuCd, String menuUrl, String iconCd, boolean useYn) {
        lock.withLock(() -> {
            SysMenu menu = require(menuCd);
            List<SysMenu> all = menus.findAll();

            applyUrl(menu, menuUrl, all);
            menu.changeIcon(iconCd);

            // 자기 자신도 포함이다 — 리프 하나를 끄는 것과 폴더를 끄는 것이 한 연산이다.
            for (SysMenu target : selfAndDescendants(menuCd, all)) {
                target.changeUseYn(useYn);
            }
            return null;
        });
    }

    /**
     * URL 은 <b>둘을 본다</b> — 자식이 있는가, 권한 행이 있는가(screen/menu/requirements.md).
     *
     * <p>앞엣것은 backend/security.md 의 <i>URL 과 자식은 배타</i> 이고, 뒤엣것은 그 <b>거꾸로</b>다:
     * 비우는 순간 권한 대상이 아닌데 {@code SYS_ROLE_MENU_AUTH} 에 행이 남아,
     * sys/menu.md 가 <i>"들어오면 거부"</i> 라고 한 상태가 <b>반대 방향으로</b> 만들어진다.
     */
    private void applyUrl(SysMenu menu, String menuUrl, List<SysMenu> all) {
        String current = menu.getMenuUrl();
        if (java.util.Objects.equals(current, menuUrl)) {
            return;
        }
        if (menuUrl != null && hasChild(menu.getMenuCd(), all)) {
            throw new BusinessException(
                    MenuErrorCode.URL_ON_PARENT,
                    "자식이 있는 메뉴는 화면을 가질 수 없다 — " + menu.getMenuCd());
        }
        if (menuUrl == null && hasAuthority(menu.getMenuCd())) {
            throw new BusinessException(
                    MenuErrorCode.URL_REQUIRED_BY_AUTH,
                    "권한이 부여된 메뉴는 화면을 비울 수 없다 — " + menu.getMenuCd());
        }
        menu.changeUrl(menuUrl);
    }

    // ── 위치 (sys/menu.md · screen/menu/requirements.md) ───────────────────────────────────────

    /**
     * 형제 목록을 통째로 받아 {@code 1..N} 으로 재작성한다 — sys/menu.md.
     *
     * <p><b>이동 명령이 아니라 최종 상태다.</b> {@code {menuCd, newIndex}} 를 보내 서버가
     * 재계산하는 방식보다 결정적이며, UX-14 리스트 CUD 규약(<i>화면이 최종 상태를 보내고
     * 서버가 그대로 반영</i>)과 같은 형태다 — <b>배열 인덱스가 곧 {@code SORT_NO}</b> 다.
     *
     * <p><b>부모가 바뀌면 두 부모가 다시 쓰인다.</b> 뺀 쪽과 넣은 쪽을 <b>한 요청</b>에
     * 담으므로 이 메서드가 그 둘을 함께 받는다 — 나눠 보내면 그 사이에 트리가 <b>양쪽 어디에도
     * 속하지 않는 노드</b>를 갖는 순간이 생긴다.
     *
     * <p><b>집합 검증이 낙관적 덮어쓰기를 막는다.</b> A 가 트리를 열어 둔 채 B 가 메뉴를
     * 추가하면 A 의 저장은 그 메뉴를 <b>목록에서 빠뜨린다</b> — 조용한 유실을 <b>시끄러운
     * 실패</b>로 바꾼 것이 이 검사다.
     *
     * @param groups 부모별 자식 목록. 최상위는 {@code upMenuCd} 가 {@code null} 이다
     */
    public void saveTree(List<MenuSiblingGroup> groups) {
        lock.withLock(() -> {
            List<SysMenu> all = menus.findAll();
            Map<String, SysMenu> byCode = byCode(all);

            // 이동 뒤의 부모를 먼저 그린다 — 순환·깊이 검사가 **결과 트리**를 봐야 한다.
            Map<String, String> parentAfter = new HashMap<>();
            for (SysMenu menu : all) {
                parentAfter.put(menu.getMenuCd(), menu.getUpMenuCd());
            }
            for (MenuSiblingGroup group : groups) {
                verifySiblingSet(group, all, parentAfter);
                for (String menuCd : group.menuCds()) {
                    parentAfter.put(menuCd, group.upMenuCd());
                }
            }
            for (MenuSiblingGroup group : groups) {
                verifyDestination(group, byCode, parentAfter);
            }
            // 검증이 전부 끝난 뒤에 쓴다 — 절반만 반영된 트리를 만들지 않는다.
            for (MenuSiblingGroup group : groups) {
                int sortNo = 1;
                for (String menuCd : group.menuCds()) {
                    require(menuCd).moveTo(group.upMenuCd(), sortNo++);
                }
            }
            return null;
        });
    }

    /**
     * 보낸 목록이 <b>그 부모의 현재 자식 집합</b>과 맞는가 — sys/menu.md.
     *
     * <p>비교 대상은 <b>이동해 오는 것을 뺀 나머지</b>다. 다른 그룹에서 이 부모로 옮겨 오는
     * 노드는 아직 여기 자식이 아니므로, 그것까지 <i>현재 집합</i>에 요구하면 <b>정상적인
     * 이동이 전부 거부</b>된다.
     */
    private void verifySiblingSet(
            MenuSiblingGroup group, List<SysMenu> all, Map<String, String> parentAfter) {
        Set<String> now = new HashSet<>();
        for (SysMenu menu : all) {
            if (java.util.Objects.equals(menu.getUpMenuCd(), group.upMenuCd())) {
                now.add(menu.getMenuCd());
            }
        }
        Set<String> sent = new HashSet<>(group.menuCds());
        if (sent.size() != group.menuCds().size()) {
            throw new BusinessException(
                    MenuErrorCode.TREE_CHANGED, "형제 목록에 같은 메뉴가 두 번 왔다");
        }
        // 이동해 온 것(원래 다른 부모였던 것)은 현재 집합에 없는 것이 정상이다.
        Set<String> incoming = new HashSet<>(sent);
        incoming.removeAll(now);
        for (String menuCd : incoming) {
            if (!menus.existsById(menuCd)) {
                throw new BusinessException(
                        MenuErrorCode.TREE_CHANGED, "없는 메뉴가 형제 목록에 있다 — " + menuCd);
            }
        }
        // 남아 있어야 할 것이 빠졌다 — 다른 그룹이 데려가는 것이 아니면 유실이다.
        for (String menuCd : now) {
            if (!sent.contains(menuCd)
                    && java.util.Objects.equals(parentAfter.get(menuCd), group.upMenuCd())) {
                throw new BusinessException(
                        MenuErrorCode.TREE_CHANGED, "형제 목록에서 빠진 메뉴가 있다 — " + menuCd);
            }
        }
    }

    /**
     * 옮겨 갈 자리가 성립하는가 — <b>셋을 본다</b>(sys/menu.md · screen/menu/requirements.md).
     *
     * <p>순환 · 깊이 · URL 이 있는 노드 아래로의 이동이다. <b>결과 트리</b>에 대해 판정하므로
     * 인자가 {@code parentAfter} 다 — 지금 트리로 보면 같은 요청 안의 두 이동이 서로를
     * 통과시킨다.
     */
    private void verifyDestination(
            MenuSiblingGroup group, Map<String, SysMenu> byCode, Map<String, String> parentAfter) {
        String parent = group.upMenuCd();
        if (parent != null) {
            SysMenu parentMenu = byCode.get(parent);
            if (parentMenu == null) {
                throw new BusinessException(
                        MenuErrorCode.TREE_CHANGED, "없는 부모로 옮기려 한다 — " + parent);
            }
            if (parentMenu.getMenuUrl() != null) {
                throw new BusinessException(
                        MenuErrorCode.CHILD_UNDER_LEAF,
                        "화면이 있는 메뉴 아래로 옮길 수 없다 — " + parent);
            }
        }
        for (String menuCd : group.menuCds()) {
            requireNoCycle(menuCd, parentAfter);
            /*
              서브트리를 통째로 끌면 **그 서브트리의 높이까지 더해** 판정한다(screen/menu/requirements.md) —
              옮기는 노드만 보면 자손이 상한을 넘는 것을 놓친다.
            */
            requireDepth(depthOf(menuCd, parentAfter) + heightOf(menuCd, parentAfter));
        }
    }

    /** 자기 자신 또는 자손 아래로의 이동 — sys/menu.md 의 네 층 중 <b>저장 서비스</b>다. */
    private static void requireNoCycle(String menuCd, Map<String, String> parentAfter) {
        Set<String> seen = new HashSet<>();
        String cursor = parentAfter.get(menuCd);
        while (cursor != null) {
            if (cursor.equals(menuCd)) {
                throw new BusinessException(
                        MenuErrorCode.CYCLE, "자기 자신이나 자손 아래로 옮길 수 없다 — " + menuCd);
            }
            // **상한이 없으면 이미 순환이 있는 데이터에서 검사 자체가 무한 루프다**(sys/menu.md).
            if (!seen.add(cursor)) {
                throw new BusinessException(
                        MenuErrorCode.CYCLE, "트리에 이미 순환이 있다 — " + cursor);
            }
            cursor = parentAfter.get(cursor);
        }
    }

    // ── 삭제 (screen/menu/requirements.md) ───────────────────────────────────────────────

    /**
     * 게이트가 넷이고 <b>하나는 함께 지운다</b> — screen/menu/requirements.md.
     *
     * <table>
     *   <tr><td>자식 노드 · 매핑 API · 매핑 역할 · 개인 예외</td><td><b>막는다</b></td></tr>
     *   <tr><td>즐겨찾기</td><td><b>함께 지운다</b></td></tr>
     * </table>
     *
     * <p><b>가르는 기준은 그 행이 인가 사실인가다.</b> 권한 둘과 매핑과 구조는 <b>누군가 결정한
     * 사실</b>이라 조용히 지울 수 없다. 즐겨찾기는 <b>메뉴를 가리키는 포인터</b>이며, 없는
     * 메뉴를 가리키는 즐겨찾기는 <i>클릭이 곧 404</i> 다(sys/menu.md) — 남길 이유가 없다.
     *
     * <p><b>막아 두면 막다른 골목이 된다.</b> 관리자는 남의 즐겨찾기를 볼 수도 지울 수도
     * 없는데 게이트 메시지가 <i>"3명이 즐겨찾기에 등록했습니다"</i> 이면 <b>할 수 있는 일이
     * 없는 거부</b>이고, 그것은 거부가 아니라 고장이다.
     *
     * <p><b>매핑 API 를 막는 이유는 FK 가 아니라 다음 배포다.</b> 시드가 전체 동기화이므로
     * (seed.md) 코드에 그 화면이 살아 있으면 {@code generateApiSeed} 가 다음 배포에서
     * {@code SYS_MENU_API} 행을 다시 넣고, {@code MENU_CD} 가 없으면 <b>FK 로 배포가
     * 깨진다</b> — 게이트는 <i>프론트 선언 제거 → 시드 재생성 → 배포 → 메뉴 삭제</i> 라는
     * 순서를 강제하는 장치다.
     */
    public void deleteNode(String menuCd) {
        lock.withLock(() -> {
            SysMenu menu = require(menuCd);
            requireDeletable(menuCd);

            /*
              포인터 셋을 함께 지운다 — screen/menu/requirements.md · seed.md. ON DELETE CASCADE 로 하지
              않는다(sys/user-role.md 이 금지했다) — 같은 트랜잭션에서 서비스가 지우고, 확인 문구가
              무엇이 함께 사라지는지 미리 말한다.

              막는 넷(자식 노드 · 매핑 API · 역할 권한 · 개인 예외)과 가르는 기준은
              **그 행이 인가 사실인가** 다. 이 셋은 메뉴를 가리키는 포인터일 뿐이고,
              없는 메뉴를 가리키는 즐겨찾기는 클릭이 곧 404 다(sys/menu.md).

              조회조건과 그리드 설정이 뒤늦게 들어왔다(2026-09-02). 둘 다 MENU_CD FK 를
              갖는데 §4.8 의 표에 없었고, 그대로 두면 **운영자가 할 수 있는 일이 없는
              거부**가 된다 — 남의 조건도 남의 컬럼 설정도 볼 수 없고 지울 화면이 없다.
            */
            favorites.deleteByMenuCd(menuCd);
            searchConds.deleteByMenuCd(menuCd);
            gridPrefs.deleteByMenuCd(menuCd);

            /*
              이름의 자리도 거둔다 — **데이터가 만든 키는 그 데이터가 거둔다**(sys/message.md).
              남기면 `menu.X` 가 `USE_SCOPE='DATA'` 인 채로 영영 남는데,
              `generateMessageSeed` 가 `menu.` 접두를 건드리지 않으므로(seed.md) **죽은 키로
              표시될 경로조차 없다**.

              값 → 키 순서다. 반대로 지우면 FK 가 거부한다(005 changelog).
            */
            String msgKey = SysMenu.messageKey(menuCd);
            boolean hadName = !messageValues.findByMsgKey(msgKey).isEmpty();
            messageValues.deleteByMsgKey(msgKey);
            messageKeys.findById(msgKey).ifPresent(messageKeys::delete);

            menus.delete(menu);
            if (hadName) {
                bumpMessageVersion();
            }
            return null;
        });
    }

    /** 넷 중 하나라도 남아 있으면 막는다. <b>어느 쪽이 막는지 말한다</b>(screen/menu/requirements.md 의 규약). */
    private void requireDeletable(String menuCd) {
        List<String> blockers = new ArrayList<>();
        if (menus.existsByUpMenuCd(menuCd)) {
            blockers.add("하위 메뉴");
        }
        if (menuApis.existsByMenuCd(menuCd)) {
            blockers.add("매핑 API");
        }
        if (roleAuths.existsByMenuCd(menuCd)) {
            blockers.add("매핑 역할");
        }
        if (userAuths.existsByMenuCd(menuCd)) {
            blockers.add("개인 예외");
        }
        if (!blockers.isEmpty()) {
            throw new BusinessException(
                    MenuErrorCode.NOT_DELETABLE,
                    "삭제를 막는 것이 있다 — " + menuCd + " : " + String.join(" · ", blockers));
        }
    }

    // ── 공통 ─────────────────────────────────────────────────────────

    private SysMenu require(String menuCd) {
        return menus.findById(menuCd)
                .orElseThrow(() -> new BusinessException(
                        MenuErrorCode.NOT_FOUND, "없는 메뉴다 — " + menuCd));
    }

    private static Map<String, SysMenu> byCode(List<SysMenu> all) {
        Map<String, SysMenu> byCode = new HashMap<>();
        for (SysMenu menu : all) {
            byCode.put(menu.getMenuCd(), menu);
        }
        return byCode;
    }

    private static boolean hasChild(String menuCd, List<SysMenu> all) {
        return all.stream().anyMatch(menu -> menuCd.equals(menu.getUpMenuCd()));
    }

    private boolean hasAuthority(String menuCd) {
        return roleAuths.existsByMenuCd(menuCd) || userAuths.existsByMenuCd(menuCd);
    }

    /** 자기 + 자손 — 사용 여부 전파의 대상이다(screen/menu/requirements.md). */
    private static List<SysMenu> selfAndDescendants(String menuCd, List<SysMenu> all) {
        Map<String, List<SysMenu>> childrenOf = new HashMap<>();
        for (SysMenu menu : all) {
            if (menu.getUpMenuCd() != null) {
                childrenOf.computeIfAbsent(menu.getUpMenuCd(), key -> new ArrayList<>()).add(menu);
            }
        }
        List<SysMenu> targets = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        List<String> pending = new ArrayList<>(List.of(menuCd));
        while (!pending.isEmpty()) {
            String cursor = pending.removeLast();
            // 순환이 들어온 데이터에서도 터지지 않는다 — sys/menu.md 3층.
            if (!visited.add(cursor)) {
                continue;
            }
            for (SysMenu menu : all) {
                if (menu.getMenuCd().equals(cursor)) {
                    targets.add(menu);
                }
            }
            for (SysMenu child : childrenOf.getOrDefault(cursor, List.of())) {
                pending.add(child.getMenuCd());
            }
        }
        return targets;
    }

    /**
     * 뿌리부터 이 노드까지의 단수 — 최상위가 {@code 1} 이다(sys/menu.md).
     *
     * <p>방문 집합이 있는 것은 <b>이미 순환이 있는 데이터</b> 때문이다(sys/menu.md 3층) — 없으면
     * 깊이를 세려다 무한 루프에 빠지고, <i>깊이를 막는 검사</i>가 <i>서버를 멈추는 검사</i>가
     * 된다.
     */
    private static int depthOf(String menuCd, Map<String, String> parents) {
        int depth = 1;
        Set<String> seen = new HashSet<>();
        String cursor = parents.get(menuCd);
        while (cursor != null && seen.add(cursor)) {
            depth++;
            cursor = parents.get(cursor);
        }
        return depth;
    }

    /** {@code MENU_CD → UP_MENU_CD}. 최상위는 값이 {@code null} 이라 키만 남는다. */
    private static Map<String, String> parentsOf(List<SysMenu> all) {
        Map<String, String> parents = new HashMap<>();
        for (SysMenu menu : all) {
            parents.put(menu.getMenuCd(), menu.getUpMenuCd());
        }
        return parents;
    }

    /** 이 노드를 뿌리로 한 서브트리의 높이 — 자기만 있으면 {@code 1} 이다. */
    private static int heightOf(String menuCd, Map<String, String> parentAfter) {
        Map<String, List<String>> childrenOf = new HashMap<>();
        parentAfter.forEach((child, parent) -> {
            if (parent != null) {
                childrenOf.computeIfAbsent(parent, key -> new ArrayList<>()).add(child);
            }
        });
        return height(menuCd, childrenOf, new HashSet<>());
    }

    private static int height(
            String menuCd, Map<String, List<String>> childrenOf, Set<String> seen) {
        if (!seen.add(menuCd)) {
            return 0;
        }
        int tallest = 0;
        for (String child : childrenOf.getOrDefault(menuCd, List.of())) {
            tallest = Math.max(tallest, height(child, childrenOf, seen));
        }
        return tallest + 1;
    }

    /** 리프 포함 5단이 상한이다 — sys/menu.md. 넘는 생성·이동은 저장에서 거부한다(sys/menu.md). */
    private static void requireDepth(int depth) {
        if (depth > SysMenu.MAX_DEPTH) {
            throw new BusinessException(
                    MenuErrorCode.DEPTH_EXCEEDED,
                    "메뉴 깊이 상한 " + SysMenu.MAX_DEPTH + " 단을 넘는다 — " + depth);
        }
    }

    /**
     * 이름 행이 실제로 사라졌을 때만 올린다 — sys/code.md.
     *
     * <p><b>{@code @Transactional} 이 없다.</b> 이미 락의 트랜잭션 안이며(backend/persistence.md), 붙여도
     * 자기 호출이라 프록시를 지나지 않아 <b>아무 일도 하지 않는다</b> — 붙어 있으면
     * <i>경계가 있다</i> 고 읽혀 더 나쁘다.
     */
    private void bumpMessageVersion() {
        versions.findById(SysCacheVersion.MESSAGE)
                .ifPresent(version -> version.bump(calendar.now()));
    }
}
