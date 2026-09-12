package com.aiagent.domain.message.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.grid.RowState;
import com.aiagent.domain.message.entity.SysCacheVersion;
import com.aiagent.domain.message.entity.SysMessage;
import com.aiagent.domain.message.entity.SysMessageKey;
import com.aiagent.domain.message.repository.SysCacheVersionRepository;
import com.aiagent.domain.message.repository.SysMessageKeyRepository;
import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MessageProps;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

/**
 * 저장이 세 상태를 무엇으로 옮기는가 — screen/admin/system/message/requirements.md.
 *
 * <p><b>여기서 지키는 것 셋이다.</b> ① 키 생성은 시드 생성기만 하고 API의 {@code C} 행은
 * 거부한다, ② 빈 값은 <b>행 삭제</b>이지 빈 문자열 저장이 아니다, ③ 캐시 버전은 <b>저장 한
 * 번에 +1</b> 이다.
 *
 * <p>②가 특히 조용히 깨진다 — 빈 문자열을 넣어도 저장은 성공하고, 그 뒤에 sys/code.md 의
 * 폴백이 <b>기본 언어로 가지 않고 빈 화면을 낸다.</b>
 */
class MessageAdminServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-29T00:00:00Z");

    private SysMessageKeyRepository keys;
    private SysMessageRepository values;
    private SysCacheVersionRepository versions;
    private MessageService messages;
    private MessageAdminService service;

    @BeforeEach
    void setUp() {
        keys = mock(SysMessageKeyRepository.class);
        values = mock(SysMessageRepository.class);
        versions = mock(SysCacheVersionRepository.class);
        messages = mock(MessageService.class);

        ConfigLookup configs = mock(ConfigLookup.class);
        when(configs.get(MessageProps.class))
                .thenReturn(new MessageProps(List.of("ko", "en"), "ko", "en", 30));

        when(values.findByMsgKey(anyString())).thenReturn(List.of());
        when(versions.findById(SysCacheVersion.MESSAGE)).thenReturn(Optional.empty());

        service = new MessageAdminService(
                keys, values, versions, messages, configs, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static MessageSaveRow row(RowState state, String key, MessageValue... given) {
        return new MessageSaveRow(state, key, List.of(given));
    }

    private void existing(String key) {
        when(keys.findById(key)).thenReturn(Optional.of(SysMessageKey.created(key)));
    }

    @Nested
    @DisplayName("키 생성 차단")
    class Create {

        @Test
        @DisplayName("TC-5052 관리 화면은 임의 메시지 키를 만들 수 없다")
        void arbitraryNewKeyIsRejected() {
            assertThatThrownBy(() -> service.save(List.of(
                            row(RowState.C, "invented.key", new MessageValue("ko", "임의 값")))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(MessageErrorCode.KEY_CREATE_FORBIDDEN);

            existing("seeded.key");
            assertThatThrownBy(() -> service.save(List.of(
                            row(RowState.C, "seeded.key", new MessageValue("ko", "우회 값")))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(MessageErrorCode.KEY_CREATE_FORBIDDEN);

            verify(keys, never()).save(any(SysMessageKey.class));
            verify(values, never()).save(any(SysMessage.class));
            verify(versions, never()).save(any(SysCacheVersion.class));
            verify(messages, never()).evict();
        }
    }

    @Nested
    @DisplayName("수정과 삭제")
    class UpdateAndDelete {

        @Test
        @DisplayName("값을 비우면 그 언어의 행을 지운다 — 빈 문자열을 저장하지 않는다")
        void emptyValueDeletesTheRow() {
            existing("a.b");
            SysMessage current = SysMessage.of("a.b", "ko", "가");
            when(values.findByMsgKey("a.b")).thenReturn(List.of(current));

            service.save(List.of(row(RowState.U, "a.b", new MessageValue("ko", null))));

            verify(values).delete(current);
        }

        @Test
        @DisplayName("삭제는 값 → 키 순서다 — 반대면 FK 가 거부한다")
        void deletesValuesBeforeKey() {
            existing("a.b");

            service.save(List.of(row(RowState.D, "a.b")));

            // 순서를 단언한다 — 둘 다 불렸는지만 보면 뒤집혀도 통과하고, 실패는 배포에서 난다.
            InOrder order = inOrder(values, keys);
            order.verify(values).deleteByMsgKey("a.b");
            order.verify(keys).delete(any(SysMessageKey.class));
        }

        @Test
        @DisplayName("없는 키의 수정·삭제는 거부한다 — 다른 사람이 먼저 지웠다")
        void missingKeyIsRejected() {
            when(keys.findById("gone")).thenReturn(Optional.empty());

            for (RowState state : new RowState[] {RowState.U, RowState.D}) {
                assertThatThrownBy(() -> service.save(List.of(row(state, "gone"))))
                        .isInstanceOf(BusinessException.class)
                        .extracting(error -> ((BusinessException) error).errorCode())
                        .isEqualTo(MessageErrorCode.KEY_MISSING);
            }
        }

        @Test
        @DisplayName("지원하지 않는 언어는 거부한다 — 목록은 서버가 갖는다")
        void unknownLanguageIsRejected() {
            existing("a.b");

            assertThatThrownBy(() -> service.save(
                            List.of(row(RowState.U, "a.b", new MessageValue("ja", "あ")))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(MessageErrorCode.LANG_UNKNOWN);
        }
    }

    @Nested
    @DisplayName("캐시")
    class Cache {

        @Test
        @DisplayName("TC-5051 저장 한 번의 메시지 버전은 정확히 +1 이다")
        void versionBumpsOncePerSave() {
            SysCacheVersion version = SysCacheVersion.started(SysCacheVersion.MESSAGE, NOW);
            when(versions.findById(SysCacheVersion.MESSAGE)).thenReturn(Optional.of(version));
            existing("a.b");
            existing("c.d");
            existing("e.f");

            service.save(List.of(
                    row(RowState.U, "a.b", new MessageValue("ko", "가")),
                    row(RowState.U, "c.d", new MessageValue("ko", "나")),
                    row(RowState.U, "e.f", new MessageValue("ko", "다"))));

            // 행마다 올리면 저장 한 번에 버전이 셋 뛰고, 그 수를 진단에 쓸 수 있다고 착각한다.
            assertThat(version.getVersion()).isEqualTo(2L);
        }

        @Test
        @DisplayName("표에 이름이 없으면 만든다 — 시드가 없어도 저장이 죽지 않는다")
        void createsVersionRowWhenMissing() {
            existing("a.b");
            service.save(List.of(row(RowState.U, "a.b", new MessageValue("ko", "가"))));

            verify(versions).save(any(SysCacheVersion.class));
        }

        @Test
        @DisplayName("저장이 끝나면 백엔드 캐시를 비운다 — 안 비우면 TTL 만큼 옛 문구가 나간다")
        void evictsAfterSave() {
            existing("a.b");
            service.save(List.of(row(RowState.U, "a.b", new MessageValue("ko", "가"))));

            verify(messages).evict();
        }

        @Test
        @DisplayName("거부된 저장은 버전을 올리지 않는다 — 전 사용자의 번들이 헛되이 무효가 된다")
        void rejectedSaveDoesNotBump() {
            assertThatThrownBy(() -> service.save(List.of(row(RowState.C, "invented.key"))))
                    .isInstanceOf(BusinessException.class);

            verify(versions, never()).save(any(SysCacheVersion.class));
            verify(messages, never()).evict();
        }
    }
}
