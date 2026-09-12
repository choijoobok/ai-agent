// @feat FEAT-509
package com.aiagent.system.api.notification.request;

import jakarta.validation.constraints.NotNull;

/**
 * 읽음으로 바꿀 알림 하나 — frontend/tabs.md.
 *
 * <p><b>{@code userId} 가 없다.</b> 세션의 주인이며 받으면 <b>남의 알림을 읽음으로
 * 바꾸는 경로</b>가 열린다 — 그러면 그 사람의 배지가 조용히 줄고, frontend/tabs.md 가 막으려던
 * <i>놓친 알림을 찾을 수 없는 상태</i>를 남이 만들 수 있게 된다.
 *
 * <p><b>목록을 받지 않는다.</b> 여는 것은 언제나 하나이며, 여러 건을 한 번에 비우는
 * 경로는 <i>모두 읽음</i> 하나다(frontend/tabs.md).
 */
public record NotiReadRequest(@NotNull Long notiId) {}
