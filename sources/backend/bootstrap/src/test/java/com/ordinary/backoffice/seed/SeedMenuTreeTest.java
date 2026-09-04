package com.ordinary.backoffice.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 메뉴 시드가 <b>트리인가</b> — 42 §4 의 네 층 중 넷째.
 *
 * <p>여기서 막는 규칙들은 <b>전부 DB 제약으로 표현할 수 없다.</b> 다른 행의 값에 의존하기
 * 때문이며(CHECK 는 다른 행을 볼 수 없고 트리거는 이식성을 포기하는 것이다), 원칙 P1 에 따라
 * 장치가 대신 지킨다. 저장 서비스는 화면을 통한 변경을 막고 <b>이 테스트는 시드를 막는다</b> —
 * 시드는 서비스를 거치지 않는다.
 *
 * <p>깨지는 방식이 중요하다. 순환이 들어오면 <b>조상 역산(AUTHZ-04)이 무한 루프</b>에 빠지고
 * 그 서브트리는 화면에서 사라진다. 고아가 들어오면 트리가 끊긴다. 둘 다 기동에서는 아무
 * 소리도 나지 않는다.
 */
class SeedMenuTreeTest {

    /** 초기 정렬은 여기 있다 — 003 이 생성물이 되면서 갈렸다(ADR-0028 · 081 파일 머리). */
    private static final String MENU_SORT_SEED = "data/081-init-menu-sort.yaml";

    /** {@code MENU_CD = 'X' AND SORT_NO = 0} 에서 대상 메뉴를 뽑는다. */
    private static final Pattern SORT_TARGET = Pattern.compile("MENU_CD = '([A-Z_0-9]+)'");

    /** 리프 포함 5단 — 52 §3.4. 넘는 저장은 거부한다. */
    private static final int MAX_DEPTH = 5;

    private static List<Map<String, Object>> rows;
    private static Map<String, String> parentOf;

    @BeforeAll
    static void load() {
        rows = SeedRows.menus();
        parentOf = rows.stream()
                .collect(Collectors.toMap(
                        row -> SeedRows.str(row, "MENU_CD"),
                        row -> String.valueOf(SeedRows.str(row, "UP_MENU_CD")),
                        (a, b) -> a,
                        LinkedHashMap::new));
    }

    @Test
    @DisplayName("52 §4.1 이 센 것과 행 수가 같다 — 구조 노드 8 + 리프 23")
    void rowCount() {
        long leaves = rows.stream().filter(row -> SeedRows.str(row, "MENU_URL") != null).count();
        long structural = rows.size() - leaves;

        /*
          샘플 일곱이 늘었다(2026-09-02 — 68 §3 ~ §8 여섯 화면 + 모듈 노드). 24 +
          SMPL_ROOT + SMPL_SINGLE_OFFSET + SMPL_SINGLE_CURSOR + SMPL_MD_VERT + SMPL_MD_HORZ +
          SMPL_MD_TABS + SMPL_EXCEL 이며, 이 숫자가 손으로 적혀 있는 것이 요점이다 —
          메뉴가 <b>모르는 사이에</b> 느는 것을 막는다(52 §4.1 이 세는 것과 같아야 한다).

          <b>여섯이 다 섰다.</b> 68 §2 의 커버리지 표에 빈 칸이 없으므로 여기서 더 늘 일은
          샘플이 아닌 화면이며, 그때도 이 줄을 고치는 순간 52 를 함께 보게 된다.
        */
        assertThat(rows).hasSize(31);
        assertThat(leaves).isEqualTo(23);
        assertThat(structural).isEqualTo(8);
    }

    @Test
    @DisplayName("MENU_CD 가 중복되지 않는다")
    void uniqueCodes() {
        Set<String> codes = rows.stream().map(row -> SeedRows.str(row, "MENU_CD")).collect(Collectors.toSet());
        assertThat(codes).hasSize(rows.size());
    }

    @Test
    @DisplayName("URL 과 자식은 배타다 — 구조 노드는 경로, 리프는 화면")
    void urlAndChildrenAreExclusive() {
        Set<String> parents = parentOf.values().stream()
                .filter(up -> !"null".equals(up))
                .collect(Collectors.toSet());

        List<String> violations = rows.stream()
                .filter(row -> {
                    boolean hasUrl = SeedRows.str(row, "MENU_URL") != null;
                    boolean hasChildren = parents.contains(SeedRows.str(row, "MENU_CD"));
                    return hasUrl == hasChildren;
                })
                .map(row -> SeedRows.str(row, "MENU_CD"))
                .toList();

        // 같으면 둘 다 참(URL 도 있고 자식도 있다)이거나 둘 다 거짓(URL 도 자식도 없는
        // 죽은 노드)이다. 전자는 security-design.md §4 가 금지한 것이고, 후자는 아무 쓸모가 없는 행이다.
        assertThat(violations)
                .as("URL 과 자식을 함께 갖거나 둘 다 없는 메뉴")
                .isEmpty();
    }

    @Test
    @DisplayName("부모가 실재한다 — 끊긴 트리는 조상 역산을 깨뜨린다")
    void noOrphans() {
        Set<String> codes = parentOf.keySet();
        List<String> orphans = parentOf.entrySet().stream()
                .filter(entry -> !"null".equals(entry.getValue()))
                .filter(entry -> !codes.contains(entry.getValue()))
                .map(Map.Entry::getKey)
                .toList();

        assertThat(orphans).isEmpty();
    }

    @Test
    @DisplayName("순환이 없고 깊이가 5단을 넘지 않는다")
    void noCyclesWithinDepthLimit() {
        List<String> tooDeep = new ArrayList<>();

        for (String start : parentOf.keySet()) {
            Set<String> visited = new LinkedHashSet<>();
            String current = start;
            int depth = 0;

            // 방문 집합과 깊이 상한을 함께 쓴다. 상한만으로는 순환과 "그냥 깊은 트리" 를
            // 구분할 수 없고, 방문 집합만으로는 이 루프 자체가 끝나지 않을 수 있다.
            while (current != null && !"null".equals(current)) {
                assertThat(visited.add(current))
                        .as("순환 — %s 에서 올라가다 %s 를 다시 만났다", start, current)
                        .isTrue();
                depth++;
                if (depth > MAX_DEPTH) {
                    tooDeep.add(start);
                    break;
                }
                current = parentOf.get(current);
            }
        }

        assertThat(tooDeep).as("5단을 넘는 메뉴").isEmpty();
    }

    /**
     * <b>SORT_NO 가 메뉴 시드에서 빠졌다</b>(ADR-0028) — 담으면 배포가 운영자의 드래그를
     * 되돌리기 때문이며, 신규 설치의 초기 순서는 {@code 081-init-menu-sort.yaml} 이 채운다.
     *
     * <p>그래서 검사도 그쪽으로 옮긴다. 검사하려는 사실은 그대로다 — 형제 사이에 값이
     * 겹치면 {@code ORDER BY SORT_NO, MENU_CD} 의 앞 키가 무의미해지고 순서가 흔들린다.
     */
    @Test
    @DisplayName("형제 사이에 SORT_NO 가 겹치지 않는다 — 겹치면 순서가 실행계획을 탄다")
    void siblingSortIsUnique() {
        Map<String, String> sortOf = new LinkedHashMap<>();
        /*
          <b>파일 이름을 박지 않는다.</b> 081 이 그때의 24개를 채웠고 뒤에 오는 메뉴는 새
          changelog 가 채운다(db-portability.md §1.1) — 이름으로 잡으면 뒤에 온 것이 검사 밖으로 나간다.
          SYS_MENU 를 갱신하는 시드는 이것 말고도 있으므로(003 의 고아 표시 · ICON_CD ·
          EXPORT_YN) <b>SORT_NO 를 쓰는 것만</b> 고른다.
        */
        for (SeedRows.Update update : SeedRows.updatesAll("SYS_MENU")) {
            if (SeedRows.str(update.columns(), "SORT_NO") == null) {
                continue;
            }
            Matcher matcher = SORT_TARGET.matcher(update.where());
            assertThat(matcher.find())
                    .as("정렬 시드의 where 형태: %s", update.where())
                    .isTrue();
            sortOf.put(matcher.group(1), SeedRows.str(update.columns(), "SORT_NO"));
        }

        assertThat(sortOf.keySet())
                .as("081 이 채우는 메뉴가 시드의 메뉴와 같다")
                .containsExactlyInAnyOrderElementsOf(parentOf.keySet());

        Map<String, Set<String>> seen = new LinkedHashMap<>();
        List<String> duplicates = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            String code = SeedRows.str(row, "MENU_CD");
            String parent = String.valueOf(SeedRows.str(row, "UP_MENU_CD"));
            String sort = sortOf.get(code);
            if (!seen.computeIfAbsent(parent, key -> new HashSet<>()).add(sort)) {
                duplicates.add(parent + "/" + sort);
            }
        }

        assertThat(duplicates).isEmpty();
    }

    @Test
    @DisplayName("MENU_NM 은 메뉴명이 아니라 메시지 키 menu.{MENU_CD} 다")
    void menuNameIsAMessageKey() {
        List<String> wrong = rows.stream()
                .filter(row -> !("menu." + SeedRows.str(row, "MENU_CD")).equals(SeedRows.str(row, "MENU_NM")))
                .map(row -> SeedRows.str(row, "MENU_CD"))
                .toList();

        assertThat(wrong).isEmpty();
    }
}
