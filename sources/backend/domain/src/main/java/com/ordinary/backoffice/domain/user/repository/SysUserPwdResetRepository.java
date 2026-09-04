package com.ordinary.backoffice.domain.user.repository;

import com.ordinary.backoffice.domain.user.entity.SysUserPwdReset;
import org.springframework.data.jpa.repository.JpaRepository;

/** 사용자당 한 행이라 PK 조회가 전부다 — architecture.md §3. */
public interface SysUserPwdResetRepository extends JpaRepository<SysUserPwdReset, String> {}
