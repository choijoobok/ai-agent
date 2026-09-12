package com.aiagent.domain.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.domain.message.repository.SysMessageRepository;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MessageProps;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * 메시지 조회 — sys/code.md.
 *
 * <p>여기서 지키는 것은 셋이다. <b>폴백이 한 방향인가</b>(요청 언어 → 기본 언어 → 부르는
 * 쪽), <b>번들에 서버 전용 문구가 섞이지 않는가</b>(backend/packages.md), 그리고 <b>캐시가 실제로
 * DB 를 아끼는가</b>.
 *
 * <p>마지막 것을 세는 이유는 <b>캐시가 조용히 꺼져도 화면이 똑같기</b> 때문이다 — 값은
 * 맞는데 매 요청 전건 조회가 도는 상태를 눈으로는 알 수 없다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MessageServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-29T00:00:00Z");

    @Mock private SysMessageRepository messages;
    @Mock private ConfigLookup configs;

    private MutableClock clock;
    private MessageService service;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(NOW);
        given(30);
    }

    @Test
    @DisplayName("요청 언어의 값이 있으면 그것을 낸다")
    void requestedLanguageWins() {
        givenRows(
                row("login.title", "ko", "백오피스 로그인", MessageScope.FRONT),
                row("login.title", "en", "Backoffice Sign-in", MessageScope.FRONT));

        assertThat(service.text("login.title", "en")).isEqualTo("Backoffice Sign-in");
    }

    @Test
    @DisplayName("TC-5053 요청 언어에 값이 없으면 기본 언어로 폴백한다")
    void fallsBackToDefaultLanguage() {
        givenRows(row("login.title", "ko", "백오피스 로그인", MessageScope.FRONT));

        assertThat(service.text("login.title", "en")).isEqualTo("백오피스 로그인");
    }

    @Test
    @DisplayName("TC-5053 어느 언어에도 없으면 키를 그대로 낸다")
    void missingKeyShowsItself() {
        givenRows();

        assertThat(service.text("login.title", "ko")).isEqualTo("login.title");
    }

    @Test
    @DisplayName("find 는 마지막 수단을 정하지 않는다 — 에러 응답의 폴백은 키가 아니다")
    void findLeavesTheLastResortToTheCaller() {
        givenRows();

        // 여기서 키를 돌려주면 ErrorMessages 가 defaultMessage() 로 갈 기회를 잃는다.
        assertThat(service.find("err.login.failed", "ko")).isEmpty();
    }

    @Test
    @DisplayName("번들은 프론트가 쓰는 것만 담는다 — 에러 문구는 서버가 완성한다(backend/packages.md)")
    void bundleExcludesServerOnlyKeys() {
        givenRows(
                row("login.title", "ko", "백오피스 로그인", MessageScope.FRONT),
                row("menu.SYSTEM", "ko", "시스템", MessageScope.DATA),
                row("common.cancel", "ko", "취소", MessageScope.BOTH),
                row("err.login.failed", "ko", "아이디 또는 비밀번호가 올바르지 않습니다.", MessageScope.BACK));

        assertThat(service.bundle("ko"))
                .containsOnlyKeys("login.title", "menu.SYSTEM", "common.cancel");
    }

    @Test
    @DisplayName("BACK 키도 text 로는 읽힌다 — 번들에서 빠지는 것이지 없는 것이 아니다")
    void serverOnlyKeysAreStillResolvable() {
        givenRows(row("err.internal", "ko", "처리 중 오류가 발생했습니다.", MessageScope.BACK));

        assertThat(service.text("err.internal", "ko")).isEqualTo("처리 중 오류가 발생했습니다.");
        assertThat(service.bundle("ko")).isEmpty();
    }

    @Test
    @DisplayName("요청 언어가 기본 언어와 같으면 IN 절 원소가 하나다 — 자기 자신과 겨루지 않는다")
    void doesNotQueryTheSameLanguageTwice() {
        givenRows(row("login.title", "ko", "백오피스 로그인", MessageScope.FRONT));

        service.text("login.title", "ko");

        assertThat(capturedLangs()).containsExactly("ko");
    }

    @Test
    @DisplayName("TC-5055 저장 노드는 즉시 갱신하고 다른 노드는 TTL까지 기존 번들을 유지한다")
    void cacheEvictionIsLocalToTheSavingNode() {
        givenRows(row("login.title", "ko", "이전 문구", MessageScope.FRONT));
        MessageService otherNode = new MessageService(messages, configs, clock);

        assertThat(service.text("login.title", "ko")).isEqualTo("이전 문구");
        assertThat(otherNode.text("login.title", "ko")).isEqualTo("이전 문구");

        givenRows(row("login.title", "ko", "새 문구", MessageScope.FRONT));
        service.evict();

        assertThat(service.text("login.title", "ko")).isEqualTo("새 문구");
        assertThat(otherNode.text("login.title", "ko")).isEqualTo("이전 문구");
    }

    @Nested
    @DisplayName("캐시")
    class Cache {

        @Test
        @DisplayName("TTL 안에서는 다시 읽지 않는다")
        void servesFromSnapshotWithinTtl() {
            givenRows(row("login.title", "ko", "백오피스 로그인", MessageScope.FRONT));

            service.text("login.title", "ko");
            clock.advance(Duration.ofMinutes(29));
            service.text("login.title", "ko");

            verify(messages, times(1)).findRows(any());
        }

        @Test
        @DisplayName("TTL 이 지나면 다시 읽는다 — 메시지를 고친 것이 언젠가는 반영돼야 한다")
        void reloadsAfterTtl() {
            givenRows(row("login.title", "ko", "백오피스 로그인", MessageScope.FRONT));

            service.text("login.title", "ko");
            clock.advance(Duration.ofMinutes(31));
            service.text("login.title", "ko");

            verify(messages, times(2)).findRows(any());
        }

        @Test
        @DisplayName("TTL 이 0 이면 매번 읽는다 — 개발용 스위치가 실제로 꺼져 있어야 한다")
        void zeroTtlDisablesTheCache() {
            given(0);
            givenRows(row("login.title", "ko", "백오피스 로그인", MessageScope.FRONT));

            service.text("login.title", "ko");
            service.text("login.title", "ko");

            verify(messages, times(2)).findRows(any());
        }

        @Test
        @DisplayName("언어마다 따로 담는다 — 하나를 읽었다고 다른 언어가 채워지지 않는다")
        void snapshotsArePerLanguage() {
            givenRows(row("login.title", "ko", "백오피스 로그인", MessageScope.FRONT));

            service.text("login.title", "ko");
            service.text("login.title", "en");

            verify(messages, times(2)).findRows(any());
        }

        @Test
        @DisplayName("evict 하면 다음 조회가 다시 읽는다 — 관리 화면의 저장이 부를 자리다")
        void evictForcesReload() {
            givenRows(row("login.title", "ko", "백오피스 로그인", MessageScope.FRONT));

            service.text("login.title", "ko");
            service.evict();
            service.text("login.title", "ko");

            verify(messages, times(2)).findRows(any());
        }

        @Test
        @DisplayName("한 번도 안 부르면 조회도 없다 — 기동만으로 전건을 읽지 않는다")
        void loadsLazily() {
            verify(messages, never()).findRows(any());
        }
    }

    // ── 도우미 ──────────────────────────────────────────────────────

    private void given(int cacheTtlMinutes) {
        when(configs.get(MessageProps.class))
                .thenReturn(new MessageProps(List.of("ko", "en"), "ko", "en", cacheTtlMinutes));
        service = new MessageService(messages, configs, clock);
    }

    private void givenRows(MessageRow... rows) {
        when(messages.findRows(any())).thenReturn(List.of(rows));
    }

    private static MessageRow row(String key, String lang, String value, MessageScope scope) {
        return new MessageRow(key, lang, value, scope);
    }

    @SuppressWarnings("unchecked")
    private Collection<String> capturedLangs() {
        ArgumentCaptor<Collection<String>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(messages).findRows(captor.capture());
        return captor.getValue();
    }

    /** TTL 을 실제 시간으로 재면 테스트가 30분을 기다린다. */
    private static final class MutableClock extends Clock {

        private Instant now;

        private MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration amount) {
            now = now.plus(amount);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }
}
