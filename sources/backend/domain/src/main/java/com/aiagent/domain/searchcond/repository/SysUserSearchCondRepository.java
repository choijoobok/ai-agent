package com.aiagent.domain.searchcond.repository;

import com.aiagent.domain.searchcond.entity.SysUserSearchCond;
import com.aiagent.domain.searchcond.entity.SysUserSearchCondId;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 저장된 조회조건 — frontend/search-form.md.
 *
 * <p><b>조회는 언제나 (사용자, 메뉴) 로 좁힌다.</b> 사용자 단위로 전건을 읽는 경로를 두지
 * 않는 이유는 그런 화면이 없기 때문이고, 두면 <i>"내 조건 전부 보기"</i> 라는 없는 기능이
 * API 로 먼저 생긴다.
 */
public interface SysUserSearchCondRepository
        extends JpaRepository<SysUserSearchCond, SysUserSearchCondId> {

    List<SysUserSearchCond> findByUserIdAndMenuCdOrderBySortNoAsc(String userId, String menuCd);

    Optional<SysUserSearchCond> findByUserIdAndMenuCdAndCondNm(
            String userId, String menuCd, String condNm);

    long countByUserIdAndMenuCd(String userId, String menuCd);

    void deleteByUserIdAndMenuCdAndCondNm(String userId, String menuCd, String condNm);

    /**
     * 메뉴가 지워질 때 함께 거둔다 — screen/menu/requirements.md · seed.md.
     *
     * <p>위 주석의 <i>"사용자 단위 전건 경로를 두지 않는다"</i> 와 어긋나 보이지만 축이
     * 다르다 — 이것은 <b>메뉴 단위</b>이며 사용자를 넘나드는 <b>조회</b>가 아니라 삭제다.
     * 없는 메뉴의 조회조건은 열 화면이 없고, 남기면 FK 가 메뉴 삭제를 거부한다.
     */
    void deleteByMenuCd(String menuCd);

    /** 다음 순번. 최대값 + 1 이며 <b>빈 자리를 메우지 않는다</b> — 순서는 만든 순서다. */
    @Query("select coalesce(max(c.sortNo), 0) from SysUserSearchCond c"
            + " where c.userId = :userId and c.menuCd = :menuCd")
    int findLastSortNo(@Param("userId") String userId, @Param("menuCd") String menuCd);
}
