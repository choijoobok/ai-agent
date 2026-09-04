package com.ordinary.backoffice.domain.authz.repository;

import com.ordinary.backoffice.domain.authz.entity.SysUserRole;
import com.ordinary.backoffice.domain.authz.entity.SysUserRoleId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysUserRoleRepository extends JpaRepository<SysUserRole, SysUserRoleId> {

    /**
     * 역방향 조회 — 역할 권한이나 역할 {@code USE_YN} 이 바뀌면 <b>보유자 전원</b>의 세션에
     * {@code authzDirty} 를 세워야 한다(security-design.md §4).
     *
     * <p>기간으로 거르지 않는다. 무효화 대상은 <b>지금 유효한 부여</b>가 아니라 <b>이 역할을
     * 가진 적이 있는 사람</b>이다 — 부여가 내일부터 유효한 사용자의 세션도 자정 이후 첫
     * 요청에서 다시 계산되어야 하고, 그 판단은 재계산이 하지 이 쿼리가 하지 않는다.
     */
    @Query("select ur.userId from SysUserRole ur where ur.roleId = :roleId")
    List<String> findUserIdsByRoleId(@Param("roleId") String roleId);

    /**
     * 내 역할 탭이 읽는 <b>부여 전부</b> — AUTHZ-04 · main-shell.md §8.
     *
     * <p><b>기간으로 거르지 않는 것이 요건이다.</b> 유효 권한 계산과 정반대다 — 거기서는
     * 만료된 부여가 없는 것과 같지만, 여기서는 <i>"왜 이 메뉴가 안 보이나"</i> 에 답하는
     * 것이 목적이라 <b>만료된 부여야말로 보여줘야 할 답</b>이다.
     */
    List<SysUserRole> findByUserIdOrderByRoleIdAsc(String userId);

    /**
     * 삭제 게이트가 보는 수 — 62 §3.5. <b>기간을 보지 않는다.</b>
     *
     * <p>만료된 부여도 {@code SYS_USER_ROLE} 행이며 <b>FK 는 날짜를 보지 않는다</b>. 유효
     * 인원이 {@code 0} 인데 삭제가 막히는 것이 정상이고, 그래서 화면이 <i>보유</i> 와
     * <i>유효</i> 를 컬럼 둘로 나눠 둔다(62 §3.2.1).
     */
    long countByRoleId(String roleId);
}
