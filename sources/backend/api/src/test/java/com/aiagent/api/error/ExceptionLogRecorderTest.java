package com.aiagent.api.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.aiagent.api.authz.AuthzErrorCode;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.core.error.ErrorCode;
import com.aiagent.domain.log.LogText;
import com.aiagent.domain.log.entity.SysExceptionLog;
import com.aiagent.domain.log.service.ExceptionLogService;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

/**
 * 에러 로그 적재의 규칙 — screen/admin/system/log/access/requirements.md.
 *
 * <p><b>실측으로 확인하기 어려운 자리라 테스트가 있다.</b> 401 과 5xx 는 화면을 두드려서
 * 만들기 힘들다 — 이 백엔드는 4xx 를 잘 막아 두어서(2026-08-30 실측 — 깨진 커서도 잘못된
 * 타입도 400 이다) <b>5xx 를 일부러 내는 길이 없다</b>. 그런데 스택을 저장하는 유일한
 * 갈래가 그것이다.
 */
@ExtendWith(MockitoExtension.class)
class ExceptionLogRecorderTest {

    @Mock
    private ExceptionLogService exceptionLogs;

    private ExceptionLogRecorder recorder;

    @BeforeEach
    void setUp() {
        BusinessCalendar calendar =
                new BusinessCalendar(
                        "UTC", Clock.fixed(Instant.parse("2026-08-30T10:00:00Z"), ZoneId.of("UTC")));
        recorder = new ExceptionLogRecorder(exceptionLogs, calendar);
    }

    private static MockHttpServletRequest request(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        request.addHeader("X-Menu-Code", "ERROR_LOG");
        return request;
    }

    private SysExceptionLog recorded() {
        ArgumentCaptor<SysExceptionLog> captor = ArgumentCaptor.forClass(SysExceptionLog.class);
        verify(exceptionLogs).record(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("401 은 남기지 않는다 — 하트비트마다 쌓이면 에러 로그가 만료 로그가 된다")
    void 세션_만료는_기록하지_않는다() {
        ErrorCode code = CommonErrorCode.UNAUTHENTICATED;

        recorder.record(request("/api/common/system/auth/getMe"), 401, code, "세션이 만료됐습니다", null);

        verify(exceptionLogs, never()).record(any());
    }

    @Test
    @DisplayName("/api/ 밖은 남기지 않는다 — 사용 이력과 대상이 같아야 traceId 로 이어진다")
    void api_밖은_기록하지_않는다() {
        recorder.record(request("/assets/index.js"), 404, CommonErrorCode.NOT_FOUND, "없습니다", null);

        verify(exceptionLogs, never()).record(any());
    }

    @Test
    @DisplayName("4xx 는 스택을 남기지 않는다 — 인터셉터 프레임뿐이고 전 행이 같다")
    void 클라이언트_오류는_스택이_없다() {
        // 403 의 세 갈래 중 하나. 스택이 있어도 저장하지 않는 것이 요점이다.
        recorder.record(
                request("/api/service/nosuch/getList"),
                403,
                AuthzErrorCode.NOT_REGISTERED,
                "권한이 없습니다.",
                new IllegalStateException("스택은 있지만 저장하지 않는다"));

        SysExceptionLog entry = recorded();
        assertThat(entry.getRootCauseStack()).isNull();
        assertThat(entry.getHttpStat()).isEqualTo((short) 403);
        // 갈래를 나르는 것이 이 컬럼이다 — 사용자에게는 셋 다 같은 403 이다(screen/admin/system/log/access/requirements.md).
        assertThat(entry.getErrCd()).isEqualTo("err.api-not-registered");
    }

    @Test
    @DisplayName("5xx 는 체인을 통째로 남긴다 — 근본 원인만 남기면 어디서 감싸였는지가 사라진다")
    void 서버_오류는_스택을_남긴다() {
        Exception cause =
                new IllegalStateException("겉", new IllegalArgumentException("근본 원인"));

        recorder.record(request("/api/service/system/errorLog/getList"), 500, CommonErrorCode.INTERNAL, "오류", cause);

        String stack = recorded().getRootCauseStack();
        assertThat(stack).contains("IllegalStateException").contains("겉");
        // 표준 형식이 근본 원인을 맨 끝에 둔다 — 이름이 말하는 것은 그대로 들어 있다(screen/admin/system/log/access/requirements.md).
        assertThat(stack).contains("Caused by").contains("근본 원인");
    }

    @Test
    @DisplayName("긴 스택은 상한에서 잘리고 잘렸음을 본문이 말한다 — screen/admin/system/log/access/requirements.md")
    void 스택은_상한에서_잘린다() {
        Exception deep = new IllegalStateException("x".repeat(64 * 1024));

        recorder.record(request("/api/service/system/errorLog/getList"), 500, CommonErrorCode.INTERNAL, "오류", deep);

        String stack = recorded().getRootCauseStack();
        assertThat(LogText.isTruncated(stack)).isTrue();
    }

    @Test
    @DisplayName("응답에 나간 문구가 그대로 남는다 — 갈리면 운영자와 사용자가 다른 말을 본다")
    void 문구는_응답과_같은_값이다() {
        recorder.record(
                request("/api/service/system/errorLog/getList"),
                400,
                CommonErrorCode.VALIDATION,
                "조회 기간은 필수입니다",
                new IllegalStateException("서버 언어의 로그 문구 — 이것이 아니다"));

        assertThat(recorded().getErrMsg()).isEqualTo("조회 기간은 필수입니다");
    }

    @Test
    @DisplayName("기록이 실패해도 던지지 않는다 — 실패를 알리는 경로가 스스로 실패하면 안 된다")
    void 기록_실패를_삼킨다() {
        doThrow(new IllegalStateException("DB 가 닿지 않는다")).when(exceptionLogs).record(any());

        // 던지면 사용자가 봉투 대신 500 HTML 을 받고 진짜 원인이 응답에서 사라진다.
        recorder.record(request("/api/service/system/errorLog/getList"), 500, CommonErrorCode.INTERNAL, "오류", null);
    }
}
