package com.aiagent.domain.authz.repository;

import com.aiagent.domain.authz.entity.SysRole;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysRoleRepository extends JpaRepository<SysRole, String> {

    /** 같은 역할의 전체 권한 저장을 직렬화해 나중 스냅샷이 실제 최종 상태가 되게 한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select role from SysRole role where role.roleId = :roleId")
    Optional<SysRole> findByRoleIdForUpdate(@Param("roleId") String roleId);
}
