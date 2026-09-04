package com.aiagent.domain.favorite.repository;

import com.aiagent.domain.favorite.entity.SysUserFavorite;
import com.aiagent.domain.favorite.entity.SysUserFavoriteId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 즐겨찾기 — 42 §7.
 *
 * <p><b>조회는 언제나 사용자로 좁힌다.</b> 즐겨찾기는 <i>평면 목록</i> 이라 메뉴로 좁히는
 * 경로가 없고(조회조건·그리드 설정과 다른 자리다), 사용자 전건이 곧 화면이 그리는 것이다.
 */
public interface SysUserFavoriteRepository
        extends JpaRepository<SysUserFavorite, SysUserFavoriteId> {

    List<SysUserFavorite> findByUserIdOrderBySortNoAsc(String userId);

    boolean existsByUserIdAndMenuCd(String userId, String menuCd);

    void deleteByUserIdAndMenuCd(String userId, String menuCd);

    /**
     * 메뉴가 사라질 때 그것을 가리키던 즐겨찾기를 <b>함께 지운다</b> — 62 §4.8.
     *
     * <p>여기만 <b>사용자로 좁히지 않는다.</b> 위의 규약을 깨는 유일한 자리이며, 깨는 이유가
     * 분명하다 — 지우는 주체가 <i>그 즐겨찾기의 주인</i>이 아니라 <b>메뉴</b>다. 관리자는 남의
     * 즐겨찾기를 볼 수도 지울 수도 없으므로, 막아 두면 <i>운영자가 할 수 있는 일이 없는
     * 거부</i>가 되고 그것은 거부가 아니라 고장이다.
     */
    void deleteByMenuCd(String menuCd);

    /** 다음 순번. 최대값 + 1 이며 <b>빈 자리를 메우지 않는다</b> — 순서는 넣은 순서다. */
    @Query("select coalesce(max(f.sortNo), 0) from SysUserFavorite f where f.userId = :userId")
    int findLastSortNo(@Param("userId") String userId);
}
