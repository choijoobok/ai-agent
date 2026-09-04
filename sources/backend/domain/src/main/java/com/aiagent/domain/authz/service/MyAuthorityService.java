package com.aiagent.domain.authz.service;

import com.aiagent.domain.authz.MyAuthority;
import com.aiagent.domain.authz.MyMenuGrant;
import com.aiagent.domain.authz.MyRoleGrant;
import com.aiagent.domain.authz.entity.SysMenu;
import com.aiagent.domain.authz.entity.SysRole;
import com.aiagent.domain.authz.entity.SysUserMenuAuth;
import com.aiagent.domain.authz.entity.SysUserRole;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.authz.repository.SysRoleRepository;
import com.aiagent.domain.authz.repository.SysUserMenuAuthRepository;
import com.aiagent.domain.authz.repository.SysUserRoleRepository;
import com.aiagent.support.time.BusinessCalendar;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 역할 — AUTHZ-04 · frontend/tabs.md.
 *
 * <p><b>{@link EffectiveAuthorityService} 와 방향이 반대다.</b> 저쪽은 <i>무엇을 할 수
 * 있는가</i> 를 계산하려고 만료·비활성을 <b>걸러 버리고</b>, 여기는 <i>왜 할 수 없는가</i> 를
 * 보이려고 <b>걸러진 것까지 남긴다</b>. 그래서 두 서비스를 합칠 수 없다 — 합치면 한쪽의
 * 필터가 다른 쪽의 답을 지운다.
 *
 * <p><b>부여를 만들거나 고치는 메서드가 없다.</b> 이 탭은 읽기 전용이며(frontend/tabs.md), 권한을
 * 늘리는 경로는 신청(NOTI-06)이지 본인 화면이 아니다.
 */
@Service
@Transactional(readOnly = true)
public class MyAuthorityService {

    private final SysUserRoleRepository userRoles;
    private final SysRoleRepository roles;
    private final SysUserMenuAuthRepository personalGrants;
    private final SysMenuRepository menus;
    private final BusinessCalendar calendar;

    public MyAuthorityService(
            SysUserRoleRepository userRoles,
            SysRoleRepository roles,
            SysUserMenuAuthRepository personalGrants,
            SysMenuRepository menus,
            BusinessCalendar calendar) {
        this.userRoles = userRoles;
        this.roles = roles;
        this.personalGrants = personalGrants;
        this.menus = menus;
        this.calendar = calendar;
    }

    public MyAuthority getMyAuthority(String userId) {
        LocalDate today = calendar.today();
        return new MyAuthority(roleGrants(userId, today), menuGrants(userId, today), today);
    }

    /**
     * 부여 목록에 역할의 이름을 붙인다.
     *
     * <p>조인 쿼리를 쓰지 않는 것은 <b>한 사람의 역할이 몇 개</b>이기 때문이다 — 생성자
     * 표현식 쿼리를 두면 그 형태를 위한 레코드가 하나 더 생기고, 유효 판정은 어차피 자바가
     * 한다(기준일이 {@link BusinessCalendar} 의 것이라 SQL 의 오늘과 다르다 — backend/persistence.md).
     */
    private List<MyRoleGrant> roleGrants(String userId, LocalDate today) {
        List<SysUserRole> grants = userRoles.findByUserIdOrderByRoleIdAsc(userId);
        Map<String, SysRole> byId = roles
                .findAllById(grants.stream().map(SysUserRole::getRoleId).toList())
                .stream()
                .collect(Collectors.toMap(SysRole::getRoleId, Function.identity()));

        return grants.stream()
                // 역할이 지워졌는데 부여가 남은 경우다. FK 가 있어 정상 경로로는 생기지
                // 않지만, 이름을 못 찾았다고 목록에서 조용히 빠지면 그 사람은 부여가
                // 있다는 사실 자체를 볼 수 없다.
                .map(grant -> {
                    SysRole role = byId.get(grant.getRoleId());
                    boolean useYn = role != null && Boolean.TRUE.equals(role.getUseYn());
                    return new MyRoleGrant(
                            grant.getRoleId(),
                            role == null ? grant.getRoleId() : role.getRoleNm(),
                            role == null ? null : role.getRoleDesc(),
                            grant.getValidFromDt(),
                            grant.getValidToDt(),
                            useYn,
                            useYn && within(grant.getValidFromDt(), grant.getValidToDt(), today));
                })
                .toList();
    }

    private List<MyMenuGrant> menuGrants(String userId, LocalDate today) {
        List<SysUserMenuAuth> grants =
                personalGrants.findByUserIdOrderByMenuCdAscActionCdAsc(userId);
        Map<String, SysMenu> byCode = menus
                .findAllById(grants.stream().map(SysUserMenuAuth::getMenuCd).distinct().toList())
                .stream()
                .collect(Collectors.toMap(SysMenu::getMenuCd, Function.identity()));

        return grants.stream()
                .map(grant -> {
                    SysMenu menu = byCode.get(grant.getMenuCd());
                    return new MyMenuGrant(
                            grant.getMenuCd(),
                            menu == null ? grant.getMenuCd() : menu.getMenuNm(),
                            grant.getActionCd(),
                            grant.getValidFromDt(),
                            grant.getValidToDt(),
                            grant.getGrantRsn(),
                            within(grant.getValidFromDt(), grant.getValidToDt(), today));
                })
                .toList();
    }

    /** <b>양끝을 포함</b>하며 NULL 은 제한 없음이다 — sys/INDEX.md. */
    private static boolean within(LocalDate from, LocalDate to, LocalDate today) {
        if (from != null && today.isBefore(from)) {
            return false;
        }
        return to == null || !today.isAfter(to);
    }
}
