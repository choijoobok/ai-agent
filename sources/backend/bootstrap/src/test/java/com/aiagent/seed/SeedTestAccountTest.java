package com.aiagent.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 시험용 계정 시드 — {@code 060-init-test-account.yaml}.
 *
 * <p><b>부트스트랩이 아니라 시험 데이터다.</b> {@code SeedBootstrapAuthorityTest} 가 지키는
 * 것은 <i>아무도 로그인하지 못하는 상태</i> 를 막는 일이고, 여기가 지키는 것은 <b>이 시드가
 * 설치 시점에 터지지 않는가</b> 와 <b>인가 화면 셋이 보여줄 것을 실제로 갖고 있는가</b> 다.
 *
 * <p>뒤엣것이 이 파일의 존재 이유다 — 시험 데이터가 조용히 한쪽으로 쏠리면(전부 <i>유효</i>
 * 이거나 전부 <i>정상</i> 이면) screen/user/requirements.md 의 상태 다섯과 §4.7 의 상태 셋은 <b>화면을 열어도
 * 눈에 보이지 않는다</b>. 그러면 그 코드는 <b>아무도 본 적 없는 채로</b> 배포된다.
 *
 * <p>{@code SYS_USER_MENU_AUTH} 를 시드로 넣는 것은 여기가 처음이므로, sys/menu.md 의 제약
 * (기간 <b>필수</b> · 사유 <b>필수</b>)이 실제로 채워졌는지도 함께 잰다 — {@code NOT NULL}
 * 이라 빠지면 설치가 실패하는데, 그 실패는 <b>이 changelog 를 처음 적용하는 사람</b>에게만
 * 드러난다.
 */
class SeedTestAccountTest {

    private static final String TEST_SEED = "data/060-init-test-account.yaml";

    /** 이 시드가 깔았다고 주장하는 것 — 아래 검사들이 이 목록을 근거로 센다. */
    private static final Set<String> EXPECTED_USERS =
            Set.of("dev1", "mgr1", "locked1", "dormant1", "expired1", "disabled1");

    private static List<Map<String, Object>> users;
    private static List<Map<String, Object>> exceptions;
    private static Set<String> leafMenus;

    @BeforeAll
    static void load() {
        users = SeedRows.inserts(TEST_SEED, "SYS_USER");
        exceptions = SeedRows.inserts(TEST_SEED, "SYS_USER_MENU_AUTH");
        leafMenus = SeedRows.menus().stream()
                .filter(row -> SeedRows.str(row, "MENU_URL") != null)
                .map(row -> SeedRows.str(row, "MENU_CD"))
                .collect(Collectors.toSet());
    }

    @Test
    @DisplayName("계정 상태 다섯이 한 목록에 다 나온다 — 하나라도 빠지면 그 표시를 볼 수 없다")
    void everyAccountStateIsRepresented() {
        assertThat(users.stream().map(row -> SeedRows.str(row, "USER_ID")))
                .containsExactlyInAnyOrderElementsOf(EXPECTED_USERS);

        /*
          screen/user/requirements.md 의 체인 순서로 읽는다 — 먼저 걸린 것 하나가 그 계정의 표시다.
          여기서 세는 것은 <b>표시가 무엇인가</b> 이지 컬럼 값이 아니며, 그래서
          `UserQueryService.statOf` 와 같은 순서로 본다.
        */
        Set<String> shown = users.stream().map(SeedTestAccountTest::statOf).collect(Collectors.toSet());

        assertThat(shown)
                .as("시험 계정이 한쪽으로 쏠렸다 — 잠금 해제·휴면 해제 버튼을 눌러 볼 대상이 없어진다")
                .containsExactlyInAnyOrder("DISABLED", "EXPIRED", "LOCKED", "DORMANT", "NORMAL");
    }

    /** 접근 제어 체인 순서 — sys/user-role.md · screen/user/requirements.md. 하나만 낸다. */
    private static String statOf(Map<String, Object> user) {
        if (!"Y".equals(SeedRows.str(user, "USE_YN"))) {
            return "DISABLED";
        }
        String to = SeedRows.str(user, "VALID_TO_DT");
        if (to != null && LocalDate.parse(to).isBefore(LocalDate.now())) {
            return "EXPIRED";
        }
        if ("Y".equals(SeedRows.str(user, "LOCK_YN"))) {
            return "LOCKED";
        }
        return "Y".equals(SeedRows.str(user, "DORMANT_YN")) ? "DORMANT" : "NORMAL";
    }

    @Test
    @DisplayName("잠긴 계정은 실패 횟수도 함께 갖는다 — 둘이 어긋나면 잠금 해제가 무엇을 지웠는지 알 수 없다")
    void lockedAccountCarriesFailureCount() {
        List<Map<String, Object>> locked = users.stream()
                .filter(row -> "Y".equals(SeedRows.str(row, "LOCK_YN")))
                .toList();

        assertThat(locked).isNotEmpty();
        /*
          {@code LOCK_DTM} 은 여기서 못 본다 — {@code valueComputed: CURRENT_TIMESTAMP} 라
          실행 시점에 정해지고 {@link SeedRows} 는 그것을 값 없음으로 다룬다. 잴 수 있는 것은
          <b>실패 횟수</b>이며, 그 둘이 어긋나면(잠겼는데 0회) 잠금 해제 버튼이 <i>무엇을
          되돌렸는지</i> 를 화면에서 읽을 수 없다.
        */
        assertThat(locked).allSatisfy(row ->
                assertThat(Integer.parseInt(SeedRows.str(row, "LOGIN_FAIL_CNT"))).isPositive());
    }

    @Test
    @DisplayName("개인 예외에 기간과 사유가 다 있다 — 셋 다 NOT NULL 이라 빠지면 설치가 실패한다")
    void personalGrantsCarryPeriodAndReason() {
        assertThat(exceptions).isNotEmpty();
        assertThat(exceptions).allSatisfy(row -> {
            assertThat(SeedRows.str(row, "VALID_FROM_DT")).isNotNull();
            assertThat(SeedRows.str(row, "VALID_TO_DT")).isNotNull();
            assertThat(SeedRows.str(row, "GRANT_RSN")).isNotBlank();
        });
    }

    @Test
    @DisplayName("개인 예외의 기간이 뒤집히지 않았다 — 어느 날도 유효하지 않은 행이 된다")
    void personalGrantPeriodsAreOrdered() {
        assertThat(exceptions).allSatisfy(row -> {
            LocalDate from = LocalDate.parse(SeedRows.str(row, "VALID_FROM_DT"));
            LocalDate to = LocalDate.parse(SeedRows.str(row, "VALID_TO_DT"));
            assertThat(from).isBeforeOrEqualTo(to);
        });
    }

    @Test
    @DisplayName("개인 예외의 상태 셋이 다 있다 — 유효 하나로는 예정·만료 배지를 볼 수 없다")
    void everyGrantStateIsRepresented() {
        LocalDate today = LocalDate.now();
        Set<String> states = exceptions.stream()
                .map(row -> {
                    LocalDate from = LocalDate.parse(SeedRows.str(row, "VALID_FROM_DT"));
                    LocalDate to = LocalDate.parse(SeedRows.str(row, "VALID_TO_DT"));
                    if (today.isBefore(from)) return "SCHEDULED";
                    return today.isAfter(to) ? "EXPIRED" : "ACTIVE";
                })
                .collect(Collectors.toSet());

        assertThat(states)
.as("screen/user/requirements.md 의 배지를 화면에서 보려면 세 상태가 시드에 다 있어야 한다")
                .containsExactlyInAnyOrder("SCHEDULED", "ACTIVE", "EXPIRED");
    }

    @Test
    @DisplayName("개인 예외도 리프에만 붙는다 — 구조 노드는 권한 대상이 아니다")
    void personalGrantsTargetLeavesOnly() {
        List<String> structural = exceptions.stream()
                .map(row -> SeedRows.str(row, "MENU_CD"))
                .distinct()
                .filter(menuCd -> !leafMenus.contains(menuCd))
                .toList();

        assertThat(structural).isEmpty();
    }

    @Test
    @DisplayName("같은 (사용자, 메뉴, 액션) 이 두 번 들어가지 않는다 — PK 충돌로 설치가 실패한다")
    void personalGrantsAreUnique() {
        Set<String> keys = exceptions.stream()
                .map(row -> SeedRows.str(row, "USER_ID")
                        + "/" + SeedRows.str(row, "MENU_CD")
                        + "/" + SeedRows.str(row, "ACTION_CD"))
                .collect(Collectors.toSet());

        assertThat(keys).hasSize(exceptions.size());
    }

    @Test
    @DisplayName("모든 시험 계정이 역할을 하나는 갖는다 — 공집합이면 로그인 자체가 막힌다")
    void everyTestUserHoldsARole() {
        Set<String> withRole = SeedRows.inserts(TEST_SEED, "SYS_USER_ROLE").stream()
                .map(row -> SeedRows.str(row, "USER_ID"))
                .collect(Collectors.toSet());

        assertThat(withRole)
.as("backend/security.md — 유효 권한이 공집합이면 그 계정은 로그인 화면에서 거절된다")
                .containsAll(EXPECTED_USERS);
    }
}
