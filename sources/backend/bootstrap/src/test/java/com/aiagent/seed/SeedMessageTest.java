package com.aiagent.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.message.MsgKey;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 메시지 키가 실제로 한 곳에서 나오는가 — sys/message.md.
 *
 * <p>ADR 은 <i>"키는 전역 상수다 — 리터럴을 금지한다"</i> 로 정하고 그 집행을 <b>ESLint 와
 * ArchUnit</b> 에 맡겼다. 프론트는 ESLint 가 {@code label()} 에 리터럴을 넘기는 것을 막는다.
 * <b>백엔드에서 키가 새는 경로는 하나뿐이다</b> — {@link ErrorCode#code()} 이며, 그것이 이
 * 클래스의 첫 번째 검사다. ArchUnit 의 규칙 문법으로는 상수 <i>값</i>을 볼 수 없어 클래스
 * 목록만 그것으로 얻고 값은 리플렉션으로 읽는다.
 *
 * <p>나머지는 <b>시드가 스스로와 맞는가</b>이다. 키만 있고 값이 없는 채로 템플릿이 배포되면
 * 갓 설치한 화면이 {@code menu.SYSTEM} 처럼 키 문자열로 뒤덮인다 — 관리 화면조차 그 상태라
 * 고칠 수도 없다.
 */
class SeedMessageTest {

    private static final Path DATA = SeedRows.CHANGELOG.resolve("data");

    private static final String GENERATED_KEYS = "008-init-message-key.csv";

    /**
     * 값 시드는 <b>파일 하나가 아니다.</b> 사람 소유 시드는 기존 changeset 을 손대지 않고
     * 파일을 더하므로(backend/persistence.md) {@code 009} · {@code 010} · … 으로 늘어난다.
     *
     * <p><b>이름을 고정해 두면 다음 파일이 검사 밖으로 나간다</b> — 값을 넣었는데 아래 검사가
     * 여전히 실패하거나, 더 나쁘게는 <b>넣지 않았는데 통과</b>한다. 패턴으로 모은다.
     */
    private static final Pattern VALUE_SEED = Pattern.compile("[0-9]{3}-init-message[.]csv");

    /**
     * <b>데이터 키 시드도 파일 하나가 아니다</b>(2026-08-29 — 실제로 걸렸다).
     *
     * <p>{@code 009} 하나로 못 박아 두었더니 언어 이름({@code code.LANG_CD.*})을 담은
     * {@code 019} 가 검사 밖으로 나갔고, 그 값들이 <b>키 없는 행</b>으로 잡혀 아래 검사가
     * 실패했다 — 시드는 옳았는데 게이트가 틀렸다. 바로 위 {@code VALUE_SEED} 가 같은 이유로
     * 패턴인데, 짝이 되는 이쪽만 이름이었다.
     *
     * <p>{@code 008} 은 여기 걸리지 않는다 — 이름이 {@code -message-key} 로 같지만 그쪽은
     * <b>생성물</b>이고 소유자가 다르다(sys/message.md). 아래에서 걸러 낸다.
     */
    private static final Pattern DATA_KEY_SEED =
            Pattern.compile("[0-9]{3}-init-message-key[.]csv");

    @Nested
    @DisplayName("키의 원본")
    class KeyDeclaration {

        @Test
        @DisplayName("모든 ErrorCode 의 code() 가 MsgKey 에 선언돼 있다 — 리터럴로 새는 경로를 막는다")
        void everyErrorCodeIsDeclared() {
            Set<String> declared = declaredKeys();
            List<String> undeclared = errorCodes().stream()
                    .map(ErrorCode::code)
                    .filter(code -> !declared.contains(code))
                    .toList();

            // 새면 조용하다 — 응답은 정상이고, 그 키만 SYS_MESSAGE_KEY 에 행이 없어
            // 관리 화면에 나타나지 않는다. 번역할 방법이 없다는 사실을 아무도 모른다.
            assertThat(undeclared)
.as("MsgKey 에 상수를 추가하고 ErrorCode 가 그것을 참조하게 한다 — sys/message.md")
                    .isEmpty();
        }

        @Test
        @DisplayName("ErrorCode 구현을 실제로 찾았다 — 0건이면 위 검사가 공허하게 통과한다")
        void errorCodesWereFound() {
            assertThat(errorCodes()).hasSizeGreaterThan(10);
        }
    }

    @Nested
    @DisplayName("생성 시드")
    class GeneratedSeed {

        @Test
        @DisplayName("MsgKey 의 모든 상수가 시드에 있다 — generateMessageSeed 를 잊으면 여기서 막힌다")
        void everyBackendKeyIsSeeded() {
            assertThat(keysOf(GENERATED_KEYS)).containsAll(declaredKeys());
        }

        @Test
        @DisplayName("데이터가 만드는 키는 생성 시드에 없다 — 있으면 전부 죽은 키로 잡힌다")
        void dataKeysStayOut() {
            // menu.* · code.* 는 소스 상수가 아니라 데이터에서 조립된 키다(sys/code.md).
            // generateMessageSeed 가 이 접두를 건드리면 소스에서 못 찾아 NONE 을 쓴다.
            assertThat(keysOf(GENERATED_KEYS))
                    .noneMatch(key -> key.startsWith("menu.") || key.startsWith("code."));
        }

        @Test
        @DisplayName("사용처가 다섯 중 하나다 — 오타 난 값은 조회가 그 자리에서 죽는다")
        void scopeIsOneOfFive() {
            assertThat(rowsOf(GENERATED_KEYS).stream().map(row -> row.get(1)))
                    .isSubsetOf("FRONT", "BACK", "BOTH", "DATA", "NONE");
        }
    }

    @Nested
    @DisplayName("값 시드")
    class ValueSeed {

        /**
         * <b>템플릿은 값 없는 키를 내보내지 않는다.</b> sys/code.md 이 <i>"없으면 키를 그대로"</i>
         * 로 정한 것은 <b>운영 중 빠뜨림</b>을 드러내기 위한 것이지, 설치 직후의 정상 상태가
         * 아니다.
         *
         * <p>새 키를 추가한 사람이 여기서 막히면 할 일은 둘 중 하나다 — 값 시드에 행을 넣거나,
         * 그 키가 이 템플릿의 것이 아니라면 자기 프로젝트의 값 시드 파일을 더한다(backend/persistence.md).
         */
        @Test
        @DisplayName("시드가 만든 키는 ko 와 en 값을 함께 갖는다 — ")
        void everySeededKeyHasBothLanguages() {
            Set<String> keys = new LinkedHashSet<>(keysOf(GENERATED_KEYS));
            keys.addAll(dataKeys());

            Map<String, Set<String>> languages = valueRows().stream()
                    .collect(Collectors.groupingBy(
                            row -> row.get(0),
                            Collectors.mapping(row -> row.get(1), Collectors.toSet())));

            List<String> incomplete = keys.stream()
                    .filter(key -> !languages.getOrDefault(key, Set.of()).containsAll(Set.of("ko", "en")))
                    .toList();

            assertThat(incomplete).as("값 시드(0NN-init-message.csv)에 ko·en 행을 넣는다").isEmpty();
        }

        /**
         * <b>같은 {@code (키, 언어)} 가 두 번 오면 기동이 죽는다.</b> {@code SYS_MESSAGE} 의 PK 가
         * 그 둘이고 값 시드는 {@code loadData}(순수 {@code INSERT})이므로, 파일이 갈려 있어도
         * <b>DB 에서는 한 테이블</b>이다.
         *
         * <p><b>파일이 늘어날수록 나기 쉬운 사고다.</b> 값 시드는 backend/persistence.md 대로 고치지 않고
         * 더하므로(089 · 091 · 093 …) 새 화면이 <i>이미 있는 컬럼</i> 의 헤더 키를 다시 적기
         * 쉽다 — 실제로 ①이 {@code sample.col.unitAmt} · {@code sample.col.rmk} ·
         * {@code sample.col.urgent} 셋을 ③의 089 위에 다시 적었고, <b>단위 테스트는 전부
         * 통과한 채</b> 실기동에서 PK 위반으로 죽었다(2026-09-02).
         *
         * <p>그 사고가 조용한 이유는 <b>검사가 값을 키 쪽으로만 보고 있었기</b> 때문이다 —
         * 아래 {@code everyValueHasItsKey} 는 <i>키가 있는가</i> 를 묻지 <i>값이 하나인가</i> 를
         * 묻지 않는다.
         */
        @Test
        @DisplayName("같은 키·언어가 두 번 오지 않는다 — SYS_MESSAGE 의 PK 다")
        void valuesAreUniquePerLanguage() {
            Map<String, Long> counts = valueRows().stream()
                    .collect(Collectors.groupingBy(
                            row -> row.get(0) + "/" + row.get(1), Collectors.counting()));

            List<String> duplicated = counts.entrySet().stream()
                    .filter(entry -> entry.getValue() > 1)
                    .map(Map.Entry::getKey)
                    .sorted()
                    .toList();

            assertThat(duplicated)
                    .as("값 시드 여러 파일에 같은 (MSG_KEY, LANG_CD) 가 있다 — loadData 가 INSERT 라 기동이 죽는다")
                    .isEmpty();
        }

        @Test
        @DisplayName("값에는 키 테이블에 없는 행이 없다 — FK 가 거부하면 기동이 실패한다")
        void everyValueHasItsKey() {
            Set<String> keys = new LinkedHashSet<>(keysOf(GENERATED_KEYS));
            keys.addAll(dataKeys());

            assertThat(valueRows().stream().map(row -> row.get(0)).distinct())
                    .allMatch(keys::contains);
        }

        @Test
        @DisplayName("시드 메뉴 전부에 이름 키가 있다 — 없으면 사이더에 menu.X 가 그대로 뜬다")
        void everySeededMenuHasAName() {
            List<String> menuKeys = SeedRows.menus().stream()
                    .map(row -> SeedRows.str(row, "MENU_NM"))
                    .toList();

            assertThat(menuKeys).isNotEmpty();
            assertThat(dataKeys()).containsAll(menuKeys);
        }
    }

    // ── 도우미 ──────────────────────────────────────────────────────

    /** 값 시드 전부를 한 목록으로 — 어느 파일에 있든 값은 값이다. */
    private static List<List<String>> valueRows() {
        List<List<String>> rows = new ArrayList<>();
        seedFiles(VALUE_SEED, "값 시드").forEach(name -> rows.addAll(rowsOf(name)));
        return rows;
    }

    /** 데이터가 만드는 키({@code menu.*} · {@code code.*}) 전부 — 생성물(008)은 빼고 모은다. */
    private static Set<String> dataKeys() {
        Set<String> keys = new LinkedHashSet<>();
        seedFiles(DATA_KEY_SEED, "데이터 키 시드").stream()
                .filter(name -> !name.equals(GENERATED_KEYS))
                .forEach(name -> keys.addAll(keysOf(name)));
        return keys;
    }

    /**
     * 이름이 아니라 <b>패턴</b>으로 모은다 — 파일이 늘어나는 것이 이 시드들의 정상 상태다.
     *
     * <p>하나도 못 찾으면 부르는 검사가 전부 <b>공허하게 통과</b>한다. 경로가 어긋난 것이므로
     * 여기서 세운다.
     */
    private static List<String> seedFiles(Pattern pattern, String what) {
        try (Stream<Path> files = Files.list(DATA)) {
            List<String> names = files
                    .map(path -> path.getFileName().toString())
                    .filter(name -> pattern.matcher(name).matches())
                    .sorted()
                    .toList();

            assertThat(names).as("%s 파일을 하나도 찾지 못했다", what).isNotEmpty();
            return names;
        } catch (IOException e) {
            throw new IllegalStateException(DATA + " 를 읽지 못했다", e);
        }
    }

    private static Set<String> declaredKeys() {
        Set<String> keys = new LinkedHashSet<>();
        for (Field field : MsgKey.class.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) && field.getType() == String.class) {
                try {
                    keys.add((String) field.get(null));
                } catch (IllegalAccessException e) {
                    throw new IllegalStateException(field.getName() + " 을 읽지 못했다", e);
                }
            }
        }
        return keys;
    }

    private static List<ErrorCode> errorCodes() {
        JavaClasses classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.aiagent");

        List<ErrorCode> codes = new ArrayList<>();
        classes.stream()
                .filter(candidate -> candidate.isAssignableTo(ErrorCode.class) && candidate.isEnum())
                .forEach(candidate -> {
                    Object[] constants = candidate.reflect().getEnumConstants();
                    for (Object constant : constants) {
                        codes.add((ErrorCode) constant);
                    }
                });
        return codes;
    }

    private static List<String> keysOf(String file) {
        return rowsOf(file).stream().map(row -> row.getFirst()).distinct().toList();
    }

    /** 헤더를 뺀 행. 값에 쉼표가 있으면 따옴표로 감싸여 있다. */
    private static List<List<String>> rowsOf(String file) {
        Path path = DATA.resolve(file);
        try {
            return Files.readAllLines(path, StandardCharsets.UTF_8).stream()
                    .skip(1)
                    .filter(line -> !line.isBlank())
                    .map(SeedMessageTest::splitCsv)
                    .toList();
        } catch (IOException e) {
            throw new IllegalStateException("시드 파일을 읽지 못했다: " + path, e);
        }
    }

    private static List<String> splitCsv(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int index = 0; index < line.length(); index++) {
            char ch = line.charAt(index);
            if (quoted && ch == '"' && index + 1 < line.length() && line.charAt(index + 1) == '"') {
                cell.append('"');
                index++;
            } else if (ch == '"') {
                quoted = !quoted;
            } else if (ch == ',' && !quoted) {
                cells.add(cell.toString());
                cell.setLength(0);
            } else {
                cell.append(ch);
            }
        }
        cells.add(cell.toString());
        return cells;
    }
}
