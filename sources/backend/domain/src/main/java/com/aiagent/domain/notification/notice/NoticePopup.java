package com.aiagent.domain.notification.notice;

/**
 * 로그인 뒤 뜨는 팝업 — 60 §9 · 66 §2.4 <b>C안</b>.
 *
 * <p><b>한 건이다.</b> 여러 건을 순차로 넘기거나(B안) 목록을 팝업에 담는(A안) 대신 최신
 * 하나만 띄우고 나머지는 알림 모달의 공지 탭으로 보낸다 — <b>목록을 두 곳에 만들지
 * 않는다</b>(main-shell.md §7).
 *
 * @param notice 띄울 공지. <b>{@code null} 이 정상</b>이다 — 팝업 대상이 없는 날이 대부분이며,
 *     그때 화면은 아무것도 열지 않는다
 * @param moreCount 지금 <b>게시중인 공지 중 이 하나를 뺀 수</b>. 0 이면 화면이
 *     <i>"N건 더 있음"</i> 링크를 감춘다. 팝업 대상이 없으면 이 값도 0 이다 — 띄우지도
 *     않은 팝업의 <i>나머지</i> 는 셀 것이 없다
 */
public record NoticePopup(NoticeDetail notice, long moreCount) {

    /** 띄울 것이 없다 — 팝업 대상이 없는 날. */
    public static NoticePopup none() {
        return new NoticePopup(null, 0L);
    }
}
