package com.aiagent.domain.progress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * 만료 청소의 <b>두 하한</b> — retention.md · backend/crosscutting.md.
 *
 * <p>여기서 세는 것은 <b>어느 시각을 넘긴 것을 지우는가</b> 하나다. 지우는 문장 자체는
 * 조건부 DELETE 라 볼 것이 없고, <b>틀리면 조용한 쪽</b>이 이 계산이다: 하한을 잘못 잡으면
 * <i>지금 도는 작업의 행</i>을 지우고, 폴링은 그 순간부터 <b>없음</b>을 받는다 — 화면에는
 * 작업이 사라진 것으로 보인다.
 */
class ProgressSweeperTest {

    private static final Instant NOW = Instant.parse("2026-09-02T10:00:00Z");

    private final JdbcJobProgressStore store = mock(JdbcJobProgressStore.class);

    private JdbcProgressSweeper sweeper(Duration ttl, Duration ghostAfter) {
        return new JdbcProgressSweeper(store, Clock.fixed(NOW, ZoneOffset.UTC), ttl, ghostAfter);
    }

    /*
      <b>둘이 다른 하한이라야 한다.</b> 같은 값을 주면 RUNNING 행이 보관 기간만 넘겨도
      지워지는데, 진행률 쓰기는 조절되므로(1% 또는 1초 — backend/crosscutting.md) <b>멈춘 것처럼 보이는
      구간이 정상적으로 있다</b>.
    */
    @Test
    @DisplayName("끝난 행과 방치된 행의 하한이 갈린다 — 도는 작업을 지우지 않는다")
    void twoThresholds() {
        when(store.purge(any(), any())).thenReturn(0);

        sweeper(Duration.ofMinutes(30), Duration.ofHours(24)).sweep();

        ArgumentCaptor<Instant> ended = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> stale = ArgumentCaptor.forClass(Instant.class);
        verify(store).purge(ended.capture(), stale.capture());

        assertThat(ended.getValue()).isEqualTo(Instant.parse("2026-09-02T09:30:00Z"));
        assertThat(stale.getValue()).isEqualTo(Instant.parse("2026-09-01T10:00:00Z"));
    }

    @Test
    @DisplayName("지운 건수를 그대로 돌려준다 — 로그가 셀 수 있어야 한다")
    void reportsCount() {
        when(store.purge(any(), any())).thenReturn(7);

        assertThat(sweeper(Duration.ofMinutes(30), Duration.ofHours(24)).sweep()).isEqualTo(7);
    }
}
