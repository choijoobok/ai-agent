package com.aiagent.seed;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.yaml.snakeyaml.Yaml;

/**
 * 시드 changelog 의 {@code insert} 행을 읽는다 — <b>테스트 전용</b>.
 *
 * <p>시드는 애플리케이션을 거치지 않고 DB 에 들어가므로 저장 서비스의 검증을 받지 않는다.
 * sys/menu.md 가 <i>"시드 검증 테스트"</i> 를 네 층 중 하나로 세워 둔 자리가 여기다 — 순환·고아·
 * URL 배타 같은 <b>DB 제약으로 표현할 수 없는 규칙</b>을 CI 가 대신 지킨다.
 *
 * <p><b>파일을 읽는다.</b> DB 에 붙어 확인하는 편이 확실해 보이지만, 그러면 검사가
 * Testcontainers 를 요구하고 <b>PR 마다 도는 값싼 게이트</b>가 아니게 된다. 여기서 막는 것은
 * "잘못된 시드가 커밋되는 것" 이므로 파일이 맞는 대상이다.
 */
final class SeedRows {

    private SeedRows() {}

    static final Path CHANGELOG = Path.of("src/main/resources/db/changelog");

    /**
     * 한 changelog 파일에서 특정 테이블에 들어가는 행을 전부 뽑는다.
     *
     * <p>컬럼 값은 {@code value} · {@code valueNumeric} · {@code valueDate} 중 있는 것을 쓴다.
     * {@code valueComputed}(예: {@code CURRENT_TIMESTAMP})는 <b>값이 없는 것으로 다룬다</b> —
     * 실행 시점에 정해지므로 파일만 보고는 알 수 없고, 검증 대상도 아니다.
     */
    static List<Map<String, Object>> inserts(String changelogFile, String tableName) {
        Map<String, Object> root = load(CHANGELOG.resolve(changelogFile));
        List<Map<String, Object>> rows = new ArrayList<>();

        for (Object entry : list(root.get("databaseChangeLog"))) {
            Map<String, Object> changeSet = map(map(entry).get("changeSet"));
            if (changeSet == null) {
                continue;
            }
            for (Object change : list(changeSet.get("changes"))) {
                Map<String, Object> insert = map(map(change).get("insert"));
                if (insert == null || !tableName.equals(insert.get("tableName"))) {
                    continue;
                }
                rows.add(columnsOf(insert));
            }
        }
        return rows;
    }

    /**
     * 한 changelog 파일에서 특정 테이블을 고치는 {@code update} 를 전부 뽑는다.
     *
     * <p><b>{@code insert} 만으로는 부족해졌다.</b> 이미 적용된 changeset 은 고칠 수 없으므로
     * (backend/persistence.md) 003 이 비워 둔 컬럼은 <b>뒤에 오는 파일이 {@code update} 로</b> 채운다 —
     * 035 의 {@code ICON_CD}, 056 의 {@code EXPORT_YN} 이 그것이다. 검사해야 할 사실이
     * 그쪽에 있으면 이쪽도 읽을 수 있어야 한다.
     *
     * <p>{@code where} 는 <b>문자열 그대로</b> 준다. SQL 을 해석하지 않으며, 부르는 쪽이
     * 자기 파일의 형태를 알고 뽑아 쓴다.
     */
    static List<Update> updates(String changelogFile, String tableName) {
        Map<String, Object> root = load(CHANGELOG.resolve(changelogFile));
        List<Update> rows = new ArrayList<>();

        for (Object entry : list(root.get("databaseChangeLog"))) {
            Map<String, Object> changeSet = map(map(entry).get("changeSet"));
            if (changeSet == null) {
                continue;
            }
            for (Object change : list(changeSet.get("changes"))) {
                Map<String, Object> update = map(map(change).get("update"));
                if (update == null || !tableName.equals(update.get("tableName"))) {
                    continue;
                }
                Object where = update.get("where");
                rows.add(new Update(columnsOf(update), where == null ? "" : String.valueOf(where)));
            }
        }
        return rows;
    }

    /** {@code update} 하나 — 무엇을 어떤 값으로, 어디에. */
    record Update(Map<String, Object> columns, String where) {}

    /**
     * 한 changelog 파일이 특정 종류의 변경으로 건드리는 <b>테이블 이름</b>을 모은다.
     *
     * @param changeType {@code insert} · {@code update} · {@code loadData} 같은 변경 이름
     */
    static Set<String> tablesTouched(Path changelogFile, String changeType) {
        Map<String, Object> root = load(changelogFile);
        Set<String> tables = new LinkedHashSet<>();

        for (Object entry : list(root.get("databaseChangeLog"))) {
            Map<String, Object> changeSet = map(map(entry).get("changeSet"));
            if (changeSet == null) {
                continue;
            }
            for (Object change : list(changeSet.get("changes"))) {
                Map<String, Object> body = map(map(change).get(changeType));
                if (body != null && body.get("tableName") != null) {
                    tables.add(String.valueOf(body.get("tableName")));
                }
            }
        }
        return tables;
    }

    /** {@code insert} 와 {@code update} 가 같은 모양이라 하나로 읽는다. */
    private static Map<String, Object> columnsOf(Map<String, Object> change) {
        Map<String, Object> row = new LinkedHashMap<>();
        for (Object wrapper : list(change.get("columns"))) {
            Map<String, Object> column = map(map(wrapper).get("column"));
            if (column == null) {
                continue;
            }
            /*
              {@code valueDate} 가 셋째다 — 060 이 사용 기간과 부여 기간을 그것으로 넣는다.
              빠뜨리면 그 칸이 {@code null} 로 읽혀 <b>검사가 조용히 통과</b>한다: 기간이
              없다고 말하는 대신 <i>기간을 안 본다</i> 가 된다.
            */
            Object value = column.containsKey("value") ? column.get("value")
                    : column.containsKey("valueNumeric") ? column.get("valueNumeric")
                    : column.get("valueDate");
            row.put(String.valueOf(column.get("name")), value);
        }
        return row;
    }

    /**
     * {@code data/} 아래의 changelog 파일 이름 전부 — <b>이름이 아니라 목록으로 모은다</b>.
     *
     * <p>{@code SeedMessageTest} 가 배운 것을 여기서도 쓴다: 시드 파일이 <b>늘어나는 것이
     * 정상 상태</b>라, 한 파일 이름을 박아 두면 <i>뒤에 온 파일이 검사 밖으로 나간다</i>.
     * 019 가 그렇게 빠졌고, 그때 <b>시드는 옳았는데 게이트가 틀렸다</b>.
     *
     * <p>하나도 못 찾으면 부르는 검사가 <b>공허하게 통과</b>하므로 여기서 세운다.
     */
    static List<String> dataFiles() {
        try (Stream<Path> files = Files.list(CHANGELOG.resolve("data"))) {
            List<String> names = files
                    .map(path -> "data/" + path.getFileName())
                    .filter(name -> name.endsWith(".yaml"))
                    .sorted()
                    .toList();
            if (names.isEmpty()) {
                throw new IllegalStateException(CHANGELOG + "/data 에 changelog 가 없다");
            }
            return names;
        } catch (IOException e) {
            throw new IllegalStateException(CHANGELOG + "/data 를 읽지 못했다", e);
        }
    }

    /** 어느 파일에 있든 그 테이블의 삽입은 삽입이다 — {@link #dataFiles()}. */
    static List<Map<String, Object>> insertsAll(String tableName) {
        List<Map<String, Object>> rows = new ArrayList<>();
        dataFiles().forEach(name -> rows.addAll(inserts(name, tableName)));
        return rows;
    }

    /** 〃 갱신. */
    static List<Update> updatesAll(String tableName) {
        List<Update> rows = new ArrayList<>();
        dataFiles().forEach(name -> rows.addAll(updates(name, tableName)));
        return rows;
    }

    static String str(Map<String, Object> row, String column) {
        Object value = row.get(column);
        return value == null ? null : String.valueOf(value);
    }

    /** 메뉴 시드가 CSV 가 됐다 — seed.md. */
    static final String MENU_SEED = "data/003-init-menu.csv";

    /**
     * 메뉴 시드의 행 — <b>{@code inserts()} 와 같은 모양</b>으로 돌려준다.
     *
     * <p>메뉴가 생성물이 되면서 `- insert:` 가 사라졌다(seed.md). 검사하려는 사실은 그대로이므로
     * (트리인가 · 고아가 없는가 · URL 과 자식이 배타인가) <b>읽는 자리만 옮긴다</b>.
     *
     * <p><b>선언(`menu-tree.yaml`)이 아니라 CSV 를 읽는다.</b> DB 에 들어가는 것이 이쪽이고,
     * 둘이 어긋나는 경우는 `checkMenuSeed` 가 CI 에서 따로 막는다 — 여기서 또 보면 같은
     * 사실을 두 곳이 지키게 된다.
     *
     * <p>빈 칸은 Liquibase 규약대로 {@code NULL} 이라는 <b>글자</b>이며 여기서 널로 바꾼다 —
     * 그러지 않으면 구조 노드의 {@code MENU_URL} 이 {@code "NULL"} 이라는 문자열이 되어
     * <i>리프가 24개</i> 로 세어진다.
     */
    static List<Map<String, Object>> menus() {
        List<String> lines;
        try {
            lines = Files.readAllLines(CHANGELOG.resolve(MENU_SEED), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("메뉴 시드를 읽지 못했다 — ./gradlew generateMenuSeed", e);
        }
        if (lines.isEmpty()) {
            throw new IllegalStateException("메뉴 시드가 비었다 — ./gradlew generateMenuSeed");
        }

        String[] header = lines.get(0).split(",", -1);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String line : lines.subList(1, lines.size())) {
            if (line.isBlank()) {
                continue;
            }
            String[] cells = line.split(",", -1);
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 0; i < header.length; i++) {
                String cell = i < cells.length ? cells[i] : "";
                row.put(header[i], "NULL".equals(cell) || cell.isEmpty() ? null : cell);
            }
            rows.add(row);
        }
        return rows;
    }

    private static Map<String, Object> load(Path path) {
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            return new Yaml().load(reader);
        } catch (IOException e) {
            throw new IllegalStateException("시드 파일을 읽지 못했다: " + path, e);
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
