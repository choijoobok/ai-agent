package com.aiagent.domain.notification.notice;

import com.aiagent.domain.notification.entity.SysNotice;
import java.time.Instant;

/**
 * 공지의 게시 상태 — screen/admin/system/notice/requirements.md. <b>저장되지 않는 파생 값</b>이다.
 *
 * <p>컬럼이 아니라 {@code USE_YN} 과 기간 둘의 <b>조합</b>이며, 그래서 조회조건에서도
 * 파생이다(screen/admin/system/notice/requirements.md — {@code 72} 가 세는 파생 조건의 다섯째 사례).
 *
 * <h2>규칙이 한 곳에 있다</h2>
 *
 * <p>{@link #resolve} 를 목록 조회(표시)와 {@link NoticeSpec}(조건)이 함께 쓴다. 나누면
 * <b>배지는 게시중인데 게시중으로 걸러도 안 나오는</b> 행이 생긴다 — 같은 질문에 답이
 * 둘이면 안 된다.
 *
 * <h2>서버가 판정한다</h2>
 *
 * <p>클라이언트가 계산하면 <b>PC 시계가 틀린 사람에게 다른 배지</b>가 뜨고, 기준 시각은
 * 브라우저가 아니라 <b>서버의 {@code Clock}</b> 이다. <b>{@code app.business-timezone} 은
 * 여기에 개입하지 않는다</b> — 판정이 {@code Instant} 비교라 시간대가 들어갈 자리가 없다.
 * 그 설정은 {@code BusinessCalendar} 의 것이며 {@code LocalDate} 로 자르는 쪽이 쓴다
 * (sys/INDEX.md). screen/admin/system/batch/schedule/requirements.md 에서 {@code 유령}
 * 배지가 서버 판정으로 옮겨 간 것과 같은 이유이며, 여기는 하나가 더 있다 —
 * <b>지금을 DB 가 아니라 애플리케이션이 준다</b>(backend/persistence.md).
 */
public enum NoticeStatus {

    /** 내림 — {@code USE_YN='N'}. <b>기간과 무관하게 이긴다</b>(sys/notification.md). */
    DOWN,

    /** 예정 — 게시 시작 전. 예약 게시가 성립하는 자리다. */
    SCHEDULED,

    /** 게시중 — 목록과 팝업이 보는 상태. */
    ACTIVE,

    /** 종료 — 게시 종료가 지났다. {@code 지난 공지 포함} 으로 켜면 보인다(screen/admin/system/notice/requirements.md). */
    EXPIRED;

    /**
     * 넷 중 하나로 판정한다 — <b>순서가 규칙이다</b>.
     *
     * <p>{@link #DOWN} 을 먼저 보는 것이 sys/notification.md 의 <i>즉시 내림이 기간을 이긴다</i> 를
     * 집행한다. 기간을 먼저 보면 내려 둔 공지가 {@code 게시중} 으로 보인다.
     *
     * <p>{@code noticeToDtm} 이 {@code null} 이면 <b>무기한</b>이라 {@link #EXPIRED} 가
     * 되지 않는다.
     */
    public static NoticeStatus resolve(
            boolean useYn, Instant from, Instant to, Instant now) {
        if (!useYn) {
            return DOWN;
        }
        if (now.isBefore(from)) {
            return SCHEDULED;
        }
        if (to != null && now.isAfter(to)) {
            return EXPIRED;
        }
        return ACTIVE;
    }

    /** 저장된 행에서 바로 — 목록 조회가 쓴다. */
    public static NoticeStatus of(SysNotice notice, Instant now) {
        return resolve(
                Boolean.TRUE.equals(notice.getUseYn()),
                notice.getNoticeFromDtm(),
                notice.getNoticeToDtm(),
                now);
    }
}
