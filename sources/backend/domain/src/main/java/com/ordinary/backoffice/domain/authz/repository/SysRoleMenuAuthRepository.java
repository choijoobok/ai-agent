package com.ordinary.backoffice.domain.authz.repository;

import com.ordinary.backoffice.domain.authz.MenuAction;
import com.ordinary.backoffice.domain.authz.entity.SysRoleMenuAuth;
import com.ordinary.backoffice.domain.authz.entity.SysRoleMenuAuthId;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysRoleMenuAuthRepository
        extends JpaRepository<SysRoleMenuAuth, SysRoleMenuAuthId> {

    /**
     * 유효 권한 계산의 ① 수집 + ② 필터 중 <b>역할 쪽</b> — security-design.md §4.
     *
     * <p>여기서 거르는 것은 <b>출처 자격</b>뿐이다. 메뉴 게이트(④)는 방향이 반대이므로
     * (②는 <i>누가 주는가</i>, ④는 <i>대상이 살아 있는가</i>) 이 쿼리에 섞지 않는다 —
     * 하나로 합치면 <b>"역할을 켜면 되는 문제" 와 "메뉴를 켜야 하는 문제" 가 구분되지 않아</b>
     * 관리자가 무엇을 고쳐야 할지 알 수 없다.
     *
     * <p>두 조건의 AND 다 — 역할이 활성이고({@code SYS_ROLE.USE_YN='Y'}) 부여가 유효기간
     * 내여야 한다. 기간 NULL 은 <b>제한 없음</b>이며 양끝을 포함한다(40 §4.3).
     *
     * <p>연관관계 매핑 없이 {@code where} 로 잇는다. 인가 판정에 필요한 것은 <b>쌍의 집합</b>
     * 하나뿐이고, {@code @ManyToOne} 을 걸면 이 한 줄을 얻으려고 엔티티 그래프가 딸려 온다.
     */
    @Query("""
            select distinct new com.ordinary.backoffice.domain.authz.MenuAction(
                    rma.menuCd, rma.actionCd)
            from SysRoleMenuAuth rma, SysUserRole ur, SysRole r
            where ur.userId = :userId
              and ur.roleId = rma.roleId
              and r.roleId = rma.roleId
              and r.useYn = :active
              and (ur.validFromDt is null or ur.validFromDt <= :businessToday)
              and (ur.validToDt is null or :businessToday <= ur.validToDt)
            """)
    List<MenuAction> findGrantsOfUser(
            @Param("userId") String userId,
            @Param("businessToday") LocalDate businessToday,
            @Param("active") boolean active);

    /** 이 메뉴에 권한을 준 역할이 있는가 — 삭제 게이트 · URL 비우기 게이트(62 §4.3 · §4.8). */
    boolean existsByMenuCd(String menuCd);

    /** 삭제 게이트가 보는 <b>권한 건수</b> — 62 §3.5. 마스터 조회 응답이 이미 갖는 수다. */
    long countByRoleId(String roleId);

    /**
     * 이 역할의 부여 전부 — 62 §2.6 의 저장이 <b>지금 상태</b>로 읽는 것이다.
     *
     * <p>화면이 보낸 집합과 이것의 차이가 곧 추가·삭제다. <b>정렬을 고정</b>하는 것은 삭제
     * 순서가 벤더마다 흔들리면 로그의 재현성이 사라지기 때문이다.
     */
    List<SysRoleMenuAuth> findByRoleIdOrderByMenuCdAscActionCdAsc(String roleId);

    /*
      <b>{@code deleteByRoleId} 를 두지 않는다.</b> 역할 삭제는 <b>권한 {@code 0} 건일 때만</b>
      통과하므로(62 §3.5) 함께 지울 것이 없다 — 두면 <i>게이트를 지나지 않고 지우는 길</i>이
      생기고, 그 길로 지운 부여는 <b>아무 화면에도 흔적이 남지 않는다</b>(42 §3.1).
    */
}
