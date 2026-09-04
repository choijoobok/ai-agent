package com.aiagent.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 메시지 값을 넣는 시드는 <b>캐시 버전을 함께 올린다</b> — sys/code.md.
 *
 * <p>프론트는 캐시의 버전을 들고 묻고, 같으면 서버가 {@code unchanged} 로 답한다. 값을
 * 더해 놓고 버전을 올리지 않으면 <b>이미 번들을 받아 둔 화면</b>은 새 문구를 영원히 못 본다 —
 * DB 에는 있는데 화면에는 키 문자열이 보이고, 그 원인은 어디에도 드러나지 않는다.
 *
 * <p><b>새로 설치한 곳에서는 멀쩡하다</b>는 것이 이 결함의 성질이다. 캐시가 없으니 무엇을
 * 받든 새것이고, 그래서 개발 중에는 잡히지 않는다. 실제로 011 을 그렇게 내보냈다
 * (2026-08-29).
 */
class SeedMessageCacheVersionTest {

    private static final Path DATA = SeedRows.CHANGELOG.resolve("data");

    @Test
    @DisplayName("SYS_MESSAGE 에 값을 싣는 changelog 는 SYS_CACHE_VERSION 도 건드린다")
    void messageSeedBumpsCacheVersion() throws IOException {
        List<Path> loaders = changelogs()
                .filter(file -> SeedRows.tablesTouched(file, "loadData").contains("SYS_MESSAGE"))
                .toList();

        // 게이트가 아무것도 보지 않고 통과하는 일이 없도록 대상이 있는지부터 확인한다.
        assertThat(loaders).isNotEmpty();

        assertThat(loaders)
                .allSatisfy(file -> assertThat(cacheVersionTouchedBy(file))
                        .as("%s 가 메시지 값을 넣고도 SYS_CACHE_VERSION 을 올리지 않는다", file.getFileName())
                        .isTrue());
    }

    private static boolean cacheVersionTouchedBy(Path file) {
        return Stream.of("insert", "update")
                .anyMatch(type -> SeedRows.tablesTouched(file, type).contains("SYS_CACHE_VERSION"));
    }

    private static Stream<Path> changelogs() throws IOException {
        try (Stream<Path> files = Files.list(DATA)) {
            return files.filter(path -> path.getFileName().toString().endsWith(".yaml")).toList().stream();
        }
    }
}
