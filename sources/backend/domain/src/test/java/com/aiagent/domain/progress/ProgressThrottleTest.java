package com.aiagent.domain.progress;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 진행률을 <b>언제 쓰는가</b> — backend/crosscutting.md.
 *
 * <p>이 파일이 지키는 것은 한 문장이다: <b>진행률을 보여 주려고 작업을 느리게 만들지
 * 않는다.</b> 건별로 쓰면 10만 건 처리에 {@code UPDATE} 가 10만 번이고, 그 값은 사용자가
 * <b>1초 주기로 폴링해서 보는 것</b>이라 그 정밀도가 화면에 닿지도 않는다.
 *
 * <p>반대쪽 실패도 함께 잰다 — <b>전체를 모르는 작업</b>이다. 퍼센트 조건만 보면 그런
 * 작업은 영영 안 써서 화면이 <i>0건</i>에 굳고, 불확정 막대만 도는 창은 <b>멈춘 것</b>과
 * 구별되지 않는다.
 */
class ProgressThrottleTest {

    private static final Instant START = Instant.parse("2026-09-02T00:00:00Z");

    /** 진행률이 쓰인 건수들 — 몇 번 썼는지와 무엇을 썼는지를 함께 본다. */
    private final List<Long> writes = new ArrayList<>();

    /** 소제목이 쓰인 순서 — 구간의 경계가 <b>몇 번</b> 왔는지가 그 자체로 사실이다. */
    private final List<String> subTitles = new ArrayList<>();

    /** {@code reset} 이 앉힌 전체들 — {@code null} 이면 다시 불확정이다. */
    private final List<Long> totals = new ArrayList<>();

    private final JobProgressStore store = new JobProgressStore() {
        @Override
        public void start(String jobId, String userId, Long totCnt) {}

        @Override
        public void progress(String jobId, long curCnt, String stepMsg, String subTitle) {
            writes.add(curCnt);
            if (subTitle != null) {
                subTitles.add(subTitle);
            }
        }

        @Override
        public void reset(String jobId, String subTitle, Long totCnt) {
            writes.add(0L);
            subTitles.add(subTitle);
            totals.add(totCnt);
        }

        @Override
        public void complete(String jobId) {}

        @Override
        public void fail(String jobId, String errMsg) {}

        @Override
        public Optional<JobProgressView> find(String jobId, String userId) {
            return Optional.empty();
        }
    };

    /** 부를 때마다 흐르는 시계 — 걸음마다 얼마나 지났는지를 시험이 정한다. */
    private static final class Ticker extends Clock {
        private Instant now = START;
        private final Duration step;

        Ticker(Duration step) {
            this.step = step;
        }

        @Override
        public Instant instant() {
            Instant answer = now;
            now = now.plus(step);
            return answer;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }

    @Test
    @DisplayName("10만 건을 건별로 쓰지 않는다 — 이 조절이 없으면 UPDATE 가 10만 번이다")
    void doesNotWritePerItem() {
        // 시간은 넉넉히 흐르게 두고 <b>퍼센트</b>만 조건이 되게 한다.
        Progress progress = new Progress(store, new Ticker(Duration.ofSeconds(1)), "j1", 100_000L);

        for (int index = 0; index < 100_000; index++) {
            progress.step();
        }

        // 1% 마다 한 번 — 100회 언저리다. 어떤 경우에도 건수만큼은 아니다.
        assertThat(writes).hasSizeLessThanOrEqualTo(101);
        assertThat(writes).isNotEmpty();
    }

    @Test
    @DisplayName("1초가 안 지났으면 퍼센트가 올라도 쓰지 않는다 — 둘 중 늦은 쪽이다")
    void waitsForTheSlowerOfTheTwo() {
        // 시간이 멈춘 것과 같다 — 퍼센트는 매 걸음 오르지만 시간 조건이 안 찬다.
        Progress progress = new Progress(store, new Ticker(Duration.ZERO), "j1", 10L);

        for (int index = 0; index < 10; index++) {
            progress.step();
        }

        assertThat(writes).isEmpty();
    }

    /*
      <b>퍼센트만 보면 여기서 굳는다.</b> 전체를 모르는 작업(sys/batch.md — {@code TOT_CNT} 가
      {@code NULL})은 퍼센트를 계산할 수 없고, 그때 화면에 남는 것은 도는 막대와
      <b>0건</b>이다 — 사용자는 그것을 <i>멈췄다</i> 로 읽는다.
    */
    @Test
    @DisplayName("전체를 모르는 작업은 시간만 본다 — 건수라도 올라가야 한다")
    void unknownTotalStillWrites() {
        Progress progress = new Progress(store, new Ticker(Duration.ofSeconds(1)), "j1", null);

        for (int index = 0; index < 5; index++) {
            progress.step();
        }

        assertThat(writes).isNotEmpty();
    }

    /*
      <b>단계가 바뀐 것은 사용자가 기다리던 신호다.</b> 조절에 걸려 늦으면 화면은 앞
      단계의 문구를 들고 있고, 그 사이 퍼센트도 안 움직이면 <i>멈춘 것</i>으로 읽힌다.
    */
    @Test
    @DisplayName("문구가 오면 조절을 건너뛴다 — 단계가 바뀐 것은 기다리던 신호다")
    void stepMessageWritesImmediately() {
        Progress progress = new Progress(store, new Ticker(Duration.ZERO), "j1", 1000L);

        progress.step("집계하는 중");

        assertThat(writes).containsExactly(1L);
    }

    /*
      <b>구간의 경계는 조절의 대상이 아니다.</b> 늦으면 그 사이의 폴링이 <i>새 구간의 건수
      대 앞 구간의 전체</i> 를 보고, 그 값은 100% 를 넘거나(앞이 컸다) 이미 끝난 것처럼
      보인다(앞이 작았다) — 둘 다 <b>없는 사실</b>이다.
    */
    @Test
    @DisplayName("구간이 바뀌면 즉시 쓴다 — 시간이 멈춰 있어도 소제목과 전체가 함께 간다")
    void resetWritesImmediately() {
        // 시간이 흐르지 않는다 — 조절만 보면 아무것도 쓰이지 않는 시계다.
        Progress progress = new Progress(store, new Ticker(Duration.ZERO), "j1", 10L);

        progress.reset("주문 A-1023 (1/50)", 3_000L);
        progress.reset("주문 A-1024 (2/50)", 1_200L);

        assertThat(subTitles).containsExactly("주문 A-1023 (1/50)", "주문 A-1024 (2/50)");
        assertThat(totals).containsExactly(3_000L, 1_200L);
    }

    /*
      <b>이 검사가 없으면 막대가 100% 를 넘는다.</b> 손잡이가 자기 {@code curCnt} 를 0 으로
      돌리지 않으면 다음 구간의 첫 걸음이 앞 구간의 건수에서 이어지고, 새 전체는 더 작을
      수 있다 — 화면은 <i>3,050 / 1,200</i> 을 그린다.
    */
    @Test
    @DisplayName("구간이 바뀌면 건수가 0 부터다 — 앞 구간의 건수를 물고 가지 않는다")
    void resetRestartsTheCount() {
        Progress progress = new Progress(store, new Ticker(Duration.ofSeconds(1)), "j1", 100L);
        for (int index = 0; index < 50; index++) {
            progress.step();
        }
        writes.clear();

        progress.reset("다음 구간", 100L);
        progress.step("첫 걸음");

        // reset 의 0 과 그 뒤 첫 걸음의 1 — 50 에서 이어지지 않는다.
        assertThat(writes).containsExactly(0L, 1L);
    }

    /*
      <b>전체를 나중에 알게 되는 작업이 있다.</b> 조회해 보고서야 대상 수를 아는 실행이
      그렇고(샘플의 일괄 재계산), 그때까지 화면은 불확정 막대다 — 알게 된 순간 앉히면
      그 뒤로는 퍼센트가 나온다. 그러지 않으면 <b>끝까지 도는 막대</b>뿐이다.
    */
    @Test
    @DisplayName("전체를 나중에 앉힐 수 있다 — 그 뒤로는 퍼센트 조절이 돈다")
    void resetCanInstallATotalLearnedLater() {
        // 전체를 모르고 시작한다 — 여기서는 시간만 조건이다.
        Progress progress = new Progress(store, new Ticker(Duration.ZERO), "j1", null);

        progress.reset(null, 200L);
        writes.clear();
        // 1% 는 2건이다. 시간이 멈춰 있으므로 <b>둘 중 늦은 쪽</b>에 걸려 하나도 안 쓴다.
        for (int index = 0; index < 4; index++) {
            progress.step();
        }

        assertThat(totals).containsExactly(200L);
        assertThat(writes).isEmpty();
    }

    /*
      <b>소제목만 바꾸는 자리</b> — 걸음을 행마다 밟는 작업이다(총계가 행 수). 그때 소제목은
      지금 어느 행인지만 말하며, 건수를 함께 밀어 넣지 않으면 <i>새 이름 + 낡은 건수</i> 가
      최대 1초 동안 화면에 있는다.
    */
    @Test
    @DisplayName("소제목만 바꿔도 즉시 쓴다 — 건수를 함께 밀어 넣는다")
    void subTitleWritesImmediatelyWithTheCount() {
        Progress progress = new Progress(store, new Ticker(Duration.ZERO), "j1", 50L);
        progress.step();
        progress.step();
        writes.clear();

        progress.subTitle("주문 A-1023");

        assertThat(subTitles).containsExactly("주문 A-1023");
        // 0 이 아니라 2 다 — 건수는 그대로 가고 되돌아가지 않는다.
        assertThat(writes).containsExactly(2L);
    }
}
