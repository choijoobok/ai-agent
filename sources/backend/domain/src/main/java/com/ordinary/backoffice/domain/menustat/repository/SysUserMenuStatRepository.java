package com.ordinary.backoffice.domain.menustat.repository;

import com.ordinary.backoffice.domain.menustat.entity.SysUserMenuStat;
import com.ordinary.backoffice.domain.menustat.entity.SysUserMenuStatId;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 자주 쓰는 메뉴 — 42 §8. */
public interface SysUserMenuStatRepository
        extends JpaRepository<SysUserMenuStat, SysUserMenuStatId> {

    Optional<SysUserMenuStat> findByUserIdAndMenuCdAndStatYm(
            String userId, String menuCd, String statYm);

    /**
     * 창 안의 합계로 정렬한 상위 목록 — 42 §8.
     *
     * <p><b>합계가 같으면 최근에 쓴 것이 위다.</b> 그것이 없으면 동점인 메뉴들의 순서가
     * 조회할 때마다 달라지고, 사용자는 <i>목록이 흔들린다</i> 고 느낀다.
     *
     * <p><b>{@code STAT_YM >= ?} 하나로 창이 된다.</b> 문자열의 사전순이 곧 시간순이라
     * 벤더별 날짜 함수가 필요 없다(22).
     *
     * <p>{@code Object[]} 로 받는다 — 프로젝션 인터페이스를 두면 이 한 줄짜리 질의 하나를
     * 위해 타입이 늘고, 그것을 도메인 밖에서 쓸 일이 없다.
     */
    @Query("select s.menuCd, sum(s.useCnt), max(s.lastUseDtm) from SysUserMenuStat s"
            + " where s.userId = :userId and s.statYm >= :fromYm"
            + " group by s.menuCd"
            + " order by sum(s.useCnt) desc, max(s.lastUseDtm) desc")
    List<Object[]> findTop(
            @Param("userId") String userId, @Param("fromYm") String fromYm, Pageable limit);
}
