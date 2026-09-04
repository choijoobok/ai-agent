package com.aiagent.domain.authz.repository;

import com.aiagent.domain.authz.entity.SysMenuApi;
import com.aiagent.domain.authz.entity.SysMenuApiId;
import org.springframework.data.jpa.repository.JpaRepository;

/** {@link SysApiRepository} 와 함께 기동 시 한 번 읽혀 URL 맵으로 합쳐진다. */
public interface SysMenuApiRepository extends JpaRepository<SysMenuApi, SysMenuApiId> {

    /**
     * 이 메뉴에 매핑된 API 가 있는가 — 삭제 게이트(62 §4.8).
     *
     * <p><b>막는 이유가 FK 가 아니라 다음 배포다.</b> 시드가 전체 동기화이므로(ADR-0022)
     * 코드에 그 화면이 살아 있으면 {@code generateApiSeed} 가 행을 다시 넣고, {@code MENU_CD}
     * 가 없으면 <b>FK 로 배포가 깨진다</b>.
     */
    boolean existsByMenuCd(String menuCd);
}
