package com.aiagent.domain.user.repository;

import com.aiagent.domain.user.entity.SysUser;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 단건 조회·저장은 JPA 가 기본이다 — backend/packages.md. */
public interface SysUserRepository extends JpaRepository<SysUser, String> {

    /** 같은 사용자의 개인 설정 변경을 한 줄로 세운다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from SysUser user where user.userId = :userId")
    Optional<SysUser> findByUserIdForUpdate(@Param("userId") String userId);
}
