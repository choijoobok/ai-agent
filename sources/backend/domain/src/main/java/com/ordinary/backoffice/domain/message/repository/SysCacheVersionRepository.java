package com.ordinary.backoffice.domain.message.repository;

import com.ordinary.backoffice.domain.message.entity.SysCacheVersion;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SysCacheVersionRepository extends JpaRepository<SysCacheVersion, String> {}
