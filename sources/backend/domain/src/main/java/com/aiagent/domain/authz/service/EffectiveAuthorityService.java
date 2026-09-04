package com.aiagent.domain.authz.service;

import com.aiagent.domain.authz.EffectiveAuthority;
import com.aiagent.domain.authz.MenuAction;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.repository.SysRoleMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysUserMenuAuthRepository;
import com.aiagent.support.time.BusinessCalendar;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 유효 권한 계산 — security-design.md §4 <i>계산 순서: 필터 · 합집합 · 게이트</i>.
 *
 * <pre>
 * ① 수집   보유 역할 N 개 + 개인 예외가 각각 (MENU_CD, ACTION_CD) 행을 낸다
 * ② 필터   역할     : SYS_ROLE.USE_YN='Y' AND 부여가 유효기간 내         ← 출처 자격
 *          개인 예외 : 업무 시간대의 오늘이 유효기간 안인 행만
 * ③ 합집합  살아남은 행을 (MENU_CD, ACTION_CD) 집합으로 합친다          ← 유일한 머지
 * ④ 게이트  SYS_MENU.USE_YN='N' · MENU_URL IS NULL 인 메뉴를 제거       ← 대상 생존
 *          = 유효 권한.  ∅ 이면 로그인 차단
 * </pre>
 *
 * <p><b>②와 ④를 한 쿼리로 합치지 않은 것이 이 클래스의 형태를 정한다.</b> 방향이 반대이기
 * 때문이다 — ②는 <i>누가 주는가</i>, ④는 <i>대상이 살아 있는가</i>. 하나로 합치면
 * <b>"역할을 켜면 되는 문제" 와 "메뉴를 켜야 하는 문제" 가 구분되지 않아</b> 관리자가 무엇을
 * 고쳐야 할지 알 수 없고, AUTHZ-13 의 진단 동선이 성립하지 않는다.
 *
 * <p><b>③이 유일한 머지다.</b> 그리고 머지되는 것은 <b>쌍</b>이다 — {@code MENU_CD} 집합과
 * {@code ACTION_CD} 집합을 각각 합치면 곱집합이 되어 아무 역할도 주지 않은 조합이 생긴다.
 * {@link MenuAction} 이 record 인 것이 그 실수를 타입 차원에서 막는다.
 *
 * <p><b>{@code USE_YN} 은 셋이고 어느 것도 머지 대상이 아니다.</b> {@code SYS_USER.USE_YN} 은
 * 로그인 자체를 막으므로 여기 오지 않고, {@code SYS_ROLE.USE_YN} 은 ②의 입력 필터,
 * {@code SYS_MENU.USE_YN} 은 ④의 최종 게이트(AND)다.
 */
@Service
@Transactional(readOnly = true)
public class EffectiveAuthorityService {

    private final SysRoleMenuAuthRepository roleGrants;
    private final SysUserMenuAuthRepository personalGrants;
    private final SysMenuRepository menus;
    private final BusinessCalendar calendar;

    public EffectiveAuthorityService(
            SysRoleMenuAuthRepository roleGrants,
            SysUserMenuAuthRepository personalGrants,
            SysMenuRepository menus,
            BusinessCalendar calendar) {
        this.roleGrants = roleGrants;
        this.personalGrants = personalGrants;
        this.menus = menus;
        this.calendar = calendar;
    }

    /**
     * 한 사용자의 유효 권한을 계산한다. <b>로그인 시 한 번</b>, 그리고 세션 캐시가 낡았을 때
     * 다시 부른다 — 매 요청 부르는 것이 아니다(security-design.md §4 권한 캐싱).
     */
    public EffectiveAuthority calculate(String userId) {
        LocalDate businessToday = calendar.today();

        // ① + ② — 두 출처가 각자의 자격 검사를 통과한 행을 낸다.
        // ③ — LinkedHashSet 이므로 중복은 여기서 사라진다. 두 역할이 같은 쌍을 주는 것은
        //      무해하며, 우선순위·순서가 개입할 여지가 없다.
        Set<MenuAction> merged = new LinkedHashSet<>(
                roleGrants.findGrantsOfUser(userId, businessToday, true));
        merged.addAll(personalGrants.findGrantsOfUser(userId, businessToday));

        // ④ — 대상이 살아 있는가. 여기만 OR 이 아니라 AND 다.
        Map<String, SysMenu> byCode = menus.findAll().stream()
                .collect(Collectors.toMap(SysMenu::getMenuCd, Function.identity()));

        Set<MenuAction> gated = merged.stream()
                // 모르는 메뉴 코드는 통과시키지 않는다. FK 가 있으므로 정상 경로로는
                // 생기지 않지만, 판정의 기본값이 "모르면 거부" 여야 한다(deny by default).
                .filter(grant -> {
                    SysMenu menu = byCode.get(grant.menuCd());
                    return menu != null && menu.isAuthorizable();
                })
                .collect(Collectors.toCollection(LinkedHashSet::new));

        return new EffectiveAuthority(Set.copyOf(gated), businessToday);
    }
}
