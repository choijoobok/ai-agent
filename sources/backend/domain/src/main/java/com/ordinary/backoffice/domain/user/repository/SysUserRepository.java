package com.ordinary.backoffice.domain.user.repository;

import com.ordinary.backoffice.domain.user.entity.SysUser;
import org.springframework.data.jpa.repository.JpaRepository;

/** 단건 조회·저장은 JPA 가 기본이다 — architecture.md §3. */
public interface SysUserRepository extends JpaRepository<SysUser, String> {}
