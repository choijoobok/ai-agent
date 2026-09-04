package com.ordinary.backoffice.domain.notification.request;

import java.util.List;

/**
 * <i>내 요청</i> 탭이 한 번에 받는 것 — 60 §8.
 *
 * <p><b>미읽음이 없다.</b> {@code MyNotifications} 와 갈리는 자리이며 main-shell.md §7.1 이 이미
 * 정했다 — <b>내가 보낸 것이라 <i>"읽지 않음"</i> 이 성립하지 않는다</b>. 요청의 진행은
 * <i>내 알림</i> 으로 알려지고 이 탭은 <b>그 이력을 보는 곳</b>이다.
 *
 * @param totalCount 전건 수. {@code rows.size()} 와 다르면 잘렸다는 뜻이다
 */
public record MyRequests(List<MyRequestRow> rows, long totalCount) {}
