package com.ordinary.backoffice.domain.progress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.error.CommonErrorCode;
import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.core.error.ErrorType;
import com.ordinary.backoffice.domain.message.service.MessageService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.AuditorAware;

/**
 * 작업이 실패했을 때 <b>사용자가 읽는 문구</b> — architecture.md §6-1.2 · 68 §9.1.
 *
 * <p>이 파일이 지키는 것은 한 문장이다: <b>진행률 창에 개발자용 문자열이 뜨지 않는다.</b>
 * 실기동에서 그 자리에 <i>amount is closed: SO-2026-1021</i> 이 떴고(2026-09-02), 그것은
 * {@code BusinessException.getMessage()} 를 그대로 적고 있었기 때문이다 — 그 값은
 * <b>로그의 것</b>이며 서버 언어이고, 부르는 자리가 상세를 덧붙이면 사람이 읽을 문장이
 * 아니게 된다.
 *
 * <p><b>세 갈래를 가른다.</b> 업무 규칙 위반은 그 코드의 문구를, 예상 밖의 고장은
 * {@code err.internal} 하나를, 문구를 읽지 못하는 상황은 기본 문구를 쓴다 — 마지막 갈래가
 * 없으면 <b>실패를 적는 경로가 스스로 실패</b>해서 그 작업이 {@code RUNNING} 인 채 굳는다.
 *
 * <p><b>언어는 시작할 때 붙든 값이다.</b> 작업 스레드에는 요청이 없으므로
 * ({@link RequestLang} 이 있는 이유다) 실패 시점에 물으면 이미 늦다 — 그 사실도 잰다.
 */
class ProgressFailureMessageTest {

    private static final Instant NOW = Instant.parse("2026-09-02T00:00:00Z");

    /** 사유가 적힌 순서 — 무엇이 적혔는지가 이 파일의 전부다. */
    private final List<String> failures = new ArrayList<>();

    private final JobProgressStore store = new JobProgressStore() {
        @Override
        public void start(String jobId, String userId, Long totCnt) {}

        @Override
        public void progress(String jobId, long curCnt, String stepMsg, String subTitle) {}

        @Override
        public void reset(String jobId, String subTitle, Long totCnt) {}

        @Override
        public void complete(String jobId) {}

        @Override
        public void fail(String jobId, String errMsg) {
            failures.add(errMsg);
        }

        @Override
        public Optional<JobProgressView> find(String jobId, String userId) {
            return Optional.empty();
        }
    };

    private final MessageService messages = mock(MessageService.class);

    /** 요청 스레드의 언어 — 시작할 때 한 번 읽힌다. */
    private String requested = "en";

    /** 같은 스레드에서 돈다 — 실패가 검사 스레드로 돌아와야 잴 수 있다. */
    private final Executor inline = Runnable::run;

    private ProgressHelper helper(Executor executor) {
        return new ProgressHelper(
                store,
                executor,
                () -> Optional.of("admin"),
                Clock.fixed(NOW, ZoneOffset.UTC),
                messages,
                () -> requested);
    }

    /** 샘플의 그 코드와 같은 모양 — 부르는 자리가 <b>상세를 덧붙인다</b>. */
    private enum TestErrorCode implements ErrorCode {
        NOT_RECALCULABLE;

        @Override
        public String code() {
            return "err.sample.not-recalculable";
        }

        @Override
        public ErrorType type() {
            return ErrorType.INVALID_REQUEST;
        }

        @Override
        public String defaultMessage() {
            return "확정 전(접수) 주문의 품목만 다시 계산할 수 있습니다";
        }
    }

    /*
      <b>이것이 이 파일의 이유다.</b> 예외의 문구를 적으면 창에 개발자용 문자열이 뜨고,
      사용자는 그것으로 자기가 무엇을 해야 하는지 알 수 없다.
    */
    @Test
    @DisplayName("업무 규칙 위반은 그 코드의 문구를 사용자 언어로 적는다 — 예외의 문구가 아니다")
    void businessFailureWritesTheUserMessage() {
        when(messages.find("err.sample.not-recalculable", "en"))
                .thenReturn(Optional.of("Only received orders can be recalculated."));

        helper(inline).start(null, progress -> {
            throw new BusinessException(
                    TestErrorCode.NOT_RECALCULABLE, "amount is closed: SO-2026-1021");
        });

        assertThat(failures).containsExactly("Only received orders can be recalculated.");
    }

    /*
      <b>문구가 없으면 키를 보이지 않는다.</b> 화면은 키 문자열을 그대로 내는 것이 규약이지만
      (43 §7.3) 여기는 <b>서버가 완성해 넘기는 자리</b>라 마지막 수단이 기본 문구다
      (architecture.md §6-1.2 — 에러 응답과 같다).
    */
    @Test
    @DisplayName("그 언어의 문구가 없으면 기본 문구다 — 키를 보이지 않는다")
    void missingMessageFallsBackToDefault() {
        when(messages.find(any(), any())).thenReturn(Optional.empty());

        helper(inline).start(null, progress -> {
            throw new BusinessException(TestErrorCode.NOT_RECALCULABLE, "amount is closed");
        });

        assertThat(failures).containsExactly("확정 전(접수) 주문의 품목만 다시 계산할 수 있습니다");
    }

    /*
      <b>예상 밖의 고장은 말할 것이 없다.</b> 예외의 문구를 내면 SQL 조각이나 클래스 이름이
      창에 뜨는데(security-design.md §8 이 응답에 스택을 담지 않기로 한 것과 같은 자리다), 그것은 사용자가
      할 수 있는 일과 아무 상관이 없다.
    */
    @Test
    @DisplayName("예상 밖의 고장은 err.internal 하나로 닫는다 — 예외의 문구가 새지 않는다")
    void unexpectedFailureWritesTheGenericMessage() {
        when(messages.find(CommonErrorCode.INTERNAL.code(), "en"))
                .thenReturn(Optional.of("Something went wrong."));

        helper(inline).start(null, progress -> {
            throw new IllegalStateException("null 이 아닌 컬럼에 null: SMPL_ORDER.ORD_NO");
        });

        assertThat(failures).containsExactly("Something went wrong.");
    }

    /*
      <b>실패를 적는 경로가 스스로 실패하면 안 된다.</b> 메시지를 읽지 못하는 상황(DB 가
      닿지 않는다)이 곧 작업이 실패하는 상황이며, 그때 여기서 던지면 진행률 행이
      {@code RUNNING} 인 채 굳어 <b>끝나지 않는 작업</b>이 된다.
    */
    @Test
    @DisplayName("메시지를 읽지 못해도 사유는 적힌다 — 작업이 RUNNING 인 채 굳지 않는다")
    void unreadableMessagesStillWriteAReason() {
        when(messages.find(any(), any())).thenThrow(new IllegalStateException("DB down"));

        helper(inline).start(null, progress -> {
            throw new BusinessException(TestErrorCode.NOT_RECALCULABLE, "amount is closed");
        });

        assertThat(failures).containsExactly("확정 전(접수) 주문의 품목만 다시 계산할 수 있습니다");
    }

    /*
      <b>언어는 맡기기 전에 붙든 값이다.</b> 작업 스레드에는 요청이 없어 그때 물으면 답이
      없거나 남의 언어다 — 그 값을 실패 시점에 읽는 구현이면 이 검사가 깨진다.
    */
    @Test
    @DisplayName("언어는 시작할 때 읽는다 — 작업이 도는 사이 요청이 바뀌어도 그 사람의 언어다")
    void languageIsCapturedAtStart() {
        when(messages.find("err.sample.not-recalculable", "ko"))
                .thenReturn(Optional.of("접수 주문만 다시 계산할 수 있습니다."));
        requested = "ko";

        helper(inline).start(null, progress -> {
            // 이 사이에 다음 요청이 들어와 언어가 바뀐다 — 이 작업의 언어는 그대로여야 한다.
            requested = "en";
            throw new BusinessException(TestErrorCode.NOT_RECALCULABLE, "amount is closed");
        });

        assertThat(failures).containsExactly("접수 주문만 다시 계산할 수 있습니다.");
    }

    /*
      <b>큐가 찼을 때도 개발자용 문자열을 적지 않는다.</b> 그 자리는
      {@code RejectedExecutionException.toString()} 이었다 — 클래스 이름이 그대로 창에 간다.
    */
    @Test
    @DisplayName("큐가 차서 접수하지 못해도 사유가 사람이 읽는 문구다")
    void rejectedExecutionWritesTheGenericMessage() {
        when(messages.find(CommonErrorCode.INTERNAL.code(), "en"))
                .thenReturn(Optional.of("Something went wrong."));
        Executor full = task -> {
            throw new RejectedExecutionException("queue is full");
        };

        assertThatThrownBy(() -> helper(full).start(null, progress -> {}))
                .isInstanceOf(RejectedExecutionException.class);

        assertThat(failures).containsExactly("Something went wrong.");
    }
}
