// @feat FEAT-509
package com.aiagent.domain.notification.inbox;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.notification.repository.SysNotiInboxRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MyNotiServiceTest {

    @Test
    @DisplayName("TC-5094 다른 사용자의 알림 번호는 존재를 드러내지 않고 읽음 처리하지 않는다")
    void hidesAnotherUsersNotificationAndLeavesItUnchanged() {
        SysNotiInboxRepository inboxes = mock(SysNotiInboxRepository.class);
        MyNotiService service = new MyNotiService(
                inboxes,
                mock(com.aiagent.support.config.ConfigLookup.class),
                Clock.fixed(Instant.parse("2026-09-13T00:00:00Z"), ZoneOffset.UTC));
        when(inboxes.findByNotiIdAndUserId(101L, "user-a")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markRead("user-a", 101L))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(NotiInboxErrorCode.NOT_FOUND);

        verify(inboxes).findByNotiIdAndUserId(101L, "user-a");
        verifyNoMoreInteractions(inboxes);
    }
}
