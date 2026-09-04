package com.aiagent.domain.authz.repository;

import com.aiagent.domain.authz.entity.SysMenu;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 메뉴는 <b>전건을 읽는다</b>. 게이트(④)도 트리 역산(AUTHZ-04)도 전체 구조를 필요로 하고,
 * 행 수가 템플릿 24 · 업무를 더해도 수백이다 — 조건 조회로 쪼개면 왕복만 늘어난다.
 */
public interface SysMenuRepository extends JpaRepository<SysMenu, String> {

    /**
     * 자식이 하나라도 있는가 — <b>삭제 게이트</b>가 묻는다(screen/menu/requirements.md).
     *
     * <p>{@code findAll} 로 세어도 되지만, 삭제는 트리를 다 읽을 이유가 없는 자리다 —
     * 게이트 넷이 전부 {@code exists} 한 번이라 <b>모양이 같아야</b> 읽힌다.
     */
    boolean existsByUpMenuCd(String upMenuCd);
}
