package com.aiagent.support.config;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.bind.BindException;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.bind.PlaceholdersResolver;
import org.springframework.boot.context.properties.bind.PropertySourcesPlaceholdersResolver;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.context.properties.bind.validation.ValidationBindHandler;
import org.springframework.boot.context.properties.source.ConfigurationPropertySource;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.validation.Validator;

/**
 * {@code yml} 위에 {@code SYS_CONFIG} 를 덮어 <b>다시 바인딩한다</b> — sys/config.md.
 *
 * <pre>
 * 기동   : yml → @ConfigurationProperties 바인딩 → 검증        ← SYS_CONFIG 가 없다
 * 런타임 : 여기가 그 위에 SYS_CONFIG 를 덮어 다시 바인딩        ← 유틸만 안다
 * </pre>
 *
 * <p><b>층이 둘이면 메커니즘도 둘이다.</b> 섞지 않으니 각 층에 따로 물을 수 있다 —
 * {@code Environment} 는 손대지 않으므로 {@code yml} 누락이 <b>DB 행에 가려지지 않는다</b>.
 *
 * <p><b>덮는 순서가 이 클래스의 전부다.</b> 오버라이드 소스를 <b>맨 앞</b>에 둔다 —
 * 환경변수가 같은 키를 가져도 화면에서 바꾼 값이 이긴다. 근거는 <i>프로퍼티 소스 순서</i>
 * 가 아니라 <b>여기가 마지막에 덮는다</b> 는 것이며, <b>순서로 지켜야 했을 것을 구조가
 * 지킨다</b>(sys/config.md).
 *
 * <p><b>검증이 딸려 온다.</b> {@link ValidationBindHandler} 를 함께 태우므로 sys/code.md 의
 * <i>"제약의 단일 원본은 바인딩 객체"</i> 가 <b>저장 경로뿐 아니라 읽기 경로에서도</b>
 * 저절로 지켜진다 — 대가는 화면을 안 거친 값이 검증을 만나는 것이고, 그것이 이 설계가
 * 원한 바다.
 *
 * <p>쓰는 곳이 둘이다 — {@link ConfigLookup}(읽기, 한 클래스씩 lazy)과
 * {@link ConfigValidator}(저장 검증, 전 클래스). <b>같은 문을 지나야</b> 저장이 통과시킨
 * 값을 읽기가 거부하는 일이 없다.
 */
@Component
public class ConfigBinder {

    private final Environment environment;
    private final Validator validator;

    public ConfigBinder(Environment environment, Validator validator) {
        this.environment = environment;
        this.validator = validator;
    }

    /**
     * props 클래스 하나를 오버라이드를 얹어 만든다.
     *
     * <p><b>바인딩 실패를 기본값으로 덮지 않는다.</b> {@code yml} 키 누락은 기동 실패여야
     * 하고(sys/code.md), 런타임 재바인딩 실패는 <b>예외여야 한다</b> — 그 키만 {@code yml} 로
     * 되돌리면 <b>화면은 {@code 변경됨} 이라 말하는데 동작은 기본값</b>인, sys/config.md 이
     * 닫으려는 바로 그 실패가 된다(§3).
     *
     * @param overrides {@code CFG_KEY → CFG_VAL}. 루트({@code sys-config.})가 붙지 않은 키다
     */
    public <T> T bind(Class<T> type, Map<String, String> overrides) {
        String prefix = ConfigCatalog.prefixOf(type);
        return binderWith(overrides)
                .bind(prefix, Bindable.of(type), new ValidationBindHandler(validator))
                .orElseThrow(() -> new IllegalStateException(
                        "설정 접두사 '" + prefix + "' 아래에 값이 없다 — application.yml 을 확인한다"));
    }

    /**
     * 실패를 <b>키 단위</b>로 편다 — 저장 경로가 그 키로 셀을 칠한다(frontend/grid.md).
     *
     * <p>{@code Binder} 는 실패를 {@code BindException} 으로 싸고 그 안에 원인이 들어 있다.
     * 둘을 가른다 — <b>검증 실패</b>는 어느 필드인지 알고, <b>변환 실패</b>는 어느 프로퍼티
     * 인지 안다. 어느 쪽도 아니면 접두사 전체에 붙인다: <b>붙일 자리를 못 찾았다고 실패를
     * 삼키면</b> 화면이 통과한 줄 안다.
     */
    public static List<ConfigViolation> translate(String prefix, RuntimeException error) {
        String base = keyOf(prefix);

        /*
          <b>검증 실패를 먼저 찾는다 — 사슬 전체에서.</b>

          {@code Binder} 는 언제나 {@code BindException} 으로 싸므로, 한 번 도는 동안 둘을
          함께 보면 <b>바깥의 BindException 이 늘 먼저 걸린다.</b> 그러면 키가 그 클래스의
          접두사({@code auth.password})가 되어 <b>어느 칸인지 알 수 없고</b>, 문구도
          *"Binding validation errors on …"* 이라는 <b>내부 설명</b>이 나간다(2026-08-30 실물).
        */
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof BindValidationException validation) {
                return fromValidation(base, validation);
            }
        }
        // 변환 실패(타입이 안 맞는다) — 이쪽은 프로퍼티 이름을 예외가 들고 있다.
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof BindException bind && bind.getName() != null) {
                return List.of(new ConfigViolation(
                        keyOf(bind.getName().toString()), messageOf(bind)));
            }
        }
        return List.of(new ConfigViolation(base, messageOf(error)));
    }

    // ── 바인더 ───────────────────────────────────────────────────────

    private Binder binderWith(Map<String, String> overrides) {
        Map<String, Object> prefixed = new LinkedHashMap<>();
        overrides.forEach((key, value) -> prefixed.put(ConfigCatalog.ROOT + key, value));

        List<ConfigurationPropertySource> sources = new ArrayList<>();
        // 맨 앞이다 — 유틸이 마지막에 덮는다는 말이 목록에서는 첫 자리다.
        sources.add(new MapConfigurationPropertySource(prefixed));
        ConfigurationPropertySources.get(environment).forEach(sources::add);

        PlaceholdersResolver placeholders = new PropertySourcesPlaceholdersResolver(environment);
        return new Binder(sources, placeholders);
    }

    // ── 실패 → 키와 문구 ─────────────────────────────────────────────

    private static List<ConfigViolation> fromValidation(
            String prefixBase, BindValidationException error) {
        /*
          <b>실패가 말하는 이름을 쓴다.</b> 중첩 객체({@code auth.password.reset})는 그
          객체 이름으로 검증되므로 필드가 {@code tryLimit} 하나로 온다 — 바깥 클래스의
          접두사에 붙이면 {@code auth.password.try-limit} 이라는 <b>없는 키</b>가 된다.
        */
        var name = error.getValidationErrors().getName();
        String base = name == null ? prefixBase : keyOf(name.toString());

        List<ConfigViolation> violations = new ArrayList<>();
        for (ObjectError objectError : error.getValidationErrors().getAllErrors()) {
            // 필드가 없는 것은 객체 전체의 제약이다 — 상호 제약이 그렇게 온다(sys/code.md).
            String key = objectError instanceof FieldError field
                    ? base + "." + kebabPath(field.getField())
                    : base;
            violations.add(new ConfigViolation(key, objectError.getDefaultMessage()));
        }
        return violations;
    }

    /** {@code sys-config.auth.password.min-length} → {@code auth.password.min-length}. */
    private static String keyOf(String propertyName) {
        return propertyName.startsWith(ConfigCatalog.ROOT)
                ? propertyName.substring(ConfigCatalog.ROOT.length())
                : propertyName;
    }

    /** {@code reset.tryLimit} → {@code reset.try-limit} — 화면이 아는 표기로 되돌린다. */
    private static String kebabPath(String field) {
        String[] segments = field.split("\\.");
        StringBuilder path = new StringBuilder();
        for (String segment : segments) {
            if (!path.isEmpty()) {
                path.append('.');
            }
            path.append(ConfigCatalog.kebab(segment));
        }
        return path.toString();
    }

    /**
     * 문구는 <b>가장 안쪽 원인</b>의 것이다.
     *
     * <p>바깥은 {@code "Failed to bind properties under …"} 라 어느 값이 왜 안 되는지 말하지
     * 않는다. 사용자가 고칠 것은 안쪽에 적혀 있다 — <i>"For input string: abc"</i> 같은 것이다.
     */
    private static String messageOf(Throwable error) {
        Throwable deepest = error;
        while (deepest.getCause() != null) {
            deepest = deepest.getCause();
        }
        String message = deepest.getMessage();
        return message == null || message.isBlank() ? "값을 읽을 수 없습니다" : message;
    }
}
