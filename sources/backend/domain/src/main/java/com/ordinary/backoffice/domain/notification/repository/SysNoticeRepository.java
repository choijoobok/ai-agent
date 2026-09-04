package com.ordinary.backoffice.domain.notification.repository;

import com.ordinary.backoffice.domain.notification.entity.SysNotice;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 공지사항 — 47 §9. 조회는 {@code QuerySpec} 을 지난다(api-conventions.md §4.1).
 *
 * <p><b>파기 대상이 아니다</b>(32 §3 · 66 §6.3) — 사람이 쓴 것이고 {@code USE_YN} 으로
 * 내리므로 지우는 것은 사람의 결정이다. 여기 {@code findIdsCreatedBefore} 가 없는 것이
 * 그 집행이다.
 */
public interface SysNoticeRepository extends JpaRepository<SysNotice, Long> {}
