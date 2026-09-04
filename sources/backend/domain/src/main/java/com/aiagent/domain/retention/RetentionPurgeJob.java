package com.aiagent.domain.retention;

import com.aiagent.domain.auth.repository.SysLoginLogRepository;
import com.aiagent.domain.batch.BatchJob;
import com.aiagent.domain.batch.BatchJobContext;
import com.aiagent.domain.batch.BatchJobResult;
import com.aiagent.domain.batch.repository.SysBatchHistoryRepository;
import com.aiagent.domain.log.repository.SysAccessLogRepository;
import com.aiagent.domain.log.repository.SysExceptionLogRepository;
import com.aiagent.domain.notification.repository.SysNotiInboxRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.RetentionProps;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 보존 기간이 지난 이력을 지운다 — <b>LOG-07</b> · retention.md.
 *
 * <h2>템플릿의 첫 {@code BatchJob} 구현이다</h2>
 *
 * <p>screen/batch/schedule/requirements.md 은 <i>"템플릿에는 구현이 하나도 없다 — 지어내면 아무도 안 쓰는 배치가 시드에
 * 남는다"</i> 고 적었다. 그 문장은 <b>업무 배치</b>에 대한 것이고 여기는 다르다: 파기는
 * 32 가 <b>이미 정책으로 정해 둔</b> 시스템 기능이며, 만들지 않으면 이력 테이블이 무한히
 * 자란다 — 지어낸 배치가 아니라 <b>빠져 있던 배치</b>다.
 *
 * <p>부수 효과가 크다. 러너·스케줄러·락·하트비트·협조적 중단이 <b>처음으로 실제로
 * 실행되는 코드</b>가 된다 — 그 전까지는 구현이 없어 어느 경로도 돌아 본 적이 없었다.
 *
 * <h2>{@code USE_YN='N'} 으로 시드된다</h2>
 *
 * <p><b>기본으로 켜면 안 된다.</b> 켜져 있으면 템플릿을 받아 첫 기동한 날 밤에
 * <b>지우기부터 시작한다</b> — 그 프로젝트가 보존 기간을 아직 정하지도 않았는데.
 * retention.md 이 요구한 <i>아카이브 후 삭제</i> 를 이 구현이 하지 않는 것도 같은 자리에서
 * 다뤄진다: 켜는 사람이 <b>아카이브 형식과 함께</b> 정한다(retention.md 의 미결).
 *
 * <h2>대상은 표이고 배치는 표를 읽는다</h2>
 *
 * <p>retention.md. 아래 {@code targets()} 가 그 표이며 본문에는 테이블 이름도 기간도 없다.
 * <b>하한 대상은 목록에 없다</b> — retention.md 의 구조적 제외다.
 *
 * <h2>중단은 청크 사이에서만 본다</h2>
 *
 * <p>sys/batch.md 의 협조적 중단. 청크 <b>안에서</b> 보면 지우던 트랜잭션을 롤백해야 하고,
 * 그러면 <i>중단했는데 아무것도 안 지워진</i> 상태가 된다. 청크 사이에서 보면
 * <b>거기까지는 커밋돼 있다</b> — 다음 실행이 이어서 한다.
 */
@Component
public class RetentionPurgeJob implements BatchJob {

    private static final Logger log = LoggerFactory.getLogger(RetentionPurgeJob.class);

    private final RetentionPurger purger;
    private final ConfigLookup configs;
    private final Clock clock;

    private final SysAccessLogRepository accessLogs;
    private final SysExceptionLogRepository exceptionLogs;
    private final SysLoginLogRepository loginLogs;
    private final SysBatchHistoryRepository batchHistories;
    private final SysNotiInboxRepository notiInboxes;

    public RetentionPurgeJob(
            RetentionPurger purger,
            ConfigLookup configs,
            Clock clock,
            SysAccessLogRepository accessLogs,
            SysExceptionLogRepository exceptionLogs,
            SysLoginLogRepository loginLogs,
            SysBatchHistoryRepository batchHistories,
            SysNotiInboxRepository notiInboxes) {
        this.purger = purger;
        this.configs = configs;
        this.clock = clock;
        this.accessLogs = accessLogs;
        this.exceptionLogs = exceptionLogs;
        this.loginLogs = loginLogs;
        this.batchHistories = batchHistories;
        this.notiInboxes = notiInboxes;
    }

    @Override
    public BatchJobResult run(BatchJobContext context) {
        /*
          한 실행 동안 값이 고정된다 — BatchRunner 가 연 스냅샷에서 읽는다(sys/config.md).
          루프 안에서 매번 읽으면 청크 백 번을 도는 사이에 화면에서 기간을 바꿨을 때
          **앞 청크와 뒤 청크가 서로 다른 기준으로** 지운다.
        */
        RetentionProps props = configs.get(RetentionProps.class);
        Instant now = clock.instant();

        List<String> summary = new ArrayList<>();
        List<String> detail = new ArrayList<>();
        long total = 0;
        boolean canceled = false;

        for (RetentionTarget target : targets()) {
            int days = target.days().apply(props);
            Instant cutoff = now.minus(Duration.ofDays(days));
            Removed removed = purge(target, cutoff, props.chunkSize(), context);

            total += removed.rows();
            summary.add(target.label() + " " + removed.rows() + "건");
            detail.add(line(target, days, cutoff, removed));

            if (removed.canceled()) {
                canceled = true;
                break;
            }
        }

        String headline = String.join(" · ", summary) + " — 모두 " + total + "건";
        if (canceled) {
            /*
              **어디까지 했는지가 문구의 내용이다.** 남은 대상은 손도 대지 않았고, 다음
              실행이 처음부터 다시 훑는다 — 이미 지운 것은 조건에 걸리지 않으므로 그
              "다시" 는 값싸다.
            */
            return BatchJobResult.canceled(
                    "중단 요청으로 멈췄다 — " + headline, String.join("\n", detail));
        }
        return BatchJobResult.of(headline, String.join("\n", detail));
    }

    // ── 안 ──────────────────────────────────────────────────────────

    /**
     * retention.md 정책 표 — <b>상한 대상 다섯</b>.
     *
     * <p>메서드인 것은 리포지토리를 생성자에서 받기 때문이다. 상수로 두려면 정적 참조가
     * 필요하고, 그러면 테스트가 대상을 갈아 끼우지 못한다.
     *
     * <p><b>다섯째가 이력이 아니다</b>(2026-08-31). 앞의 넷은 <i>무슨 일이 있었나</i> 를
     * 적은 것이라 아무도 안 봐도 값이 있지만, 인앱 알림은 <b>받는 사람이 있는 것</b>이며
     * 안 읽힌 채 지워질 수 있다. 그럼에도 기간으로 지운다 — sys/notification.md 이 닫은 결정이고,
     * <b>읽은 것만 지우면 안 읽은 알림이 영원히 쌓인다</b>: 그것이 정확히 지우고 싶은
     * 행이다(아무도 안 보는 알림). retention.md 이 요구한 <i>표를 데이터로 읽는다</i> 는 그대로라
     * 여기 한 줄이 늘 뿐 본문은 손대지 않았다.
     */
    private List<RetentionTarget> targets() {
        return List.of(
                new RetentionTarget(
                        "사용 이력",
                        "SYS_LO_ACCESS",
                        RetentionProps::accessLogDays,
                        accessLogs::findIdsCreatedBefore,
                        accessLogs::deleteAllByIdInBatch),
                new RetentionTarget(
                        "로그인 이력",
                        "SYS_LO_LOGIN",
                        RetentionProps::loginLogDays,
                        loginLogs::findIdsCreatedBefore,
                        loginLogs::deleteAllByIdInBatch),
                new RetentionTarget(
                        "에러 로그",
                        "SYS_LO_EXCEPTION",
                        RetentionProps::exceptionLogDays,
                        exceptionLogs::findIdsCreatedBefore,
                        exceptionLogs::deleteAllByIdInBatch),
                new RetentionTarget(
                        "배치 실행 이력",
                        "SYS_BATCH_HISTORY",
                        RetentionProps::batchHistoryDays,
                        batchHistories::findIdsStartedBefore,
                        batchHistories::deleteAllByIdInBatch),
                new RetentionTarget(
                        "인앱 알림",
                        "SYS_NOTI_INBOX",
                        RetentionProps::notiInboxDays,
                        notiInboxes::findIdsCreatedBefore,
                        notiInboxes::deleteAllByIdInBatch));
    }

    /**
     * 한 대상을 <b>끝까지</b> — 청크가 덜 차면 그것이 끝이다.
     *
     * <p><b>중단을 청크 <i>앞</i>에서 본다.</b> 뒤에서 보면 마지막 청크를 지우고 나서
     * 멈추는데, 그 청크는 이미 커밋됐으므로 <i>멈추라고 했는데 한 번 더 했다</i> 가 된다.
     */
    private Removed purge(
            RetentionTarget target, Instant cutoff, int chunkSize, BatchJobContext context) {
        long rows = 0;
        int chunks = 0;
        while (true) {
            if (context.isCancelRequested()) {
                return new Removed(rows, chunks, true);
            }
            int deleted = purger.purgeChunk(target, cutoff, chunkSize);
            rows += deleted;
            if (deleted > 0) {
                chunks++;
            }
            if (deleted < chunkSize) {
                return new Removed(rows, chunks, false);
            }
            log.debug("{} 파기 중 — 누적 {}건", target.table(), rows);
        }
    }

    /**
     * 상세 한 줄 — <b>기준을 함께 적는다</b>.
     *
     * <p>건수만 적으면 <i>0건</i> 이 <i>지울 것이 없었다</i> 인지 <i>기간을 잘못 잡았다</i>
     * 인지 알 수 없다. 기준 시각이 있으면 그 자리에서 판단된다.
     */
    private static String line(
            RetentionTarget target, int days, Instant cutoff, Removed removed) {
        return "%s (%s) — %d일 보존, %s 이전 %d건 삭제%s"
                .formatted(
                        target.label(),
                        target.table(),
                        days,
                        cutoff,
                        removed.rows(),
                        removed.canceled() ? " [중단 요청으로 여기서 멈췄다]" : "");
    }

    private record Removed(long rows, int chunks, boolean canceled) {}
}
