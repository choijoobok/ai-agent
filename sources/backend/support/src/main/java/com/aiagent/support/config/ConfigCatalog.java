package com.aiagent.support.config;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.RecordComponent;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.configurationmetadata.ConfigurationMetadataProperty;
import org.springframework.boot.configurationmetadata.ConfigurationMetadataRepository;
import org.springframework.boot.configurationmetadata.ConfigurationMetadataRepositoryJsonBuilder;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.env.Environment;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Component;

/**
 * 설정 키의 <b>왼쪽 테이블</b> — screen/config/requirements.md. {@code yml} 이 정한 키 목록이 여기서 나온다.
 *
 * <p><b>등록 목록을 관리하지 않는다.</b> props 클래스는 빈으로 등록되지 않으므로
 * (sys/config.md) {@code getBeansWithAnnotation} 이 아무것도 돌려주지 않는다 —
 * <b>애노테이션 스캔</b>이며 그래서 <b>빠뜨릴 목록이 없다.</b>
 *
 * <p><b>인스턴스를 만들지 않는다.</b> 층이 셋이던 판은 기본값을 읽으려고
 * {@code new AuthLoginProps()} 를 만들었고 그 때문에 JavaBean 바인딩을 강제해야 했다.
 * 층이 둘이 되면서 그 제약이 통째로 사라진다 — 이 클래스에게 props 클래스는 <b>이름과
 * 타입을 얻는 수단</b>일 뿐이라 {@code record} 로 써도 된다(screen/config/requirements.md).
 *
 * <p><b>셋의 원천이 셋이다.</b>
 *
 * <table><caption></caption>
 * <tr><td>키·유형</td><td>애노테이션 스캔 + 필드 타입</td></tr>
 * <tr><td>설명</td><td>{@code META-INF/spring-configuration-metadata.json}(필드 Javadoc)</td></tr>
 * <tr><td>기본값</td><td>{@code Environment} 유효값</td></tr>
 * </table>
 *
 * <p><b>메타데이터의 {@code defaultValue} 는 쓰지 않는다</b> — 기본값의 원천은 {@code yml}
 * 하나이고(sys/code.md), 프로세서의 추출은 best-effort 이며 <b>프로필을 반영하지 못한다</b>.
 *
 * <p><b>기동 때 한 번 만들고 그대로 둔다.</b> 셋 다 기동 중에 바뀌지 않는다 —
 * 클래스패스도, 빌드 산출물도, {@code Environment} 도 그렇다. 런타임에 바뀌는 것은
 * {@code SYS_CONFIG} 뿐이고 그것은 이 클래스의 것이 아니다(아우터 조인의 오른쪽이다).
 */
@Component
public class ConfigCatalog {

    private static final Logger log = LoggerFactory.getLogger(ConfigCatalog.class);

    /**
     * 시스템 설정의 루트 — sys/code.md · sys/config.md.
     *
     * <p>이 루트가 <b>범위를 확정한다</b>. {@code app.*} 은 기동 시 구조를 정하는 <b>배포
     * 설정</b>이라 런타임에 바꿔도 반영될 자리가 없고, 그래서 이 화면에 나타나지 않는다.
     */
    public static final String ROOT = "sys-config.";

    /** 스캔의 뿌리. 우리 패키지 밖의 {@code @ConfigurationProperties} 는 우리 것이 아니다. */
    private static final String BASE_PACKAGE = "com.aiagent";

    private static final Pattern CAMEL_BOUNDARY = Pattern.compile("([a-z0-9])([A-Z])");

    /** Javadoc 표기를 걷어낸다 — {@code MessageSeedTask.clean} 과 같은 규칙이다(seed.md). */
    private static final Pattern JAVADOC_TAG = Pattern.compile("\\{@\\w+\\s+([^}]*)}");

    private static final Pattern HTML_TAG = Pattern.compile("</?[a-zA-Z]+>");

    private final List<ConfigKey> keys;
    private final List<Class<?>> propsClasses;

    public ConfigCatalog(Environment environment) {
        this.propsClasses = List.copyOf(scanPropsClasses());
        Map<String, String> descriptions = readMetadata();
        this.keys = List.copyOf(build(propsClasses, descriptions, environment));
        log.info("시스템 설정 키 {}개 — props 클래스 {}개", keys.size(), propsClasses.size());
    }

    /** 키 목록. <b>키 오름차순</b>이며 이것이 화면의 기본 정렬이다(screen/config/requirements.md). */
    public List<ConfigKey> keys() {
        return keys;
    }

    /**
     * 재바인딩의 대상 — {@code sys-config.} 아래의 props 클래스 전부.
     *
     * <p>저장 검증이 이것을 돈다(screen/config/requirements.md). 여기 없는 클래스는 이 화면이 건드릴 수 없다.
     */
    public List<Class<?>> propsClasses() {
        return propsClasses;
    }

    // ── 애노테이션 스캔 ─────────────────────────────────────────────

    /**
     * {@code sys-config.} 로 시작하는 접두사를 가진 클래스만.
     *
     * <p>{@code false} 는 <b>기본 필터를 쓰지 않는다</b>는 뜻이다 — {@code @Component}
     * 계열을 함께 주워 오면 우리가 찾는 것이 묻힌다.
     */
    private static List<Class<?>> scanPropsClasses() {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(ConfigurationProperties.class));

        List<Class<?>> found = new ArrayList<>();
        for (var definition : scanner.findCandidateComponents(BASE_PACKAGE)) {
            String className = definition.getBeanClassName();
            if (className == null) {
                continue;
            }
            Class<?> type = load(className);
            if (prefixOf(type).startsWith(ROOT)) {
                found.add(type);
            }
        }
        found.sort(java.util.Comparator.comparing(ConfigCatalog::prefixOf));
        return found;
    }

    private static Class<?> load(String className) {
        try {
            return Class.forName(className, false, ConfigCatalog.class.getClassLoader());
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("스캔이 찾은 클래스를 읽지 못했다 — " + className, e);
        }
    }

    /** {@code prefix} 와 {@code value} 는 별칭이다 — 둘 중 채워진 쪽을 쓴다. */
    public static String prefixOf(Class<?> type) {
        ConfigurationProperties meta = type.getAnnotation(ConfigurationProperties.class);
        if (meta == null) {
            throw new IllegalStateException(
                    type.getName() + " 에 @ConfigurationProperties 가 없다 — 접두사를 알 수 없다");
        }
        return meta.prefix().isEmpty() ? meta.value() : meta.prefix();
    }

    // ── 키 만들기 ───────────────────────────────────────────────────

    private static List<ConfigKey> build(
            List<Class<?>> propsClasses, Map<String, String> descriptions, Environment environment) {

        Binder binder = Binder.get(environment);
        List<ConfigKey> result = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        for (Class<?> type : propsClasses) {
            // 루트를 뺀 나머지가 CFG_KEY 다 — sys/code.md · sys/config.md.
            String base = prefixOf(type).substring(ROOT.length());
            collect(type, base, descriptions, binder, result, seen, 0);
        }
        result.sort(java.util.Comparator.comparing(ConfigKey::key));
        return result;
    }

    /**
     * 중첩 객체는 <b>재귀</b>한다 — {@code auth.password.reset.try-limit} 이 그것이다.
     *
     * <p>{@code depth} 는 순환 방어다. 프로퍼티 객체가 자기 자신을 품는 일은 없어야 하지만,
     * 있으면 <b>기동이 스택 오버플로로 죽는다</b> — 원인을 말하는 예외가 낫다.
     */
    private static void collect(
            Class<?> type,
            String base,
            Map<String, String> descriptions,
            Binder binder,
            List<ConfigKey> result,
            Set<String> seen,
            int depth) {

        if (depth > 5) {
            throw new IllegalStateException("설정 프로퍼티 중첩이 너무 깊다 — " + base);
        }
        for (var member : membersOf(type)) {
            String key = base + "." + kebab(member.name());
            ConfigValueType valueType = ConfigValueType.of(member.type());

            if (valueType == null) {
                // 컬렉션·맵은 목록에 내지 않는다(screen/config/requirements.md). 우리 패키지의 객체는 펴 낸다.
                if (isNested(member.type())) {
                    collect(member.type(), key, descriptions, binder, result, seen, depth + 1);
                }
                continue;
            }
            if (!seen.add(key)) {
                throw new IllegalStateException("설정 키가 둘이다 — " + key);
            }
            result.add(new ConfigKey(
                    key,
                    valueType,
                    descriptions.get(ROOT + key),
                    defaultOf(binder, ROOT + key)));
        }
    }

    /**
     * 이 클래스가 보는 <b>멤버</b> — {@code record} 면 컴포넌트, 아니면 인스턴스 필드다.
     *
     * <p>둘을 다 받는 이유는 <b>props 클래스의 모양을 이 화면이 정하지 않기</b> 때문이다.
     * 지금은 전부 {@code record} 지만 그것은 우연이고, 여기서 강제하면 이 화면이 남의
     * 선언 형태를 구속하게 된다.
     */
    private static List<Member> membersOf(Class<?> type) {
        if (type.isRecord()) {
            List<Member> members = new ArrayList<>();
            for (RecordComponent component : type.getRecordComponents()) {
                members.add(new Member(component.getName(), component.getType()));
            }
            return members;
        }
        List<Member> members = new ArrayList<>();
        for (var field : type.getDeclaredFields()) {
            if (java.lang.reflect.Modifier.isStatic(field.getModifiers()) || field.isSynthetic()) {
                continue;
            }
            members.add(new Member(field.getName(), field.getType()));
        }
        return members;
    }

    private record Member(String name, Class<?> type) {}

    private static boolean isNested(Class<?> type) {
        return type.getName().startsWith(BASE_PACKAGE);
    }

    /**
     * {@code Binder} 로 읽는다 — <b>완화 바인딩이 필요하다</b>.
     *
     * <p>{@code Environment.getProperty} 는 정확한 이름만 본다. 배포가 환경변수
     * ({@code SYS_CONFIG_AUTH_LOGIN_FAIL_LIMIT})로 덮은 값이 <b>기본값 컬럼에서 사라지면</b>
     * 화면이 배포가 정한 값을 말하지 못한다(screen/config/requirements.md).
     */
    private static String defaultOf(Binder binder, String fullKey) {
        return binder.bind(fullKey, Bindable.of(String.class)).orElse(null);
    }

    /** {@code camelCase → kebab-case} — 완화 바인딩의 <b>정규 표기</b>다(screen/config/requirements.md). */
    static String kebab(String name) {
        return CAMEL_BOUNDARY.matcher(name).replaceAll("$1-$2").toLowerCase(java.util.Locale.ROOT);
    }

    // ── 설명(빌드 산출물) ───────────────────────────────────────────

    /**
     * {@code META-INF/spring-configuration-metadata.json} — screen/config/requirements.md.
     *
     * <p><b>여러 개일 수 있다.</b> 모듈마다 하나씩 나오므로 {@code classpath*:} 로 전부
     * 읽어 합친다.
     *
     * <p><b>없어도 죽지 않는다.</b> 프로세서가 빠지면 설명만 비고 목록은 그대로다 —
     * 키 목록의 원천이 여기가 아니라 애노테이션 스캔이기 때문이며, 그것이 둘을 가른 값이다.
     *
     * <p><b>전용 라이브러리로 읽는다.</b> {@code JsonParserFactory} 는 클래스패스에 있는
     * 파서를 고르므로 <b>Jackson 이 있는 곳에서만 맞는다</b> — 없으면 기본 파서로 떨어지고
     * 이 파일을 잘못 읽는다(2026-08-30 실측). 배포에는 Jackson 이 있어 <b>테스트에서만
     * 틀렸고</b>, 그런 어긋남은 검사가 검사하지 못한다는 뜻이라 가장 나쁘다.
     */
    private static Map<String, String> readMetadata() {
        Map<String, String> descriptions = new HashMap<>();
        var resolver = new PathMatchingResourcePatternResolver(ConfigCatalog.class.getClassLoader());
        Resource[] resources;
        try {
            resources = resolver.getResources("classpath*:META-INF/spring-configuration-metadata.json");
        } catch (IOException e) {
            log.warn("설정 메타데이터를 찾지 못했다 — 설명 컬럼이 빈다", e);
            return descriptions;
        }
        for (Resource resource : resources) {
            readInto(resource, descriptions);
        }
        if (descriptions.isEmpty()) {
            log.warn("설정 메타데이터가 비었다 — spring-boot-configuration-processor 가 붙었는지 본다(screen/config/requirements.md)");
        }
        return descriptions;
    }

    private static void readInto(Resource resource, Map<String, String> descriptions) {
        try (InputStream in = resource.getInputStream()) {
            ConfigurationMetadataRepository repository =
                    ConfigurationMetadataRepositoryJsonBuilder.create(in).build();
            for (ConfigurationMetadataProperty property : repository.getAllProperties().values()) {
                String text = property.getDescription();
                if (text != null && !text.isBlank()) {
                    descriptions.put(property.getId(), clean(text));
                }
            }
        } catch (IOException | RuntimeException e) {
            // 설명이 비는 것은 화면이 견딘다. 여기서 던지면 기동이 설명 때문에 죽는다.
            log.warn("설정 메타데이터를 읽지 못했다 — {}", resource, e);
        }
    }

    /**
     * Javadoc 표기를 걷어내고 한 줄로 만든다.
     *
     * <p>{@code {@code x}} 와 {@code <b>} 를 그대로 두면 <b>그리드 셀에 마크업이 보인다</b>.
     * 화면이 걷어내게 두지 않는 것은, 그러면 같은 규칙이 프론트에도 생기기 때문이다.
     */
    private static String clean(String doc) {
        String text = JAVADOC_TAG.matcher(doc).replaceAll("$1");
        text = HTML_TAG.matcher(text).replaceAll("");
        return text.replaceAll("\\s+", " ").strip();
    }
}
