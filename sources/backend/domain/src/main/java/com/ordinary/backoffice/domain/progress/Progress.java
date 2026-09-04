package com.ordinary.backoffice.domain.progress;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 작업이 손에 쥐는 진행률 손잡이 — 30 §6.
 *
 * <p><b>건별로 쓰지 않는다</b>(30 §6.2). 이 값은 사용자가 <b>폴링으로 보는 것</b>이라
 * 밀리초 정밀도가 필요 없고, 10만 건마다 {@code UPDATE} 를 치면 <i>진행률을 보여 주려고
 * 작업을 느리게 만드는</i> 꼴이 된다.
 *
 * <p><b>진행률 1% 또는 1초 중 늦은 쪽</b>이다. 10만 건이면 {@code UPDATE} 는 100회이고
 * 프론트 폴링이 1초 주기이므로 <b>사용자가 보는 정밀도는 그대로</b>다.
 *
 * <p><b>둘 중 늦은 쪽인 것이 요점이다.</b> 1% 만 보면 <i>건수를 모르는 작업</i>(총계가
 * {@code null})에서 영영 안 쓰고, 1초만 보면 <b>초당 수천 건</b>이 도는 작업이 1초마다
 * 쓰는데 그 사이 진행률은 이미 여러 퍼센트를 지난다.
 *
 * <p><b>종료는 조절하지 않는다.</b> {@code complete}·{@code fail} 은 즉시 쓴다 — 마지막
 * flush 이후의 잔여 진행분과 종료 상태가 함께 늦으면 <b>작업이 끝났는데 99% 에서 멈춰
 * 보인다</b>(30 §6.2).
 *
 * <h2>여러 스레드가 함께 세도 된다 (2026-09-03)</h2>
 *
 * <p>한동안 <i>"스레드 하나가 쓴다"</i> 를 전제로 필드에 아무 보호가 없었다. 지금 쓰는 두
 * 실행이 단일 루프라 문제가 드러나지 않았을 뿐이고, <b>구조가 그것을 막고 있지는
 * 않았다</b> — 누군가 {@code parallelStream().forEach(x -> progress.step())} 을 쓰면
 * <b>조용히</b> 어긋난다: 카운트가 유실되어 100% 에 못 닿고(막대가 97% 에서 완료로
 * 넘어간다), 조절 상태가 찢어져 {@code UPDATE} 가 폭주하거나 반대로 멈추며, 저장소가
 * {@code CUR_CNT} 를 <b>덮어쓰므로</b> 늦게 도착한 값이 막대를 <b>뒤로</b> 되돌린다.
 * 예외도 실패한 작업도 없는 고장이라 아무도 화면을 의심하지 않는다.
 *
 * <p>그래서 셋으로 나눴다.
 *
 * <table border="1">
 *   <caption></caption>
 *   <tr><td><b>세는 것</b></td><td>{@link AtomicLong}</td>
 *       <td>락이 없다 — 일하는 스레드가 서로를 기다리지 않는다</td></tr>
 *   <tr><td><b>쓰는 것</b></td><td>{@link ReentrantLock}</td>
 *       <td>한 번에 하나. 그래야 조절 상태와 기록한 건수가 함께 움직인다</td></tr>
 *   <tr><td><b>구간을 바꾸는 것</b></td><td>같은 락(<b>기다린다</b>)</td>
 *       <td>경계는 놓치면 안 된다 — 놓치면 다음 구간이 앞 구간의 전체로 그려진다</td></tr>
 * </table>
 *
 * <p><b>걸음은 {@code tryLock} 이다.</b> 남이 쓰고 있으면 그냥 돌아간다 — 그 쓰기가
 * <b>이미 내 걸음을 포함</b>하기 때문이다({@code curCnt} 를 락 안에서 읽는다). 여기서
 * 기다리게 하면 <i>진행률을 보여 주려고 작업을 느리게 만드는</i> 그 자리로 되돌아간다.
 *
 * <p><b>단계 문구는 기다린다.</b> 그것은 조절의 대상이 아니라 <i>사용자가 기다리던
 * 신호</i>라(아래 {@link #step(String)}) 떨어뜨리면 안 된다.
 *
 * <h2>구간이 갈리는 작업 — {@link #reset}</h2>
 *
 * <p>고른 행마다 딸린 디테일 수천 건을 처리하는 실행이 있다. 그때 <b>하나의 퍼센트로는
 * 둘 중 하나만 말할 수 있다</b>: 행이 어디까지 갔는지(50행 중 3행 — 디테일이 몇만 건이면
 * 막대가 몇 분에 한 칸 움직인다)와 <b>이 행이 어디까지 갔는지</b>(3,000건 중 1,200건)가
 * 다른 사실이기 때문이다.
 *
 * <p>그래서 <b>소제목이 행을 말하고 막대가 그 행의 디테일을 말한다</b>:
 *
 * <pre>
 * progress.reset("주문 A-1023 (1/50)", 3_000L);   // 첫 행 — 막대가 0 으로 돌아간다
 * items.forEach(item -&gt; { ...; progress.step(); });
 * progress.reset("주문 A-1024 (2/50)", 1_200L);   // 다음 행 — 또 0 부터
 * </pre>
 *
 * <p><b>반대로도 쓴다.</b> 행 기준 진행률이 필요하면 총계를 행 수로 두고 걸음을 행마다
 * 밟으며, 소제목({@link #subTitle})으로 지금 어느 행인지만 말한다 — 그때 {@code reset} 은
 * 부르지 않는다.
 */
public class Progress {

    /** 1초 — 30 §6.2. */
    private static final Duration MIN_INTERVAL = Duration.ofSeconds(1);

    /** 1% — 〃. */
    private static final long PERCENT_STEP = 1L;

    private final JobProgressStore store;
    private final Clock clock;
    private final String jobId;

    /**
     * <b>final 이 아니다</b> — {@link #reset} 이 구간마다 갈아 끼운다.
     *
     * <p><b>{@code volatile} 인 것은 읽는 스레드가 여럿이기 때문이다.</b> 퍼센트 계산이
     * 이 값을 보는데, 그 계산은 <b>걸음을 밟는 아무 스레드</b>에서나 일어난다.
     */
    private volatile Long totCnt;

    /**
     * 지금까지 센 것 — <b>여러 스레드가 함께 올린다</b>.
     *
     * <p>{@code long} 이면 {@code ++} 가 <b>읽고-더하고-쓰는 셋</b>이라 겹치는 순간 유실이
     * 시작되고, 그 유실은 <i>100% 에 못 닿는 막대</i> 로만 드러난다 — 몇 건이 사라졌는지는
     * 아무 데도 남지 않는다.
     */
    private final AtomicLong curCnt = new AtomicLong();

    /**
     * <b>쓰기를 한 번에 하나로 좁힌다.</b>
     *
     * <p>{@code curCnt} 만 원자적이면 모자라다 — 조절 상태({@link #lastWrite} ·
     * {@link #lastPercent})와 <b>실제로 기록한 건수</b>가 함께 움직여야 한다. 따로 놀면
     * 늦게 도착한 쓰기가 저장소의 {@code CUR_CNT} 를 <b>더 작은 값으로 덮어</b> 막대가
     * 뒤로 간다.
     */
    private final ReentrantLock flushLock = new ReentrantLock();

    private Instant lastWrite;
    private long lastPercent = -1L;

    /**
     * 종료를 적었다 — <b>그 뒤로는 쓰지 않는다</b>.
     *
     * <p>없으면 종료 직전에 밟힌 걸음이 <b>종료 뒤에</b> 도착해 {@code CUR_CNT} 와
     * {@code MOD_DTM} 을 되돌린다. 상태는 그대로 {@code DONE} 이라 화면은 멀쩡해 보이지만,
     * 만료 청소(32 §5)가 <i>방금 끝난 작업</i>으로 읽어 그만큼 늦게 지운다.
     */
    private boolean finished;

    Progress(JobProgressStore store, Clock clock, String jobId, Long totCnt) {
        this.store = store;
        this.clock = clock;
        this.jobId = jobId;
        this.totCnt = totCnt;
        this.lastWrite = clock.instant();
    }

    public String jobId() {
        return jobId;
    }

    /** 한 건 처리했다 — 문구는 그대로 둔다. */
    public void step() {
        step(null);
    }

    /**
     * 한 건 처리했고 <b>지금 무엇을 하는지</b> 를 말한다.
     *
     * <p>문구가 {@code null} 이면 앞의 것이 남는다 — 매 걸음 문구를 만드는 작업은 드물고,
     * 지우면 사용자가 보던 <i>지금 무엇을 하는 중</i>이 사라진다.
     *
     * <p><b>세는 것은 언제나 성공한다.</b> 쓰는 것만 조절되며, 문구가 없는 걸음은 남이
     * 쓰고 있으면 <b>그냥 돌아간다</b> — 그 쓰기가 이미 이 걸음을 포함한다.
     */
    public void step(String stepMsg) {
        curCnt.incrementAndGet();

        if (stepMsg != null) {
            // 단계가 바뀐 것은 <b>사용자가 기다리던 신호</b>다 — 떨어뜨리지 않는다.
            flushLock.lock();
            try {
                write(stepMsg, null);
            } finally {
                flushLock.unlock();
            }
            return;
        }

        if (!flushLock.tryLock()) {
            return;
        }
        try {
            if (due()) {
                write(null, null);
            }
        } finally {
            flushLock.unlock();
        }
    }

    /**
     * 소제목을 바꾼다 — <b>건수는 그대로</b>다(위 <i>반대로도 쓴다</i>).
     *
     * <p><b>즉시 쓴다.</b> 구간이 바뀐 것은 단계 문구와 같은 자리이며 — 조절에 걸려 늦으면
     * 화면은 <b>앞 행의 이름</b>을 든 채로 새 행의 건수를 센다.
     *
     * <p><b>건수를 함께 밀어 넣는다.</b> 소제목만 쓰면 그 행의 {@code CUR_CNT} 는 마지막
     * flush 의 값이라, <i>새 이름 + 낡은 건수</i> 가 최대 1초 동안 화면에 있는다.
     */
    public void subTitle(String subTitle) {
        flushLock.lock();
        try {
            write(null, subTitle);
        } finally {
            flushLock.unlock();
        }
    }

    /**
     * <b>다음 구간으로 넘어간다</b> — 소제목을 걸고 건수를 0 으로, 전체를 새로 앉힌다.
     *
     * <p><b>즉시 쓴다</b>({@link JobProgressStore#reset}). 이것은 진행이 아니라 구간의
     * 경계이고, 늦으면 그 사이의 폴링이 <i>새 구간의 건수 대 앞 구간의 전체</i> 를 본다.
     *
     * <p><b>전체를 나중에 알게 된 작업</b>도 이것을 쓴다 — 조회해 보고서야 대상 건수를
     * 아는 실행이 그렇다({@code SampleOrderService.recalculate}). 시작할 때
     * {@code null} 로 열어 두고(불확정 막대) 센 순간 앉히면, 그 뒤로는 퍼센트가 나온다.
     *
     * <p><b>구간의 경계는 부르는 쪽이 혼자 넘는다.</b> 앞 구간의 걸음이 아직 돌고 있는
     * 채로 이것을 부르면 그 걸음들이 <b>새 구간에 실린다</b> — 락으로 막을 수 있는 것은
     * <i>쓰기가 찢어지는 것</i>이지 <i>일이 아직 안 끝난 것</i>이 아니다. 구간을 나눠 도는
     * 작업은 <b>그 구간을 다 돌고 나서</b> 넘어간다.
     *
     * @param subTitle {@code null} 이면 앞의 소제목이 남는다 — <b>건수만 되돌리는</b> 자리다
     * @param totCnt 이 구간의 전체. <b>모르면 {@code null}</b> — 다시 불확정 막대가 된다
     */
    public void reset(String subTitle, Long totCnt) {
        flushLock.lock();
        try {
            if (finished) {
                return;
            }
            this.curCnt.set(0L);
            this.totCnt = totCnt;
            store.reset(jobId, subTitle, totCnt);
            // 방금 썼다 — 조절의 기준도 여기서 다시 시작한다.
            this.lastWrite = clock.instant();
            this.lastPercent = percent();
        } finally {
            flushLock.unlock();
        }
    }

    public void complete() {
        finish(() -> store.complete(jobId));
    }

    public void fail(String errMsg) {
        finish(() -> store.fail(jobId, errMsg));
    }

    /**
     * 종료를 적고 <b>문을 닫는다</b>.
     *
     * <p>락을 잡는 것은 <b>진행 중인 쓰기 뒤에 오게</b> 하기 위해서다 — 종료를 먼저 적고
     * 그 뒤에 늦은 걸음이 도착하면 {@link #finished} 가 막는다.
     */
    private void finish(Runnable write) {
        flushLock.lock();
        try {
            if (finished) {
                return;
            }
            write.run();
            finished = true;
        } finally {
            flushLock.unlock();
        }
    }

    /** <b>락 안에서만 부른다</b> — {@link #lastWrite} · {@link #lastPercent} 를 읽는다. */
    private boolean due() {
        Instant now = clock.instant();
        boolean slept = !now.isBefore(lastWrite.plus(MIN_INTERVAL));
        long percent = percent();
        boolean moved = percent >= 0 && percent >= lastPercent + PERCENT_STEP;
        /*
          <b>늦은 쪽</b>이다 — 둘 다 만족해야 쓴다. 건수를 모르는 작업({@code totCnt} 가
          {@code null})은 퍼센트가 없으므로 <b>시간만</b> 본다: 그러지 않으면 그 작업의
          진행률은 영영 0 이고, 화면은 불확정 막대만 돌린 채 건수를 못 낸다.
        */
        return totCnt == null ? slept : slept && moved;
    }

    private long percent() {
        Long total = totCnt;
        if (total == null || total <= 0) {
            return -1L;
        }
        return curCnt.get() * 100L / total;
    }

    /** <b>락 안에서만 부른다</b> — 조절 상태와 기록한 건수가 함께 움직여야 한다. */
    private void write(String stepMsg, String subTitle) {
        if (finished) {
            return;
        }
        store.progress(jobId, curCnt.get(), stepMsg, subTitle);
        lastWrite = clock.instant();
        lastPercent = percent();
    }
}
