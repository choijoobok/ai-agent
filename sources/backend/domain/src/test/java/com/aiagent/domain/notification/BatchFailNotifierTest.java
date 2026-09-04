package com.aiagent.domain.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.domain.authz.repository.SysUserRoleRepository;
import com.aiagent.domain.batch.BatchResultCode;
import com.aiagent.domain.batch.repository.SysScheduleBatchRepository;
import com.aiagent.domain.notification.producer.BatchFailNotifier;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.NotiPolicyProps;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 배치 실패 알림 — BATCH-06 · 65 §3.11 · 66 §6.2.
 *
 * <p>지키는 것 셋이다 — ① <b>무엇이 실패인가</b>(유령을 포함하고 건너뜀·중단을 뺀다),
 * ② <b>역할을 비우면 보내지 않는가</b>, ③ <b>이동 링크에 <i>받는 쪽이 기대하는 값</i>이
 * 실리는가</b>(실행 번호가 아니라 배치 ID 다).
 *
 * <p>①이 조용히 틀리기 쉽다. {@code SKIP_LOCK} 은 <b>설계대로 안 돈 것</b>이라 알리면
 * 다른 노드가 잡을 때마다 알림이 나가고, 그 소음이 진짜 실패를 덮는다.
 */
class BatchFailNotifierTest {

    private NotificationSender notifications;
    private SysUserRoleRepository userRoles;
    private BatchFailNotifier notifier;

    @BeforeEach
    void setUp() {
        notifications = mock(NotificationSender.class);
        userRoles = mock(SysUserRoleRepository.class);
        SysScheduleBatchRepository batches = mock(SysScheduleBatchRepository.class);
        ConfigLookup configs = mock(ConfigLookup.class);

        when(configs.get(NotiPolicyProps.class)).thenReturn(new NotiPolicyProps("ADMIN", 7));
        when(userRoles.findUserIdsByRoleId("ADMIN")).thenReturn(List.of("admin", "mgr1"));
        // 등록이 지워진 뒤 남은 이력이다 — 이름을 못 찾아도 알림은 나가야 한다.
        when(batches.findById(anyString())).thenReturn(Optional.empty());

        notifier = new BatchFailNotifier(notifications, userRoles, batches, configs);
    }

    @Test
    @DisplayName("실패와 유령만 알린다 — 건너뜀·중단·성공은 아니다")
    void onlyFailuresAreNotified() {
        assertThat(BatchFailNotifier.isFailure(BatchResultCode.FAIL)).isTrue();
        // 프로세스가 죽어 결과를 못 적은 실행이다 — 운영에서 실패보다 나쁘다(65 §4.4).
        assertThat(BatchFailNotifier.isFailure(BatchResultCode.LOST)).isTrue();

        assertThat(BatchFailNotifier.isFailure(BatchResultCode.SUCCESS)).isFalse();
        // 다른 노드가 잡았다 — 설계대로다(31 §7). 알리면 그 소음이 진짜 실패를 덮는다.
        assertThat(BatchFailNotifier.isFailure(BatchResultCode.SKIP_LOCK)).isFalse();
        assertThat(BatchFailNotifier.isFailure(BatchResultCode.SKIP_COOLDOWN)).isFalse();
        // 사람이 멈춘 것이다 — 멈춘 사람이 이미 안다.
        assertThat(BatchFailNotifier.isFailure(BatchResultCode.CANCELED)).isFalse();
        assertThat(BatchFailNotifier.isFailure(BatchResultCode.RUNNING)).isFalse();
    }

    @Test
    @DisplayName("역할 보유자 전원에게 가고 이동 링크에 배치 ID 가 실린다")
    void everyoneInTheRoleGetsALinkToTheBatch() {
        notifier.notifyFailure(77L, "RETENTION_PURGE", BatchResultCode.FAIL, "커넥션이 끊겼다");

        verify(notifications)
                .sendAll(
                        eq(List.of("admin", "mgr1")),
                        eq(NotiType.BATCH),
                        // 이름을 못 찾았으므로 ID 가 그대로 제목에 남는다.
                        eq("배치가 실패했습니다 — RETENTION_PURGE"),
                        eq("커넥션이 끊겼다"),
                        eq("BATCH_HISTORY"),
                        /*
                          **실행 번호(77)가 아니라 배치 ID 다.** 넘겨주기 채널은 화면당 값
                          하나이고 무엇인지 모르는 문자열이며, BATCH_HISTORY 의 그 자리는
                          이미 배치 ID 가 쓰고 있다(65 §4.7). 실행 번호를 넣으면 받는 화면이
                          그것을 배치 ID 로 읽어 0건을 보인다 — 열리기는 하는데 아무 데도
                          가 있지 않은, 가장 헷갈리는 실패다.
                        */
                        eq("RETENTION_PURGE"));
    }

    @Test
    @DisplayName("역할을 비우면 보내지 않는다 — 끈 것이지 빠뜨린 것이 아니다")
    void anEmptyRoleTurnsItOff() {
        ConfigLookup configs = mock(ConfigLookup.class);
        when(configs.get(NotiPolicyProps.class)).thenReturn(new NotiPolicyProps("  ", 7));

        new BatchFailNotifier(
                        notifications, userRoles, mock(SysScheduleBatchRepository.class), configs)
                .notifyFailure(1L, "ANY", BatchResultCode.FAIL, "무엇이든");

        verify(notifications, never())
                .sendAll(anyList(), any(), anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("보유자가 없으면 조용히 넘어가지 않는다 — 오타가 그렇게 보인다")
    void nobodyInTheRoleIsNotSilent() {
        when(userRoles.findUserIdsByRoleId("ADMIN")).thenReturn(List.of());

        notifier.notifyFailure(1L, "ANY", BatchResultCode.LOST, "노드가 사라졌다");

        /*
          로그를 검증하지는 않는다 — 여기서 확인하는 것은 **빈 목록으로 보내지 않는다**
          이며, 사람에게 알리는 것은 서버 로그의 WARN 이다(구현이 그것을 찍는다).
          없는 역할을 적는 오타는 배치가 실패할 때까지 드러나지 않으므로, 드러나야 할
          그 순간에 또 조용하면 안 된다.
        */
        verify(notifications, never())
                .sendAll(anyList(), any(), anyString(), anyString(), any(), any());
    }
}
