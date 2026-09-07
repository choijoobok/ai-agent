package com.aiagent.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code Tuple} 에서 <b>프로젝션에 없는 컬럼을 읽는 것</b>을 막는다 — backend/search.md.
 *
 * <h2>이것이 조용한 실패인 이유</h2>
 *
 * <p>{@code Projections.tuple(LIST)} 로 뽑은 {@code Tuple} 에 {@code row.get(B.timezone)} 을
 * 물으면, 그 컬럼이 {@code LIST} 에 없어도 <b>컴파일이 통과하고 예외도 나지 않는다</b> —
 * QueryDSL 이 {@code null} 을 준다. 그래서 응답의 그 칸이 조용히 비고, 처음 아는 사람이
 * <b>화면을 열어 본 사람</b>이 된다.
 *
 * <p>2026-09-07 에 실제로 났다: 배치 시간대 컬럼을 더하면서 {@code LIST} 에 넣지 않아
 * 게이트 전부가 초록인 채로 화면의 두 칸이 비었다. 단위 테스트는 리포지토리를 목으로
 * 쓰므로 이 경로를 지나지 않고 타입도 막지 못한다 — <b>검사가 없으면 앱을 띄워 보는 것이
 * 유일한 방법</b>이었다.
 *
 * <h2>무엇을 세나 — 파일이 어디서든 고른 컬럼</h2>
 *
 * <p>프로젝션의 꼴이 셋이다 — {@code Expression<?>[] LIST = { … }} 상수,
 * {@code Projections.tuple(…)} 인라인, 그리고 <b>{@code query.select(a, b, c)} 직접 다중
 * select</b>. 셋을 <b>합집합으로</b> 모으고 {@code .get(별칭.필드)} 가 그 안에 있는지 본다.
 *
 * <p>별칭은 {@code static final QXxx B = ...} 로 선언된 이름이며 — 다른 파일에서 static
 * import 되는 것이 있어({@code BatchScheduleSpec.B}) <b>전역으로 모은다</b>.
 *
 * <p>{@code ExpressionUtils.as(...)} 처럼 계산된 표현식은 프로젝션과 읽기 <b>양쪽에서</b> 이
 * 꼴이 아니므로 추적하지 않는다 — 한쪽만 놓치면 오탐이 되지만, 둘 다 안 보므로 지나간다.
 *
 * <h2>못 보는 것 — 어느 튜플에서 읽는가</h2>
 *
 * <p>한 서비스가 질의를 여럿 돌리고 프로젝션도 여럿이다({@code BRIEF}·{@code DETAIL},
 * 목록 질의와 하위 집계). <b>어느 튜플에서 읽는가</b> 를 가리려면 흐름 분석이 필요하므로
 * 합집합으로 본다. 그래서 잡는 것은 하나다:
 *
 * <blockquote><b>이 파일이 어디서도 고르지 않은 컬럼을 읽는다.</b></blockquote>
 *
 * <p>그것이 바로 이 결함의 꼴이다 — 레코드에 필드를 더하고 읽기를 더하면서 <b>어느
 * 프로젝션에도 넣지 않는</b> 것. 반대로 <i>다른 프로젝션의 컬럼을 잘못 읽는 것</i> 은
 * 못 잡는다.
 *
 * <p><b>일부러 좁게 둔다.</b> 귀속을 맞히려 들면 파싱이 틀리고, <b>틀리게 파싱한 검사는
 * 아무것도 안 막는 검사</b>가 된다({@code guard-generated} 가 목록을 계산하지 않는 것과
 * 같은 판단이다). 첫 판에서 오탐 30건이 났고, 그 원인이 직접 다중 select 를 몰랐던 것이다.
 */
class ProjectionCoverageTest {

    /** 모듈 작업 디렉터리 기준 — {@code SeedRows.CHANGELOG} 와 같은 방식이다. */
    private static final List<Path> ROOTS = List.of(
            Path.of("../domain/src/main/java"), Path.of("../api/src/main/java"));

    /** 이 검사가 서려면 최소 이만큼은 찾아야 한다 — 못 찾으면 검사가 사라진 것이다. */
    private static final int MIN_FILES = 12;

    /** {@code static final QSysUser U = ...} · {@code = new QSysUser("alias")} 둘 다. */
    private static final Pattern ALIAS =
            Pattern.compile("static\\s+final\\s+Q[A-Za-z0-9_]+\\s+([A-Z][A-Za-z0-9_]*)\\s*=");

    /** {@code Expression<?>[] NAME = { … };} — 안쪽의 `별칭.필드` 를 뽑는 대상이다. */
    private static final Pattern PROJECTION = Pattern.compile(
            "Expression<\\?>\\[\\]\\s+[A-Z][A-Za-z0-9_]*\\s*=\\s*\\{([^}]*)\\}", Pattern.DOTALL);

    /** `별칭.필드` 한 조각. */
    private static final Pattern MEMBER =
            Pattern.compile("\\b([A-Z][A-Za-z0-9_]*)\\.([a-z][A-Za-z0-9_]*)\\b");

    /** {@code .get(별칭.필드)} — 인자가 하나이고 그 꼴인 것만. */
    private static final Pattern READ = Pattern.compile(
            "\\.get\\(\\s*([A-Z][A-Za-z0-9_]*)\\s*\\.\\s*([a-z][A-Za-z0-9_]*)\\s*\\)");

    @Test
    @DisplayName("프로젝션에 없는 컬럼을 Tuple 에서 읽지 않는다 — QueryDSL 은 조용히 null 을 준다")
    void everyReadColumnIsProjected() {
        List<Path> sources = javaSources();
        Set<String> aliases = aliasNames(sources);

        List<String> missing = new ArrayList<>();
        int inspected = 0;

        for (Path file : sources) {
            String text = read(file);
            if (!text.contains("Projections.tuple")) {
                continue;
            }
            inspected += 1;

            Set<String> projected = projectedColumns(text, aliases);
            for (Map.Entry<String, String> hit : reads(text, aliases)) {
                String column = hit.getKey() + "." + hit.getValue();
                if (!projected.contains(column)) {
                    missing.add(file.getFileName() + " — " + column);
                }
            }
        }

        /*
          <b>아무것도 못 찾으면 실패한다.</b> 경로가 어긋나거나 정규식이 낡으면 이 검사는
          *위반 0* 을 내며 통과하는데, 그것은 초록이 아니라 <b>검사가 사라진 것</b>이다.
        */
        assertThat(inspected)
                .as("Projections.tuple 을 쓰는 파일을 %d개 미만 찾았다 — 경로나 정규식이 낡았다", MIN_FILES)
                .isGreaterThanOrEqualTo(MIN_FILES);

        assertThat(missing)
                .as("프로젝션에 없는 컬럼을 읽는다 — QueryDSL 이 예외 대신 null 을 주므로 "
                        + "응답의 그 칸이 조용히 빈다(2026-09-07 배치 시간대에서 실제로 났다)")
                .isEmpty();
    }

    // ── 센다 ──────────────────────────────────────────────────────────

    private static Set<String> projectedColumns(String text, Set<String> aliases) {
        Set<String> out = new LinkedHashSet<>();

        Matcher constant = PROJECTION.matcher(text);
        while (constant.find()) {
            collectMembers(constant.group(1), aliases, out);
        }
        /*
          {@code .select( … )} 의 인자를 <b>괄호 균형으로</b> 떼어 낸다. 정규식으로 끝을 찾으면
          {@code JPAExpressions.select(...)} 같은 중첩에서 잘리고, 잘린 파싱은 오탐을 낸다.

          <b>중첩 하위 질의의 컬럼까지 함께 담긴다.</b> 프로젝션 집합이 넓어지므로 놓치는
          쪽으로 기울지만 <b>오탐은 나지 않는다</b> — 이 검사가 사는 방향이 그쪽이다.
        */
        int at = 0;
        while ((at = text.indexOf(".select(", at)) >= 0) {
            int open = at + ".select(".length() - 1;
            String args = balanced(text, open);
            collectMembers(args, aliases, out);
            at = open + 1;
        }
        return out;
    }

    private static void collectMembers(String fragment, Set<String> aliases, Set<String> into) {
        Matcher member = MEMBER.matcher(fragment);
        while (member.find()) {
            if (aliases.contains(member.group(1))) {
                into.add(member.group(1) + "." + member.group(2));
            }
        }
    }

    /** {@code open} 위치의 {@code (} 와 짝이 맞는 {@code )} 까지의 안쪽 문자열. */
    private static String balanced(String text, int open) {
        int depth = 0;
        for (int i = open; i < text.length(); i += 1) {
            char c = text.charAt(i);
            if (c == '(') {
                depth += 1;
            } else if (c == ')') {
                depth -= 1;
                if (depth == 0) {
                    return text.substring(open + 1, i);
                }
            }
        }
        return text.substring(open + 1);
    }

    private static List<Map.Entry<String, String>> reads(String text, Set<String> aliases) {
        List<Map.Entry<String, String>> out = new ArrayList<>();
        Matcher m = READ.matcher(text);
        while (m.find()) {
            if (aliases.contains(m.group(1))) {
                out.add(Map.entry(m.group(1), m.group(2)));
            }
        }
        return out;
    }

    /** 별칭은 <b>전역으로 모은다</b> — {@code *Spec} 이 선언하고 서비스가 static import 한다. */
    private static Set<String> aliasNames(List<Path> sources) {
        Set<String> out = new LinkedHashSet<>();
        for (Path file : sources) {
            Matcher m = ALIAS.matcher(read(file));
            while (m.find()) {
                out.add(m.group(1));
            }
        }
        return out;
    }

    private static List<Path> javaSources() {
        List<Path> out = new ArrayList<>();
        for (Path root : ROOTS) {
            if (!Files.isDirectory(root)) {
                continue;
            }
            try (Stream<Path> walk = Files.walk(root)) {
                walk.filter(path -> path.toString().endsWith(".java")).forEach(out::add);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return out;
    }

    private static String read(Path file) {
        try {
            return Files.readString(file);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
