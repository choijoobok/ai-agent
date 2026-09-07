package com.aiagent.domain.batch.schedule;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Optional;
import org.springframework.scheduling.support.CronExpression;

/**
 * 크론을 <b>읽는 규칙</b> — backend/persistence.md · screen/batch/schedule/requirements.md.
 *
 * <p>화면이 이것을 못 하는 것이 이 클래스가 서버에 있는 이유다. screen/batch/schedule/requirements.md 가
 * <i>"크론 파서가 필요하고, 그것은 stack.md 의 프론트 의존성에 없다"</i> 고 적었고,
 * frontend/grid.md 의 <b>서버 검증이 남는 자리</b>가 정확히 여기다.
 *
 * <p><b>파서를 새로 들이지 않는다.</b> {@link CronExpression} 은 스프링이 이미 갖고 있고
 * ({@code spring-context}) 스케줄러가 실제로 쓰는 파서다 — 다른 파서로 검증하면
 * <b>통과했는데 안 도는</b> 크론이 생긴다.
 *
 * <h2>최소 간격을 <b>표본</b>으로 잰다</h2>
 *
 * <p>backend/persistence.md 이 정의를 그렇게 두었다 — <i>"고정 기준시각에서 다음 실행 N개를 뽑아 인접
 * 간격의 최솟값"</i>. 크론의 최소 주기를 해석적으로 구하는 것은 필드 조합이 얽혀 정확히
 * 어렵고, 표본은 <b>틀려도 안전한 쪽으로 틀린다</b>: 표본에서 못 본 짧은 간격이 뒤에
 * 있으면 검증이 <i>통과</i> 시킬 뿐이며, 없는 간격을 지어내지는 않는다.
 *
 * <p><b>기준시각이 고정인 것이 중요하다.</b> {@code now()} 로 재면 같은 크론이 저장하는
 * 시각에 따라 다른 값을 내고, 그러면 <i>어제는 저장되던 것이 오늘은 거부</i>된다.
 */
public final class CronRules {

    /**
     * 표본 개수 — backend/persistence.md 의 <i>N</i>.
     *
     * <p>{@code 0 0 9 * * MON-FRI} 같은 주간 패턴에서 <b>주말 건너뜀</b>이 보이려면 한 주를
     * 넘겨야 하고, 열 개면 평일 크론이 두 번의 주말을 지난다.
     */
    private static final int SAMPLE = 10;

    /**
     * 고정 기준시각 — <b>월요일 자정</b>이다.
     *
     * <p>요일 패턴이 주 초에서 시작해야 한 주가 온전히 표본에 들어온다. 임의의 과거
     * 시각을 쓰면 같은 크론이 <i>수요일 기준</i>일 때와 다른 최솟값을 낼 수 있다.
     *
     * <p><b>시간대는 UTC 다</b> — backend/time.md §2. 재는 것이 <i>인접 실행의 간격</i> 이라
     * 기준점의 시간대는 결과에 들어오지 않지만, {@code systemDefault()} 를 두면 상수가
     * <b>배포 환경에 따라 달라지고</b> 서머타임이 있는 지역에서는 간격 최솟값까지 흔들린다.
     */
    private static final ZonedDateTime EPOCH_MONDAY =
            ZonedDateTime.of(2024, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC);

    /** 표현식이 문법에 맞는가 — 틀리면 {@link CronExpression} 이 던진다. */
    public static boolean isValid(String cron) {
        return parse(cron).isPresent();
    }

    /**
     * 다음 실행 시각 — 파생 컬럼 <b>다음 실행</b>이 이 값이다(screen/batch/schedule/requirements.md).
     *
     * <p>그 컬럼이 <i>크론을 눈으로 확인시킨다</i> — {@code 0 0 9 * * MON-FRI} 를 넣고
     * 다음 실행이 월요일이면 맞게 쓴 것이다. <b>API 를 늘리지 않고</b> 목록 조회가 계산해
     * 내려준다.
     *
     * <p><b>{@code USE_YN='N'} 이면 부르는 쪽이 비운다.</b> 여기서 판단하지 않는 것은 이
     * 클래스가 크론만 알기 때문이며, 꺼 둔 배치에 다음 실행을 그리면 <i>돌 것처럼</i>
     * 보인다(screen/batch/schedule/requirements.md — 스케줄러가 등록조차 하지 않는다).
     */
    public static Optional<Instant> nextExecution(String cron, Instant from) {
        return parse(cron)
                .map(expression -> expression.next(from.atZone(ZoneId.systemDefault())))
                .map(next -> next == null ? null : next.toInstant());
    }

    /**
     * 인접 실행 간격의 <b>최솟값(초)</b> — 쿨다운과 비교되는 값이다(backend/persistence.md · screen/batch/schedule/requirements.md).
     *
     * <p>표본을 다 못 뽑으면(연 1회 크론이 상한에 걸린다) 뽑은 것까지로 잰다. 하나도 못
     * 뽑으면 비어 있고, 그때 부르는 쪽은 <b>검증을 건너뛴다</b> — 간격을 모르는 것과
     * 간격이 짧은 것은 다르며, 모르는 것을 짧다고 읽으면 <i>정상 크론이 저장되지 않는다</i>.
     */
    public static Optional<Long> minIntervalSeconds(String cron) {
        Optional<CronExpression> parsed = parse(cron);
        if (parsed.isEmpty()) {
            return Optional.empty();
        }
        CronExpression expression = parsed.get();

        ZonedDateTime cursor = EPOCH_MONDAY;
        Long min = null;
        for (int i = 0; i < SAMPLE; i++) {
            ZonedDateTime next = expression.next(cursor);
            if (next == null) {
                break;
            }
            long gap = Duration.between(cursor, next).toSeconds();
            // 첫 간격은 기준시각과의 거리라 주기가 아니다 — 두 번째부터 잰다.
            if (i > 0 && (min == null || gap < min)) {
                min = gap;
            }
            cursor = next;
        }
        return Optional.ofNullable(min);
    }

    private static Optional<CronExpression> parse(String cron) {
        if (cron == null || cron.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(CronExpression.parse(cron.trim()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private CronRules() {}

    /**
     * 쿨다운이 <b>주기를 통째로 삼키는가</b> — screen/batch/schedule/requirements.md 가 저장에서 막는 그 관계다.
     *
     * <p><b>판정이 두 곳에서 필요하다.</b> 저장은 사람이 넣는 값을 막고(그 자리에서
     * 고칠 수 있으므로 거부한다), 기동은 <b>시드와 직접 UPDATE 로 들어온 값</b>을 본다
     * (고칠 사람이 없으므로 경고하고 건다 — {@code BatchScheduler#reload}). 두 곳이
     * 같은 판정을 각자 쓰면 <b>저장이 막은 것과 기동이 경고하는 것이 어긋난다</b>.
     *
     * <p><b>같을 때도 참이다.</b> 쿨다운이 주기와 정확히 같으면 경계에서 한 주기가 통째로
     * 누락된다 — 다음 실행이 쿨다운 종료 <i>직전</i>에 깨어나기 때문이다.
     *
     * <p>크론을 못 읽으면 {@code false} 다. <b>모르는 것과 어긋난 것은 다르다</b> — 모르는
     * 것을 어긋났다고 읽으면 정상 크론이 저장되지 않는다({@link #minIntervalSeconds} 의 계약).
     */
    public static boolean cooldownSwallowsCycles(String cron, int cooldownSec) {
        if (cooldownSec <= 0) {
            return false;
        }
        return minIntervalSeconds(cron).filter(interval -> cooldownSec >= interval).isPresent();
    }
}
