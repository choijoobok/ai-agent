package com.ordinary.backoffice.domain.authz.repository;

import com.ordinary.backoffice.domain.authz.entity.SysRole;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SysRoleRepository extends JpaRepository<SysRole, String> {}
