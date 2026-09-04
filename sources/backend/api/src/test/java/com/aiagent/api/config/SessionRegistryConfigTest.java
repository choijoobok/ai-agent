package com.aiagent.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.session.SessionRegistryImpl;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.MapSession;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.security.SpringSessionBackedSessionRegistry;

/**
 * 세션 레지스트리가 <b>무엇 위에 서는가</b> — backend/security.md · backend/session.md.
 *
 * <p><b>조용한 폴백이 이 테스트의 이유다.</b> Spring Session 의 Redis 구현은 둘이고
 * {@link FindByIndexNameSessionRepository} 를 가진 것은 하나인데,
 * {@code spring.session.data.redis.repository-type} 의 <b>기본값이 인덱스 없는 쪽</b>이다.
 * 스토어를 Redis 로 바꾸기만 하면 레지스트리가 {@link SessionRegistryImpl}(JVM 힙의 맵)로
 * 떨어지고, <b>동시 접속 제어가 다중화에서 무력해진다</b>.
 *
 * <p>그 실패는 <b>배포에서만</b> 드러나고 증상이 *"계정당 1세션인데 두 곳에서 로그인된다"*
 * 라 원인을 짐작하기 어렵다. 그래서 빌드에서 잡는다 — 원칙 P1.
 *
 * <p><b>세 갈래를 다 고정한다.</b> 가운데 하나만 적으면 나머지 둘이 어느 쪽으로 움직여도
 * 조용하다.
 */
class SessionRegistryConfigTest {

    private final SecurityConfig config = new SecurityConfig();

    @Test
    @DisplayName("인덱스가 있으면 스토어를 직접 묻는 레지스트리를 쓴다 — 노드가 둘이어도 같은 답이다")
    void indexedStoreBacksTheRegistry() {
        SessionRegistry registry = config.sessionRegistry(provider(new IndexedStore()), provider(null));

        assertThat(registry).isInstanceOf(SpringSessionBackedSessionRegistry.class);
    }

    @Test
    @DisplayName("스토어가 아예 없으면 빈 레지스트리다 — 컨테이너 세션은 선택된 동작이다")
    void noStoreFallsBackToTheHeapRegistry() {
        SessionRegistry registry = config.sessionRegistry(provider(null), provider(null));

        assertThat(registry).isInstanceOf(SessionRegistryImpl.class);
    }

    /**
     * <b>이 한 줄이 2026-08-30 에 바뀐 것이다.</b> 이전에는 여기서도 {@link SessionRegistryImpl}
     * 로 떨어졌다 — 스토어를 골라 놓고 인덱스가 없는 것은 <i>고르다 만 상태</i> 이지 선택이
     * 아니다.
     *
     * <p>문구에 <b>고치는 방법이 들어 있는지</b>도 함께 본다. 기동을 죽이면서 무엇을 켜야
     * 하는지 말하지 않으면, 그것은 조용한 폴백을 시끄러운 폴백으로 바꾼 것일 뿐이다.
     */
    @Test
    @DisplayName("스토어는 있는데 인덱스가 없으면 기동을 실패시킨다 — 무제한인 채로 도는 것보다 낫다")
    void storeWithoutIndexFailsStartup() {
        assertThatThrownBy(() -> config.sessionRegistry(provider(null), provider(new PlainStore())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("principal 인덱스가 없다")
                .hasMessageContaining("repository-type: indexed");
    }

    /** {@code getIfAvailable()} 하나만 쓰므로 그것만 답하는 최소 구현이다. */
    private static <T> ObjectProvider<T> provider(T value) {
        return new ObjectProvider<>() {
            @Override
            public T getIfAvailable() {
                return value;
            }

            @Override
            public T getObject() {
                return value;
            }
        };
    }

    /** 인덱스가 없는 스토어 — {@code RedisSessionRepository} 가 이 모양이다. */
    private static final class PlainStore implements SessionRepository<MapSession> {
        @Override
        public MapSession createSession() {
            return new MapSession();
        }

        @Override
        public void save(MapSession session) {}

        @Override
        public MapSession findById(String id) {
            return null;
        }

        @Override
        public void deleteById(String id) {}
    }

    /** 인덱스가 있는 스토어 — {@code JdbcIndexedSessionRepository} · {@code RedisIndexedSessionRepository}. */
    private static final class IndexedStore implements FindByIndexNameSessionRepository<MapSession> {
        @Override
        public java.util.Map<String, MapSession> findByIndexNameAndIndexValue(String name, String value) {
            return java.util.Map.of();
        }

        @Override
        public MapSession createSession() {
            return new MapSession();
        }

        @Override
        public void save(MapSession session) {}

        @Override
        public MapSession findById(String id) {
            return null;
        }

        @Override
        public void deleteById(String id) {}
    }

    /** 컴파일이 깨지면 테스트가 거짓이 된다 — {@link Session} 이 여전히 그 자리인지 붙잡아 둔다. */
    @SuppressWarnings("unused")
    private static final Class<? extends Session> PINNED = MapSession.class;
}
