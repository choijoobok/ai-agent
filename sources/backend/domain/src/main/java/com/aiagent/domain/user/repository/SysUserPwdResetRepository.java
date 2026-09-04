package com.aiagent.domain.user.repository;

import com.aiagent.domain.user.entity.SysUserPwdReset;
import org.springframework.data.jpa.repository.JpaRepository;

/** 사용자당 한 행이라 PK 조회가 전부다 — backend/packages.md. */
public interface SysUserPwdResetRepository extends JpaRepository<SysUserPwdReset, String> {}
