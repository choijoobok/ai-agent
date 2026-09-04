package com.aiagent.domain.batch;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.domain.batch.schedule.CronRules;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 크론을 읽는 규칙 — backend/persistence.md · screen/batch/schedule/requirements.md.
 *
 * <p><b>화면이 이것을 못 한다.</b> 크론 파서가 프론트 의존성에 없어(stack.md) 쿨다운과의
 * 관계는 서버만 판정할 수 있고, 그래서 frontend/grid.md 의 <i>서버 검증이 남는 자리</i> 다 —
 * 판정이 순수 함수라 여기서 값싸게 지킬 수 있다.
 */
class CronRulesTest {

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
        assertThat(CronRules.nextExecution("매일 두시", Instant.now())).isEmpty();
    }

    @Test
    @DisplayName("다음 실행이 크론을 눈으로 확인시킨다 — 평일 크론은 주말을 건너뛴다")
    void nextExecutionSkipsTheWeekend() {
        // 토요일 정오에서 물으면 다음은 **월요일 아침 9시**다 — 화면이 그것을 그린다(screen/batch/schedule/requirements.md).
        Instant saturdayNoon =
                ZonedDateTime.of(2026, 8, 29, 12, 0, 0, 0, ZoneId.systemDefault()).toInstant();

        Instant next = CronRules.nextExecution("0 0 9 * * MON-FRI", saturdayNoon).orElseThrow();
        ZonedDateTime at = next.atZone(ZoneId.systemDefault());

        assertThat(at.getDayOfWeek().getValue()).isEqualTo(1);
        assertThat(at.getHour()).isEqualTo(9);
    }
}
