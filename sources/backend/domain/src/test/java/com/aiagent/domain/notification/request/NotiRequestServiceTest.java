// @feat FEAT-509
package com.aiagent.domain.notification.request;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.LockModeType;
import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.notification.NotiType;
import com.aiagent.domain.notification.NotificationSender;
import com.aiagent.domain.notification.ReqStatus;
import com.aiagent.domain.notification.ReqType;
import com.aiagent.domain.notification.entity.SysNotiRequest;
import com.aiagent.domain.notification.repository.SysNotiRequestRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.Lock;

class NotiRequestServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-13T00:00:00Z");

    private SysNotiRequestRepository requests;
    private NotificationSender notifications;
    private NotiRequestService service;

    @BeforeEach
    void setUp() {
        requests = mock(SysNotiRequestRepository.class);
        notifications = mock(NotificationSender.class);
        @SuppressWarnings("unchecked")
        AuditorAware<String> auditor = mock(AuditorAware.class);
        when(auditor.getCurrentAuditor()).thenReturn(java.util.Optional.of("admin"));
        service = new NotiRequestService(
                requests,
                notifications,
                auditor,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    @DisplayName("TC-5091 접수 요청을 처리하면 판정 정보와 사용자 알림 한 건을 함께 남긴다")
    void handlingReceivedRequestFinalizesItAndSendsOneNotification() {
        SysNotiRequest request = received("user-a");
        when(requests.lockAllByReqIdIn(List.of(1L))).thenReturn(List.of(request));

        service.handle(List.of(1L), ReqStatus.DONE, null);

        assertThat(request.getReqStatCd()).isEqualTo(ReqStatus.DONE);
        assertThat(request.getHandlerId()).isEqualTo("admin");
        assertThat(request.getHandleDtm()).isEqualTo(NOW);
        verify(notifications).send(
                "user-a", NotiType.REQUEST, "요청이 처리되었습니다", "요청이 처리되었습니다.");
    }

    @Test
    @DisplayName("TC-5096 반려 사유가 비면 요청과 알림을 바꾸지 않는다")
    void rejectsBlankMemoBeforeReadingOrChangingRequests() {
        assertThatThrownBy(() -> service.handle(List.of(1L), ReqStatus.REJECTED, "  "))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(NotiRequestErrorCode.MEMO_REQUIRED);

        verifyNoInteractions(requests, notifications);
    }

    @Test
    @DisplayName("TC-5097 동시 판정의 뒤 요청은 잠금 해제 뒤 상태 충돌로 끝나며 알림을 더 만들지 않는다")
    void rejectsTheLaterConcurrentHandlingAfterTheLockedRequestHasFinalized() {
        SysNotiRequest request = received("user-a");
        request.handle(ReqStatus.DONE, "admin", null, NOW.minusSeconds(60));
        when(requests.lockAllByReqIdIn(List.of(1L))).thenReturn(List.of(request));

        assertThatThrownBy(() -> service.handle(List.of(1L), ReqStatus.REJECTED, "재처리"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(NotiRequestErrorCode.NOT_RECEIVED);

        assertThat(request.getReqStatCd()).isEqualTo(ReqStatus.DONE);
        verify(notifications, never()).send(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    @DisplayName("TC-5097 동시 판정은 요청 ID 오름차순의 비관 잠금으로 직렬화한다")
    void locksTargetsInAscendingOrderBeforeStateDecision() throws NoSuchMethodException {
        SysNotiRequest first = received("user-a");
        SysNotiRequest second = received("user-b");
        when(requests.lockAllByReqIdIn(List.of(1L, 2L))).thenReturn(List.of(first, second));

        service.handle(List.of(2L, 1L), ReqStatus.DONE, null);

        verify(requests).lockAllByReqIdIn(List.of(1L, 2L));
        Lock lock = SysNotiRequestRepository.class
                .getMethod("lockAllByReqIdIn", List.class)
                .getAnnotation(Lock.class);
        assertThat(lock.value()).isEqualTo(LockModeType.PESSIMISTIC_WRITE);
        verify(notifications).send(
                "user-a", NotiType.REQUEST, "요청이 처리되었습니다", "요청이 처리되었습니다.");
        verify(notifications).send(
                "user-b", NotiType.REQUEST, "요청이 처리되었습니다", "요청이 처리되었습니다.");
    }

    private static SysNotiRequest received(String userId) {
        return SysNotiRequest.builder()
                .userId(userId)
                .reqTypeCd(ReqType.ROLE_GRANT)
                .reqContent("권한 요청")
                .creDtm(NOW.minusSeconds(3600))
                .build();
    }
}
