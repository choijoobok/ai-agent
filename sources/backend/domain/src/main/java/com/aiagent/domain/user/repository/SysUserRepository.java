package com.aiagent.domain.user.repository;

import com.aiagent.domain.user.entity.SysUser;
import org.springframework.data.jpa.repository.JpaRepository;

/** 단건 조회·저장은 JPA 가 기본이다 — backend/packages.md. */
public interface SysUserRepository extends JpaRepository<SysUser, String> {}
