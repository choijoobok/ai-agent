package com.ordinary.backoffice.domain.authz.repository;

import com.ordinary.backoffice.domain.authz.entity.SysApi;
import org.springframework.data.jpa.repository.JpaRepository;

/** 기동 시 전건을 읽어 맵으로 만든다 — 런타임 조회는 해시 한 번이다(security-design.md §4 권한 캐싱). */
public interface SysApiRepository extends JpaRepository<SysApi, String> {}
