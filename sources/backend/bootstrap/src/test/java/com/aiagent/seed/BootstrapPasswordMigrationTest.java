// @feat FEAT-501
package com.aiagent.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiagent.domain.user.entity.SysUser;
import java.nio.file.Files;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.test.util.ReflectionTestUtils;
import org.yaml.snakeyaml.Yaml;

/** TC-5016: 새 초기 비밀번호와 제한 세션이 항상 함께 적용돼야 한다. */
class BootstrapPasswordMigrationTest {
    private static final String MIGRATION = "modules/system/003-admin-initial-password.yaml";

    @Test
    void initialAdminPasswordRequiresChangeWithoutExpiringBeforeFirstLogin() {
        var updates = SeedRows.updates(MIGRATION, "SYS_USER");
        assertThat(updates).hasSize(1);
        var row = updates.getFirst().columns();
        String hash = SeedRows.str(row, "PWD");
        var encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
        assertThat(encoder.matches("admin", hash)).isTrue();
        assertThat(encoder.matches("Backoffice!1", hash)).isFalse();
        assertThat(SeedRows.str(row, "PWD_INIT_YN")).isEqualTo("Y");
        assertThat(row).containsKey("PWD_CHG_DTM");
        assertThat(row.get("PWD_CHG_DTM")).isNull();

        var user = SysUser.builder().userId("admin").userNm("관리자").pwd(hash).build();
        ReflectionTestUtils.setField(user, "pwdInitYn", "Y".equals(SeedRows.str(row, "PWD_INIT_YN")));
        assertThat(user.mustChangePassword(Instant.now(), 0)).isTrue();
        assertThat(user.isTemporaryPasswordExpired(Instant.now(), 24)).isFalse();
    }

    @Test
    void onlyTheUnchangedOriginalAdminSeedIsSelected() {
        var original = SeedRows.inserts("data/002-init-admin.yaml", "SYS_USER").getFirst();
        String oldHash = SeedRows.str(original, "PWD");
        assertThat(SeedRows.updates(MIGRATION, "SYS_USER").getFirst().where())
                .isEqualTo("USER_ID = 'admin' AND PWD = '" + oldHash + "'");
    }

    @Test
    @SuppressWarnings("unchecked")
    void removesOldSessionsOnlyAfterTheSeedPasswordWasChanged() throws Exception {
        Map<String, Object> root = new Yaml().load(Files.readString(SeedRows.CHANGELOG.resolve(MIGRATION)));
        var entries = (List<Map<String, Object>>) root.get("databaseChangeLog");
        var changeSet = (Map<String, Object>) entries.getFirst().get("changeSet");
        var changes = (List<Map<String, Object>>) changeSet.get("changes");
        assertThat(changes.getFirst()).containsKey("update");
        var deletion = (Map<String, Object>) changes.get(1).get("delete");
        assertThat(deletion).isNotNull();
        assertThat(deletion.get("tableName")).isEqualTo("SPRING_SESSION");
        String hash = SeedRows.str(SeedRows.updates(MIGRATION, "SYS_USER").getFirst().columns(), "PWD");
        String target = "USER_ID = 'admin' AND PWD = '" + hash + "' AND PWD_INIT_YN = 'Y'";
        assertThat(deletion.get("where"))
                .isEqualTo("PRINCIPAL_NAME = 'admin' AND EXISTS (SELECT 1 FROM SYS_USER WHERE " + target + ")");
        var update = (Map<String, Object>) changes.getFirst().get("update");
        var columns = (List<Map<String, Map<String, Object>>>) update.get("columns");
        var changedAt = columns.stream().map(column -> column.get("column"))
                .filter(column -> "PWD_CHG_DTM".equals(column.get("name")))
                .findFirst().orElseThrow();
        // SeedRows는 계산식을 null로 읽으므로 원문도 검사해야 CURRENT_TIMESTAMP 회귀를 잡는다.
        assertThat(changedAt).containsEntry("valueComputed", "NULL");
    }
}
