package com.aiagent.domain.notification.inbox;

import java.util.List;

/**
 * <i>내 알림</i> 탭이 한 번에 받는 것 — frontend/tabs.md.
 *
 * <p><b>셋을 함께 준다.</b> 목록만 주면 화면이 미읽음을 <i>세어야</i> 하는데, 목록에는
 * 상한이 있으므로(`NotiProps`) 그 셈은 <b>상한 안에서만 맞다</b> — frontend/tabs.md 이 배지에
 * 요구한 것은 <b>전건의 미읽음</b>이다.
 *
 * @param rows 최근 것부터. 상한에 걸려 잘릴 수 있다
 * @param unreadCount <b>상한과 무관한 전건</b>의 미읽음 수 — 헤더 벨의 배지가 이 값이다
 * @param totalCount 전건 수. {@code rows.size()} 와 다르면 <b>잘렸다</b>는 뜻이고, 화면은
 *     그때 <i>"최근 N건"</i> 이라고 말한다 — 조용히 자르면 목록이 전부로 읽힌다
 */
public record MyNotifications(List<MyNotiRow> rows, long unreadCount, long totalCount) {}
