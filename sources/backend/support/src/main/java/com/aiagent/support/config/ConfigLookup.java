package com.aiagent.support.config;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * 시스템 설정 조회 — sys/code.md · sys/config.md.
 *
 * <pre>
 * configs.get(AuthLoginProps.class).failLimit()   // call site 에 문자열 키가 없다
 * </pre>
 *
 * <p><b>props 클래스를 빈으로 등록하지 않는다.</b> 등록하면 {@code @Autowired} 로 직접
 * 주입할 수 있게 되고, 그러면 아래의 {@code SYS_CONFIG} 오버레이를 우회하는 경로가 생긴다
 * — 화면은 {@code 변경됨} 이라 말하는데 동작은 {@code yml} 값인 그 실패다(sys/config.md).
 * 여기서 직접 바인딩하므로 주입 시도는 기동에서 죽는다.
 *
 * <h2>층이 둘이고 메커니즘도 둘이다</h2>
 *
 * <pre>
 * 기동   : yml → @ConfigurationProperties 바인딩 → 검증        ← SYS_CONFIG 가 없다
 * 런타임 : 여기가 그 위에 SYS_CONFIG 를 덮어 다시 바인딩        ← 유틸만 안다
 * </pre>
 *
 * <p>{@code SYS_CONFIG} 를 프로퍼티 소스로 두지 않았다. 두면 <b>읽는 시점이 기동 한 번</b>
 * 이라 MASTER-08 의 런타임 변경이 성립하지 않고, 두 층이 하나의 {@code Environment} 에
 * 섞여 <b>어느 층에서 온 값인지 물을 수 없게</b> 된다(sys/config.md).
 *
 * <h2>경계는 요청이 아니라 <b>작업</b>이다</h2>
 *
 * <p>한 덩어리 일 안에서 값이 바뀌면 안 된다 — 배치가 10만 건을 도는 도중에 바뀌어도 같은
 * 사고다(backend/caching.md · sys/config.md). 그래서 경계의 이름이 <b>작업(unit-of-work)</b> 이며
 * 요청은 그 한 종류다.
 *
 * <p>조회는 <b>작업당 {@code SELECT * FROM SYS_CONFIG} 한 번</b>이고, 그 안에서는 어느
 * 키·어느 클래스든 쿼리가 없다. <b>재바인딩도 lazy 다</b> — 그 작업이 실제로 만진 클래스만
 * 다시 만든다. 안 쓰는 값 때문에 죽을 이유가 없고, <b>전량 검사는 기동이 한다</b>.
 *
 * <p><b>경계 밖 호출은 예외로 죽인다.</b> 조용히 임시 스냅샷을 뜨면 루프 안에서 부를 때
 * 매번 조회하고 <b>매번 값이 다를 수 있다</b> — backend/caching.md 이 막으려던 사고가 그대로
 * 되돌아온다. 대신 {@link #inNewSnapshot} 을 공개해 기동 검사·테스트가 경계를 직접 연다.
 *
 * <h2>{@code sys-config.} 밖은 경계를 요구하지 않는다</h2>
 *
 * <p>{@code app.security.*} · {@code app.logging.*} 은 <b>배포 설정</b>이다(sys/code.md) —
 * 기동 시 필터 체인이나 {@code DataSource} 의 모양을 정하므로 런타임에 바꿔도 반영될 자리가
 * 없고, 그래서 관리 화면에도 나오지 않는다. <b>덮을 층이 없으므로 스냅샷도 필요 없다</b> —
 * 요구하면 {@code SecurityConfig} 처럼 <b>기동 중에 읽는 정상 호출</b>이 전부 죽는다.
 */
@Component
public class ConfigLookup {

    private final ConfigBinder binder;
    private final ConfigOverrideSource overrides;

    /**
     * 배포 설정({@code sys-config.} 밖)의 캐시.
     *
     * <p>덮을 층이 없어 <b>기동 중에 값이 정해지고 그대로다</b> — 작업마다 다시 만들 이유가
     * 없다. {@code sys-config.} 아래는 여기 오지 않는다: 그쪽 캐시는 스냅샷이 갖는다.
     */
    private final Map<Class<?>, Object> deployment = new ConcurrentHashMap<>();

    /**
     * 지금 열려 있는 작업의 스냅샷.
     *
     * <p><b>{@code InheritableThreadLocal} 이 아니다.</b> 자식 스레드가 부모의 것을 <i>가리키게</i>
     * 두면 부모 작업이 먼저 끝나도 자식이 계속 쓰게 되고, 그것은 backend/crosscutting.md 가 금지한
     * <b>살아 있는 객체의 전파</b>다. 비동기는 <b>복사</b>해 물려받는다 — 그 배선은
     * {@code @Async} 데코레이터가 생기는 슬라이스의 것이다.
     */
    private static final ThreadLocal<Snapshot> CURRENT = new ThreadLocal<>();

    public ConfigLookup(ConfigBinder binder, ConfigOverrideSource overrides) {
        this.binder = binder;
        this.overrides = overrides;
    }

    /**
     * 설정 객체 하나 — <b>call site 에 문자열 키가 없다</b>.
     *
     * <p>{@code sys-config.} 아래면 <b>열린 작업 안에서만</b> 부를 수 있다.
     */
    @SuppressWarnings("unchecked")
    public <T> T get(Class<T> type) {
        if (!ConfigCatalog.prefixOf(type).startsWith(ConfigCatalog.ROOT)) {
            // 배포 설정 — 덮을 층이 없다. yml 그대로이며 경계를 묻지 않는다.
            return (T) deployment.computeIfAbsent(type, key -> binder.bind(key, Map.of()));
        }
        Snapshot snapshot = CURRENT.get();
        if (snapshot == null) {
            throw new IllegalStateException(
                    "작업 경계 밖에서 설정을 읽었다 — " + type.getSimpleName()
                            + ". 요청·비동기·스케줄러 밖이라면 configs.inNewSnapshot(…) 으로 직접 연다"
                            + " (sys/config.md)");
        }
        return snapshot.get(type);
    }

    /**
     * 작업 경계를 <b>직접 연다</b> — 기동 검사와 테스트의 자리다(sys/config.md).
     *
     * <p>요청 필터·{@code @Async} 데코레이터·스케줄러 래퍼는 <b>MDC 가 이미 붙는 자리</b>
     * (backend/crosscutting.md)에서 이것을 부른다. <b>새 자리를 만들지 않는다.</b>
     *
     * <p><b>중첩은 바깥을 지킨다.</b> 이미 열려 있으면 새로 뜨지 않고 그대로 쓴다 — 한
     * 작업 안에서 값이 갈리면 이 클래스가 지키려는 것이 무너진다.
     */
    public <T> T inNewSnapshot(Supplier<T> work) {
        if (CURRENT.get() != null) {
            return work.get();
        }
        CURRENT.set(new Snapshot(binder, overrides));
        try {
            return work.get();
        } finally {
            // 스레드 풀이 돌려 쓰므로 반드시 지운다 — 남으면 다음 요청이 남의 값을 본다.
            CURRENT.remove();
        }
    }

    /** 돌려줄 것이 없는 작업. */
    public void inNewSnapshot(Runnable work) {
        inNewSnapshot(() -> {
            work.run();
            return null;
        });
    }

    /**
     * 한 작업의 값 묶음 — <b>불변으로 굳는다</b>.
     *
     * <p>{@code SYS_CONFIG} 조회는 <b>첫 요청에서 한 번</b>이다. 아무 설정도 읽지 않는
     * 작업(정적 리소스·헬스체크)은 그 쿼리도 치지 않는다 — 경계를 여는 것 자체는 값싸야
     * 한다.
     */
    private static final class Snapshot {

        private final ConfigBinder binder;
        private final ConfigOverrideSource source;
        private final Map<Class<?>, Object> bound = new HashMap<>();
        private Map<String, String> overrides;

        private Snapshot(ConfigBinder binder, ConfigOverrideSource source) {
            this.binder = binder;
            this.source = source;
        }

        /** 한 작업은 한 스레드다 — 동기화하지 않는다. */
        @SuppressWarnings("unchecked")
        <T> T get(Class<T> type) {
            Object cached = bound.get(type);
            if (cached == null) {
                cached = binder.bind(type, overrides());
                bound.put(type, cached);
            }
            return (T) cached;
        }

        private Map<String, String> overrides() {
            if (overrides == null) {
                overrides = Map.copyOf(source.load());
            }
            return overrides;
        }
    }
}
