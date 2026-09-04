package com.aiagent.domain.authz.repository;

import com.aiagent.domain.authz.MenuAction;
import com.aiagent.domain.authz.entity.SysUserMenuAuth;
import com.aiagent.domain.authz.entity.SysUserMenuAuthId;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysUserMenuAuthRepository
        extends JpaRepository<SysUserMenuAuth, SysUserMenuAuthId> {

    /**
     * ① 수집 + ② 필터 중 <b>개인 예외 쪽</b> — security-design.md §4.
     *
     * <p>합집합의 <b>독립 항</b>이다. 역할이 하나도 없어도 개인 예외만으로 일하는 사용자가
     * 정당하게 존재하므로, 로그인 차단 판정을 "역할 미부여" 로 하면 그 사용자가 부당하게
     * 막힌다 — 기준은 언제나 <b>유효 권한 공집합</b>이다.
     *
     * <p>기간이 NOT NULL 이므로 역할 부여와 달리 NULL 분기가 없다.
     */
    @Query("""
            select distinct new com.aiagent.domain.authz.MenuAction(
                    uma.menuCd, uma.actionCd)
            from SysUserMenuAuth uma
            where uma.userId = :userId
              and uma.validFromDt <= :businessToday
              and :businessToday <= uma.validToDt
            """)
    List<MenuAction> findGrantsOfUser(
            @Param("userId") String userId, @Param("businessToday") LocalDate businessToday);

    /**
     * 내 역할 탭이 읽는 <b>예외 전부</b> — main-shell.md §8.
     *
     * <p>위의 것과 달리 <b>기간으로 거르지 않는다.</b> 만료된 예외를 감추면 <i>"어제까지
     * 되던 것이 왜 안 되나"</i> 에 답할 것이 없어진다 — 그 답이 이 탭의 존재 이유다.
     */
    List<SysUserMenuAuth> findByUserIdOrderByMenuCdAscActionCdAsc(String userId);

    /** 이 메뉴에 개인 예외가 있는가 — 삭제 게이트 · URL 비우기 게이트(62 §4.3 · §4.8). */
    boolean existsByMenuCd(String menuCd);
}
