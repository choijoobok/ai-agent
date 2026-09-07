package com.aiagent.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaCall;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 시각의 <b>단일 출처</b>를 빌드가 고정한다 — aidd-guide/standard/backend/time.md §2.
 *
 * <p><b>왜 검사가 필요한가.</b> 이것은 어겨도 컴파일되고 테스트도 통과하는 종류다.
 * {@code LocalDate.now()} 한 줄이 들어와도 빌드는 초록이고, 틀리는 것은 <b>배포 환경의
 * 기본 시간대가 업무 시간대와 다를 때, 자정 근처 요청에서만</b>이다 — 그래서 재현되지
 * 않고, 재현되지 않는 것은 고쳐지지 않는다.
 *
 * <h2>괄호가 빈 것만 금지다</h2>
 *
 * <p>{@code Instant.now(clock)} 은 인자가 단일 출처이므로 규약을 지킨다. 그래서 이름만
 * 보고 막지 않고 <b>매개변수가 없는 것</b>만 센다 — 이름으로 막으면 옳은 호출까지 막히고,
 * 옳은 호출을 막는 검사는 사람이 끄는 검사가 된다.
 *
 * <h2>면제는 양방향으로 실패한다</h2>
 *
 * <p>{@link #EXEMPT} 에 없는 위반이 생기면 실패하고, <b>면제인데 위반이 사라져도
 * 실패한다.</b> 뒤쪽이 없으면 면제가 <i>영구 주석</i>이 되고, 남아 있는 면제는 다음 사람에게
 * <i>여기는 원래 그런 곳</i> 이라고 가르친다 — 조용한 면제는 검사를 끈 것이다.
 *
 * <h2>이 검사가 못 보는 것</h2>
 *
 * <p><b>프레임워크가 우리 대신 부르는 것.</b> {@code new CronTrigger(cron)} 은 시간대를
 * 스프링 안에서 {@code systemDefault()} 로 정하므로 우리 바이트코드에 그 호출이 없다.
 * 바이트코드를 보는 검사의 한계이며, 그 자리는 {@code time.md} 의 산문이 갖는다.
 *
 * <h2>테스트는 대상이 아니다</h2>
 *
 * <p>{@link ImportOption.Predefined#DO_NOT_INCLUDE_TESTS} 로 뺀다. 테스트가 <i>지금</i> 을
 * 물어야 하는 자리가 있고(시드 계정의 유효 기간이 지났는지), 그것이 흔들리면 사람이 곧
 * 알아챈다 — 프로덕션의 조용한 하루 밀림과 성질이 다르다.
 */
class TimeSourceConventionTest {

    private static final String BASE = "com.aiagent";

    /**
     * 맨 {@code now()} 를 가진 타입들 — {@code java.time} 의 달력·시각 타입.
     *
     * <p><b>이름으로 걸러내지 않고 소유 타입을 열거한다.</b> {@code now} 는 우리 코드에도
     * 있을 수 있는 흔한 이름이고, 그것까지 막으면 검사가 <i>시각의 출처</i> 가 아니라
     * <i>메서드 이름</i> 을 검사하는 것이 된다.
     */
    private static final Set<String> CALENDAR_TYPES = Set.of(
            "java.time.Instant",
            "java.time.LocalDate",
            "java.time.LocalDateTime",
            "java.time.LocalTime",
            "java.time.OffsetDateTime",
            "java.time.OffsetTime",
            "java.time.ZonedDateTime",
            "java.time.Year",
            "java.time.YearMonth",
            "java.time.MonthDay");

    /**
     * 지금 고칠 수 없는 자리와 <b>그 이유</b> — 키는 부르는 쪽의 전체 이름이다.
     *
     * <p><b>비어 가는 방향으로만 움직인다.</b> 더하려면 이유를 함께 적고, 이유가 *나중에
     * 하겠다* 뿐이면 그것은 면제가 아니라 미룬 것이다.
     */
    private static final Map<String, String> EXEMPT = Map.of(
            "com.aiagent.domain.batch.schedule.CronRules"
                    + ".nextExecution(java.lang.String, java.time.Instant)",
            "배치 목록의 파생 컬럼 *다음 실행* 을 계산한다. **여기만 업무 시간대로 고치면 "
                    + "표시와 실행이 어긋난다** — 실행 시각은 BatchScheduler 의 CronTrigger 가 "
                    + "정하고 그것도 JVM 기본 시간대를 쓰며, 스프링 안쪽이라 이 검사가 보지 "
                    + "못한다. 둘을 함께 바꾸는 것은 배치 동작의 변경이므로 사용자 결정이 "
                    + "앞선다(standard/INDEX.md 의 「이미 있는 것을 고칠 때」 ③·⑦).");

    private final JavaClasses classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages(BASE);

    @Test
    @DisplayName("지금을 직접 묻지 않는다 — Clock 빈과 BusinessCalendar 가 유일한 출처다")
    void timeComesFromTheSingleSource() {
        Map<String, List<String>> found = violations();

        List<String> unexpected = new ArrayList<>();
        found.forEach((origin, where) -> {
            if (!EXEMPT.containsKey(origin)) {
                unexpected.add(origin + " — " + String.join(" · ", where));
            }
        });

        assertThat(unexpected)
                .as("time.md §2 위반. clock.instant() · calendar.today() · calendar.zone() 을 쓴다 — "
                        + "판정이 흩어지면 배포 환경의 시간대에 따라 하루가 밀리고, "
                        + "자정 근처에서만 밀리므로 재현되지 않는다")
                .isEmpty();
    }

    @Test
    @DisplayName("면제가 남아 있으면 그 위반이 아직 있어야 한다 — 조용한 면제는 검사를 끈 것이다")
    void everyExemptionIsStillEarned() {
        Set<String> found = violations().keySet();

        List<String> stale = EXEMPT.keySet().stream()
                .filter(origin -> !found.contains(origin))
                .toList();

        assertThat(stale)
                .as("면제된 자리에 위반이 없다 — 고쳐졌으면 EXEMPT 에서 지운다")
                .isEmpty();
    }

    // ── 센다 ──────────────────────────────────────────────────────────

    /** 부르는 쪽의 전체 이름 → 위반이 있는 자리(파일:줄). */
    private Map<String, List<String>> violations() {
        Map<String, List<String>> found = new LinkedHashMap<>();
        for (JavaClass type : classes) {
            collect(found, type.getMethodCallsFromSelf(), TimeSourceConventionTest::forbiddenMethod);
            collect(found, type.getConstructorCallsFromSelf(), TimeSourceConventionTest::bareDate);
        }
        return found;
    }

    private static <T extends JavaCall<?>> void collect(
            Map<String, List<String>> into, Set<T> calls, Predicate<T> forbidden) {
        for (T call : calls) {
            if (!forbidden.test(call)) {
                continue;
            }
            into.computeIfAbsent(call.getOrigin().getFullName(), key -> new ArrayList<>())
                    .add(call.getTarget().getName() + " @ " + call.getSourceCodeLocation());
        }
    }

    /** 맨 {@code now()} · {@code ZoneId.systemDefault()} · {@code System.currentTimeMillis()}. */
    private static boolean forbiddenMethod(com.tngtech.archunit.core.domain.JavaMethodCall call) {
        String owner = call.getTarget().getOwner().getFullName();
        String name = call.getTarget().getName();
        boolean noArgs = call.getTarget().getRawParameterTypes().isEmpty();

        if ("now".equals(name) && noArgs) {
            return CALENDAR_TYPES.contains(owner);
        }
        if ("systemDefault".equals(name)) {
            return "java.time.ZoneId".equals(owner);
        }
        // 시간대 문제는 없지만 **고정할 수 없는** 출처다 — 테스트가 시간을 잡을 수 없다.
        return "currentTimeMillis".equals(name) && "java.lang.System".equals(owner);
    }

    /** {@code new Date()} — 인자 없는 것만. {@code new Date(long)} 은 값을 받은 것이다. */
    private static boolean bareDate(com.tngtech.archunit.core.domain.JavaConstructorCall call) {
        return "java.util.Date".equals(call.getTarget().getOwner().getFullName())
                && call.getTarget().getRawParameterTypes().isEmpty();
    }
}
