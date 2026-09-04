package com.aiagent.domain.config.repository;

import com.aiagent.domain.config.entity.SysConfig;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@code SYS_CONFIG} — <b>전건 조회가 정상 사용법이다</b>.
 *
 * <p>19~20행짜리 표이고 조회는 <b>작업당 한 번</b>이다(backend/caching.md). 조건절도 페이징도 두지
 * 않는 것은, 이 테이블이 아우터 조인의 <b>오른쪽</b>이라 <b>왼쪽(코드)이 이미 목록을 정해
 * 놓았기</b> 때문이다 — 여기서 거르면 왼쪽과 개수가 갈린다.
 */
public interface SysConfigRepository extends JpaRepository<SysConfig, String> {}
