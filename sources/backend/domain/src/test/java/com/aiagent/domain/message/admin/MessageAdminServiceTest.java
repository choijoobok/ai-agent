package com.aiagent.domain.message.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.grid.RowState;
import com.aiagent.domain.message.MessageScope;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

/**
 * 저장이 세 상태를 무엇으로 옮기는가 — screen/code/requirements.md.
 *
 * <p><b>여기서 지키는 것 셋이다.</b> ① 화면이 {@code USE_SCOPE} 를 정하지 못한다(시드의
 * 소유다), ② 빈 값은 <b>행 삭제</b>이지 빈 문자열 저장이 아니다, ③ 캐시 버전은 <b>저장 한
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
        when(keys.existsById(key)).thenReturn(true);
        when(keys.findById(key)).thenReturn(Optional.of(SysMessageKey.created(key)));
    }

    @Nested
    @DisplayName("추가")
    class Create {

        @Test
        @DisplayName("화면이 만든 키는 미사용이다 — 사용처를 받을 경로가 없다")
        void newKeyIsUnused() {
            service.save(List.of(row(RowState.C, "a.b", new MessageValue("ko", "가"))));

            ArgumentCaptor<SysMessageKey> saved = ArgumentCaptor.forClass(SysMessageKey.class);
            verify(keys).save(saved.capture());
            assertThat(saved.getValue().getUseScope()).isEqualTo(MessageScope.NONE);
        }

        @Test
        @DisplayName("값이 있는 언어만 행을 만든다 — 빈 행을 만들면 세 번째 상태가 생긴다")
        void onlyFilledLanguagesGetRows() {
            service.save(List.of(row(
                    RowState.C, "a.b", new MessageValue("ko", "가"), new MessageValue("en", null))));

            verify(values, times(1)).save(any(SysMessage.class));
        }

        @Test
        @DisplayName("공백만 있는 값은 비어 있는 것이다 — Oracle 에서는 '' 가 곧 NULL 이다")
        void blankIsEmpty() {
            service.save(List.of(row(RowState.C, "a.b", new MessageValue("ko", "   "))));

            verify(values, never()).save(any(SysMessage.class));
        }

        @Test
        @DisplayName("이미 있는 키는 거부한다 — 현재 페이지 밖은 화면이 모른다")
        void duplicateKeyIsRejected() {
            existing("a.b");

            assertThatThrownBy(() -> service.save(List.of(row(RowState.C, "a.b"))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(MessageErrorCode.KEY_DUPLICATE);
        }

        @Test
        @DisplayName("같은 요청 안의 중복도 거부한다 — 두 번째의 존재 확인이 첫 번째를 못 본다")
        void duplicateWithinOneRequest() {
            assertThatThrownBy(() -> service.save(List.of(
                            row(RowState.C, "a.b", new MessageValue("ko", "가")),
                            row(RowState.C, "a.b", new MessageValue("ko", "나")))))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(MessageErrorCode.KEY_DUPLICATE);
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
        @DisplayName("버전은 저장 한 번에 +1 이다 — 행 수만큼 올리지 않는다")
        void versionBumpsOncePerSave() {
            SysCacheVersion version = SysCacheVersion.started(SysCacheVersion.MESSAGE, NOW);
            when(versions.findById(SysCacheVersion.MESSAGE)).thenReturn(Optional.of(version));

            service.save(List.of(
                    row(RowState.C, "a.b", new MessageValue("ko", "가")),
                    row(RowState.C, "c.d", new MessageValue("ko", "나")),
                    row(RowState.C, "e.f", new MessageValue("ko", "다"))));

            // 행마다 올리면 저장 한 번에 버전이 셋 뛰고, 그 수를 진단에 쓸 수 있다고 착각한다.
            assertThat(version.getVersion()).isEqualTo(2L);
        }

        @Test
        @DisplayName("표에 이름이 없으면 만든다 — 시드가 없어도 저장이 죽지 않는다")
        void createsVersionRowWhenMissing() {
            service.save(List.of(row(RowState.C, "a.b", new MessageValue("ko", "가"))));

            verify(versions).save(any(SysCacheVersion.class));
        }

        @Test
        @DisplayName("저장이 끝나면 백엔드 캐시를 비운다 — 안 비우면 TTL 만큼 옛 문구가 나간다")
        void evictsAfterSave() {
            service.save(List.of(row(RowState.C, "a.b", new MessageValue("ko", "가"))));

            verify(messages).evict();
        }

        @Test
        @DisplayName("거부된 저장은 버전을 올리지 않는다 — 전 사용자의 번들이 헛되이 무효가 된다")
        void rejectedSaveDoesNotBump() {
            existing("a.b");

            assertThatThrownBy(() -> service.save(List.of(row(RowState.C, "a.b"))))
                    .isInstanceOf(BusinessException.class);

            verify(versions, never()).save(any(SysCacheVersion.class));
            verify(messages, never()).evict();
        }
    }
}
