package com.aiagent.support.time;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 업무 달력 날짜의 판정 기준 — sys/INDEX.md.
 *
 * <p>{@code _DT} 컬럼(사용 기간 등)은 시간대가 없는 달력 값이므로 <b>"오늘"이 무엇인가</b>를
 * 누군가 정해야 한다. 서버 JVM 의 기본 시간대에 맡기면 배포 환경이 UTC 인지 KST 인지에
 * 따라 <b>하루가 밀린다</b> — 그것도 자정 근처 요청에서만 밀리므로 재현되지 않는다.
 *
 * <p>시간대는 {@code app.business-timezone} 이며 배포 시 고정한다. 런타임 변경 대상이
 * 아니므로 {@code sys-config} 가 아니다(sys/INDEX.md).
 */
@Component
public class BusinessCalendar {

    private final ZoneId zone;
    private final Clock clock;

    public BusinessCalendar(@Value("${app.business-timezone}") String businessTimezone, Clock clock) {
        this.zone = ZoneId.of(businessTimezone);
        this.clock = clock;
    }

    /** 업무 시간대 기준의 오늘. */
    public LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), zone);
    }

    public Instant now() {
        return clock.instant();
    }

    public ZoneId zone() {
        return zone;
    }
}
