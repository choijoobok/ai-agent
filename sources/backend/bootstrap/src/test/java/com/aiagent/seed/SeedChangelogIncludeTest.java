package com.aiagent.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

/**
 * changelog 파일을 만들어 놓고 <b>{@code master} 에 걸지 않는 것</b>을 막는다 — backend/persistence.md.
 *
 * <h2>이것이 조용한 실패인 이유</h2>
 *
 * <p>{@code master} 는 {@code includeAll} 이 아니라 <b>include 를 하나씩 적는다</b>. 순서를
 * 사람이 정해야 하고(FK) 왜 이 자리인지를 주석으로 남기기 위해서다. 그 대가로 <b>파일을 만들고
 * include 를 잊는 경로</b>가 생긴다.
 *
 * <p>그때 <b>기존 게이트가 전부 초록이다</b>. {@link SeedRows#dataFiles()} 는 {@code master}
 * 가 아니라 <b>디렉터리를 훑고</b>, {@code checkSeeds} 는 생성물만 본다. 이 저장소에는
 * {@code @SpringBootTest} 가 하나도 없어 <b>{@code ./gradlew test} 가 Liquibase 를 태우지
 * 않는다</b> — 실제로 changelog 를 태우는 것은 Docker 를 요구하는 {@code portabilityTest}
 * 뿐이고 그것은 평소의 {@code test} 에서 빠져 있다.
 *
 * <p>그래서 증상이 <b>"내 로컬은 초록인데 DB 에 안 들어간다"</b> 가 된다. 시드는 맞고 게이트도
 * 맞는데 <b>아무도 그 파일을 읽지 않는다</b>.
 *
 * <h2>반대 방향도 본다</h2>
 *
 * <p>{@code master} 가 없는 파일을 가리키면 <b>기동이 실패한다</b> — 조용하지는 않지만 그것을
 * 아는 자리가 배포여서는 안 된다. {@code loadData} 가 가리키는 CSV 도 같다.
 */
class SeedChangelogIncludeTest {

    private static final Path CHANGELOG = SeedRows.CHANGELOG;
    /** product와 local의 루트 모두를 검사한다. local만 sample 기준선을 더 포함한다(ADR-009). */
    private static final List<Path> MASTERS = List.of(
            CHANGELOG.resolve("db.changelog-master.yaml"),
            CHANGELOG.resolve("db.changelog-local.yaml"));

    @Test
    @DisplayName("모듈 기준선은 product 또는 local master에서 빠짐없이 도달한다")
    void everyChangelogIsIncluded() throws IOException {
        Set<String> included = includedFiles();
        List<String> onDisk = changelogsOnDisk();

        // 한쪽이라도 비면 검사가 아무것도 보지 않고 통과한다.
        assertThat(included).isNotEmpty();
        assertThat(onDisk).isNotEmpty();

        List<String> missing = onDisk.stream()
                .filter(file -> !included.contains(file))
                .toList();

        assertThat(missing)
                .as(
                        "%s 에 include 가 없다 — 파일은 있지만 기동해도 적재되지 않는다."
                                + " master 맨 끝에 include 하고 왜 를 주석으로 적는다(backend/persistence.md)",
                        MASTERS)
                .isEmpty();
    }

    @Test
    @DisplayName("master 가 가리키는 changelog 와 CSV 가 실제로 있다")
    void everyIncludeAndDataFileExists() throws IOException {
        List<String> referenced = new ArrayList<>(includedFiles());
        for (String include : includedFiles()) {
            if (include.endsWith(".yaml")) {
                referenced.addAll(dataFilesOf(fromClasspathRoot(include)));
            }
        }

        assertThat(referenced).isNotEmpty();

        List<String> gone = referenced.stream()
                .filter(file -> !Files.exists(fromClasspathRoot(file)))
                .toList();

        assertThat(gone).as("master 나 changeSet 이 없는 파일을 가리킨다 — 기동이 실패한다").isEmpty();
    }

    @Test
    @DisplayName("각 실행 변형은 같은 changelog 를 두 번 include 하지 않는다")
    void noDuplicateIncludes() throws IOException {
        for (Path master : MASTERS) {
            List<String> files = new ArrayList<>();
            collectIncludes(master, files, new LinkedHashSet<>());
            Set<String> unique = new LinkedHashSet<>(files);

            assertThat(files).isNotEmpty();
            assertThat(files)
                    .as("%s 에 두 번 걸린 changelog 가 있다 — 같은 changeSet 이 두 자리에서 돈다", master)
                    .hasSameSizeAs(unique);
        }
    }

    /** {@code src/main/resources} 기준 경로 — {@code relativeToChangelogFile: false} 의 기준이다. */
    private static Path fromClasspathRoot(String file) {
        return CHANGELOG.getParent().getParent().resolve(file);
    }

    private static Set<String> includedFiles() throws IOException {
        return new LinkedHashSet<>(includeList());
    }

    /** 두 master가 재귀 include 하는 기준선 파일을 <b>적힌 순서대로</b> 모은다. */
    private static List<String> includeList() throws IOException {
        List<String> files = new ArrayList<>();
        for (Path master : MASTERS) {
            collectIncludes(master, files, new LinkedHashSet<>());
        }
        return files;
    }

    private static void collectIncludes(Path changelog, List<String> files, Set<Path> seen) throws IOException {
        Path normalized = changelog.normalize();
        if (!seen.add(normalized)) {
            return;
        }
        for (Object entry : list(load(changelog).get("databaseChangeLog"))) {
            Map<String, Object> include = map(map(entry).get("include"));
            if (include != null && include.get("file") != null) {
                String file = String.valueOf(include.get("file"));
                files.add(file);
                if (file.endsWith(".yaml")) {
                    collectIncludes(fromClasspathRoot(file), files, seen);
                }
            }
        }
    }

    /** 한 changelog 가 {@code loadData}·{@code loadUpdateData} 로 읽는 파일들. */
    private static List<String> dataFilesOf(Path changelog) {
        List<String> files = new ArrayList<>();
        if (!Files.exists(changelog)) {
            return files; // 없는 것은 앞의 검사가 잡는다
        }
        for (Object entry : list(load(changelog).get("databaseChangeLog"))) {
            Map<String, Object> changeSet = map(map(entry).get("changeSet"));
            if (changeSet == null) {
                continue;
            }
            for (Object change : list(changeSet.get("changes"))) {
                for (String type : List.of("loadData", "loadUpdateData")) {
                    Map<String, Object> body = map(map(change).get(type));
                    if (body != null && body.get("file") != null) {
                        files.add(String.valueOf(body.get("file")));
                    }
                }
            }
        }
        return files;
    }

    private static List<String> changelogsOnDisk() throws IOException {
        List<String> files = new ArrayList<>();
        Path modules = CHANGELOG.resolve("modules");
        assertThat(modules).as("%s 가 없다 — 검사가 헛돈다", modules).isDirectory();
        try (Stream<Path> moduleFolders = Files.list(modules)) {
            for (Path folder : moduleFolders.filter(Files::isDirectory).toList()) {
                String module = folder.getFileName().toString();
                try (Stream<Path> paths = Files.list(folder)) {
                    paths.map(path -> path.getFileName().toString())
                            .filter(name -> name.endsWith(".yaml"))
                            .sorted()
                            .forEach(name -> files.add("db/changelog/modules/" + module + "/" + name));
                }
            }
        }
        return files;
    }

    private static Map<String, Object> load(Path path) {
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            Map<String, Object> root = new Yaml().load(reader);
            return root == null ? Map.of() : root;
        } catch (IOException e) {
            throw new IllegalStateException(path + " 를 읽지 못했다", e);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return value instanceof Map ? (Map<String, Object>) value : null;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> list(Object value) {
        return value instanceof List ? (List<Object>) value : List.of();
    }
}
