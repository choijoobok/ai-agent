// @feat FEAT-505
package com.aiagent.system.api.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.aiagent.api.message.RequestLocale;
import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.domain.message.MessageRow;
import com.aiagent.domain.message.MessageScope;
import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.domain.message.service.CacheVersionService;
import com.aiagent.domain.message.service.MessageBundleQueryService;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MessageProps;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MessageBundleConsistencyTest {

    private final SysMessageRepository rows = mock(SysMessageRepository.class);
    private final ConfigLookup configs = mock(ConfigLookup.class);
    private final CacheVersionService versions = mock(CacheVersionService.class);
    private final RequestLocale locale = mock(RequestLocale.class);
    private MessageService messages;
    private MessageController controller;

    @BeforeEach
    void setUp() {
        when(configs.get(MessageProps.class))
                .thenReturn(new MessageProps(List.of("ko", "en"), "ko", "en", 30));
        when(locale.normalize("ko")).thenReturn("ko");
        messages = new MessageService(rows, configs, Clock.systemUTC());
        controller = new MessageController(new MessageBundleQueryService(messages, versions), locale, configs);
    }

    @Test
    @DisplayName("TC-5058 다른 노드의 오래된 TTL 캐시와 최신 버전을 묶어 브라우저에 보내지 않는다")
    void latestVersionDoesNotLabelAnOldNodeSnapshot() {
        when(rows.findRows(any())).thenReturn(List.of(row("이전 문구")));
        assertThat(messages.text("login.title", "ko")).isEqualTo("이전 문구");
        when(rows.findRows(any())).thenReturn(List.of(row("새 문구")));
        when(versions.current("message")).thenReturn(2L);

        var response = controller.getBundle("ko", 1L).data();

        assertThat(response.version()).isEqualTo(2L);
        assertThat(response.messages()).containsEntry("login.title", "새 문구");
    }

    @Test
    @DisplayName("TC-5058 버전 조회와 본문 조회 사이의 저장을 감지해 같은 버전의 본문을 다시 읽는다")
    void commitBetweenVersionAndRowsDoesNotMislabelTheBundle() {
        when(versions.current("message")).thenReturn(1L, 2L, 2L);
        when(rows.findRows(any())).thenReturn(List.of(row("새 문구")));

        var response = controller.getBundle("ko", 0L).data();

        assertThat(response.version()).isEqualTo(2L);
        assertThat(response.messages()).containsEntry("login.title", "새 문구");
    }

    @Test
    @DisplayName("TC-5058 같은 버전이면 DB 메시지 전량 조회 없이 변경 없음 응답을 낸다")
    void unchangedVersionDoesNotReadRows() {
        when(versions.current("message")).thenReturn(2L);

        var response = controller.getBundle("ko", 2L).data();

        assertThat(response.unchanged()).isTrue();
        assertThat(response.messages()).isNull();
        verify(rows, never()).findRows(any());
    }

    @Test
    @DisplayName("TC-5058 계속 바뀌는 번들은 세 번까지만 읽고 기존 상태 충돌로 재조회를 요청한다")
    void repeatedCommitsDoNotReturnAMislabelledBundleOrLoopForever() {
        when(versions.current("message")).thenReturn(1L, 2L, 3L, 4L);
        when(rows.findRows(any())).thenReturn(List.of(row("새 문구")));

        assertThatThrownBy(() -> controller.getBundle("ko", 0L))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(CommonErrorCode.CONFLICT);
        verify(rows, times(3)).findRows(any());
    }

    private static MessageRow row(String value) {
        return new MessageRow("login.title", "ko", value, MessageScope.FRONT);
    }
}
