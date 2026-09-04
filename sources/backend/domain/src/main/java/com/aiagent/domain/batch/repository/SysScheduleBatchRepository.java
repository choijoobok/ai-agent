package com.aiagent.domain.batch.repository;

import com.aiagent.domain.batch.entity.SysScheduleBatch;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 배치 등록 — 46 §5.
 *
 * <p><b>메서드가 없다.</b> 목록은 {@code QuerySpec} 을 지나고(api-conventions.md §4.1) 단건은
 * {@code findById} 이며, 유일하게 특별할 뻔한 <i>"{@code BEAN_ID} 로 찾기"</i> 는
 * <b>필요가 없다</b> — 같은 빈을 여러 번 등록하는 것이 정상이라(46 §5.2) 그 조회의 답이
 * 언제나 목록이고, 목록은 화면의 것이다.
 */
public interface SysScheduleBatchRepository extends JpaRepository<SysScheduleBatch, String> {}
