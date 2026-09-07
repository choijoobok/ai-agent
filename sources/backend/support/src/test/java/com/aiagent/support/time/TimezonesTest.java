package com.aiagent.support.time;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 시간대 후보와 판정 — screen/batch/schedule/requirements.md §4-1 · backend/time.md.
 *
 * <p><b>순서가 규약이다.</b> 오름차순이지만 <b>업무 시간대 하나만 맨 위</b>이며, 그 값이
 * 목록 안 제자리에도 다시 나온다 — 빼면 알파벳 순으로 찾는 사람이 그 자리에서 못 찾는다.
 */
class TimezonesTest {

    @Test
    @DisplayName("아는 시간대만 통과시킨다 — 있을 듯한 오타가 걸린다")
    void knowsOnlyRealZones() {
        assertThat(Timezones.isKnown("Asia/Seoul")).isTrue();
        assertThat(Timezones.isKnown("America/New_York")).isTrue();
        assertThat(Timezones.isKnown("UTC")).isTrue();

        // 있을 듯하지만 없다 — 자유 입력을 열면 이런 것이 들어온다(BS-43 · BS-44).
        assertThat(Timezones.isKnown("Korea/Seoul")).isFalse();
        assertThat(Timezones.isKnown("Asia/Sepul")).isFalse();
        assertThat(Timezones.isKnown("")).isFalse();
        assertThat(Timezones.isKnown(null)).isFalse();
        assertThat(Timezones.isKnown("  ")).isFalse();
    }

    @Test
    @DisplayName("오프셋 꼴은 받지 않는다 — 서머타임을 표현할 수 없어 이 화면의 목적을 깬다")
    void offsetLiteralsAreNotZones() {
        /*
          `ZoneId.of("+09:00")` 은 성공한다 — 하지만 그것은 <b>고정 오프셋</b>이라
          서머타임이 없다. 배치 시간대의 목적이 *현지 시각을 유지하는 것* 이므로
          고정 오프셋을 허용하면 그 목적을 조용히 깬 값이 저장된다.
        */
        assertThat(Timezones.isKnown("+09:00")).isFalse();
        assertThat(Timezones.isKnown("GMT+9")).isFalse();
    }

    @Test
    @DisplayName("업무 시간대가 맨 위이고, 목록 안 제자리에도 남는다")
    void businessZoneIsPinnedButNotRemoved() {
        List<String> candidates = Timezones.candidates(ZoneId.of("Asia/Seoul"));

        assertThat(candidates).isNotEmpty();
        assertThat(candidates.get(0)).isEqualTo("Asia/Seoul");
        // 맨 위의 것 하나를 빼고도 제자리에 있다 — 두 번 나오는 것이 의도다.
        assertThat(candidates.subList(1, candidates.size())).contains("Asia/Seoul");
    }

    @Test
    @DisplayName("맨 위 하나를 뺀 나머지는 오름차순이다")
    void restIsAscending() {
        List<String> rest = Timezones.candidates(ZoneId.of("America/New_York"));
        rest = rest.subList(1, rest.size());

        assertThat(rest).isSorted();
        assertThat(rest).containsAll(List.of("Africa/Abidjan", "Asia/Seoul", "UTC"));
    }

    @Test
    @DisplayName("후보에 고정 오프셋이 섞이지 않는다 — 판정과 목록이 같은 규칙을 쓴다")
    void candidatesAreAllAccepted() {
        List<String> candidates = Timezones.candidates(ZoneId.of("Asia/Seoul"));

        // 목록에서 고른 값이 저장 검증에 걸리면 사용자는 무엇을 골라야 할지 알 수 없다.
        assertThat(candidates).allMatch(Timezones::isKnown);
    }
}
