package com.aiagent.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * <b>부트스트랩 함정</b> — backend/security.md.
 *
 * <p>최초 관리자 계정에 {@code SYS_USER_ROLE} 이 없으면 유효 권한이 공집합이라 로그인이
 * 차단되고, 관리 화면에 들어갈 수 없으므로 <b>복구 경로가 남지 않는다.</b> 그래서
 * {@code SYS_USER} · {@code SYS_ROLE} · {@code SYS_USER_ROLE} · {@code SYS_ROLE_MENU_AUTH} 는
 * 한 묶음이며, <b>파일이 둘로 갈려도 검사는 하나여야 한다.</b>
 *
 * <p>이 테스트가 없으면 어긋남이 조용하다 — 기동은 성공하고, 아무도 로그인하지 못한다는
 * 사실은 사람이 시도해야 드러난다. {@code SeedAdminPasswordTest} 와 같은 자리다.
 */
class SeedBootstrapAuthorityTest {

    private static final String ADMIN_SEED = "data/002-init-admin.yaml";
    private static final String ROLE_SEED = "data/004-init-role.yaml";

    /**
     * 시험용 역할 둘 — 060. <b>004 와 같은 규칙을 받아야 한다.</b>
     *
     * <p>부트스트랩 함정과는 무관하지만(admin 은 004 가 챙긴다) 아래 다섯 불변식
     * (리프만 · 액션 4종 · {@code READ} 전제 · {@code EXPORT} 선언 · PK 유일)은 <b>부여 행
     * 전부</b>에 걸린다. 파일이 갈렸다고 검사가 갈리면, 시험 데이터가 <b>규칙을 어기는
     * 예시</b>가 되어 남는다.
     */
    private static final String TEST_SEED = "data/060-init-test-account.yaml";
    private static final String EXPORT_SEED = "data/056-menu-export.yaml";

    /** {@code MENU_CD IN ('A', 'B', …)} 에서 코드만 뽑는다 — SQL 을 해석하지 않는다. */
    private static final Pattern MENU_CODE = Pattern.compile("'([A-Z_]+)'");

    /** backend/security.md — 집합은 여기서 닫힌다. */
    private static final Set<String> ACTIONS = Set.of("READ", "SAVE", "EXPORT", "EXECUTE");

    private static List<Map<String, Object>> grants;
    private static Set<String> leafMenus;
    private static Set<String> exportMenus;

    @BeforeAll
    static void load() {
        grants = new ArrayList<>(SeedRows.inserts(ROLE_SEED, "SYS_ROLE_MENU_AUTH"));
        grants.addAll(SeedRows.inserts(TEST_SEED, "SYS_ROLE_MENU_AUTH"));
        leafMenus = SeedRows.menus().stream()
                .filter(row -> SeedRows.str(row, "MENU_URL") != null)
                .map(row -> SeedRows.str(row, "MENU_CD"))
                .collect(Collectors.toSet());
        exportMenus = SeedRows.updates(EXPORT_SEED, "SYS_MENU").stream()
                .filter(update -> "Y".equals(String.valueOf(update.columns().get("EXPORT_YN"))))
                .flatMap(update -> MENU_CODE.matcher(update.where()).results())
                .map(match -> match.group(1))
                .collect(Collectors.toSet());
    }

    @Test
    @DisplayName("시드 관리자에게 역할이 부여돼 있다 — 없으면 아무도 들어올 수 없다")
    void adminHasRole() {
        String adminId = SeedRows.str(SeedRows.inserts(ADMIN_SEED, "SYS_USER").getFirst(), "USER_ID");
        List<Map<String, Object>> userRoles = SeedRows.inserts(ROLE_SEED, "SYS_USER_ROLE");

        assertThat(userRoles).isNotEmpty();
        assertThat(userRoles).anyMatch(row -> adminId.equals(SeedRows.str(row, "USER_ID")));
    }

    @Test
    @DisplayName("부여된 역할이 실재하고 활성이다 — USE_YN='N' 이면 권한 행을 내지 않는다")
    void grantedRolesExistAndAreActive() {
        Map<String, String> roleActivation = SeedRows.inserts(ROLE_SEED, "SYS_ROLE").stream()
                .collect(Collectors.toMap(
                        row -> SeedRows.str(row, "ROLE_ID"), row -> SeedRows.str(row, "USE_YN")));

        Set<String> grantedRoles = SeedRows.inserts(ROLE_SEED, "SYS_USER_ROLE").stream()
                .map(row -> SeedRows.str(row, "ROLE_ID"))
                .collect(Collectors.toSet());

        assertThat(roleActivation.keySet()).containsAll(grantedRoles);
        assertThat(grantedRoles).allMatch(roleId -> "Y".equals(roleActivation.get(roleId)));
    }

    @Test
    @DisplayName("유효 권한이 공집합이 아니다 — 부트스트랩 함정의 본체")
    void effectiveAuthorityIsNotEmpty() {
        Set<String> grantedRoles = SeedRows.inserts(ROLE_SEED, "SYS_USER_ROLE").stream()
                .map(row -> SeedRows.str(row, "ROLE_ID"))
                .collect(Collectors.toSet());

        // ② 필터를 통과한 행이 ③ 합집합에 남고 ④ 게이트(리프 여부)를 지나야 한다.
        // 그 결과가 비면 로그인이 차단된다.
        long usable = grants.stream()
                .filter(row -> grantedRoles.contains(SeedRows.str(row, "ROLE_ID")))
                .filter(row -> leafMenus.contains(SeedRows.str(row, "MENU_CD")))
                .count();

        assertThat(usable).isPositive();
    }

    @Test
    @DisplayName("권한은 리프에만 붙는다 — 구조 노드는 권한 대상이 아니다")
    void grantsTargetLeavesOnly() {
        List<String> structural = grants.stream()
                .map(row -> SeedRows.str(row, "MENU_CD"))
                .distinct()
                .filter(menuCd -> !leafMenus.contains(menuCd))
                .toList();

        assertThat(structural)
.as("MENU_URL 이 없는 메뉴에 붙은 권한 — backend/security.md 는 이것을 거부한다")
                .isEmpty();
    }

    @Test
    @DisplayName("ACTION_CD 가 4종 안에 있다")
    void actionsAreClosed() {
        List<String> unknown = grants.stream()
                .map(row -> SeedRows.str(row, "ACTION_CD"))
                .distinct()
                .filter(action -> !ACTIONS.contains(action))
                .toList();

        assertThat(unknown).isEmpty();
    }

    @Test
    @DisplayName("READ 는 나머지 셋의 전제다 — 없으면 화면에 들어갈 수 없어 쓸 방법이 없다")
    void readIsPrerequisite() {
        Map<String, Set<String>> actionsByKey = grants.stream()
                .collect(Collectors.groupingBy(
                        row -> SeedRows.str(row, "ROLE_ID") + "/" + SeedRows.str(row, "MENU_CD"),
                        Collectors.mapping(row -> SeedRows.str(row, "ACTION_CD"), Collectors.toSet())));

        List<String> missingRead = actionsByKey.entrySet().stream()
                .filter(entry -> !entry.getValue().contains("READ"))
                .map(Map.Entry::getKey)
                .toList();

        assertThat(missingRead).isEmpty();
    }

    @Test
    @DisplayName("EXPORT 부여는 EXPORT_YN='Y' 인 메뉴에만 있다 — 정의 없는 부여는 고아가 된다")
    void exportGrantsAreDeclared() {
        /*
          다른 셋과 달리 EXPORT 는 매핑된 API 가 말해 주지 않는다 — 엑셀은 프론트가 만들어
          SYS_API 행이 없다(frontend/grid-advanced.md · sys/menu.md). 그래서 이 검사가 없으면 어긋남이 조용하다:
          기동은 성공하고, 역할 권한 화면의 트리에 그 칸이 — 로 그려지며, 004 가 준 부여는
          <b>화면에서 회수할 수 없는 고아</b>로 남는다(seed.md — 정의 밖은 건드리지 않는다).

          실제로 그렇게 있었다(2026-08-30). 10건 전부가 그랬다.
        */
        List<String> undeclared = grants.stream()
                .filter(row -> "EXPORT".equals(SeedRows.str(row, "ACTION_CD")))
                .map(row -> SeedRows.str(row, "MENU_CD"))
                .distinct()
                .filter(menuCd -> !exportMenus.contains(menuCd))
                .toList();

        assertThat(undeclared)
                .as("EXPORT 를 부여받았는데 EXPORT_YN 이 켜져 있지 않은 메뉴 — 056 이 빠졌다")
                .isEmpty();
    }

    @Test
    @DisplayName("EXPORT_YN 은 리프에만 켜진다 — 구조 노드에는 화면이 없어 낼 엑셀도 없다")
    void exportDeclarationTargetsLeavesOnly() {
        assertThat(exportMenus).isNotEmpty();
        assertThat(exportMenus)
                .as("MENU_URL 이 없는 메뉴에 켜진 EXPORT_YN — 트리가 폴더에 스위치를 그리게 된다")
                .allMatch(leafMenus::contains);
    }

    @Test
    @DisplayName("같은 (역할, 메뉴, 액션) 이 두 번 들어가지 않는다 — PK 충돌로 설치가 실패한다")
    void grantsAreUnique() {
        Set<String> keys = grants.stream()
                .map(row -> SeedRows.str(row, "ROLE_ID")
                        + "/" + SeedRows.str(row, "MENU_CD")
                        + "/" + SeedRows.str(row, "ACTION_CD"))
                .collect(Collectors.toSet());

        assertThat(keys).hasSize(grants.size());
    }
}
