package com.aiagent.domain.retention;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiagent.domain.auth.repository.SysLoginLogRepository;
import com.aiagent.domain.batch.BatchJobContext;
import com.aiagent.domain.batch.BatchJobResult;
import com.aiagent.domain.batch.repository.SysBatchHistoryRepository;
import com.aiagent.domain.log.repository.SysAccessLogRepository;
import com.aiagent.domain.log.repository.SysExceptionLogRepository;
import com.aiagent.domain.notification.repository.SysNotiInboxRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.RetentionProps;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 보존 파기 배치 — LOG-07 · retention.md. <b>템플릿의 첫 {@code BatchJob} 구현이다.</b>
 *
 * <p>여기서 지키는 것 셋이 retention.md 의 계약 그대로다: <b>표를 데이터로 읽는가</b>(대상 다섯,
 * 각자 다른 기간) · <b>분할 커밋인가</b>(청크가 덜 차면 끝) · <b>중단이 먹는가</b>(청크
 * 사이에서만 본다).
 *
 * <p>실제 SQL 은 여기서 검증되지 않는다 — 이 저장소에는 DB 를 띄우는 테스트가 없다.
 * 그래서 {@link RetentionPurger} 를 대역으로 두고 <b>배치가 그것을 어떻게 부르는가</b>만
 * 본다. 조건절과 인덱스는 기동해서 실제로 돌려 확인한다.
 */
class RetentionPurgeJobTest {

    private static final Instant NOW = Instant.parse("2026-08-31T03:30:00Z");
    private static final int CHUNK = 1000;

    private static final RetentionProps PROPS = new RetentionProps(90, 180, 365, 365, 90, CHUNK);

    private RetentionPurger purger;
    private RetentionPurgeJob job;

    /** 대상 이름 → 남은 행 수. 청크 크기로 나눠 돌려주는 대역이다. */
    private final Map<String, Integer> remaining = new HashMap<>();

    /** 부른 순서대로의 (대상, 기준시각) — 표를 제대로 읽었는지 본다. */
    private final List<String> calls = new ArrayList<>();

    @BeforeEach
    void setUp() {
        purger = mock(RetentionPurger.class);
        ConfigLookup configs = mock(ConfigLookup.class);
        when(configs.get(RetentionProps.class)).thenReturn(PROPS);

        job = new RetentionPurgeJob(
                purger,
                configs,
                Clock.fixed(NOW, ZoneOffset.UTC),
                mock(SysAccessLogRepository.class),
                mock(SysExceptionLogRepository.class),
                mock(SysLoginLogRepository.class),
                mock(SysBatchHistoryRepository.class),
                mock(SysNotiInboxRepository.class));

        when(purger.purgeChunk(any(), any(), anyInt())).thenAnswer(invocation -> {
            RetentionTarget target = invocation.getArgument(0);
            Instant cutoff = invocation.getArgument(1);
            calls.add(target.table() + "@" + cutoff);
            int left = remaining.getOrDefault(target.table(), 0);
            int deleted = Math.min(left, CHUNK);
            remaining.put(target.table(), left - deleted);
            return deleted;
        });
    }

    private static BatchJobContext context() {
        return new BatchJobContext("RETENTION_PURGE", null, 1L, () -> false);
    }

    private static BatchJobContext cancelAfter(int checks) {
        AtomicInteger seen = new AtomicInteger();
        return new BatchJobContext(
                "RETENTION_PURGE", null, 1L, () -> seen.incrementAndGet() > checks);
    }

    @Test
    @DisplayName("대상 다섯을 각자의 기간으로 훑는다 — 표가 데이터이고 본문에 테이블 이름이 없다")
    void readsThePolicyTable() {
        job.run(context());

        // retention.md 의 값 그대로다 — 90 · 365 · 180 · 365 · 90.
        assertThat(calls)
                .containsExactly(
                        "SYS_LO_ACCESS@" + NOW.minus(java.time.Duration.ofDays(90)),
                        "SYS_LO_LOGIN@" + NOW.minus(java.time.Duration.ofDays(365)),
                        "SYS_LO_EXCEPTION@" + NOW.minus(java.time.Duration.ofDays(180)),
                        "SYS_BATCH_HISTORY@" + NOW.minus(java.time.Duration.ofDays(365)),
                        "SYS_NOTI_INBOX@" + NOW.minus(java.time.Duration.ofDays(90)));
    }

    @Test
    @DisplayName("인앱 알림은 읽음 여부를 보지 않는다 — 기간 하나가 유일한 조건이다")
    void notificationsArePurgedByAgeAlone() {
        remaining.put("SYS_NOTI_INBOX", 1_500);

        BatchJobResult result = job.run(context());

        /*
          <b>대역은 READ_YN 을 모른다.</b> 배치가 리포지토리에 넘기는 것은 기준 시각
          하나뿐이며(RetentionTarget.findIds 의 시그니처가 그것을 강제한다), 읽음 여부를
          보려면 대상 표의 모양 자체가 달라져야 한다 — sys/notification.md 이 닫은 결정이 여기서
          <b>구조로</b> 지켜진다. 읽은 것만 지우면 안 읽은 알림이 영원히 쌓이고,
          그것이 정확히 지우고 싶은 행이다.
        */
        assertThat(calls)
                .contains("SYS_NOTI_INBOX@" + NOW.minus(java.time.Duration.ofDays(90)));
        assertThat(result.summary()).contains("인앱 알림 1500건");
    }

    @Test
    @DisplayName("개인정보 접근 이력은 대상에 없다 — retention.md 의 구조적 제외")
    void personalDataAccessHistoryIsStructurallyExcluded() {
        job.run(context());

        /*
          <b>설정으로도 켤 수 없다.</b> 목록에 행 자체가 없으므로, 켜려면 소스를 고치고
          배포해야 한다 — retention.md 가 <i>"설정으로 켤 수 있게도 하지 않는다"</i> 로 못박은
          것이 이 상태다. 방향이 반대인 대상을 같은 배치에 넣으면 <b>규제 위반을 자동화</b>한다.
        */
        assertThat(calls).noneMatch(call -> call.contains("PII"));
    }

    @Test
    @DisplayName("청크가 덜 차면 그 대상은 끝이다 — 90일분을 한 트랜잭션으로 지우지 않는다")
    void deletesInChunksUntilTheChunkIsNotFull() {
        remaining.put("SYS_LO_ACCESS", 2_300);

        BatchJobResult result = job.run(context());

        // 1000 · 1000 · 300 세 번이고 네 번째는 없다 — 300 에서 끝을 알았다.
        assertThat(calls.stream().filter(call -> call.startsWith("SYS_LO_ACCESS")).count())
                .isEqualTo(3);
        assertThat(result.summary()).contains("사용 이력 2300건").contains("모두 2300건");
        assertThat(result.canceled()).isFalse();
    }

    @Test
    @DisplayName("정확히 나누어떨어지면 한 번 더 묻는다 — 덜 찬 청크를 봐야 끝을 안다")
    void anExactMultipleNeedsOneMoreProbe() {
        remaining.put("SYS_LO_EXCEPTION", 2_000);

        job.run(context());

        // 1000 · 1000 · 0 — 마지막 0 이 없으면 <i>아직 남았는지</i> 를 알 방법이 없다.
        assertThat(calls.stream().filter(call -> call.startsWith("SYS_LO_EXCEPTION")).count())
                .isEqualTo(3);
    }

    @Test
    @DisplayName("중단이 청크 사이에서 먹는다 — 거기까지는 커밋돼 있다")
    void cancelStopsBetweenChunks() {
        remaining.put("SYS_LO_ACCESS", 10_000);

        BatchJobResult result = job.run(cancelAfter(2));

        assertThat(result.canceled()).isTrue();
        // 두 청크만 지웠다 — 나머지 대상은 손도 대지 않았다.
        assertThat(calls).hasSize(2);
        assertThat(result.summary()).startsWith("중단 요청으로 멈췄다");
        assertThat(result.detail()).contains("중단 요청으로 여기서 멈췄다");
    }

    @Test
    @DisplayName("중단해도 지운 만큼은 요약에 남는다 — 다음 실행이 이어서 한다")
    void aCanceledRunStillReportsWhatItRemoved() {
        remaining.put("SYS_LO_ACCESS", 10_000);

        BatchJobResult result = job.run(cancelAfter(3));

        assertThat(result.summary()).contains("사용 이력 3000건");
    }

    @Test
    @DisplayName("지울 것이 없어도 상세에 기준을 적는다 — 0건의 이유를 그 자리에서 판단한다")
    void anEmptyRunStillReportsItsCutoff() {
        BatchJobResult result = job.run(context());

        assertThat(result.summary()).contains("모두 0건");
        // 건수만 있으면 *지울 것이 없었다* 와 *기간을 잘못 잡았다* 가 같은 화면이 된다.
        assertThat(result.detail())
                .contains("90일 보존")
                .contains("365일 보존")
                .contains("SYS_BATCH_HISTORY");
    }

    @Test
    @DisplayName("설정을 실행 시작에 한 번만 읽는다 — 청크 사이에 기준이 바뀌면 안 된다")
    void configIsReadOncePerRun() {
        remaining.put("SYS_LO_ACCESS", 5_000);

        job.run(context());

        /*
          같은 대상의 기준 시각이 청크마다 같아야 한다. 루프 안에서 설정을 다시 읽으면
          화면에서 기간을 바꾼 순간 <b>앞 청크와 뒤 청크가 서로 다른 기준</b>으로 지운다.
        */
        assertThat(calls.stream().filter(call -> call.startsWith("SYS_LO_ACCESS")).distinct())
                .hasSize(1);
    }
}
