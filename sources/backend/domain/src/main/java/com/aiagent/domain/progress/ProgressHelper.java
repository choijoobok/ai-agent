package com.aiagent.domain.progress;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.core.error.ErrorCode;
import com.aiagent.domain.message.service.MessageService;
import java.time.Clock;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Component;

/**
 * 오래 걸리는 작업을 <b>맡기고 곧바로 돌아온다</b> — 30 §6 · 68 §9.1.
 *
 * <pre>
 * String jobId = progressHelper.start(1000L, progress -&gt; service.bulkSave(list, progress));
 * return Map.of("jobId", jobId);
 * </pre>
 *
 * <p><b>요청 스레드를 붙잡지 않는 것이 전부다.</b> 붙잡으면 그 요청이 타임아웃까지 열려
 * 있고, 사용자는 <i>화면이 멈췄다</i> 를 겪으며 새로고침한다 — 그러면 같은 작업이 <b>또</b>
 * 시작된다.
 *
 * <p><b>{@code RUNNING} 을 먼저 적재한다</b>(30 §6). 화면은 {@code jobId} 를 받자마자
 * 폴링을 시작하는데, 그 첫 요청이 <i>없음</i> 을 받으면 <b>실패한 것과 구별할 수 없다</b>.
 *
 * <p><b>사용자를 여기서 붙든다.</b> 작업은 다른 스레드에서 돌고 그 스레드에는
 * {@code SecurityContext} 가 없다 — 안에서 물으면 <b>주인 없는 진행률</b>이 되어 시작한
 * 사람조차 자기 것을 볼 수 없다(46 §8.1 의 인가가 {@code USER_ID} 대조다).
 *
 * <p><b>언어도 같은 이유로 여기서 붙든다</b>({@link RequestLang} · 2026-09-02). 실패
 * 문구는 사용자 언어여야 하는데 그것을 정하는 규칙은 요청을 아는 쪽에 있고, 작업
 * 스레드에는 요청이 없다.
 *
 * <h2>실패 문구는 <b>코드로 푼다</b> — 예외의 {@code getMessage()} 가 아니다</h2>
 *
 * <p>여기가 한 번 어긋나 있었다(2026-09-02 실기동에서 드러났다). {@code getMessage()} 를
 * 그대로 {@code ERR_MSG} 에 적고 있었는데, {@code BusinessException} 의 그 값은
 * <b>로그의 것이고 응답의 것이 아니다</b>(그 클래스의 주석이 못 박아 두었다) — 서버
 * 언어이며, 부르는 자리가 상세를 덧붙이면 <b>개발자용 문자열</b>이다. 그래서 진행률 창에
 * <i>amount is closed: SO-2026-1021</i> 이 떴다. 사용자가 읽을 문구는
 * {@code ErrorCode.code()} 를 키로 {@code SYS_MESSAGE} 에서 그 사람의 언어로 읽는 것이며
 * (architecture.md §6-1.2 — {@code ErrorMessages} 가 응답에서 하는 것과 같다), 이 클래스가 그
 * 자리를 대신한다: 작업 스레드에는 요청이 없으므로 {@code ErrorMessages} 를 쓸 수 없다.
 *
 * <p><b>업무 규칙 위반과 예상 밖의 고장을 가른다.</b> 앞엣것은 <i>무엇이 막혔는지</i> 를
 * 말할 수 있고(그 코드의 문구), 뒤엣것은 말할 것이 없다 — 그때 예외의 문구를 내면
 * SQL 조각이나 클래스 이름이 창에 뜬다(security-design.md §8 이 응답에 스택을 담지 않기로 한 것과 같은
 * 자리다). 뒤엣것은 {@code err.internal} 하나로 닫고 <b>원인은 로그가 갖는다</b>.
 */
@Component
public class ProgressHelper {

    private static final Logger log = LoggerFactory.getLogger(ProgressHelper.class);

    private final JobProgressStore store;
    private final Executor executor;
    private final AuditorAware<String> auditor;
    private final Clock clock;
    private final MessageService messages;
    private final RequestLang lang;

    public ProgressHelper(
            JobProgressStore store,
            @Qualifier(ProgressExecutorConfig.EXECUTOR) Executor executor,
            AuditorAware<String> auditor,
            Clock clock,
            MessageService messages,
            RequestLang lang) {
        this.store = store;
        this.executor = executor;
        this.auditor = auditor;
        this.clock = clock;
        this.messages = messages;
        this.lang = lang;
    }

    /**
     * @param totCnt 전체 건수. <b>모르면 {@code null}</b> — 화면이 불확정 막대를 그린다
     *     (46 §8). 0 을 주면 {@code 0/0} 이 되어 <b>완료로 보인다</b>
     * @return 발급된 {@code jobId} — 응답에 실어 보내면 화면이 그것으로 폴링한다
     */
    public String start(Long totCnt, Consumer<Progress> work) {
        String userId = auditor.getCurrentAuditor().orElseThrow(() ->
                // 개발자용이라 영어다 — 사용자에게 나가는 문구가 아니다(43 §3).
                new IllegalStateException("Progress job needs a session user (46 §8.1)"));
        // 여기가 요청 스레드다 — 작업 안에서는 물을 수 없다(위).
        String userLang = lang.current();
        String jobId = UUID.randomUUID().toString();
        store.start(jobId, userId, totCnt);

        Progress progress = new Progress(store, clock, jobId, totCnt);
        try {
            executor.execute(() -> run(progress, work, userLang));
        } catch (RejectedExecutionException rejected) {
            /*
              <b>큐가 찼으면 그 자리에서 실패로 닫는다.</b> 사전 등록한 {@code RUNNING} 행을
              그대로 두면 <b>영영 도는 작업</b>이 되고, 사용자는 만료 청소가 지울 때까지
              (32 §5) 진행률 창을 열어 둔 채 기다린다.
            */
            store.fail(jobId, userText(rejected, userLang));
            throw rejected;
        }
        return jobId;
    }

    /**
     * <b>예외를 여기서 잡는다.</b> 실행기의 스레드로 새어 나가면 그 스택은 로그에만 남고
     * 진행률 행은 {@code RUNNING} 인 채 굳는다 — 사용자에게는 <i>끝나지 않는 작업</i>이다.
     *
     * <p><b>{@code Throwable} 까지 잡는다.</b> {@code OutOfMemoryError} 같은 것도 같은
     * 결과를 만들며, 이 자리에서 하는 일은 <b>상태를 닫는 것</b>뿐이라 다시 던진다.
     */
    private void run(Progress progress, Consumer<Progress> work, String userLang) {
        try {
            work.accept(progress);
            progress.complete();
        } catch (RuntimeException error) {
            // 로그는 서버 언어이고 상세를 그대로 갖는다 — 화면의 문구와 다른 축이다.
            log.warn("Progress job failed: {}", progress.jobId(), error);
            progress.fail(userText(error, userLang));
        } catch (Throwable fatal) {
            log.error("Progress job died: {}", progress.jobId(), fatal);
            progress.fail(userText(fatal, userLang));
            throw fatal;
        }
    }

    /**
     * 화면에 그대로 보이는 문구다(68 §9.1 &mdash; <i>{@code ERR_MSG} 를 보인다</i>).
     *
     * <p><b>예외의 문구를 쓰지 않는다</b>(위 클래스 주석). 업무 규칙 위반이면 그 코드의
     * 문구를 사용자 언어로 읽고, 예상 밖의 고장이면 {@code err.internal} 하나로 닫는다 &mdash;
     * 스택도 예외의 문구도 창에 넣지 않으며(security-design.md §8) 그것들은 위 로그가 갖는다.
     *
     * <p><b>여기서 던지면 안 된다.</b> 실패를 적는 경로가 스스로 실패하면 그 작업은
     * {@code RUNNING} 인 채 굳고, 사용자에게는 <i>끝나지 않는 작업</i>이 된다 &mdash;
     * 메시지를 읽지 못하는 상황(DB 가 닿지 않는다)이 바로 작업이 실패하는 상황이므로
     * <b>이 자리에서만</b> 예외를 삼키고 기본 문구로 간다({@code ErrorMessages} 가 응답에서
     * 하는 것과 같다).
     */
    private String userText(Throwable error, String userLang) {
        ErrorCode code = error instanceof BusinessException rule
                ? rule.errorCode()
                : CommonErrorCode.INTERNAL;
        try {
            return messages.find(code.code(), userLang).orElseGet(code::defaultMessage);
        } catch (RuntimeException unreadable) {
            log.warn("메시지를 읽지 못해 기본 문구로 적는다 code={}", code.code(), unreadable);
            return code.defaultMessage();
        }
    }
}
