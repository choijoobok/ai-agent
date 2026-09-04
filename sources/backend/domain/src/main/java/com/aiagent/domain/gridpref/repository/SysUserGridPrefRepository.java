package com.aiagent.domain.gridpref.repository;

import com.aiagent.domain.gridpref.entity.SysUserGridPref;
import com.aiagent.domain.gridpref.entity.SysUserGridPrefId;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 그리드 개인화 — 언제나 (사용자, 메뉴, 그리드) 하나를 다룬다(frontend/grid.md). */
public interface SysUserGridPrefRepository
        extends JpaRepository<SysUserGridPref, SysUserGridPrefId> {

    Optional<SysUserGridPref> findByUserIdAndMenuCdAndGridId(
            String userId, String menuCd, String gridId);

    void deleteByUserIdAndMenuCdAndGridId(String userId, String menuCd, String gridId);

    /**
     * 메뉴가 지워질 때 함께 거둔다 — screen/menu/requirements.md · seed.md.
     *
     * <p><b>사용자를 가리지 않는 유일한 경로다.</b> 없는 메뉴의 컬럼 설정은 열 화면이
     * 없으므로 남길 이유가 없고, 남기면 {@code MENU_CD} FK 가 메뉴 삭제를 거부한다 —
     * 관리자는 남의 설정을 볼 수도 지울 수도 없으니 <b>할 수 있는 일이 없는 거부</b>가 된다.
     */
    void deleteByMenuCd(String menuCd);
}
