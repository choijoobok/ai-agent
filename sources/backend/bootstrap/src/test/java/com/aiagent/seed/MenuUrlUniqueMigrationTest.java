// @feat FEAT-503
package com.aiagent.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** CR-002 — 구조 메뉴의 NULL URL과 리프 URL의 1:1 규칙은 모든 지원 DB에서 함께 성립한다. */
class MenuUrlUniqueMigrationTest {

    private static final Path CHANGELOG = Path.of(
            "src/main/resources/db/changelog/schema/031-menu-url-unique.yaml");

    @Test
    @DisplayName("SQL Server는 NULL을 제외한 유니크 인덱스로 메뉴 URL 1:1을 강제한다")
    void sqlServerExcludesNullStructureMenus() throws IOException {
        String changelog = Files.readString(CHANGELOG, StandardCharsets.UTF_8);

        assertThat(changelog).contains("dbms: \"!mssql\"");
        assertThat(changelog).contains("dbms: mssql");
        assertThat(changelog).contains("WHERE MENU_URL IS NOT NULL");
    }

    @Test
    @DisplayName("각 DB 분기는 되돌릴 방법을 함께 가진다")
    void eachVendorBranchHasRollback() throws IOException {
        String changelog = Files.readString(CHANGELOG, StandardCharsets.UTF_8);

        assertThat(changelog).contains("dropUniqueConstraint");
        assertThat(changelog).contains("DROP INDEX UK_SYS_MENU_01 ON SYS_MENU");
    }
}
