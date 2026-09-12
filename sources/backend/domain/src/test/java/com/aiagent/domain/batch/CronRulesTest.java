package com.aiagent.domain.batch;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.domain.batch.schedule.CronRules;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 크론을 읽는 규칙 — backend/persistence.md · screen/admin/system/batch/schedule/requirements.md.
 *
 * <p><b>화면이 이것을 못 한다.</b> 크론 파서가 프론트 의존성에 없어(stack.md) 쿨다운과의
 * 관계는 서버만 판정할 수 있고, 그래서 frontend/grid.md 의 <i>서버 검증이 남는 자리</i> 다 —
 * 판정이 순수 함수라 여기서 값싸게 지킬 수 있다.
 */
class CronRulesTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final ZoneId NEW_YORK = ZoneId.of("America/New_York");

    @Test
    @DisplayName("스프링이 읽는 것만 통과시킨다 — 다른 파서를 쓰면 통과했는데 안 도는 크론이 생긴다")
    void acceptsWhatTheSchedulerAccepts() {
        assertThat(CronRules.isValid("0 0 2 * * *")).isTrue();
        assertThat(CronRules.isValid("0 */5 * * * *")).isTrue();
        assertThat(CronRules.isValid("0 0 9 * * MON-FRI")).isTrue();

        assertThat(CronRules.isValid("매일 두시")).isFalse();
        // 5칸 크론(리눅스 crontab)은 스프링이 읽지 않는다 — 초 자리가 있어야 한다.
        assertThat(CronRules.isValid("0 2 * * *")).isFalse();
        assertThat(CronRules.isValid(null)).isFalse();
        assertThat(CronRules.isValid("  ")).isFalse();
    }

    @Test
    @DisplayName("인접 간격의 최솟값을 잰다 — 쿨다운이 이 값과 비교된다")
    void measuresTheShortestGap() {
        assertThat(CronRules.minIntervalSeconds("0 */5 * * * *")).contains(300L);
        assertThat(CronRules.minIntervalSeconds("0 0 * * * *")).contains(3600L);
        assertThat(CronRules.minIntervalSeconds("0 0 2 * * *")).contains(86_400L);
    }

    @Test
    @DisplayName("주말 건너뜀이 표본에 들어온다 — 그래서 기준시각이 월요일이고 표본이 열이다")
    void weekendGapDoesNotShortenTheMinimum() {
        /*
          평일 9시 크론의 인접 간격은 하루(86400)와 사흘(259200)이 섞인다. **최솟값은
          하루**이며, 표본이 한 주를 못 넘기면 사흘 간격을 못 보는 것이 아니라 — 그것은
          최솟값에 영향이 없다 — 오히려 <b>기준시각이 주 중간이면 첫 간격이 짧게 잡힌다</b>.
          그래서 첫 간격을 버리고(기준시각과의 거리는 주기가 아니다) 월요일에서 시작한다.
        */
        assertThat(CronRules.minIntervalSeconds("0 0 9 * * MON-FRI")).contains(86_400L);
    }

    @Test
    @DisplayName("못 읽는 크론은 비어 있다 — 부르는 쪽이 검증을 건너뛴다")
    void unreadableCronHasNoInterval() {
        // 모르는 것과 짧은 것은 다르다. 모르는 것을 짧다고 읽으면 정상 크론이 저장되지 않는다.
        assertThat(CronRules.minIntervalSeconds("매일 두시")).isEmpty();
        assertThat(CronRules.nextExecution("매일 두시", Instant.now(), SEOUL)).isEmpty();
    }

    @Test
    @DisplayName("다음 실행이 크론을 눈으로 확인시킨다 — 평일 크론은 주말을 건너뛴다")
    void nextExecutionSkipsTheWeekend() {
        // 토요일 정오에서 물으면 다음은 **월요일 아침 9시**다 — 화면이 그것을 그린다(screen/admin/system/batch/schedule/requirements.md).
        Instant saturdayNoon = ZonedDateTime.of(2026, 8, 29, 12, 0, 0, 0, SEOUL).toInstant();

        Instant next = CronRules.nextExecution("0 0 9 * * MON-FRI", saturdayNoon, SEOUL).orElseThrow();
        ZonedDateTime at = next.atZone(SEOUL);

        assertThat(at.getDayOfWeek().getValue()).isEqualTo(1);
        assertThat(at.getHour()).isEqualTo(9);
    }

    // ── 시간대 (screen/admin/system/batch/schedule/requirements.md §4-1 · BS-38~40 · BS-46) ──

    @Test
    @DisplayName("같은 식이 시간대마다 다른 순간을 낸다 — 현지 시각은 둘 다 06:00 이다")
    void sameExpressionDiffersByZone() {
        Instant from = ZonedDateTime.of(2026, 9, 7, 12, 0, 0, 0, SEOUL).toInstant();

        Instant seoul = CronRules.nextExecution("0 0 6 * * *", from, SEOUL).orElseThrow();
        Instant newYork = CronRules.nextExecution("0 0 6 * * *", from, NEW_YORK).orElseThrow();

        assertThat(seoul.atZone(SEOUL).getHour()).isEqualTo(6);
        assertThat(newYork.atZone(NEW_YORK).getHour()).isEqualTo(6);
        // **실제 순간이 다르다** — 이것이 이 컬럼이 있는 이유다(BS-39).
        assertThat(seoul).isNotEqualTo(newYork);
    }

    @Test
    @DisplayName("서머타임 경계에서 현지 시각이 유지된다 — 오프셋만 옮겨 간다")
    void localTimeSurvivesDaylightSaving() {
        /*
          미국 동부는 2026-11-01 에 서머타임이 끝난다. **저장할 때 시차를 굳혀 넣는 방식이면
          여기서 한 시간 틀어진다** — 그래서 식을 변환하지 않고 시간대를 함께 넘긴다.
        */
        // **10/30 에서 시작해야 경계를 걸친다** — 10/31 정오에서 물으면 첫 실행이 이미
        // 전환 뒤(11/1)라 둘 다 표준시가 되어 24시간이 나오고, 검사가 아무것도 잠그지 않는다.
        Instant beforeSwitch = ZonedDateTime.of(2026, 10, 30, 12, 0, 0, 0, NEW_YORK).toInstant();

        Instant first = CronRules.nextExecution("0 0 6 * * *", beforeSwitch, NEW_YORK).orElseThrow();
        Instant second = CronRules.nextExecution("0 0 6 * * *", first, NEW_YORK).orElseThrow();

        assertThat(first.atZone(NEW_YORK).getHour()).isEqualTo(6);
        assertThat(second.atZone(NEW_YORK).getHour()).isEqualTo(6);
        // 현지 06:00 을 지키느라 **UTC 로는 25시간**이 지난다.
        assertThat(second.getEpochSecond() - first.getEpochSecond()).isEqualTo(25 * 3600L);
    }

    @Test
    @DisplayName("일 자리를 쓴 식은 매일이 아니다 — 여섯 칸의 셋째가 시(時)다")
    void dayOfMonthIsNotHour() {
        Instant from = ZonedDateTime.of(2026, 9, 7, 12, 0, 0, 0, SEOUL).toInstant();

        // `0 0 0 6 * *` 는 **매월 6일 자정**이다 — 매일 06시는 `0 0 6 * * *` 다.
        Instant monthly = CronRules.nextExecution("0 0 0 6 * *", from, SEOUL).orElseThrow();
        assertThat(monthly.atZone(SEOUL).getDayOfMonth()).isEqualTo(6);
        assertThat(monthly.atZone(SEOUL).getHour()).isZero();

        Instant daily = CronRules.nextExecution("0 0 6 * * *", from, SEOUL).orElseThrow();
        assertThat(daily.atZone(SEOUL).getHour()).isEqualTo(6);
    }
}
