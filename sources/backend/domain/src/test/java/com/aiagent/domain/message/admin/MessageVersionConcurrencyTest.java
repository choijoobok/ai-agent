// @feat FEAT-505
package com.aiagent.domain.message.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiagent.core.grid.RowState;
import com.aiagent.domain.message.entity.SysCacheVersion;
import com.aiagent.domain.message.entity.SysMessageKey;
import com.aiagent.domain.message.repository.SysCacheVersionRepository;
import com.aiagent.domain.message.repository.SysMessageKeyRepository;
import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MessageProps;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;

class MessageVersionConcurrencyTest {

    @Test
    @DisplayName("TC-5056 서로 다른 키의 동시 저장 두 건은 메시지 버전을 두 번 증가시킨다")
    void successfulConcurrentSavesDoNotLoseAnIncrement() throws Exception {
        AtomicLong committed = new AtomicLong(1L);
        ThreadLocal<SysCacheVersion> transactionSnapshot = new ThreadLocal<>();
        CyclicBarrier bothReadTheOldVersion = new CyclicBarrier(2);
        SysCacheVersionRepository versions = mock(SysCacheVersionRepository.class, invocation -> {
            String name = invocation.getMethod().getName();
            if (name.equals("findById")) {
                SysCacheVersion snapshot = SysCacheVersion.started("message", Instant.EPOCH);
                transactionSnapshot.set(snapshot);
                bothReadTheOldVersion.await(5, TimeUnit.SECONDS);
                return Optional.of(snapshot);
            }
            if (name.equals("incrementVersion")) {
                committed.incrementAndGet();
                return 1;
            }
            return invocation.getMethod().isDefault()
                    ? invocation.callRealMethod()
                    : Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        SysMessageKeyRepository keys = mock(SysMessageKeyRepository.class);
        when(keys.findById(anyString())).thenAnswer(call ->
                Optional.of(SysMessageKey.created(call.getArgument(0))));
        SysMessageRepository values = mock(SysMessageRepository.class);
        when(values.findByMsgKey(anyString())).thenReturn(List.of());
        ConfigLookup configs = mock(ConfigLookup.class);
        when(configs.get(MessageProps.class))
                .thenReturn(new MessageProps(List.of("ko"), "ko", "ko", 30));
        MessageAdminService service = new MessageAdminService(
                keys, values, versions, mock(MessageService.class), configs, Clock.systemUTC());

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> save(service, "first", committed, transactionSnapshot));
            var second = executor.submit(() -> save(service, "second", committed, transactionSnapshot));
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);
        }

        assertThat(committed.get()).isEqualTo(3L);
    }

    /** 저장소의 읽기-수정은 각 트랜잭션 사본을 커밋하고, DB 원자 증가는 사본 없이 반영된다. */
    private static void save(
            MessageAdminService service, String key, AtomicLong committed,
            ThreadLocal<SysCacheVersion> transactionSnapshot) {
        service.save(List.of(new MessageSaveRow(
                RowState.U, key, List.of(new MessageValue("ko", key)))));
        SysCacheVersion snapshot = transactionSnapshot.get();
        if (snapshot != null) {
            committed.set(snapshot.getVersion());
        }
        transactionSnapshot.remove();
    }
}
