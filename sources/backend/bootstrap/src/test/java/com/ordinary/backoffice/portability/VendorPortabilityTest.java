package com.ordinary.backoffice.portability;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;
import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.testcontainers.DockerClientFactory;

/**
 * <b>무수정으로 서고, 걷어내고, 다시 선다</b> — 4벤더. db-portability.md §6 · 48 §7.6 · 68 §11.
 *
 * <p><b>스파이크가 있던 자리다</b>(2026-09-02). {@code spike/db-portability} 는 손으로 만든
 * <b>축소판 changelog</b> 로 식별자 전략과 CLOB 매핑만 봤고, 그 둘은 확인이 끝나 결론이
 * db-portability.md §3.1 · §4.1 과 ADR-0015 로 옮겨졌다. 남은 질문은 전부 <b>실제 스키마와 실제 시드</b>를
 * 요구한다 — 축소판이 초록인 것은 이제 아무것도 뜻하지 않으므로, 그것을 지우고 여기가
 * 물려받는다. 검사가 둘이면 <b>쉬운 쪽이 초록인 것을 보고 안심</b>하게 된다.
 *
 * <h2>한 메서드에 이야기가 하나다</h2>
 *
 * <p>벤더당 컨테이너 하나를 띄우는 값이 비싸 여러 검사가 그것을 나눠 쓰게 되는데, 이
 * 시나리오의 뒷부분은 <b>앞부분이 만든 것을 지운다</b> — 나누면 검사끼리 순서에 매이고,
 * 순서에 매인 검사는 하나가 붉을 때 <b>뒤엣것이 왜 붉은지</b> 를 말하지 못한다. 그래서
 * 순서가 곧 뜻인 한 편으로 쓴다: <b>선다 → 걷어낸다 → 다시 선다</b>.
 *
 * <h2>{@code @Tag("portability")} — 평소의 {@code test} 에서 빠진다</h2>
 *
 * <p>Docker 가 있어야 돌고 벤더당 수십 초가 든다. {@code ./gradlew test} 가 이것을 끌고
 * 가면 <b>개발 머신에서 매번 건너뛰는 검사</b>가 되고, 건너뛰는 검사는 곧 <b>건너뛴 채
 * 초록</b>이 된다 — 그 상태가 이 파일이 막으려는 것과 같은 종류의 거짓이다. 도는 자리는
 * {@code portabilityTest} 태스크와 그것을 부르는 워크플로다.
 *
 * <h2>SQL Server 는 <b>사용 조건에 동의해야</b> 뜬다</h2>
 *
 * <p>{@code src/test/resources/container-license-acceptance.txt} 가 그 동의다 — 이미지
 * 이름 한 줄이며, <b>없으면 컨테이너가 뜨지 않는다</b>. URL 로 컨테이너를 띄우는 길에는
 * {@code acceptLicense()} 를 부를 자리가 없어 <b>파일이 유일한 경로</b>다. 스파이크에도
 * 같은 파일이 있었고, 그것을 함께 지우면 <b>넷 중 하나가 뜨지 않는 검사</b>가 된다.
 *
 * @see <a href="file:../../../../../../../../.github/workflows/db-portability.yml">db-portability.yml</a>
 */
@Tag("portability")
class VendorPortabilityTest {

    /** 스키마의 유일한 출처(db-portability.md §1) — 축소판이 아니라 <b>이것</b>을 태운다. */
    private static final String MASTER = "db/changelog/db.changelog-master.yaml";

    /** 걷어내기 — 48 §7.2. master 에서 900·901 을 빼고 이 한 줄로 바꾸는 그 파일이다. */
    private static final String REMOVAL = "db/changelog/sample/999-sample-remove.yaml";

    /**
     * <b>ESCAPE 가 지키는 것</b> — 48 §7.3.
     *
     * <p>{@code LIKE 'SMPL_%'} 의 밑줄은 와일드카드라 <b>{@code SMPLX} 도 잡는다</b>.
     * 그래서 걷어내기 전에 {@code SMPLX} 넷을 심어 두고 <b>살아남는지</b> 본다 — 접두가
     * 걸리는 칸 넷(시퀀스명 · 메시지 키 · 코드그룹 · 메뉴코드) 하나씩이며,
     * 접두만 세면 이 사고는 보이지 않는다: 지워야 할 것이 다 지워졌기 때문이다.
     *
     * <p><b>이것이 4벤더 질문인 이유</b>는 {@code ESCAPE '/'} 가 벤더마다 같게 도는지를
     * 아무도 확인한 적이 없다는 것이다(48 §8). 역슬래시를 안 쓴 것도 그래서다 — MySQL 은
     * 그것을 문자열 리터럴에서 <b>한 번 더</b> 해석한다(db-portability.md §4).
     */
    private static final List<String> DECOYS = List.of(
            "INSERT INTO SYS_SEQUENCE (SEQ_NAME, NEXT_VAL) VALUES ('SMPLX', 1)",
            "INSERT INTO SYS_MESSAGE_KEY (MSG_KEY, USE_SCOPE) VALUES ('menu.SMPLX', 'DATA')",
            "INSERT INTO SYS_CODE_GROUP (GRP_CD, GRP_NM, SYS_YN, SORT_NO)"
                    + " VALUES ('SMPLX', 'decoy', 'N', 999)",
            "INSERT INTO SYS_MENU (MENU_CD, MENU_NM, SORT_NO, USE_YN, EXPORT_YN, SRC_CD)"
                    + " VALUES ('SMPLX', 'decoy', 999, 'Y', 'N', 'SEED')");

    /** 걷어낸 뒤 <b>한 줄도 남아서는 안 되는 것</b> — 48 §7.4 의 일곱 단계와 같은 목록이다. */
    private static final List<String> RESIDUE = List.of(
            "SELECT count(*) FROM SYS_USER_GRID_PREF   WHERE MENU_CD LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_USER_SEARCH_COND WHERE MENU_CD LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_USER_FAVORITE    WHERE MENU_CD LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_USER_MENU_STAT   WHERE MENU_CD LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_USER_MENU_AUTH   WHERE MENU_CD LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_ROLE_MENU_AUTH   WHERE MENU_CD LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_MENU_API         WHERE MENU_CD LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_MENU             WHERE MENU_CD LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_CODE             WHERE GRP_CD  LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_CODE_GROUP       WHERE GRP_CD  LIKE 'SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_SEQUENCE         WHERE SEQ_NAME LIKE 'SMPL/_%' ESCAPE '/'",
            /*
              <b>접두가 넷이다</b>(48 §7.3) — 화면이 쓰는 둘과 데이터가 만드는 둘. 한 줄에
              OR 로 묶지 않고 넷으로 갈라 두는 것은, 묶으면 <b>어느 접두가 남았는지</b> 를
              실패가 말하지 못하기 때문이다. ⑤를 세우며 겪은 것이 정확히 그 하나였다.
            */
            "SELECT count(*) FROM SYS_MESSAGE     WHERE MSG_KEY LIKE 'sample.%'",
            "SELECT count(*) FROM SYS_MESSAGE     WHERE MSG_KEY LIKE 'err.sample.%'",
            "SELECT count(*) FROM SYS_MESSAGE     WHERE MSG_KEY LIKE 'menu.SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_MESSAGE     WHERE MSG_KEY LIKE 'code.SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_MESSAGE_KEY WHERE MSG_KEY LIKE 'sample.%'",
            "SELECT count(*) FROM SYS_MESSAGE_KEY WHERE MSG_KEY LIKE 'err.sample.%'",
            "SELECT count(*) FROM SYS_MESSAGE_KEY WHERE MSG_KEY LIKE 'menu.SMPL/_%' ESCAPE '/'",
            "SELECT count(*) FROM SYS_MESSAGE_KEY WHERE MSG_KEY LIKE 'code.SMPL/_%' ESCAPE '/'");

    /**
     * 로컬 개발 DB(PostgreSQL · ICU {@code ko-KR} — db-portability.md §6.0)가 낸 순서다.
     *
     * <p><b>그리드 정렬을 서버가 판정하므로</b>(grid-column-contract.md §3) 벤더를 바꾸면 같은 목록이 다른 순서로
     * 나올 수 있고, 그것이 db-portability.md §6 의 마지막 미결이다. 여기서 붉어지는 것은 <b>고장이 아니라
     * 답</b>이다 — 어느 벤더가 어떻게 다른지를 실패 메시지가 그대로 적어 준다.
     *
     * <p>고른 여덟은 샘플 코드그룹의 이름이다. <b>첫 글자가 같은 짝이 둘</b>(주문상태 ·
     * 주문채널 / 우선순위 · 원천시스템) 있어 두세 번째 글자까지 비교가 내려간다.
     */
    private static final List<String> KOREAN_ORDER = List.of(
            "샘플 고객등급",
            "샘플 단위",
            "샘플 우선순위",
            "샘플 원천시스템",
            "샘플 주문상태",
            "샘플 주문채널",
            "샘플 태그유형",
            "샘플 품목상태");

    /**
     * 어느 벤더를 태우나 — {@code -Dportability.vendors=mysql,sqlserver}.
     *
     * <p>기본이 넷인 것은 <b>넷이 요건</b>이기 때문이다(20 §1.3). Oracle 은 이미지가 2GB+ 라
     * 기본에서 빼 두었고, 워크플로의 입력이 그것을 켠다 — 20분 걸리는 확인을 매번 돌리면
     * <b>사람이 워크플로를 안 돌리게</b> 된다.
     */
    static Stream<String> vendors() {
        String requested = System.getProperty(
                "portability.vendors", "postgresql,mysql,mariadb,sqlserver");
        return Arrays.stream(requested.split(","))
                .map(String::trim)
                .filter(vendor -> !vendor.isEmpty());
    }

    @ParameterizedTest(name = "무수정 기동 → 걷어내기 → 다시 기동 · {0}")
    @MethodSource("vendors")
    void standsRemovesAndStandsAgain(String vendor) throws Exception {
        Assumptions.assumeTrue(dockerAvailable(), "Docker 없음 — 4벤더 확인을 건너뛴다");

        String url = url(vendor);

        // ① 선다 — 축소판이 아니라 실제 changelog 전부다.
        apply(url, MASTER);
        try (Connection c = connect(url)) {
            assertSeedLanded(c, vendor);
            reportKoreanOrder(c, vendor);
            for (String decoy : DECOYS) {
                execute(c, decoy);
            }
        }

        // ② 걷어낸다.
        apply(url, REMOVAL);
        try (Connection c = connect(url)) {
            assertNoResidue(c, vendor);
            assertDecoysSurvived(c, vendor);
            assertUnrelatedRowsSurvived(c, vendor);
        }

        /*
          ③ 다시 선다 — 48 §7.6 이 4벤더 CI 에 요구한 것이 이 한 줄이다. <b>남은 FK 하나가
          다음 사람의 기동을 막는다</b>: 걷어내기가 부모를 먼저 지우거나 매핑을 남기면
          여기서 처음 드러난다.

          <b>이것이 "걷어내기가 끝났다" 를 뜻하지는 않는다.</b> 여기서 메뉴·API 시드는
          {@code runOnChange} 로 <b>다시 돌고</b>, 선언 파일에 샘플이 남아 있으면
          {@code SYS_MENU} 의 SMPL_ 행이 되살아난다 — 그것이 48 §7.5 가 소스까지 함께
          걷어내라고 적은 이유이며, 잔여 판정을 ②에서 먼저 하는 이유다. 샘플 테이블은
          되살아나지 않는다(이미 적용된 changeset 은 다시 돌지 않는다 — 48 §7.1).
        */
        apply(url, MASTER);
        try (Connection c = connect(url)) {
            assertThat(count(c, "SELECT count(*) FROM SYS_MENU")).isPositive();
        }
    }

    /**
     * 시드가 실제로 들었는가 — <b>한글이 왕복하는지까지</b>.
     *
     * <p>기동이 초록인데 값이 물음표인 경우가 있다: 드라이버·콜레이션·changelog 의
     * {@code encoding: UTF-8} 셋 중 하나만 어긋나도 그렇게 되며, 그때 화면은 <b>메뉴 이름이
     * 깨진 채</b> 뜬다. 문자열 하나를 견주는 것이 그 셋을 한 번에 잰다.
     */
    private static void assertSeedLanded(Connection c, String vendor) throws SQLException {
        assertThat(count(c, "SELECT count(*) FROM SMPL_ORDER"))
                .as("%s — 샘플 주문 여섯(901)", vendor)
                .isEqualTo(6);
        assertThat(count(c, "SELECT count(*) FROM SYS_MENU WHERE MENU_CD LIKE 'SMPL/_%' ESCAPE '/'"))
                .as("%s — 샘플 메뉴(생성 시드)", vendor)
                .isPositive();

        String menuName = single(c,
                "SELECT MSG_VAL FROM SYS_MESSAGE WHERE MSG_KEY = 'menu.SMPL_EXCEL' AND LANG_CD = 'ko'");
        assertThat(menuName).as("%s — 한글 왕복", vendor).isEqualTo("엑셀 업로드");
    }

    /** db-portability.md §6 의 마지막 미결 — 벤더가 다르면 실패 메시지가 <b>어떻게 다른지</b> 를 적는다. */
    private static void reportKoreanOrder(Connection c, String vendor) throws SQLException {
        List<String> ordered = column(c,
                "SELECT GRP_NM FROM SYS_CODE_GROUP WHERE GRP_CD LIKE 'SMPL/_%' ESCAPE '/'"
                        + " ORDER BY GRP_NM");

        // 진단이 먼저다 — 아래가 붉을 때 읽을 것이 로그에 남아 있어야 한다.
        System.out.printf("[정렬] %s / 한글 순서 = %s%n", vendor, ordered);

        assertThat(ordered)
                .as("%s — 한글 정렬이 로컬(ICU ko-KR)과 같은가. 다르면 그것이 db-portability.md §6 의 답이다", vendor)
                .containsExactlyElementsOf(KOREAN_ORDER);
    }

    private static void assertNoResidue(Connection c, String vendor) throws SQLException {
        for (String query : RESIDUE) {
            assertThat(count(c, query)).as("%s — %s", vendor, query).isZero();
        }

        List<String> left = new ArrayList<>();
        DatabaseMetaData meta = c.getMetaData();
        try (ResultSet rs = meta.getTables(null, null, "%", new String[] {"TABLE"})) {
            while (rs.next()) {
                String name = rs.getString("TABLE_NAME").toUpperCase(java.util.Locale.ROOT);
                if (name.startsWith("SMPL")) {
                    left.add(name);
                }
            }
        }
        assertThat(left).as("%s — 샘플 테이블", vendor).isEmpty();
    }

    /** {@code SMPLX} 는 샘플이 아니다 — ESCAPE 가 없으면 함께 지워진다(48 §7.3). */
    private static void assertDecoysSurvived(Connection c, String vendor) throws SQLException {
        assertThat(count(c, "SELECT count(*) FROM SYS_SEQUENCE WHERE SEQ_NAME = 'SMPLX'"))
                .as("%s — ESCAPE 없으면 SMPLX 가 SMPL_%% 에 걸린다(SEQ_NAME)", vendor)
                .isEqualTo(1);
        assertThat(count(c, "SELECT count(*) FROM SYS_MESSAGE_KEY WHERE MSG_KEY = 'menu.SMPLX'"))
                .as("%s — 〃 (MSG_KEY)", vendor)
                .isEqualTo(1);
        assertThat(count(c, "SELECT count(*) FROM SYS_CODE_GROUP WHERE GRP_CD = 'SMPLX'"))
                .as("%s — 〃 (GRP_CD)", vendor)
                .isEqualTo(1);
        assertThat(count(c, "SELECT count(*) FROM SYS_MENU WHERE MENU_CD = 'SMPLX'"))
                .as("%s — 〃 (MENU_CD)", vendor)
                .isEqualTo(1);
    }

    /**
     * <b>지나치게 지우지 않았는가.</b> 접두가 아무것도 안 잡는 것과 전부를 잡는 것은 둘 다
     * 초록인 잔여 검사를 만든다 — 남아야 하는 쪽을 함께 세지 않으면 그 둘이 구별되지 않는다.
     */
    private static void assertUnrelatedRowsSurvived(Connection c, String vendor) throws SQLException {
        assertThat(count(c, "SELECT count(*) FROM SYS_MESSAGE_KEY WHERE MSG_KEY LIKE 'grid.%'"))
                .as("%s — 화면 공용 문구는 샘플이 아니다", vendor)
                .isPositive();
        assertThat(count(c, "SELECT count(*) FROM SYS_MENU WHERE MENU_CD = 'SYSTEM'"))
                .as("%s — 시스템 노드", vendor)
                .isEqualTo(1);
        assertThat(count(c, "SELECT count(*) FROM SYS_USER"))
                .as("%s — 계정", vendor)
                .isPositive();
    }

    // ── Liquibase · JDBC ────────────────────────────────────────────────

    /**
     * <b>연결을 매번 새로 딴다.</b> Liquibase 가 {@code JdbcConnection} 을 닫으면 그 아래
     * 연결도 닫히므로 하나를 돌려 쓸 수 없고, 그래서 URL 에 {@code TC_DAEMON=true} 가 있다 —
     * 없으면 마지막 연결이 닫힐 때 <b>컨테이너가 함께 내려가</b> 다음 단계가 새 DB 를 본다.
     */
    private static void apply(String url, String changelog) {
        try (Connection connection = connect(url)) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (Liquibase liquibase =
                    new Liquibase(changelog, new ClassLoaderResourceAccessor(), database)) {
                liquibase.update(new Contexts(), new LabelExpression());
            }
        } catch (Exception failure) {
            throw new IllegalStateException("changelog 적용 실패: " + changelog, failure);
        }
    }

    private static Connection connect(String url) throws SQLException {
        return DriverManager.getConnection(url);
    }

    /**
     * {@code jdbc:tc:} — Testcontainers 의 JDBC 드라이버가 컨테이너를 띄운다.
     *
     * <p>벤더 모듈이 클래스패스에 있어야 URL 이 해석된다. 없으면 컨테이너를 띄우기도 전에
     * <i>"Database name … not supported"</i> 로 죽는데, 그 문장은 <b>Docker 문제로 오해하기
     * 쉽다</b>(스파이크가 그것을 겪고 적어 두었다).
     */
    private static String url(String vendor) {
        return switch (vendor) {
            case "postgresql" -> "jdbc:tc:postgresql:16-alpine:///bo?TC_DAEMON=true";
            case "mysql" -> "jdbc:tc:mysql:8.4:///bo?TC_DAEMON=true";
            case "mariadb" -> "jdbc:tc:mariadb:11.4:///bo?TC_DAEMON=true";
            case "sqlserver" -> "jdbc:tc:sqlserver:2022-latest:///bo?TC_DAEMON=true";
            /*
              <b>확인된 적 없다.</b> 스파이크도 이미지 크기(2GB+) 때문에 Oracle 을 빼고
              돌렸으므로(db-portability.md §6) 이 한 줄은 <b>처음 켜는 사람이 고칠 수도 있다</b> —
              {@code oracle} 이라는 타입 이름이 {@code oracle-free} 모듈에 그대로 붙는지가
              그 자리다. 넷과 함께 기본으로 켜 두지 않는 것이 그 사실을 감추지 않는 길이다.
            */
            case "oracle" -> "jdbc:tc:oracle:slim-faststart:///bo?TC_DAEMON=true";
            default -> throw new IllegalArgumentException("모르는 벤더: " + vendor);
        };
    }

    private static boolean dockerAvailable() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (RuntimeException unavailable) {
            return false;
        }
    }

    private static void execute(Connection c, String sql) throws SQLException {
        try (Statement statement = c.createStatement()) {
            statement.executeUpdate(sql);
        }
    }

    private static long count(Connection c, String query) throws SQLException {
        try (Statement statement = c.createStatement();
                ResultSet rs = statement.executeQuery(query)) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private static String single(Connection c, String query) throws SQLException {
        List<String> values = column(c, query);
        assertThat(values).as("한 줄이어야 한다: %s", query).hasSize(1);
        return values.get(0);
    }

    private static List<String> column(Connection c, String query) throws SQLException {
        List<String> values = new ArrayList<>();
        try (Statement statement = c.createStatement();
                ResultSet rs = statement.executeQuery(query)) {
            while (rs.next()) {
                values.add(rs.getString(1));
            }
        }
        return values;
    }
}
