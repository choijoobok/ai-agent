package com.aiagent.support.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiagent.support.config.props.AuthLoginProps;
import com.aiagent.support.config.props.ConcurrentSessionProps;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

/**
 * 작업 스코프 스냅샷 — ADR-0026 §2 · ADR-0017 §3.
 *
 * <p><b>여기서 지키는 것 넷이다.</b> ① {@code SYS_CONFIG} 가 {@code yml} 을 덮는다,
 * ② 조회는 <b>작업당 한 번</b>이고 그 안에서는 값이 바뀌지 않는다, ③ 경계 밖 호출은
 * <b>예외</b>다, ④ 배포 설정({@code sys-config.} 밖)은 경계를 요구하지 않는다.
 *
 * <p>②가 이 클래스의 존재 이유다 — 작업 도중에 다른 사람이 값을 바꿔도 <b>그 작업은 끝까지
 * 옛 값</b>이어야 한다. 매번 읽으면 10만 건을 도는 배치가 <b>앞뒤로 다른 규칙</b>을 쓴다.
 *
 * <p>④를 빠뜨리면 조용히 깨지지 않고 <b>시끄럽게</b> 깨진다 — {@code SecurityConfig} 가
 * 기동 중에 {@code ConcurrentSessionProps} 를 읽으므로 애플리케이션이 뜨지 않는다.
 */
class ConfigLookupTest {

    /** 부른 횟수를 센다 — <i>"작업당 한 번"</i> 은 세어 보지 않으면 확인할 수 없다. */
    private static final class CountingSource implements ConfigOverrideSource {
        private final Map<String, String> values = new HashMap<>();
        private final AtomicInteger calls = new AtomicInteger();

        @Override
        public Map<String, String> load() {
            calls.incrementAndGet();
            return Map.copyOf(values);
        }
    }

    private CountingSource source;
    private ConfigLookup configs;

    @BeforeEach
    void setUp() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("sys-config.auth.login.fail-limit", "5");
        environment.setProperty("sys-config.auth.login.lock-release-minutes", "30");
        environment.setProperty("sys-config.auth.login.deny-empty-authority", "true");
        environment.setProperty("app.security.concurrent-session.enabled", "true");
        environment.setProperty("app.security.concurrent-session.max-sessions", "1");
        environment.setProperty("app.security.concurrent-session.prevent-login", "false");

        LocalValidatorFactoryBean beanValidator = new LocalValidatorFactoryBean();
        beanValidator.afterPropertiesSet();

        source = new CountingSource();
        configs = new ConfigLookup(new ConfigBinder(environment, beanValidator), source);
    }

    @Nested
    @DisplayName("오버레이")
    class Overlay {

        @Test
        @DisplayName("오버라이드가 없으면 yml 값이다")
        void 없으면_yml() {
            int limit = configs.inNewSnapshot(() -> configs.get(AuthLoginProps.class).failLimit());

            assertThat(limit).isEqualTo(5);
        }

        /**
         * <b>순서로 지켜야 했을 것을 구조가 지킨다</b>(ADR-0026 §1). 환경변수가 같은 키를
         * 가져도 화면에서 바꾼 값이 이기는 것은 <i>프로퍼티 소스 순서</i> 때문이 아니라
         * <b>유틸이 마지막에 덮기</b> 때문이다.
         */
        @Test
        @DisplayName("SYS_CONFIG 행이 있으면 그 값이 이긴다 — 이것이 없으면 화면이 거짓말을 한다")
        void 있으면_DB가_이긴다() {
            source.values.put("auth.login.fail-limit", "3");

            int limit = configs.inNewSnapshot(() -> configs.get(AuthLoginProps.class).failLimit());

            assertThat(limit).isEqualTo(3);
        }

        @Test
        @DisplayName("덮은 키만 바뀐다 — 나머지는 yml 그대로다")
        void 덮은_키만() {
            source.values.put("auth.login.fail-limit", "3");

            var props = configs.inNewSnapshot(() -> configs.get(AuthLoginProps.class));

            assertThat(props.failLimit()).isEqualTo(3);
            assertThat(props.lockReleaseMinutes()).isEqualTo(30);
        }

        /**
         * <b>재바인딩이 {@code @Validated} 를 다시 돌린다.</b> 화면을 안 거친 값(SQL 직접
         * 수정)이 검증을 만나는 자리이며, <b>그 키만 {@code yml} 로 조용히 되돌리지 않는다</b>
         * — 그러면 화면은 {@code 변경됨} 이라 말하는데 동작은 기본값이다(ADR-0026 §3).
         */
        @Test
        @DisplayName("규칙을 어긴 행은 예외다 — yml 로 조용히 폴백하지 않는다")
        void 잘못된_행은_예외() {
            source.values.put("auth.login.fail-limit", "-1");

            assertThatThrownBy(() -> configs.inNewSnapshot(() -> configs.get(AuthLoginProps.class)))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("작업 스코프")
    class Scope {

        @Test
        @DisplayName("작업당 조회 한 번이다 — 같은 클래스를 여러 번 읽어도 그대로다")
        void 조회는_한_번() {
            configs.inNewSnapshot(() -> {
                configs.get(AuthLoginProps.class);
                configs.get(AuthLoginProps.class);
                configs.get(AuthLoginProps.class);
            });

            assertThat(source.calls).hasValue(1);
        }

        @Test
        @DisplayName("설정을 안 읽는 작업은 조회도 하지 않는다 — 경계를 여는 것은 값싸야 한다")
        void 안_읽으면_조회도_없다() {
            configs.inNewSnapshot(() -> { /* 정적 리소스·헬스체크가 이렇다 */ });

            assertThat(source.calls).hasValue(0);
        }

        /**
         * ADR-0017 §3 이 원한 일관성이 이것이다. <b>오래 도는 작업이 낡은 값에 묶이는 것은
         * 버그가 아니라 의도</b>이며, 반영하려면 작업을 다시 돌린다.
         */
        @Test
        @DisplayName("작업 도중에 바뀌어도 그 작업은 끝까지 옛 값이다")
        void 도중에_바뀌어도_그대로() {
            Integer[] seen = new Integer[2];
            configs.inNewSnapshot(() -> {
                seen[0] = configs.get(AuthLoginProps.class).failLimit();
                source.values.put("auth.login.fail-limit", "3");   // 다른 사람이 저장했다
                seen[1] = configs.get(AuthLoginProps.class).failLimit();
            });

            assertThat(seen).containsExactly(5, 5);
        }

        @Test
        @DisplayName("다음 작업부터 새 값이다")
        void 다음_작업은_새_값() {
            configs.inNewSnapshot(() -> configs.get(AuthLoginProps.class));
            source.values.put("auth.login.fail-limit", "3");

            int limit = configs.inNewSnapshot(() -> configs.get(AuthLoginProps.class).failLimit());

            assertThat(limit).isEqualTo(3);
        }

        @Test
        @DisplayName("중첩은 바깥을 지킨다 — 한 작업 안에서 값이 갈리면 안 된다")
        void 중첩은_바깥을_지킨다() {
            source.values.put("auth.login.fail-limit", "5");

            int inner = configs.inNewSnapshot(() -> {
                configs.get(AuthLoginProps.class);
                source.values.put("auth.login.fail-limit", "3");
                return configs.inNewSnapshot(() -> configs.get(AuthLoginProps.class).failLimit());
            });

            assertThat(inner).isEqualTo(5);
            assertThat(source.calls).hasValue(1);
        }

        @Test
        @DisplayName("작업이 끝나면 스코프도 닫힌다 — 스레드 풀이 돌려 쓴다")
        void 끝나면_닫힌다() {
            configs.inNewSnapshot(() -> configs.get(AuthLoginProps.class));

            assertThatThrownBy(() -> configs.get(AuthLoginProps.class))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("작업이 예외로 끝나도 닫힌다")
        void 예외여도_닫힌다() {
            assertThatThrownBy(() -> configs.inNewSnapshot(() -> {
                throw new IllegalArgumentException("업무 실패");
            })).isInstanceOf(IllegalArgumentException.class);

            assertThatThrownBy(() -> configs.get(AuthLoginProps.class))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("경계 밖")
    class OutsideScope {

        /**
         * <b>조용히 임시 스냅샷을 뜨지 않는다.</b> 루프 안에서 부르면 매번 조회하고
         * <b>매번 값이 다를 수 있다</b> — ADR-0017 §3 이 막으려던 사고가 되돌아온다.
         */
        @Test
        @DisplayName("sys-config 아래를 경계 밖에서 읽으면 예외다 — 열라고 말한다")
        void 경계_밖은_예외() {
            assertThatThrownBy(() -> configs.get(AuthLoginProps.class))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("inNewSnapshot");

            assertThat(source.calls).hasValue(0);
        }

        /**
         * <b>배포 설정에는 덮을 층이 없다</b>(43 §6.1) — 기동 시 필터 체인의 모양을 정하므로
         * 런타임에 바꿔도 반영될 자리가 없고 관리 화면에도 나오지 않는다. 경계를 요구하면
         * {@code SecurityConfig} 가 기동 중에 읽는 정상 호출이 죽는다.
         */
        @Test
        @DisplayName("app.* 은 경계 없이 읽힌다 — 기동 중에 읽는 것이 정상이다")
        void 배포_설정은_경계가_없다() {
            var props = configs.get(ConcurrentSessionProps.class);

            assertThat(props.maxSessions()).isEqualTo(1);
            // 덮을 층이 없으므로 DB 를 보지 않는다.
            assertThat(source.calls).hasValue(0);
        }
    }
}
